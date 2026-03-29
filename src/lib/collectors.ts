import { getDb } from "./db";
import * as taostats from "./taostats";
import * as github from "./github";
import * as hf from "./huggingface";
import { insertSignal, detectFlowInflections, detectDevSpikes } from "./signals";
import { analyzePendingSignals } from "./analyzer";
import { storeTwitterHandles, collectSocial, seedInfluencerAccounts } from "./social";
import { collectStakingData } from "./staking-collector";
import { collectRevenueData } from "./revenue-collector";

const RAO = 1e9; // 1 TAO = 1e9 rao

// ── TaoStats Collector ───────────────────────────────────────────
export async function collectTaoStats(): Promise<{
  subnets: number;
  metrics: number;
  signals: number;
}> {
  const db = getDb();
  let subnetCount = 0;
  let metricsCount = 0;
  let signalCount = 0;
  let poolMap = new Map<number, taostats.SubnetPool>();

  // 1. Fetch subnet identities and upsert
  try {
    const identities = await taostats.getSubnetIdentities();
    const upsertSubnet = db.prepare(`
      INSERT INTO subnets (netuid, name, description, github_url, owner_address, image_url, discord, website, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
      ON CONFLICT(netuid) DO UPDATE SET
        name = excluded.name,
        description = excluded.description,
        github_url = excluded.github_url,
        image_url = excluded.image_url,
        discord = excluded.discord,
        website = excluded.website,
        updated_at = datetime('now')
    `);

    for (const id of identities) {
      upsertSubnet.run(
        id.netuid,
        id.subnet_name,
        id.description || id.summary || null,
        id.github_repo || null,
        null,
        id.logo_url || null,
        id.discord || null,
        id.subnet_url || null
      );
      subnetCount++;
    }

    // Store Twitter handles from subnet identities
    storeTwitterHandles(identities as Array<{ netuid: number; subnet_name: string; twitter: string | null }>);
    seedInfluencerAccounts();
  } catch (e) {
    console.error("Failed to fetch subnet identities:", e);
  }

  // 2. Fetch flows, pools, emissions and TAO price, then merge into metrics
  try {
    // Parallel fetch to save time on Vercel
    const [flows, pools, emissions, taoUsdPrice] = await Promise.all([
      taostats.getTaoFlows(),
      taostats.getSubnetPools(),
      taostats.getSubnetEmissions(),
      taostats.getTaoPrice(),
    ]);

    console.log(`TAO/USD price: $${taoUsdPrice.toFixed(2)}`);

    const timestamp = new Date().toISOString().slice(0, 19).replace("T", " ");

    const flowMap = new Map(flows.map((f) => [f.netuid, f]));
    poolMap = new Map(pools.map((p) => [p.netuid, p]));
    const emissionMap = new Map(emissions.map((e) => [e.netuid, e]));

    const allNetuids = new Set([
      ...flowMap.keys(),
      ...poolMap.keys(),
      ...emissionMap.keys(),
    ]);

    const insertMetric = db.prepare(`
      INSERT OR IGNORE INTO subnet_metrics
        (netuid, timestamp, net_flow_24h, net_flow_7d, net_flow_30d,
         emission_rate, emission_pct, alpha_reserve, tao_reserve,
         alpha_price, market_cap, volume_24h, price_change_24h)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    for (const netuid of allNetuids) {
      const flow = flowMap.get(netuid);
      const pool = poolMap.get(netuid);
      const emission = emissionMap.get(netuid);

      // EMA flow from rao to TAO (long-term trend)
      const flowEma = flow ? flow.tao_flow / RAO : null;
      // Actual 24h net flow from buy/sell volume (short-term reality)
      const netFlow24h = pool
        ? (parseFloat(pool.tao_buy_volume_24_hr || "0") - parseFloat(pool.tao_sell_volume_24_hr || "0")) / RAO
        : null;

      // price field = alpha price in TAO, multiply by TAO/USD for USD price
      const alphaPriceUsd = pool ? parseFloat(pool.price) * taoUsdPrice : null;
      // market_cap field is in rao, convert to TAO then to USD
      const marketCapUsd = pool ? (parseFloat(pool.market_cap) / RAO) * taoUsdPrice : null;
      // volume in rao, convert to TAO then USD
      const volumeUsd = pool ? (parseFloat(pool.tao_volume_24_hr) / RAO) * taoUsdPrice : null;
      const alphaReserve = pool ? parseFloat(pool.alpha_in_pool) / RAO : null;
      const taoReserve = pool ? parseFloat(pool.total_tao) / RAO : null;
      const priceChange24h = pool?.price_change_1_day ? parseFloat(pool.price_change_1_day) : null;

      insertMetric.run(
        netuid,
        timestamp,
        netFlow24h,  // real 24h net flow (buys - sells)
        flowEma,     // EMA flow (long-term trend) stored in 7d slot
        null,        // net_flow_30d
        emission ? parseFloat(emission.alpha_rewards) / RAO : null,
        null,      // emission_pct - will compute from totals
        alphaReserve,
        taoReserve,
        alphaPriceUsd,
        marketCapUsd,
        volumeUsd,
        priceChange24h
      );
      metricsCount++;
    }
  } catch (e) {
    console.error("Failed to fetch metrics:", e);
  }

  // 3. Detect flow-based signals
  try {
    const flowSignals = detectFlowInflections();
    for (const sig of flowSignals) {
      insertSignal(sig);
      signalCount++;
    }
  } catch (e) {
    console.error("Failed to detect flow signals:", e);
  }

  // 4. Generate signals from pool data — big movers, volume spikes
  try {
    const pools = poolMap || new Map();
    for (const [netuid, pool] of pools) {
      if (netuid === 0) continue;
      const priceChange = pool.price_change_1_day ? parseFloat(pool.price_change_1_day) : 0;
      const priceChange1w = pool.price_change_1_week ? parseFloat(pool.price_change_1_week) : 0;

      // Big daily mover (>10% up or down)
      if (Math.abs(priceChange) > 10) {
        const direction = priceChange > 0 ? "surged" : "dropped";
        const strength = Math.min(90, 40 + Math.abs(priceChange));
        insertSignal({
          netuid,
          signal_type: priceChange > 0 ? "price_surge" : "price_drop",
          strength,
          title: `Price ${direction} ${priceChange > 0 ? "+" : ""}${priceChange.toFixed(1)}% in 24h`,
          description: `${pool.name || `SN${netuid}`} alpha token ${direction} ${Math.abs(priceChange).toFixed(1)}% in the last 24 hours. Weekly change: ${priceChange1w > 0 ? "+" : ""}${priceChange1w.toFixed(1)}%. Buys: ${pool.buys_24_hr}, Sells: ${pool.sells_24_hr}.`,
          source: "taostats",
        });
        signalCount++;
      }

      // Volume-based buy/sell pressure (uses TAO volume, not tx count)
      const buyVol = parseFloat(pool.tao_buy_volume_24_hr || "0") / RAO;
      const sellVol = parseFloat(pool.tao_sell_volume_24_hr || "0") / RAO;
      const totalVol = buyVol + sellVol;
      if (totalVol > 100) { // minimum 100 TAO volume
        const volRatio = buyVol / Math.max(sellVol, 1);
        if (volRatio > 1.5 && priceChange > 0) {
          // Buy volume dominates AND price is up — real buy pressure
          insertSignal({
            netuid,
            signal_type: "buy_pressure",
            strength: Math.min(80, 40 + volRatio * 10),
            title: `Buy pressure: ${buyVol.toFixed(0)}τ bought vs ${sellVol.toFixed(0)}τ sold`,
            description: `${volRatio.toFixed(1)}x buy/sell volume ratio on ${pool.name || `SN${netuid}`}. ${pool.buyers_24_hr} unique buyers, ${pool.sellers_24_hr} sellers. Price ${priceChange > 0 ? "+" : ""}${priceChange.toFixed(1)}%.`,
            source: "taostats",
          });
          signalCount++;
        } else if (volRatio < 0.67 && priceChange < 0) {
          // Sell volume dominates AND price is down — real sell pressure
          insertSignal({
            netuid,
            signal_type: "sell_pressure",
            strength: Math.min(70, 30 + (1/volRatio) * 10),
            title: `Sell pressure: ${sellVol.toFixed(0)}τ sold vs ${buyVol.toFixed(0)}τ bought`,
            description: `${(1/volRatio).toFixed(1)}x sell/buy volume ratio on ${pool.name || `SN${netuid}`}. ${pool.sellers_24_hr} unique sellers, ${pool.buyers_24_hr} buyers. Price ${priceChange.toFixed(1)}%.`,
            source: "taostats",
          });
          signalCount++;
        }
      }
    }
  } catch (e) {
    console.error("Failed to detect pool signals:", e);
  }

  return { subnets: subnetCount, metrics: metricsCount, signals: signalCount };
}

// ── GitHub Collector ─────────────────────────────────────────────
export async function collectGitHub(): Promise<{
  repos: number;
  events: number;
  signals: number;
}> {
  const db = getDb();
  let repoCount = 0;
  let eventCount = 0;
  let signalCount = 0;

  // 1. Build repo registry from subnets table GitHub URLs
  const subnetsWithGithub = db
    .prepare("SELECT netuid, github_url FROM subnets WHERE github_url IS NOT NULL AND github_url != ''")
    .all() as Array<{ netuid: number; github_url: string }>;

  const upsertRepo = db.prepare(`
    INSERT INTO github_repos (netuid, org, repo, full_name)
    VALUES (?, ?, ?, ?)
    ON CONFLICT(full_name) DO UPDATE SET netuid = excluded.netuid
  `);

  for (const s of subnetsWithGithub) {
    let fullName = s.github_url;
    if (fullName.includes("github.com/")) {
      fullName = fullName.split("github.com/")[1];
    }
    fullName = fullName.replace(/^\/|\/$/g, "").replace(/\.git$/, "");

    const parts = fullName.split("/");
    if (parts.length >= 2) {
      upsertRepo.run(s.netuid, parts[0], parts[1], `${parts[0]}/${parts[1]}`);
      repoCount++;
    }
  }

  // 2. Also pull dev activity from TaoStats (much more efficient than polling GitHub directly)
  try {
    await new Promise(r => setTimeout(r, 2000)); // delay to avoid TaoStats 429
    const devActivity = await taostats.getGithubActivity();
    const insertEvent = db.prepare(`
      INSERT OR IGNORE INTO github_events
        (netuid, repo, event_type, event_id, title, description, url, author, created_at, significance)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    for (const act of devActivity) {
      // Extract repo name from URL
      let repoName = act.repo_url;
      if (repoName.includes("github.com/")) {
        repoName = repoName.split("github.com/")[1];
      }
      repoName = repoName.replace(/^\/|\/$/g, "");

      // Create a synthetic event from the activity data
      const eventId = `taostats-${act.netuid}-${act.as_of_day}`;
      const significance = Math.min(
        100,
        act.commits_1d * 3 + act.prs_merged_1d * 20 + act.reviews_1d * 5
      );

      if (significance > 5) {
        insertEvent.run(
          act.netuid,
          repoName,
          "DevActivity",
          eventId,
          `${act.commits_1d} commits, ${act.prs_merged_1d} PRs merged (${act.unique_contributors_1d} contributors)`,
          `7d: ${act.commits_7d} commits, ${act.prs_merged_7d} PRs. 30d: ${act.commits_30d} commits, ${act.unique_contributors_30d} contributors.`,
          act.repo_url,
          `${act.unique_contributors_1d} contributors`,
          act.last_event_at || act.as_of_day,
          significance
        );
        eventCount++;
      }

      // Generate signal for hot repos
      if (act.commits_1d > 5 || act.prs_merged_1d > 1) {
        const strength = Math.min(90, 30 + act.commits_1d * 2 + act.prs_merged_1d * 10);
        insertSignal({
          netuid: act.netuid,
          signal_type: "dev_spike",
          strength,
          title: `Hot dev activity: ${act.commits_1d} commits, ${act.prs_merged_1d} PRs in 24h`,
          description: `${repoName} — ${act.unique_contributors_1d} active contributors. 7d trend: ${act.commits_7d} commits.`,
          source: "github",
          source_url: act.repo_url,
        });
        signalCount++;
      }
    }
  } catch (e) {
    console.error("Failed to fetch TaoStats dev activity:", e);
  }

  // 3. Also poll GitHub directly for repos we track (for real-time events)
  const repos = db
    .prepare("SELECT * FROM github_repos") // poll all repos (ETags make this efficient)
    .all() as Array<{
    id: number;
    netuid: number;
    org: string;
    repo: string;
    full_name: string;
    etag: string | null;
  }>;

  const insertGHEvent = db.prepare(`
    INSERT OR IGNORE INTO github_events
      (netuid, repo, event_type, event_id, title, description, url, author, created_at, significance)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const updateEtag = db.prepare(
    "UPDATE github_repos SET etag = ?, last_checked_at = datetime('now') WHERE id = ?"
  );

  for (const repo of repos) {
    try {
      const result = await github.getRepoEvents(repo.org, repo.repo, repo.etag || undefined);

      if (result.notModified) continue;

      if (result.etag) {
        updateEtag.run(result.etag, repo.id);
      }

      for (const event of result.events) {
        const parsed = github.parseEvent(event);
        if (parsed.significance < 10) continue;

        insertGHEvent.run(
          repo.netuid,
          repo.full_name,
          event.type,
          event.id,
          parsed.title,
          parsed.description,
          parsed.url,
          event.actor.login,
          event.created_at,
          parsed.significance
        );
        eventCount++;
      }

      await new Promise((r) => setTimeout(r, 100));
    } catch (e) {
      console.error(`Failed to fetch events for ${repo.full_name}:`, e);
    }
  }

  // 4. Detect dev spikes from stored events
  try {
    const devSignals = detectDevSpikes();
    for (const sig of devSignals) {
      insertSignal(sig);
      signalCount++;
    }
  } catch (e) {
    console.error("Failed to detect dev signals:", e);
  }

  return { repos: repoCount, events: eventCount, signals: signalCount };
}

// ── HuggingFace Collector ────────────────────────────────────────
export async function collectHuggingFace(): Promise<{
  orgs: number;
  items: number;
  signals: number;
}> {
  const db = getDb();
  let orgCount = 0;
  let itemCount = 0;
  let signalCount = 0;

  // 1. Auto-discover HF orgs from GitHub org names + bittensor search
  try {
    const discovered = await hf.discoverHFOrgs();
    orgCount += discovered;
  } catch (e) {
    console.error("HF discovery error:", e);
  }

  // Count total orgs
  const totalOrgs = db.prepare("SELECT COUNT(*) as cnt FROM hf_orgs").get() as { cnt: number };
  orgCount = totalOrgs.cnt;

  const insertItem = db.prepare(`
    INSERT INTO huggingface_items
      (netuid, org, item_type, item_id, name, description, url, downloads, likes, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(item_id) DO UPDATE SET
      downloads = excluded.downloads,
      likes = excluded.likes,
      updated_at = excluded.updated_at
  `);

  const orgItems = await hf.fetchAllOrgItems();

  for (const oi of orgItems) {
    const processItems = (items: hf.HFItem[], type: string) => {
      for (const item of items) {
        const itemId = `${type}:${item.id}`;
        const urlPrefix = type === "model" ? "" : type + "s/";
        insertItem.run(
          oi.netuid || null,
          oi.org,
          type,
          itemId,
          item.id,
          null,
          `https://huggingface.co/${urlPrefix}${item.id}`,
          item.downloads || 0,
          item.likes || 0,
          item.createdAt || item.lastModified,
          item.lastModified
        );
        itemCount++;
      }
    };

    processItems(oi.models, "model");
    processItems(oi.datasets, "dataset");
    processItems(oi.spaces, "space");
  }

  // Detect new HF items
  const newItems = db
    .prepare(
      `SELECT * FROM huggingface_items
       WHERE detected_at > datetime('now', '-1 hour')
       AND created_at > datetime('now', '-7 days')`
    )
    .all() as Array<{
    netuid: number;
    org: string;
    item_type: string;
    name: string;
    url: string;
    downloads: number;
  }>;

  for (const item of newItems) {
    if (item.netuid) {
      insertSignal({
        netuid: item.netuid,
        signal_type: "hf_drop",
        strength: item.item_type === "model" ? 70 : item.item_type === "dataset" ? 60 : 50,
        title: `New ${item.item_type}: ${item.name}`,
        description: `${item.org} published a new ${item.item_type} on HuggingFace. ${item.downloads > 0 ? `Already ${item.downloads} downloads.` : ""}`,
        source: "huggingface",
        source_url: item.url,
      });
      signalCount++;
    }
  }

  return { orgs: orgCount, items: itemCount, signals: signalCount };
}

