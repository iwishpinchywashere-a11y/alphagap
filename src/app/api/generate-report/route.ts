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
export const maxDuration = 60;

const ANTHROPIC_KEY = process.env.ANTHROPIC_API_KEY || "";
const RAO = 1e9;

// GET handler for Vercel cron job
export async function GET() {
  return generateReport();
}

// POST handler for manual generation
export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  return generateReport(body?.netuid as number | undefined);
}

async function generateReport(forceNetuid?: number) {
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

    if (forceNetuid) {
      targetNetuid = forceNetuid;
      const lb = (scanData?.leaderboard as Array<Record<string, unknown>>) || [];
      const entry = lb.find(s => s.netuid === forceNetuid);
      targetName = (entry?.name as string) || `SN${forceNetuid}`;
    } else {
      // Pick the top aGap subnet that HASN'T been reported on recently
      const lb = (scanData?.leaderboard as Array<Record<string, unknown>>) || [];
      if (lb.length === 0) {
        return NextResponse.json({ error: "No scan data available" }, { status: 400 });
      }

      // Get recent report netuids (last 3 days)
      const recentNetuids = new Set<number>();
      try {
        const { blobs } = await list({ prefix: "reports/", limit: 5 });
        for (const b of blobs) {
          try {
            const r = await get(b.pathname, { token: process.env.BLOB_READ_WRITE_TOKEN!, access: "private" });
            if (r?.stream) {
              const reader = r.stream.getReader();
              const chunks: Uint8Array[] = [];
              while (true) { const { done, value } = await reader.read(); if (done) break; chunks.push(value); }
              const data = JSON.parse(Buffer.concat(chunks).toString("utf-8"));
              recentNetuids.add(data.netuid);
            }
          } catch { /* skip */ }
        }
      } catch { /* no reports yet */ }

      console.log(`[report] Recent report netuids to skip: ${[...recentNetuids].join(", ")}`);

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

    // Identity details
    const github = identity?.github_repo || dev?.repo_url || "Unknown";
    const twitter = identity?.twitter || "Unknown";
    const website = identity?.subnet_url || "Unknown";
    const description = identity?.description || identity?.summary || "No description available";

    // Step 4: Generate the deep-dive report with Claude
    const prompt = `You are the AlphaGap Intelligence Engine generating a DEEP DIVE daily report. This is the most important content we produce — our readers use these reports to make investment decisions in the Bittensor ecosystem.

Write a comprehensive, magazine-quality intelligence report on this subnet. Be specific, data-driven, and give actionable insights. Use actual numbers from the data below. This should read like a professional research report that people would pay for.

═══════════════════════════════════════
SUBNET DATA
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
  Emission Rank: ${rank} | Root Prop: ${rootProp}%

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

Write the report using EXACTLY this structure. Each section should be substantive (3-8 sentences). Use markdown formatting.

# AlphaGap Deep Dive: ${targetName} (SN${targetNetuid})

## 🏗️ What Is ${targetName}?
(High-level explanation of the subnet — what it does, what problem it solves, how its technology works. Explain it so someone new to Bittensor can understand. Include any known background on the team or org behind it.)

## 📊 Development Progress
(Where are they in terms of product development? What stage are they at? Is this a mature product or early stage? What do the commit patterns tell us about their velocity and focus areas?)

## 🔧 Latest Technical Shipments
(Deep dive into the actual GitHub commits and PRs. What specific features, fixes, or improvements did they ship recently? Be technical but accessible. Explain what each change means for the product.)

## 📡 Social & Community Gap Analysis
(How visible is this subnet on social media? Is there a gap between what they're building and how much attention they're getting? Are people talking about them? What's the social velocity?)

## ⚡ Emissions & Validator Confidence
(How much of the network's emissions go to this subnet? Is that proportion growing or shrinking? What does the emission rank tell us about validator confidence? Is there a gap between emissions and market cap?)

## 💰 Token Price Analysis
(How is the alpha token performing? Is the price reflecting the development activity and emission data? Is it undervalued or overvalued based on our metrics? What does the buy/sell ratio tell us?)

## 🌍 Real-World Applications
(Give 2-3 concrete examples of how this technology could be or is being used in the real world. Make it tangible — who would use this, what industry, what problem does it solve for them?)

## 🎯 The AlphaGap Verdict
(Our final, bold take. Is there an alpha gap here? Should investors be paying attention? What's the risk/reward? What catalysts could close the gap? Give a clear, actionable conclusion. Be opinionated — this is what our readers come for.)

---
*Report generated by AlphaGap Intelligence Engine on ${new Date().toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}*`;

    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": ANTHROPIC_KEY,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-5",
        max_tokens: 4000,
        messages: [{ role: "user", content: prompt }],
      }),
    });

    if (!res.ok) {
      const text = await res.text();
      return NextResponse.json({ error: `Claude API error: ${res.status} ${text}` }, { status: 502 });
    }

    const data = await res.json();
    const reportContent = data.content?.[0]?.text || "Report generation failed";

    // Step 5: Store the report in Vercel Blob
    const today = new Date().toISOString().split("T")[0];
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
        // Delete existing report for today first (Blob doesn't overwrite)
        try {
          const { blobs } = await list({ prefix: `reports/${today}`, limit: 5 });
          for (const b of blobs) {
            await del(b.url);
            console.log(`[report] Deleted old blob: ${b.pathname}`);
          }
        } catch { /* no existing blob */ }

        await put(`reports/${today}.json`, JSON.stringify(report), {
          access: "private",
          addRandomSuffix: false,
          contentType: "application/json",
        });
        console.log(`[report] Saved to Blob: reports/${today}.json`);
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
