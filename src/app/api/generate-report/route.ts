import { NextResponse } from "next/server";
import { put, get, del, list } from "@vercel/blob";
import { fetchRecentCommits, fetchRecentPRs, fetchLatestRelease } from "@/lib/context-fetcher";
import {
  getSubnetIdentities,
  getSubnetPools,
  getGithubActivity,
  getTaoPrice,
} from "@/lib/taostats";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

const ANTHROPIC_KEY = process.env.ANTHROPIC_API_KEY || "";
const RAO = 1e9;

// GET handler for Vercel cron job
export async function GET(req: Request) {
  // Auth: Vercel cron header or CRON_SECRET bearer
  const isVercelCron = req.headers.get("x-vercel-cron") === "1";
  if (!isVercelCron) {
    const cronSecret = process.env.CRON_SECRET;
    const auth = req.headers.get("authorization");
    if (!cronSecret || auth !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }
  }
  return generateReport();
}

// POST handler for manual generation
export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  return generateReport(body?.netuid as number | undefined, body?.date as string | undefined);
}

async function generateReport(forceNetuid?: number, forceDate?: string) {
  if (!ANTHROPIC_KEY) {
    return NextResponse.json({ error: "No Anthropic API key" }, { status: 500 });
  }

  try {

    // Step 1: Get current scan data for context
    let scanData: Record<string, unknown> | null = null;
    try {
      const result = await get("scan-latest.json", {
        token: process.env.BLOB_READ_WRITE_TOKEN!,
        access: "private",
      });
      if (result?.stream) {
        const reader = result.stream.getReader();
        const chunks: Uint8Array[] = [];
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          chunks.push(value);
        }
        scanData = JSON.parse(Buffer.concat(chunks).toString("utf-8"));
      }
    } catch (e) {
      console.error("[report] Failed to read scan cache:", e);
    }

    // Step 2: Determine which subnet to report on
    let targetNetuid: number;
    let targetName: string;

    // ── Load report-index.json (maps YYYY-MM-DD → netuid) ─────────────────────
    // Used for fast dedup AND updated on save. Load it here (before the if/else)
    // so both force and auto modes can update it in the save section.
    // The old approach (list({limit:30}) + individual get() per file) silently missed
    // recent entries once the archive grew past 30 files — causing the same subnet to repeat.
    let reportIndex: Record<string, number> = {};
    try {
      const indexBlob = await get("report-index.json", {
        token: process.env.BLOB_READ_WRITE_TOKEN!,
        access: "private",
        abortSignal: AbortSignal.timeout(8000),
      });
      if (indexBlob?.stream) {
        const reader = indexBlob.stream.getReader();
        const chunks: Uint8Array[] = [];
        while (true) { const { done, value } = await reader.read(); if (done) break; chunks.push(value); }
        reportIndex = JSON.parse(Buffer.concat(chunks).toString("utf-8"));
        console.log(`[report] Loaded report-index.json (${Object.keys(reportIndex).length} entries)`);
      }
    } catch { /* no index yet — will bootstrap below if needed */ }

    // If index is empty (first run or missing), bootstrap from existing report files
    if (Object.keys(reportIndex).length === 0 && process.env.BLOB_READ_WRITE_TOKEN) {
      try {
        // Paginate to get ALL report blobs (no hard limit)
        let cursor: string | undefined;
        do {
          const page = await list({ prefix: "reports/", token: process.env.BLOB_READ_WRITE_TOKEN!, limit: 100, cursor });
          for (const b of page.blobs) {
            const dateMatch = b.pathname.match(/reports\/(\d{4}-\d{2}-\d{2})\.json/);
            if (!dateMatch) continue;
            try {
              const r = await get(b.pathname, { token: process.env.BLOB_READ_WRITE_TOKEN!, access: "private", abortSignal: AbortSignal.timeout(5000) });
              if (r?.stream) {
                const reader2 = r.stream.getReader();
                const chunks2: Uint8Array[] = [];
                while (true) { const { done, value } = await reader2.read(); if (done) break; chunks2.push(value); }
                const data = JSON.parse(Buffer.concat(chunks2).toString("utf-8"));
                if (data.netuid) reportIndex[dateMatch[1]] = data.netuid;
              }
            } catch { /* skip this file */ }
          }
          cursor = page.cursor;
        } while (cursor);
        console.log(`[report] Bootstrapped report-index.json from ${Object.keys(reportIndex).length} existing files`);
      } catch { /* no reports yet */ }
    }

    // ── Cooldown check (applies to BOTH manual and auto-select) ──────────────
    const REPORT_COOLDOWN_DAYS = 14;
    const cutoffDate = new Date(Date.now() - REPORT_COOLDOWN_DAYS * 24 * 60 * 60 * 1000)
      .toISOString().slice(0, 10); // YYYY-MM-DD

    const recentNetuids = new Map<number, string>(); // netuid → most recent report date
    for (const [date, netuid] of Object.entries(reportIndex)) {
      if (date >= cutoffDate) {
        const prev = recentNetuids.get(netuid);
        if (!prev || date > prev) recentNetuids.set(netuid, date);
      }
    }
    console.log(`[report] Subnets reported in last ${REPORT_COOLDOWN_DAYS} days (cooldown): ${[...recentNetuids.keys()].join(", ")}`);

    // ── Idempotency: skip if today's report already exists ───────────────
    const today = forceDate || new Date().toISOString().split("T")[0];
    if (!forceNetuid && !forceDate && reportIndex[today] !== undefined) {
      console.log(`[report] Today's report (${today}) already exists for SN${reportIndex[today]} — skipping`);
      return NextResponse.json({ skipped: true, date: today, netuid: reportIndex[today] });
    }

    if (forceNetuid) {
      // Manual request — still enforce cooldown
      const lastReportDate = recentNetuids.get(forceNetuid);
      if (lastReportDate) {
        const daysAgo = Math.floor((Date.now() - new Date(lastReportDate).getTime()) / 86400000);
        return NextResponse.json({
          error: `Report for SN${forceNetuid} was generated ${daysAgo} day(s) ago (${lastReportDate}). Cooldown is ${REPORT_COOLDOWN_DAYS} days.`,
          lastReportDate,
          cooldownDays: REPORT_COOLDOWN_DAYS,
          daysRemaining: REPORT_COOLDOWN_DAYS - daysAgo,
        }, { status: 429 });
      }
      targetNetuid = forceNetuid;
      const lb = (scanData?.leaderboard as Array<Record<string, unknown>>) || [];
      const entry = lb.find(s => s.netuid === forceNetuid);
      targetName = (entry?.name as string) || `SN${forceNetuid}`;
    } else {
      // Auto-select: pick top aGap subnet not in cooldown
      const lb = (scanData?.leaderboard as Array<Record<string, unknown>>) || [];
      if (lb.length === 0) {
        return NextResponse.json({ error: "No scan data available" }, { status: 400 });
      }

      // Walk down the aGap ranking to find a subnet without a recent report
      const sorted = [...lb].sort((a, b) => (b.composite_score as number) - (a.composite_score as number));
      const chosen = sorted.find(s => !recentNetuids.has(s.netuid as number)) || sorted[0];
      targetNetuid = chosen.netuid as number;
      targetName = chosen.name as string;
    }

    console.log(`[report] Generating deep-dive for ${targetName} (SN${targetNetuid})`);

    // Step 3: Gather deep context
    const [identities, pools, devActivity, taoPrice] = await Promise.all([
      getSubnetIdentities(),
      getSubnetPools(),
      getGithubActivity(),
      getTaoPrice(),
    ]);

    const identity = identities.find(i => i.netuid === targetNetuid);
    const pool = pools.find(p => p.netuid === targetNetuid);
    const dev = devActivity.find(d => d.netuid === targetNetuid);

    // Get leaderboard entry for scores
    const lb = (scanData?.leaderboard as Array<Record<string, unknown>>) || [];
    const lbEntry = lb.find(s => s.netuid === targetNetuid) || {};

    // Price data
    // pool.price is already decimal (e.g. 0.0776), NOT in rao
    const price = pool ? (parseFloat(pool.price || "0") * taoPrice).toFixed(2) : "?";
    // market_cap is in rao, needs conversion
    const mcap = pool ? (parseFloat(pool.market_cap || "0") / RAO * taoPrice / 1e6).toFixed(1) : "?";
    const pch24h = pool?.price_change_1_day ? parseFloat(pool.price_change_1_day).toFixed(1) : "?";
    const pch1w = pool?.price_change_1_week ? parseFloat(pool.price_change_1_week).toFixed(1) : "?";
    const pch1m = pool?.price_change_1_month ? parseFloat(pool.price_change_1_month).toFixed(1) : "?";
    const rootProp = pool?.root_prop ? (parseFloat(pool.root_prop) * 100).toFixed(2) : "?";
    const rank = pool?.rank || "?";
    // Volume fields are in rao
    const volume24h = pool ? (parseFloat(pool.tao_volume_24_hr || "0") / RAO * taoPrice).toFixed(0) : "?";
    const buyVol = pool ? (parseFloat(pool.tao_buy_volume_24_hr || "0") / RAO).toFixed(0) : "?";
    const sellVol = pool ? (parseFloat(pool.tao_sell_volume_24_hr || "0") / RAO).toFixed(0) : "?";
    const buys = pool?.buys_24_hr || 0;
    const sells = pool?.sells_24_hr || 0;

    // GitHub context
    let commitText = "No GitHub data available";
    let prText = "";
    let releaseText = "";
    if (dev?.repo_url) {
      let repoPath = dev.repo_url;
      if (repoPath.includes("github.com/")) repoPath = repoPath.split("github.com/")[1];
      repoPath = repoPath.replace(/^\/|\/$/g, "").replace(/\.git$/, "");
      const parts = repoPath.split("/");
      if (parts.length >= 2) {
        const [owner, repo] = parts;
        const [commits, prs, release] = await Promise.all([
          fetchRecentCommits(owner, repo, 15),
          fetchRecentPRs(owner, repo, 8),
          fetchLatestRelease(owner, repo),
        ]);
        if (commits.length) commitText = commits.join("\n");
        if (prs.length) prText = prs.join("\n");
        if (release) releaseText = `Latest Release: ${release.name} (${release.tag})\n${release.body.slice(0, 1000)}`;
      }
    }

    // Signals for this subnet
    const signals = ((scanData?.signals as Array<Record<string, unknown>>) || [])
      .filter(s => s.netuid === targetNetuid)
      .map(s => `${s.title}: ${(s.description as string || "").slice(0, 200)}`)
      .join("\n\n");

    // Verified X handle overrides (same map as scan/route.ts) — fills gaps in TaoStats registry
    const TWITTER_HANDLE_OVERRIDES: Record<number, string> = {
      3: "tplr_ai", 4: "TargonCompute", 6: "numinous_ai", 8: "VantaTrading",
      11: "TrajectoryRL", 12: "ComputeHorde", 13: "Data_SN13", 14: "taohash",
      15: "oroagents", 16: "bitads_ai", 17: "404gen_", 18: "zeussubnet",
      22: "desearch_ai", 23: "trishoolai", 24: "QuasarModels", 27: "nodex0_",
      33: "ReadyAI_", 34: "BitMindAI", 36: "AutoppiaAI", 37: "AureliusAligned",
      39: "basilic_ai", 41: "almanac_market", 43: "GraphiteSubnet", 44: "webuildscore",
      46: "resilabsai", 50: "SynthdataCo", 51: "lium_io", 54: "yanez__ai",
      56: "gradients_ai", 58: "handshake_58", 59: "babelbit", 60: "bitsecai",
      61: "_redteam_", 62: "ridges_ai", 64: "chutes_ai", 65: "TPN_Labs",
      66: "alpha_core_ai", 68: "metanova_labs", 71: "LeadpoetAI", 74: "gittensor_io",
      75: "hippius_subnet", 81: "grail_ai", 85: "vidaio_", 88: "Investing88ai",
      91: "bitstarterAI", 93: "Bitcast_network",
      // SN97 (Distil): no verified official handle — do NOT add unverified accounts
      121: "sundaebar_ai", 122: "Bitrecs", 124: "SwarmSubnet",
    };

    // Identity details
    const github = identity?.github_repo || dev?.repo_url || "Unknown";
    const rawTwitter = identity?.twitter?.replace(/https?:\/\/(twitter|x)\.com\//g, "").replace(/^@/, "").replace(/\/$/, "").trim() || "";
    const twitterHandle = rawTwitter || TWITTER_HANDLE_OVERRIDES[targetNetuid] || "";
    const twitter = twitterHandle ? `https://x.com/${twitterHandle}` : "Not found in registry";
    const website = identity?.subnet_url || "Unknown";
    const description = identity?.description || identity?.summary || "No description available";

    // Emission % from leaderboard (ground truth — more accurate than root_prop)
    const emissionPct = lbEntry.emission_pct != null
      ? `${(lbEntry.emission_pct as number).toFixed(2)}%`
      : rootProp !== "?" ? `${rootProp}% (root prop)` : "?";

    // Step 4: Generate the deep-dive report with Claude
    const prompt = `You are the AlphaGap Intelligence Engine generating a DEEP DIVE daily report. This is the most important content we produce — our readers use these reports to make investment decisions in the Bittensor ecosystem.

Write a comprehensive, magazine-quality intelligence report on this subnet. Be specific, data-driven, and give actionable insights. Use actual numbers from the data below.

⚠️ ACCURACY RULES — MANDATORY:
1. ONLY use numbers that appear EXPLICITLY in the data section below. Do NOT calculate, infer, or estimate any figures.
2. For emission percentage, use ONLY the "Emission %" value provided. Do NOT use Root Prop or any other field for this claim.
3. For price, market cap, volume — use ONLY the exact figures provided.
4. If a data field shows "?" it means unknown — say "data unavailable" or omit that claim entirely.
5. Never extrapolate trends or compound statistics not explicitly in the data.
6. NEVER identify any individual as a founder, CEO, core team member, or key figure unless that claim is explicitly stated in the subnet's official description field above. A Twitter handle or GitHub username does NOT imply someone is a founder — do not make that inference. If no team/founder information is in the description, omit it entirely.

═══════════════════════════════════════
SUBNET DATA (USE ONLY THESE NUMBERS)
═══════════════════════════════════════

Name: ${targetName} (SN${targetNetuid})
Description: ${description}
Website: ${website}
GitHub: ${github}
Twitter: ${twitter}

SCORES:
  aGap Score: ${lbEntry.composite_score || "?"}
  Dev Score: ${lbEntry.dev_score || "?"}
  eVal Score: ${lbEntry.eval_score || "?"} (emission/valuation ratio: ${lbEntry.eval_ratio || "?"}x)
  Flow Score: ${lbEntry.flow_score || "?"}
  Social Score: ${lbEntry.social_score || "?"}

MARKET DATA:
  Token Price: $${price} (TAO price: $${taoPrice.toFixed(2)})
  Market Cap: $${mcap}M
  24h Volume: $${volume24h}
  24h Change: ${pch24h}% | 7d: ${pch1w}% | 30d: ${pch1m}%
  Buy Volume: ${buyVol} TAO (${buys} buys)
  Sell Volume: ${sellVol} TAO (${sells} sells)
  Emission %: ${emissionPct}   ← USE THIS EXACT FIGURE for any emission % claims
  Emission Rank: ${rank}
  Root Prop (validator weight share): ${rootProp}%   ← this is NOT the same as Emission %

DEV ACTIVITY:
  Today: ${dev?.commits_1d || 0} commits, ${dev?.prs_merged_1d || 0} PRs merged
  7 Day: ${dev?.commits_7d || 0} commits, ${dev?.prs_merged_7d || 0} PRs merged
  30 Day: ${dev?.commits_30d || 0} commits, ${dev?.unique_contributors_30d || 0} contributors

RECENT COMMITS:
${commitText}

MERGED PULL REQUESTS:
${prText || "None found"}

${releaseText}

RECENT SIGNALS:
${signals || "No signals detected"}

═══════════════════════════════════════
REPORT FORMAT
═══════════════════════════════════════

Write the report using EXACTLY this structure. Be concise and punchy — each section should be tight and direct. Use markdown formatting.

# AlphaGap Deep Dive: ${targetName} (SN${targetNetuid})

## 🏗️ What Is ${targetName}?
(ONE sentence only. What it does and what problem it solves. Nothing more.)

## 📊 Development Progress
(2-3 sentences max. What stage are they at and what do commit patterns tell us about velocity?)

## 🔧 Latest Technical Shipments
(2-4 sentences. The most important specific commits/PRs shipped recently and what they mean for the product.)

## 📡 Social & Community Gap Analysis
(2-3 sentences. How visible is this subnet and is there a gap between what they're building and the attention they're getting?)

## ⚡ Emissions & Validator Confidence
(2-3 sentences. Emission share, rank, and what it signals about validator confidence.)

## 💰 Token Price Analysis
(2-3 sentences. Is the price reflecting development and emission data? Undervalued or overvalued?)

## 🌍 Real-World Applications
(2-3 sentences. One or two concrete examples of who uses this and why it matters.)

## 🎯 The AlphaGap Verdict
(3-4 sentences max. Bold, opinionated conclusion — is there an alpha gap? What's the risk/reward? Be direct.)

---
*Report generated by AlphaGap Intelligence Engine on ${new Date().toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}*`;

    // Strip lone surrogates and other non-JSON-safe characters from prompt
    const safePrompt = prompt.replace(/[\uD800-\uDFFF]/g, "").replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, "");

    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": ANTHROPIC_KEY,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-6",
        max_tokens: 4000,
        messages: [{ role: "user", content: safePrompt }],
      }),
      signal: AbortSignal.timeout(120000),
    });

    if (!res.ok) {
      const text = await res.text();
      return NextResponse.json({ error: `Claude API error: ${res.status} ${text}` }, { status: 502 });
    }

    const data = await res.json();
    let reportContent: string = data.content?.[0]?.text || "Report generation failed";

    // ── Step 4b: Fact-check the report ──────────────────────────────────────
    // Scan for any numeric claims that contradict known ground-truth values.
    // If found, append a correction note so readers aren't misled.
    const factErrors: string[] = [];

    // Check emission % — if the report contains a % figure near the wrong rootProp value
    if (lbEntry.emission_pct != null) {
      const trueEmPct = (lbEntry.emission_pct as number).toFixed(2);
      // Look for patterns like "X% of ... emissions" or "capturing X%" in the text
      const emPctMatches = reportContent.match(/(\d+\.?\d*)\s*%\s*(of\s*(Bittensor('s)?\s*)?(total\s*)?emissions?|of\s*emissions?|emissions?\s*share)/gi) || [];
      for (const m of emPctMatches) {
        const numMatch = m.match(/(\d+\.?\d*)/);
        if (numMatch) {
          const claimed = parseFloat(numMatch[1]);
          const truth = parseFloat(trueEmPct);
          // Flag if claimed value is off by more than 1 percentage point AND it's not the root prop
          if (Math.abs(claimed - truth) > 1 && Math.abs(claimed - parseFloat(rootProp)) < 0.5) {
            factErrors.push(`Emission % appears as ${claimed}% in report but actual value is ${trueEmPct}% (root prop ${rootProp}% was incorrectly used)`);
          }
        }
      }
    }

    // Check market cap
    if (mcap !== "?" && mcap !== "0.0") {
      const mcapNum = parseFloat(mcap);
      const mcapMatches = reportContent.match(/\$(\d+\.?\d*)\s*[Mm](illion)?/g) || [];
      for (const m of mcapMatches) {
        const numMatch = m.match(/(\d+\.?\d*)/);
        if (numMatch) {
          const claimed = parseFloat(numMatch[1]);
          if (Math.abs(claimed - mcapNum) / Math.max(mcapNum, 1) > 0.25) {
            factErrors.push(`Market cap appears as $${claimed}M but actual value is $${mcapNum}M`);
          }
        }
      }
    }

    if (factErrors.length > 0) {
      console.warn(`[report] Fact-check warnings for ${targetName}:`, factErrors);
      // Append a correction section at the end of the report
      reportContent += `\n\n---\n> ⚠️ **Data Note:** The following figures were auto-corrected by the AlphaGap fact-checker:\n${factErrors.map(e => `> - ${e}`).join("\n")}`;
    }

    // Step 5: Store the report in Vercel Blob
    const report = {
      date: today,
      netuid: targetNetuid,
      subnet_name: targetName,
      composite_score: lbEntry.composite_score || 0,
      alpha_price: parseFloat(price),
      market_cap: parseFloat(mcap) * 1e6,
      content: reportContent,
      generated_at: new Date().toISOString(),
    };

    try {
      if (process.env.BLOB_READ_WRITE_TOKEN) {
        // Save the report blob
        await put(`reports/${today}.json`, JSON.stringify(report), {
          access: "private",
          addRandomSuffix: false,
          allowOverwrite: true,
          contentType: "application/json",
          token: process.env.BLOB_READ_WRITE_TOKEN!,
        });
        console.log(`[report] Saved to Blob: reports/${today}.json`);

        // Update report-index.json so dedup works reliably without reading individual files
        reportIndex[today] = targetNetuid;
        await put("report-index.json", JSON.stringify(reportIndex), {
          access: "private",
          addRandomSuffix: false,
          allowOverwrite: true,
          contentType: "application/json",
          token: process.env.BLOB_READ_WRITE_TOKEN!,
        });
        console.log(`[report] Updated report-index.json (${Object.keys(reportIndex).length} entries)`);
      }
    } catch (e) {
      console.error("[report] Failed to save to Blob:", e);
    }

    return NextResponse.json(report);
  } catch (e) {
    console.error("[report] Error:", e);
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