// ── Fast collector for Vercel (fits in 60s) ─────────────────────
// Skips direct GitHub repo polling and heavy metagraph calls.
// Uses TaoStats dev_activity for GitHub data instead.
export async function collectAllFast() {
  const db = getDb();
  const startTime = Date.now();
  const results: Record<string, unknown> = {};

  // 1. TaoStats (subnets, flows, pools, emissions, signals) ~8s
  try {
    const tao = await collectTaoStats();
    results.taostats = tao;
  } catch (e) {
    results.taostats = { error: String(e) };
  }

  // 2. GitHub — ONLY TaoStats dev_activity (skip direct repo polling) ~3s
  try {
    const gh = await collectGitHubFast();
    results.github = gh;
  } catch (e) {
    results.github = { error: String(e) };
  }

  // 3. HuggingFace — skip org discovery on Vercel (too slow), just fetch items for known orgs
  try {
    // Seed the orgs from seed list without discovery
    const hfDb = getDb();
    const SEED_ORGS = [
      "bittensor", "opentensor", "macrocosm-os", "SocialTensor", "bitmind-ai",
      "tenstorrent", "MyShell-TTS", "NousResearch", "targon-hubai", "manifold-inc",
      "TensorAlchemy", "corcel-api", "omega-labs-ai", "datura-mining", "fractal-inc",
    ];
    const upsertOrg = hfDb.prepare("INSERT OR IGNORE INTO hf_orgs (netuid, org_name) VALUES (?, ?)");
    for (const org of SEED_ORGS) upsertOrg.run(null, org);

    const hfResult = await collectHuggingFaceItems();
    results.huggingface = hfResult;
  } catch (e) {
    results.huggingface = { error: String(e) };
  }

  // 4. Check time budget — skip optional collectors if running low
  const elapsed = Date.now() - startTime;
  const timeLeft = 50000 - elapsed; // 50s hard limit (leave 10s buffer)

  if (timeLeft > 15000) {
    // 4a. Social (Desearch + Reddit) ~8s
    try {
      const social = await collectSocial();
      results.social = social;
    } catch (e) {
      results.social = { error: String(e) };
    }
  } else {
    results.social = { skipped: "time budget exceeded" };
  }

  const elapsed2 = Date.now() - startTime;
  const timeLeft2 = 50000 - elapsed2;

  if (timeLeft2 > 8000) {
    // 4b. Staking — LIGHT version ~5s
    try {
      const staking = await collectStakingData();
      results.staking = staking;
    } catch (e) {
      results.staking = { error: String(e) };
    }
  } else {
    results.staking = { skipped: "time budget exceeded" };
  }

  const elapsed3 = Date.now() - startTime;
  const timeLeft3 = 50000 - elapsed3;

  if (timeLeft3 > 8000) {
    // 4c. Revenue ~5s
    try {
      const revenue = await collectRevenueData();
      results.revenue = revenue;
    } catch (e) {
      results.revenue = { error: String(e) };
    }
  } else {
    results.revenue = { skipped: "time budget exceeded" };
  }

  // 5. AI Analysis — only if we have >10s left, limit to 3 signals
  const elapsed4 = Date.now() - startTime;
  const timeLeft4 = 55000 - elapsed4;

  if (timeLeft4 > 10000) {
    try {
      const analyzed = await analyzePendingSignals(3);
      results.analyzer = { analyzed };
    } catch (e) {
      results.analyzer = { error: String(e) };
    }
  } else {
    results.analyzer = { skipped: "time budget exceeded" };
  }

  return {
    duration_ms: Date.now() - startTime,
    results,
  };
}

