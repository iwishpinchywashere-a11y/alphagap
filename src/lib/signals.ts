import { getDb } from "./db";

export interface Signal {
  id?: number;
  netuid: number;
  signal_type: string;
  strength: number;
  title: string;
  description: string;
  source: string;
  source_url?: string;
  metadata?: string;
  analysis?: string;
  analysis_status?: string;
  created_at?: string;
  subnet_name?: string;
}

export interface SubnetScore {
  netuid: number;
  name: string;
  composite_score: number;
  flow_score: number;
  dev_score: number;
  hf_score: number;
  staking_score: number;
  revenue_score: number;
  social_score: number;
  signal_count: number;
  top_signal?: string;
  alpha_price?: number;
  market_cap?: number;
  net_flow_24h?: number;
  emission_pct?: number;
  price_change_24h?: number;
}

// ── Insert signal ────────────────────────────────────────────────
export function insertSignal(signal: Signal): number {
  const db = getDb();

  // Dedup: skip if same netuid + signal_type + title exists in last 24h
  const existing = db.prepare(
    `SELECT id FROM signals
     WHERE netuid = ? AND signal_type = ? AND title = ?
     AND created_at > datetime('now', '-24 hours')
     LIMIT 1`
  ).get(signal.netuid, signal.signal_type, signal.title);

  if (existing) return (existing as { id: number }).id;

  const stmt = db.prepare(`
    INSERT INTO signals (netuid, signal_type, strength, title, description, source, source_url, metadata)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);
  const result = stmt.run(
    signal.netuid,
    signal.signal_type,
    Math.round(signal.strength),
    signal.title,
    signal.description,
    signal.source,
    signal.source_url || null,
    signal.metadata || null
  );
  return result.lastInsertRowid as number;
}

// ── Get recent signals ───────────────────────────────────────────
export function getRecentSignals(limit: number = 50): Signal[] {
  const db = getDb();
  return db
    .prepare(
      `SELECT s.*, sub.name as subnet_name
       FROM signals s
       LEFT JOIN subnets sub ON s.netuid = sub.netuid
       ORDER BY s.strength DESC, s.created_at DESC LIMIT ?`
    )
    .all(limit) as Signal[];
}

export function getAnalyzedSignals(limit: number = 50): Signal[] {
  const db = getDb();
  return db
    .prepare(
      `SELECT s.*, sub.name as subnet_name
       FROM signals s
       LEFT JOIN subnets sub ON s.netuid = sub.netuid
       WHERE s.analysis IS NOT NULL AND s.analysis != ''
       ORDER BY s.created_at DESC LIMIT ?`
    )
    .all(limit) as Signal[];
}

// ── Get signals for a subnet ─────────────────────────────────────
export function getSubnetSignals(netuid: number, limit: number = 20): Signal[] {
  const db = getDb();
  return db
    .prepare("SELECT * FROM signals WHERE netuid = ? ORDER BY created_at DESC LIMIT ?")
    .all(netuid, limit) as Signal[];
}

// ── Flow Inflection Detection ────────────────────────────────────
export function detectFlowInflections(): Signal[] {
  const db = getDb();
  const signals: Signal[] = [];

  // Get the two most recent metric snapshots per subnet
  const rows = db
    .prepare(
      `WITH ranked AS (
         SELECT *, ROW_NUMBER() OVER (PARTITION BY netuid ORDER BY timestamp DESC) as rn
         FROM subnet_metrics
         WHERE net_flow_24h IS NOT NULL
       )
       SELECT
         a.netuid, a.net_flow_24h as current_flow, b.net_flow_24h as prev_flow,
         a.net_flow_7d, a.emission_pct, a.alpha_price, a.market_cap
       FROM ranked a
       JOIN ranked b ON a.netuid = b.netuid AND b.rn = 2
       WHERE a.rn = 1`
    )
    .all() as Array<{
    netuid: number;
    current_flow: number;
    prev_flow: number;
    net_flow_7d: number;
    emission_pct: number;
    alpha_price: number;
    market_cap: number;
  }>;

  for (const row of rows) {
    // Detect flow turning positive (was negative or zero, now positive)
    if (row.current_flow > 0 && row.prev_flow <= 0) {
      // Log scale so small flips (0.1 TAO) score ~52 and large ones (50+ TAO) hit 95.
      // Old linear scale clustered everything at 68 for typical 1-2 TAO flows.
      const flowMag = Math.log10(Math.max(row.current_flow, 0.1) + 1) * 35;
      const strength = Math.min(95, Math.round(50 + flowMag));
      signals.push({
        netuid: row.netuid,
        signal_type: "flow_inflection",
        strength,
        title: `Flow turned positive: +${row.current_flow.toFixed(2)} TAO/24h`,
        description: `Net flow flipped from ${row.prev_flow.toFixed(2)} to +${row.current_flow.toFixed(2)} TAO. 7d flow: ${row.net_flow_7d?.toFixed(2) || "N/A"}. This precedes emission increases due to 30-day EMA lag.`,
        source: "taostats",
      });
    }

    // Detect large flow spikes (>2x previous)
    if (
      row.current_flow > 0 &&
      row.prev_flow > 0 &&
      row.current_flow > row.prev_flow * 2
    ) {
      // Log2 scale: 2x→60, 3x→72, 5x→83, 10x→95. Old formula clustered at 60-70.
      const ratio = row.current_flow / row.prev_flow;
      const strength = Math.min(95, Math.round(40 + Math.log2(ratio) * 22));
      signals.push({
        netuid: row.netuid,
        signal_type: "flow_spike",
        strength,
        title: `Flow spiked ${ratio.toFixed(1)}x`,
        description: `24h flow jumped from ${row.prev_flow.toFixed(2)} to ${row.current_flow.toFixed(2)} TAO. Accelerating inflows.`,
        source: "taostats",
      });
    }

    // Detect flow turning negative (was positive, now negative)
    if (row.current_flow < 0 && row.prev_flow >= 0) {
      // Dynamic: small flips ~25, large reversals ~55. Was hardcoded 30 for everything.
      const flipSize = Math.abs(row.current_flow - row.prev_flow);
      const strength = Math.min(60, Math.round(20 + Math.log10(Math.max(flipSize, 0.1) + 1) * 25));
      signals.push({
        netuid: row.netuid,
        signal_type: "flow_warning",
        strength,
        title: `Flow turned negative: ${row.current_flow.toFixed(2)} TAO/24h`,
        description: `Net flow flipped from +${row.prev_flow.toFixed(2)} to ${row.current_flow.toFixed(2)} TAO. Outflows beginning.`,
        source: "taostats",
      });
    }
  }

  return signals;
}

// ── Dev Quality Scorer ───────────────────────────────────────────
// Scores the QUALITY of dev activity based on event content, not just count.
// Returns 20–95: 20-35=noise/chores, 40-55=routine work, 60-75=real features,
// 80-90=major launch/release, 95=once-in-a-while breakthrough.
export function scoreDevQuality(events: Array<{ title: string; event_type: string }>): number {
  // Event type base: releases >> PRs >> pushes
  const hasRelease = events.some(e => e.event_type === "ReleaseEvent");
  const prCount = events.filter(e => e.event_type === "PullRequestEvent").length;
  const pushCount = events.filter(e => e.event_type === "PushEvent").length;

  let typePts = 0;
  if (hasRelease) typePts = 35;       // Actual versioned release = huge signal
  else if (prCount >= 3) typePts = 20; // Multiple PRs merged = real feature work
  else if (prCount >= 1) typePts = 14;
  else typePts = 6;                    // Push-only = smaller signal

  // Keyword quality tiers
  const allText = events.map(e => e.title.toLowerCase()).join(" ");

  const tier1 = ["launch", "live", "mainnet", "production", "v1.", "v2.", "v3.", "v4.",
    "major release", "ship", "shipped", "breakthrough", "milestone", "new product", "goes live"];
  const tier2 = ["new feature", "add ", "implement", "new model", "new endpoint", "new api",
    "deploy", "release", "improve", "upgrade", "support ", "enable ", "performance", "speed",
    "accuracy", "new miner", "new validator"];
  const tier3 = ["fix ", "update", "refactor", "optimize", "patch", "cleanup", "enhancement"];
  const penalty = ["chore", "ci:", "test:", "bump version", "update deps", "typo",
    "lint", "format ", "readme", "bump ", "dependabot", "minor fix", "housekeeping"];

  const t1hits = tier1.filter(k => allText.includes(k)).length;
  const t2hits = tier2.filter(k => allText.includes(k)).length;
  const t3hits = tier3.filter(k => allText.includes(k)).length;
  const phits  = penalty.filter(k => allText.includes(k)).length;

  const keywordPts = Math.min(50, t1hits * 20 + t2hits * 8 + t3hits * 3) - Math.min(20, phits * 7);

  const raw = typePts + keywordPts;
  return Math.min(95, Math.max(20, Math.round(raw)));
}

// ── Dev Activity Spike Detection ─────────────────────────────────
export function detectDevSpikes(): Signal[] {
  const db = getDb();
  const signals: Signal[] = [];

  // Look for repos with >2x their normal commit rate in the last 24h
  const rows = db
    .prepare(
      `SELECT repo, netuid, COUNT(*) as recent_events,
              (SELECT COUNT(*) FROM github_events ge2
               WHERE ge2.repo = ge.repo
               AND ge2.created_at > datetime('now', '-7 days')) as week_events
       FROM github_events ge
       WHERE created_at > datetime('now', '-24 hours')
       AND event_type IN ('PushEvent', 'PullRequestEvent', 'ReleaseEvent')
       GROUP BY repo
       HAVING recent_events > 3`
    )
    .all() as Array<{
    repo: string;
    netuid: number;
    recent_events: number;
    week_events: number;
  }>;

  for (const row of rows) {
    const dailyAvg = row.week_events / 7;
    if (row.recent_events > dailyAvg * 2 || row.recent_events > 10) {
      // Fetch the actual event titles to score content quality
      const events = db.prepare(
        `SELECT title, event_type FROM github_events
         WHERE repo = ? AND created_at > datetime('now', '-24 hours')
         AND event_type IN ('PushEvent', 'PullRequestEvent', 'ReleaseEvent')
         LIMIT 30`
      ).all(row.repo) as Array<{ title: string; event_type: string }>;

      const qualityScore = scoreDevQuality(events);

      // Label the signal based on quality tier
      const qualityLabel =
        qualityScore >= 85 ? "Major launch / release" :
        qualityScore >= 70 ? "Significant feature shipped" :
        qualityScore >= 55 ? "Active development" :
        qualityScore >= 40 ? "Routine dev work" :
        "Minor / infra updates";

      signals.push({
        netuid: row.netuid,
        signal_type: "dev_spike",
        strength: qualityScore,
        title: `${qualityLabel}: ${row.recent_events} events in 24h`,
        description: `${row.repo} — ${row.recent_events} events in 24h vs ${dailyAvg.toFixed(1)} daily avg. Top events: ${events.slice(0, 3).map(e => e.title).join(" · ")}`,
        source: "github",
        source_url: `https://github.com/${row.repo}`,
      });
    }
  }

  return signals;
}