// ── HuggingFace Items Only (skip discovery) ──────────────────────
async function collectHuggingFaceItems(): Promise<{ orgs: number; items: number; signals: number }> {
  const db = getDb();
  let itemCount = 0;
  let signalCount = 0;

  const insertItem = db.prepare(`
    INSERT INTO huggingface_items
      (netuid, org, item_type, item_id, name, description, url, downloads, likes, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(item_id) DO UPDATE SET
      downloads = excluded.downloads,
      likes = excluded.likes,
      updated_at = excluded.updated_at
  `);

  const orgItems = await hf.fetchAllOrgItems();
  for (const oi of orgItems) {
    const processItems = (items: hf.HFItem[], type: string) => {
      for (const item of items) {
        const itemId = `${type}:${item.id}`;
        const urlPrefix = type === "model" ? "" : type + "s/";
        insertItem.run(
          oi.netuid || null, oi.org, type, itemId, item.id, null,
          `https://huggingface.co/${urlPrefix}${item.id}`,
          item.downloads || 0, item.likes || 0,
          item.createdAt || item.lastModified, item.lastModified
        );
        itemCount++;
      }
    };
    processItems(oi.models, "model");
    processItems(oi.datasets, "dataset");
    processItems(oi.spaces, "space");
  }

  return { orgs: orgItems.length, items: itemCount, signals: signalCount };
}