// ── Compute Subnet Leaderboard ───────────────────────────────────
// The aGap score measures the GAP between building activity and market price.
// High aGap = subnet is shipping hard but price hasn't caught up = ALPHA opportunity.
// Low aGap = either not building, or price already reflects the work.

export function computeLeaderboard(): SubnetScore[] {
  const db = getDb();

  const subnets = db
    .prepare("SELECT netuid, name FROM subnets WHERE netuid > 0 AND name IS NOT NULL AND name != 'Unknown'")
    .all() as Array<{ netuid: number; name: string }>;

  // ── Step 1: Gather raw data for all subnets ────────────────────
  interface RawData {
    netuid: number;
    name: string;
    metrics?: Record<string, number>;
    ghEvents: number;
    ghPRsMerged: number;
    ghCommits: number;
    ghContributors: number;
    hfModels: number;
    hfDatasets: number;
    hfSpaces: number;
    hfTotalDownloads: number;
    staking?: {
      total_alpha_staked: number | null;
      validator_count: number | null;
      top_validator_share: number | null;
      registration_cost: number | null;
      miner_count: number | null;
      registrations_24h: number | null;
      avg_incentive: number | null;
      avg_trust: number | null;
    };
    revenue?: {
      emission_tao: number | null;
      emission_share: number | null;
      burned_alpha: number | null;
      tao_inflow: number | null;
      tao_outflow: number | null;
      net_revenue: number | null;
      coverage_ratio: number | null;
      liquidity_depth: number | null;
      emission_trend_7d: number | null;
    };
  }

  const rawData: RawData[] = [];

  for (const subnet of subnets) {
    const metrics = db
      .prepare("SELECT * FROM subnet_metrics WHERE netuid = ? ORDER BY timestamp DESC LIMIT 1")
      .get(subnet.netuid) as Record<string, number> | undefined;

    // GitHub: use individual events AND TaoStats DevActivity aggregates
    const ghStats = db.prepare(
      `SELECT
         COUNT(*) as total_events,
         SUM(CASE WHEN event_type = 'PullRequestEvent' AND significance >= 50 THEN 1 ELSE 0 END) as prs_merged,
         SUM(CASE WHEN event_type IN ('PushEvent', 'DevActivity') THEN 1 ELSE 0 END) as commits,
         COUNT(DISTINCT author) as contributors
       FROM github_events
       WHERE netuid = ? AND created_at > datetime('now', '-7 days')`
    ).get(subnet.netuid) as { total_events: number; prs_merged: number; commits: number; contributors: number } | undefined;

    // Also check TaoStats DevActivity for 7d/30d aggregate data (much more complete)
    const devActivity = db.prepare(
      `SELECT title, description FROM github_events
       WHERE netuid = ? AND event_type = 'DevActivity'
       ORDER BY created_at DESC LIMIT 1`
    ).get(subnet.netuid) as { title: string; description: string } | undefined;

    let devCommits7d = 0, devPRs7d = 0, devContributors30d = 0;
    if (devActivity?.description) {
      const m7d = devActivity.description.match(/7d:\s*(\d+)\s*commits?,\s*(\d+)\s*PRs/);
      if (m7d) { devCommits7d = parseInt(m7d[1]); devPRs7d = parseInt(m7d[2]); }
      const m30d = devActivity.description.match(/30d:.*?(\d+)\s*contributors/);
      if (m30d) { devContributors30d = parseInt(m30d[1]); }
    }

    const effectiveCommits = Math.max(ghStats?.commits || 0, devCommits7d);
    const effectivePRs = Math.max(ghStats?.prs_merged || 0, devPRs7d);
    const effectiveContributors = Math.max(ghStats?.contributors || 0, devContributors30d);
    const effectiveEvents = Math.max(ghStats?.total_events || 0, devCommits7d + devPRs7d);

    const hfStats = db.prepare(
      `SELECT
         SUM(CASE WHEN item_type = 'model' THEN 1 ELSE 0 END) as models,
         SUM(CASE WHEN item_type = 'dataset' THEN 1 ELSE 0 END) as datasets,
         SUM(CASE WHEN item_type = 'space' THEN 1 ELSE 0 END) as spaces,
         SUM(downloads) as total_downloads
       FROM huggingface_items
       WHERE netuid = ?`
    ).get(subnet.netuid) as { models: number; datasets: number; spaces: number; total_downloads: number } | undefined;

    // Staking data
    const stakingData = db.prepare(
      "SELECT * FROM subnet_staking WHERE netuid = ? ORDER BY timestamp DESC LIMIT 1"
    ).get(subnet.netuid) as RawData["staking"] | undefined;

    // Revenue data
    const revenueData = db.prepare(
      "SELECT * FROM subnet_revenue WHERE netuid = ? ORDER BY timestamp DESC LIMIT 1"
    ).get(subnet.netuid) as RawData["revenue"] | undefined;

    rawData.push({
      netuid: subnet.netuid,
      name: subnet.name || `Subnet ${subnet.netuid}`,
      metrics,
      ghEvents: effectiveEvents,
      ghPRsMerged: effectivePRs,
      ghCommits: effectiveCommits,
      ghContributors: effectiveContributors,
      hfModels: hfStats?.models || 0,
      hfDatasets: hfStats?.datasets || 0,
      hfSpaces: hfStats?.spaces || 0,
      hfTotalDownloads: hfStats?.total_downloads || 0,
      staking: stakingData,
      revenue: revenueData,
    });
  }

  // ── Step 2: Compute percentile ranks ───────────────────────────
  // Percentile ranking gives us 0-100 relative to all other subnets

  function percentileRank(values: number[], value: number): number {
    if (values.length === 0) return 0;
    const below = values.filter(v => v < value).length;
    const equal = values.filter(v => v === value).length;
    return Math.round(((below + equal * 0.5) / values.length) * 100);
  }

  // Compute combined Dev score (GitHub + HuggingFace merged)
  const devRawScores = rawData.map(d =>
    // GitHub activity
    d.ghPRsMerged * 30 +        // PRs merged = highest signal (real features shipping)
    d.ghCommits * 3 +            // Commits = building
    d.ghContributors * 15 +      // Multiple contributors = real team, not solo
    d.ghEvents * 1 +             // General activity
    // HuggingFace activity (models/datasets = shipping product)
    d.hfModels * 25 +            // Models = shipping AI product
    d.hfDatasets * 15 +          // Datasets = valuable data work
    d.hfSpaces * 10 +            // Spaces/demos = user facing
    Math.min(d.hfTotalDownloads / 100, 30) // Downloads show adoption
  );

  // ── Step 3: Score each subnet ──────────────────────────────────
  const scores: SubnetScore[] = [];

  // Flow score: absolute scale based on 24h price change
  function computeFlowScore(priceChange24h: number): number {
    if (priceChange24h <= -20) return 1;
    if (priceChange24h >= 10) return 100;
    if (priceChange24h < 0) {
      return Math.round(1 + ((priceChange24h + 20) / 20) * 49);
    } else {
      return Math.round(50 + (priceChange24h / 10) * 50);
    }
  }

  // ── Compute Staking Scores ──────────────────────────────────
  // Based on REAL data distributions:
  // - Validator count: 1-5 per subnet (API returns top validators)
  // - Total alpha staked: 0 to 2.5M (bigger = more validator conviction)
  // - Top validator share: 0.23 to 1.0 (lower = more decentralized)
  // - Miner count: ~180+ for active subnets (metagraph data)
  function computeStakingScore(d: RawData): number {
    const s = d.staking;
    if (!s) return 0;

    let score = 0;

    // Total alpha staked (0-35 pts): how much alpha validators are holding
    // This is the STRONGEST signal — validators putting skin in the game
    const totalStaked = s.total_alpha_staked || 0;
    if (totalStaked >= 2000000) score += 35;       // Top tier (2M+)
    else if (totalStaked >= 1500000) score += 30;   // Very high
    else if (totalStaked >= 1000000) score += 25;   // High
    else if (totalStaked >= 500000) score += 18;    // Decent
    else if (totalStaked >= 100000) score += 12;    // Moderate
    else if (totalStaked >= 10000) score += 6;      // Low
    else if (totalStaked > 0) score += 2;

    // Validator count (0-20 pts): more validators = distributed confidence
    // Real range is 1-5, so calibrate for that
    const valCount = s.validator_count || 0;
    if (valCount >= 5) score += 20;
    else if (valCount >= 4) score += 16;
    else if (valCount >= 3) score += 12;
    else if (valCount >= 2) score += 8;
    else if (valCount >= 1) score += 4;

    // Decentralization (0-20 pts): top validator share
    // Lower = more decentralized = healthier
    const topShare = s.top_validator_share || 1;
    if (topShare <= 0.25) score += 20;       // Very decentralized
    else if (topShare <= 0.35) score += 16;
    else if (topShare <= 0.45) score += 12;
    else if (topShare <= 0.55) score += 8;
    else if (topShare <= 0.75) score += 4;
    // >75% = single validator dominance, 0 pts

    // Miner ecosystem (0-15 pts): active miners + registrations
    const minerCount = s.miner_count || 0;
    const regs = s.registrations_24h || 0;
    if (minerCount >= 200) score += 10;
    else if (minerCount >= 100) score += 7;
    else if (minerCount >= 50) score += 4;
    if (regs >= 5) score += 5;
    else if (regs >= 1) score += 3;

    // Trust/incentive quality (0-10 pts)
    const avgTrust = s.avg_trust || 0;
    const avgIncentive = s.avg_incentive || 0;
    if (avgTrust > 0.3 && avgIncentive > 0.1) score += 10;
    else if (avgTrust > 0.1 || avgIncentive > 0.05) score += 5;
    else if (avgTrust > 0 || avgIncentive > 0) score += 2;

    return Math.min(100, score);
  }

  // ── Compute Revenue Scores ──────────────────────────────────
  // Revenue score = is this subnet economically healthy?
  // Uses ACTUAL pool data: volume, market cap, liquidity depth, coverage ratio
  // NOT the broken per-block emission (which is 1 TAO for everyone)
  function computeRevenueScore(d: RawData): number {
    const r = d.revenue;
    const m = d.metrics;
    if (!m) return 0;

    let score = 0;

    // Volume 24h in USD (0-30 pts): trading activity = economic health
    // Real range: Templar $4.5M, Chutes $1.2M, Vanta $259K, most <$50K
    const vol = m.volume_24h || 0;
    if (vol >= 1000000) score += 30;       // $1M+ volume = tier 1
    else if (vol >= 500000) score += 25;
    else if (vol >= 100000) score += 20;
    else if (vol >= 50000) score += 15;
    else if (vol >= 10000) score += 10;
    else if (vol >= 1000) score += 5;
    else if (vol > 0) score += 2;

    // TAO Pool Size (0-25 pts): deep pool = strong economic foundation
    // Real range: Chutes 217K, Templar 125K, most 1-10K
    const taoPool = m.tao_reserve || 0;
    if (taoPool >= 100000) score += 25;     // 100K+ TAO = massive pool
    else if (taoPool >= 50000) score += 22;
    else if (taoPool >= 20000) score += 18;
    else if (taoPool >= 10000) score += 14;
    else if (taoPool >= 5000) score += 10;
    else if (taoPool >= 1000) score += 6;
    else if (taoPool > 0) score += 2;

    // Coverage ratio (0-20 pts): buy vol / sell vol
    // >1 = more buying than selling = sustainable
    const coverage = r?.coverage_ratio || 0;
    if (coverage >= 3) score += 20;
    else if (coverage >= 2) score += 17;
    else if (coverage >= 1.5) score += 14;
    else if (coverage >= 1.1) score += 11;
    else if (coverage >= 0.9) score += 8;   // roughly balanced
    else if (coverage >= 0.5) score += 4;   // more selling
    // <0.5 = heavy selling, 0 pts

    // Market Cap (0-15 pts): larger mcap = more established
    // Real range: Chutes $130M, Templar $105M, most $1-10M
    const mcap = m.market_cap || 0;
    if (mcap >= 50000000) score += 15;      // $50M+
    else if (mcap >= 20000000) score += 12;
    else if (mcap >= 5000000) score += 9;
    else if (mcap >= 1000000) score += 6;
    else if (mcap >= 100000) score += 3;

    // Burned alpha bonus (0-10 pts): deflationary = bullish
    const burned = r?.burned_alpha || 0;
    if (burned > 100) score += 10;
    else if (burned > 10) score += 7;
    else if (burned > 1) score += 4;
    else if (burned > 0) score += 2;

    return Math.min(100, score);
  }

  for (let i = 0; i < rawData.length; i++) {
    const d = rawData[i];
    const m = d.metrics;

    // Percentile scores (0-100, relative to all subnets)
    const devScore = percentileRank(devRawScores, devRawScores[i]);

    // Flow score: absolute scale based on actual price performance
    const priceChange = m?.price_change_24h || 0;
    const flowScore = computeFlowScore(priceChange);

    // New scores
    const stakingScore = computeStakingScore(d);
    const revenueScore = computeRevenueScore(d);

    // ── THE ALPHA GAP FORMULA v4 ──────────────────────────────────
    // Now incorporates 5 dimensions: Dev, Social, Staking, Revenue, Price
    //
    // The CORE INSIGHT: aGap = (Building Strength) × (Market Blindness)
    // Building Strength = dev + staking health + revenue sustainability
    // Market Blindness = price lagging + low social awareness
    //
    // A subnet scores high when:
    //   1. It's building hard (high dev score)
    //   2. Validators are confident (high staking score)
    //   3. It's economically sustainable (high revenue score)
    //   4. BUT the price hasn't caught up yet (negative or flat price change)
    //   5. AND nobody is talking about it (low social velocity)

    // ── ALPHA GAP FORMULA v5 ────────────────────────────────────
    // Priority: Dev (most important) > Flow & Social > Staking & Revenue
    //
    // Dev is the FOUNDATION — if you're not building, nothing else matters
    // Flow (price lag) and Social (awareness gap) are the GAP DETECTORS
    // Staking and Revenue are CONFIDENCE BOOSTERS
    //
    // Formula: Base (from dev) + Gap Bonus (from flow/social) + Confidence (staking/rev)

    // 1. DEV BASE (0-55 pts): Most important — are they shipping?
    const devBase = devScore * 0.55;

    // 2. FLOW GAP (0-25 pts): Price lagging behind fundamentals?
    // This is the primary alpha detector
    let flowGap = 0;
    if (devScore > 30) { // Only award flow gap if there's something being built
      if (priceChange < -20) flowGap = 25;          // Massive disconnect
      else if (priceChange < -10) flowGap = 20;      // Strong gap
      else if (priceChange < -5) flowGap = 15;       // Clear gap
      else if (priceChange < -2) flowGap = 10;       // Mild gap
      else if (priceChange < 0) flowGap = 6;         // Slight gap
      else if (priceChange < 3) flowGap = 3;         // Flat — tiny gap
      else if (priceChange < 8) flowGap = 0;         // Price catching up — no gap
      else if (priceChange < 15) flowGap = -5;       // Pumping — gap closing
      else flowGap = -12;                              // Mooning — alpha is GONE
    }

    // 3. SOCIAL GAP (0-10 pts): Is the market aware of the building?
    // Low social + high dev = hidden alpha
    // High social = everyone knows, gap is smaller
    const socialData = db.prepare(
      "SELECT mentions_24h, mentions_7d, total_engagement_24h FROM social_metrics WHERE netuid = ? ORDER BY timestamp DESC LIMIT 1"
    ).get(d.netuid) as { mentions_24h: number; mentions_7d: number; total_engagement_24h: number } | undefined;

    const socialMentions = socialData?.mentions_24h || 0;
    const socialEngagement = socialData?.total_engagement_24h || 0;

    let socialGap = 0;
    if (devScore > 40) { // Only matters if they're building something
      if (socialMentions <= 2 && socialEngagement < 50) {
        socialGap = 10;    // Ghost mode — nobody knows, maximum alpha
      } else if (socialMentions <= 8 && socialEngagement < 300) {
        socialGap = 6;     // Under the radar
      } else if (socialMentions <= 15 && socialEngagement < 800) {
        socialGap = 3;     // Some awareness
      } else if (socialMentions > 30 && socialEngagement > 2000) {
        socialGap = -3;    // Crowded — less alpha
      } else if (socialMentions > 50 && socialEngagement > 5000) {
        socialGap = -8;    // Viral — alpha evaporated
      }
    }

    // 4. CONFIDENCE BOOST (0-10 pts): Staking & revenue as tiebreakers
    // These validate the thesis but don't drive the score
    const confidenceBoost = (
      Math.min(5, stakingScore * 0.05) +   // Max 5 pts from staking
      Math.min(5, revenueScore * 0.05)     // Max 5 pts from revenue
    );

    // 5. MARKET CAP PENALTY: Tiny subnets are uninvestable noise
    // Can't trade alpha if there's no liquidity
    const mcap = m?.market_cap || 0;
    let mcapPenalty = 0;
    if (mcap < 50000) mcapPenalty = -35;          // <$50K = ghost, basically untradeable
    else if (mcap < 100000) mcapPenalty = -25;     // <$100K = micro, extreme risk
    else if (mcap < 500000) mcapPenalty = -15;     // <$500K = tiny, high risk
    else if (mcap < 1000000) mcapPenalty = -8;     // <$1M = small, moderate risk
    else if (mcap < 5000000) mcapPenalty = -3;     // <$5M = emerging, slight risk
    // $5M+ = no penalty, liquid enough to trade

    // Final aGap = dev base + flow gap + social gap + confidence + mcap penalty
    const rawAGap = devBase + flowGap + socialGap + confidenceBoost + mcapPenalty;
    const aGap = Math.max(1, Math.min(100, Math.round(rawAGap)));

    // Signal count
    const signalCount = db
      .prepare("SELECT COUNT(*) as cnt FROM signals WHERE netuid = ? AND created_at > datetime('now', '-24 hours')")
      .get(d.netuid) as { cnt: number };

    const topSignal = db
      .prepare("SELECT title FROM signals WHERE netuid = ? ORDER BY strength DESC, created_at DESC LIMIT 1")
      .get(d.netuid) as { title: string } | undefined;

    // Social score: based on tweet count + engagement from Desearch
    let socialScore = 0;
    if (socialMentions > 0 || socialEngagement > 0) {
      let mentionPts = 0;
      if (socialMentions >= 50) mentionPts = 40;
      else if (socialMentions >= 20) mentionPts = 30;
      else if (socialMentions >= 10) mentionPts = 22;
      else if (socialMentions >= 5) mentionPts = 15;
      else if (socialMentions >= 2) mentionPts = 8;
      else mentionPts = 3;

      let engagePts = 0;
      if (socialEngagement >= 5000) engagePts = 60;
      else if (socialEngagement >= 1000) engagePts = 50;
      else if (socialEngagement >= 500) engagePts = 40;
      else if (socialEngagement >= 100) engagePts = 28;
      else if (socialEngagement >= 30) engagePts = 18;
      else if (socialEngagement >= 10) engagePts = 10;
      else engagePts = 3;

      socialScore = Math.min(100, mentionPts + engagePts);
    }

    scores.push({
      netuid: d.netuid,
      name: d.name,
      composite_score: aGap,
      flow_score: Math.round(flowScore),
      dev_score: Math.round(devScore),
      hf_score: 0,
      staking_score: stakingScore,
      revenue_score: revenueScore,
      social_score: socialScore,
      signal_count: signalCount?.cnt || 0,
      top_signal: topSignal?.title,
      alpha_price: m?.alpha_price,
      market_cap: m?.market_cap,
      net_flow_24h: m?.net_flow_24h,
      emission_pct: m?.emission_pct,
      price_change_24h: m?.price_change_24h,
    });
  }

  return scores.sort((a, b) => b.composite_score - a.composite_score);
}