// ── GitHub Fast (TaoStats dev_activity only, no direct polling) ──
async function collectGitHubFast(): Promise<{ repos: number; events: number; signals: number }> {
  const db = getDb();
  let repoCount = 0;
  let eventCount = 0;
  let signalCount = 0;

  // Build repo registry from subnets table
  const subnetsWithGithub = db
    .prepare("SELECT netuid, github_url FROM subnets WHERE github_url IS NOT NULL AND github_url != ''")
    .all() as Array<{ netuid: number; github_url: string }>;

  const upsertRepo = db.prepare(`
    INSERT INTO github_repos (netuid, org, repo, full_name)
    VALUES (?, ?, ?, ?)
    ON CONFLICT(full_name) DO UPDATE SET netuid = excluded.netuid
  `);

  for (const s of subnetsWithGithub) {
    let fullName = s.github_url;
    if (fullName.includes("github.com/")) fullName = fullName.split("github.com/")[1];
    fullName = fullName.replace(/^\/|\/$/g, "").replace(/\.git$/, "");
    const parts = fullName.split("/");
    if (parts.length >= 2) {
      upsertRepo.run(s.netuid, parts[0], parts[1], `${parts[0]}/${parts[1]}`);
      repoCount++;
    }
  }

  // Use TaoStats dev_activity (much faster than polling 100+ repos)
  try {
    await new Promise(r => setTimeout(r, 300));
    const devActivity = await taostats.getGithubActivity();
    const insertEvent = db.prepare(`
      INSERT OR IGNORE INTO github_events
        (netuid, repo, event_type, event_id, title, description, url, author, created_at, significance)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    for (const act of devActivity) {
      let repoName = act.repo_url;
      if (repoName.includes("github.com/")) repoName = repoName.split("github.com/")[1];
      repoName = repoName.replace(/^\/|\/$/g, "");

      const eventId = `taostats-${act.netuid}-${act.as_of_day}`;
      const significance = Math.min(100, act.commits_1d * 3 + act.prs_merged_1d * 20 + act.reviews_1d * 5);

      if (significance > 5) {
        insertEvent.run(act.netuid, repoName, "DevActivity", eventId,
          `${act.commits_1d} commits, ${act.prs_merged_1d} PRs merged (${act.unique_contributors_1d} contributors)`,
          `7d: ${act.commits_7d} commits, ${act.prs_merged_7d} PRs. 30d: ${act.commits_30d} commits, ${act.unique_contributors_30d} contributors.`,
          act.repo_url, `${act.unique_contributors_1d} contributors`, act.last_event_at || act.as_of_day, significance
        );
        eventCount++;
      }

      if (act.commits_1d > 5 || act.prs_merged_1d > 1) {
        insertSignal({
          netuid: act.netuid, signal_type: "dev_spike",
          strength: Math.min(90, 30 + act.commits_1d * 2 + act.prs_merged_1d * 10),
          title: `Hot dev activity: ${act.commits_1d} commits, ${act.prs_merged_1d} PRs in 24h`,
          description: `${repoName} — ${act.unique_contributors_1d} active contributors. 7d trend: ${act.commits_7d} commits.`,
          source: "github", source_url: act.repo_url,
        });
        signalCount++;
      }
    }
  } catch (e) {
    console.error("Failed to fetch TaoStats dev activity:", e);
  }

  // Detect dev spikes
  try {
    const devSignals = detectDevSpikes();
    for (const sig of devSignals) { insertSignal(sig); signalCount++; }
  } catch (e) {
    console.error("Failed to detect dev signals:", e);
  }

  return { repos: repoCount, events: eventCount, signals: signalCount };
}

// ── Run all collectors (full version for local dev) ──────────────
export async function collectAll() {
  const db = getDb();
  const startTime = Date.now();

  const logRun = db.prepare(`
    INSERT INTO collector_runs (collector, status, items_collected, error, completed_at)
    VALUES (?, ?, ?, ?, datetime('now'))
  `);

  const results: Record<string, unknown> = {};

  try {
    const tao = await collectTaoStats();
    logRun.run("taostats", "success", tao.subnets + tao.metrics, null);
    results.taostats = tao;
  } catch (e) {
    logRun.run("taostats", "error", 0, String(e));
    results.taostats = { error: String(e) };
  }

  try {
    const gh = await collectGitHub();
    logRun.run("github", "success", gh.events, null);
    results.github = gh;
  } catch (e) {
    logRun.run("github", "error", 0, String(e));
    results.github = { error: String(e) };
  }

  try {
    const hfResult = await collectHuggingFace();
    logRun.run("huggingface", "success", hfResult.items, null);
    results.huggingface = hfResult;
  } catch (e) {
    logRun.run("huggingface", "error", 0, String(e));
    results.huggingface = { error: String(e) };
  }

  // 4. Scan social media (Reddit + Twitter)
  try {
    const social = await collectSocial();
    logRun.run("social", "success", social.redditPosts + social.twitterPosts, null);
    results.social = social;
  } catch (e) {
    logRun.run("social", "error", 0, String(e));
    results.social = { error: String(e) };
  }

  // 5. Collect staking/validator data
  try {
    const staking = await collectStakingData();
    logRun.run("staking", "success", staking.subnets, null);
    results.staking = staking;
  } catch (e) {
    logRun.run("staking", "error", 0, String(e));
    results.staking = { error: String(e) };
  }

  // 6. Collect revenue/sustainability data
  try {
    const revenue = await collectRevenueData();
    logRun.run("revenue", "success", revenue.subnets, null);
    results.revenue = revenue;
  } catch (e) {
    logRun.run("revenue", "error", 0, String(e));
    results.revenue = { error: String(e) };
  }

  // 7. Run AI analysis on new signals
  try {
    const analyzed = await analyzePendingSignals();
    logRun.run("analyzer", "success", analyzed, null);
    results.analyzer = { analyzed };
  } catch (e) {
    logRun.run("analyzer", "error", 0, String(e));
    results.analyzer = { error: String(e) };
  }

  return {
    duration_ms: Date.now() - startTime,
    results,
  };
}
