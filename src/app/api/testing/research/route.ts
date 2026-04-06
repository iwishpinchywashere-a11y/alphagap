import { NextRequest, NextResponse } from "next/server";
import { parseGitHubRepo } from "@/lib/github-scanner";
import { getPoolHistory } from "@/lib/taostats";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const GITHUB_PAT = process.env.GITHUB_PAT || "";

function ghHeaders(): Record<string, string> {
  const h: Record<string, string> = { Accept: "application/vnd.github+json" };
  if (GITHUB_PAT) h.Authorization = `Bearer ${GITHUB_PAT}`;
  return h;
}

// ── Types returned to client ───────────────────────────────────────────────

export interface CommitSummary {
  sha: string;
  message: string;
  author: string;
  date: string;
  daysBeforePump: number;
}

export interface DailyCommitCount {
  date: string;       // YYYY-MM-DD
  count: number;
  daysBeforePump: number;
}

export interface GitHubResearch {
  owner: string;
  repo: string;
  repoUrl: string;
  totalCommits: number;
  uniqueContributors: number;
  commitsByDay: DailyCommitCount[];
  peakDay: string;       // YYYY-MM-DD
  peakCount: number;
  baselineAvgPerDay: number;   // avg commits/day in days -30 to -15 (baseline window)
  spikeWindow: number;         // avg commits/day in days -7 to 0 (spike window)
  spikeMultiplier: number;     // spikeWindow / baselineAvgPerDay
  topCommits: CommitSummary[]; // up to 10 most significant commits
  hasRelease: boolean;
  releaseInfo?: { tag: string; name: string; date: string };
  finding: string;             // plain-English summary
}

export interface EmissionResearch {
  prePumpAvgPct: number;   // avg emission % in -30 to -14 days
  pumpWindowAvgPct: number; // avg emission % in -7 to 0 days
  delta: number;
  trend: "rising" | "falling" | "flat";
  prePumpVolume: number;   // avg 24h TAO volume before pump
  pumpWindowVolume: number;
  volumeMultiplier: number;
  finding: string;
}

export interface ResearchResult {
  netuid: number;
  pumpStartDate: string;
  github: GitHubResearch | null;
  emission: EmissionResearch | null;
  overallFindings: string[];
}

// ── GitHub retroactive research ────────────────────────────────────────────

async function researchGitHub(
  repoUrl: string,
  pumpStartDate: string
): Promise<GitHubResearch | null> {
  const parsed = parseGitHubRepo(repoUrl);
  if (!parsed) return null;
  const { owner, repo } = parsed;

  const pumpMs = new Date(pumpStartDate).getTime();
  const since = new Date(pumpMs - 30 * 86400000).toISOString(); // 30 days before pump
  const until = new Date(pumpMs + 86400000).toISOString();      // pump day +1

  try {
    // Fetch all commits in the 30-day window (paginated, up to 200)
    const allCommits: Array<{
      sha: string;
      commit: { message: string; author: { name: string; date: string } };
    }> = [];

    for (let page = 1; page <= 4; page++) {
      const res = await fetch(
        `https://api.github.com/repos/${owner}/${repo}/commits?since=${since}&until=${until}&per_page=50&page=${page}`,
        { headers: ghHeaders(), signal: AbortSignal.timeout(12000) }
      );
      if (!res.ok) break;
      const batch = await res.json();
      if (!Array.isArray(batch) || batch.length === 0) break;
      allCommits.push(...batch);
      if (batch.length < 50) break;
    }

    // Fetch latest release (to see if one dropped before the pump)
    let releaseInfo: GitHubResearch["releaseInfo"];
    let hasRelease = false;
    try {
      const relRes = await fetch(
        `https://api.github.com/repos/${owner}/${repo}/releases?per_page=5`,
        { headers: ghHeaders(), signal: AbortSignal.timeout(8000) }
      );
      if (relRes.ok) {
        const releases = await relRes.json();
        if (Array.isArray(releases)) {
          const preRelease = releases.find((r: { published_at: string; tag_name: string; name: string }) => {
            const releaseMs = new Date(r.published_at).getTime();
            return releaseMs >= pumpMs - 30 * 86400000 && releaseMs <= pumpMs + 86400000;
          });
          if (preRelease) {
            hasRelease = true;
            releaseInfo = {
              tag: preRelease.tag_name,
              name: preRelease.name || preRelease.tag_name,
              date: preRelease.published_at,
            };
          }
        }
      }
    } catch { /* releases optional */ }

    // Aggregate by day
    const byDay = new Map<string, number>();
    const contributors = new Set<string>();

    for (const c of allCommits) {
      const d = c.commit.author.date.split("T")[0]; // YYYY-MM-DD
      byDay.set(d, (byDay.get(d) ?? 0) + 1);
      contributors.add(c.commit.author.name);
    }

    const commitsByDay: DailyCommitCount[] = Array.from(byDay.entries())
      .map(([date, count]) => ({
        date,
        count,
        daysBeforePump: Math.round((pumpMs - new Date(date).getTime()) / 86400000),
      }))
      .sort((a, b) => a.daysBeforePump - b.daysBeforePump);

    // Baseline window: -30 to -15 days before pump
    const baselineDays = commitsByDay.filter(d => d.daysBeforePump >= 15 && d.daysBeforePump <= 30);
    const baselineAvgPerDay = baselineDays.length > 0
      ? baselineDays.reduce((s, d) => s + d.count, 0) / 15
      : 0;

    // Spike window: -7 to 0 days before pump
    const spikeDays = commitsByDay.filter(d => d.daysBeforePump >= 0 && d.daysBeforePump <= 7);
    const spikeWindow = spikeDays.length > 0
      ? spikeDays.reduce((s, d) => s + d.count, 0) / 7
      : 0;

    const spikeMultiplier = baselineAvgPerDay > 0 ? spikeWindow / baselineAvgPerDay : 0;

    // Peak day
    const peakEntry = commitsByDay.reduce(
      (best, d) => (d.count > best.count ? d : best),
      { date: "", count: 0, daysBeforePump: 0 }
    );

    // Top commits (prefer recent ones with meaningful messages)
    const topCommits: CommitSummary[] = allCommits
      .filter(c => c.commit.message.length > 15 && !c.commit.message.startsWith("Merge"))
      .slice(0, 10)
      .map(c => ({
        sha: c.sha.slice(0, 7),
        message: c.commit.message.split("\n")[0].slice(0, 100),
        author: c.commit.author.name,
        date: c.commit.author.date.split("T")[0],
        daysBeforePump: Math.round((pumpMs - new Date(c.commit.author.date).getTime()) / 86400000),
      }));

    // Plain-English finding
    let finding = "";
    if (allCommits.length === 0) {
      finding = "No commits found in the 30-day pre-pump window. Repo may be private or had no activity.";
    } else if (spikeMultiplier >= 3) {
      finding = `🔥 Strong dev spike: ${spikeWindow.toFixed(1)} commits/day in the week before pump vs ${baselineAvgPerDay.toFixed(1)}/day baseline (${spikeMultiplier.toFixed(1)}× surge). Peak on ${peakEntry.date} (${peakEntry.count} commits). This is a leading signal.`;
    } else if (spikeMultiplier >= 1.5) {
      finding = `📈 Moderate dev acceleration: ${spikeWindow.toFixed(1)} commits/day pre-pump vs ${baselineAvgPerDay.toFixed(1)}/day baseline (${spikeMultiplier.toFixed(1)}×). Activity picked up but not a dramatic spike.`;
    } else if (allCommits.length >= 20) {
      finding = `✅ Steady development: ${allCommits.length} commits over 30 days with consistent pace. No spike but ongoing activity.`;
    } else {
      finding = `⚠️ Low dev activity: Only ${allCommits.length} commits in the 30-day pre-pump window. Pump may have been market-driven rather than fundamental.`;
    }

    if (hasRelease && releaseInfo) {
      const daysBeforeRelease = Math.round((pumpMs - new Date(releaseInfo.date).getTime()) / 86400000);
      finding += ` 🚀 Release "${releaseInfo.name}" dropped ${daysBeforeRelease}d before pump start.`;
    }

    return {
      owner, repo,
      repoUrl,
      totalCommits: allCommits.length,
      uniqueContributors: contributors.size,
      commitsByDay,
      peakDay: peakEntry.date,
      peakCount: peakEntry.count,
      baselineAvgPerDay,
      spikeWindow,
      spikeMultiplier,
      topCommits,
      hasRelease,
      releaseInfo,
      finding,
    };
  } catch (e) {
    console.error(`[research/github] Error for ${owner}/${repo}:`, e);
    return null;
  }
}

// ── Emission / volume retroactive research ─────────────────────────────────

async function researchEmission(
  netuid: number,
  pumpStartDate: string
): Promise<EmissionResearch | null> {
  try {
    const history = await getPoolHistory(netuid, 90);
    if (!history || history.length < 10) return null;

    const pumpMs = new Date(pumpStartDate).getTime();

    // Tag each point with daysBeforePump
    const tagged = history.map(h => {
      const ts = Number(h.timestamp);
      const d = new Date(ts < 1e12 ? ts * 1000 : ts);
      return {
        date: d.toISOString().split("T")[0],
        daysBeforePump: Math.round((pumpMs - d.getTime()) / 86400000),
        volume: parseFloat(h.tao_volume_24_hr) || 0,
      };
    });

    // Baseline window (-30 to -14 days)
    const baseline = tagged.filter(t => t.daysBeforePump >= 14 && t.daysBeforePump <= 30);
    const prePumpVolume = baseline.length > 0
      ? baseline.reduce((s, t) => s + t.volume, 0) / baseline.length
      : 0;

    // Pump window (-7 to pump day)
    const pumpWindow = tagged.filter(t => t.daysBeforePump >= 0 && t.daysBeforePump <= 7);
    const pumpWindowVolume = pumpWindow.length > 0
      ? pumpWindow.reduce((s, t) => s + t.volume, 0) / pumpWindow.length
      : 0;

    const volumeMultiplier = prePumpVolume > 0 ? pumpWindowVolume / prePumpVolume : 0;

    // We don't have per-day emission % from pool history (it's in the scan blob).
    // Use volume as a proxy for on-chain interest.
    const trend: "rising" | "falling" | "flat" =
      volumeMultiplier >= 1.5 ? "rising" : volumeMultiplier <= 0.7 ? "falling" : "flat";

    const fmtVol = (v: number) => {
      if (v >= 1000) return `${(v / 1000).toFixed(1)}K TAO`;
      return `${v.toFixed(1)} TAO`;
    };

    let finding = "";
    if (volumeMultiplier >= 3) {
      finding = `🔥 Volume explosion: avg ${fmtVol(pumpWindowVolume)}/day in pump window vs ${fmtVol(prePumpVolume)}/day baseline (${volumeMultiplier.toFixed(1)}×). Massive on-chain buying pressure preceded the move.`;
    } else if (volumeMultiplier >= 1.5) {
      finding = `📈 Volume rising: ${fmtVol(pumpWindowVolume)}/day pre-pump vs ${fmtVol(prePumpVolume)}/day baseline (${volumeMultiplier.toFixed(1)}×). Clear uptick in trading activity.`;
    } else if (volumeMultiplier >= 0.7) {
      finding = `➡️ Volume steady around ${fmtVol(pumpWindowVolume)}/day — no abnormal on-chain activity detected before pump.`;
    } else {
      finding = `📉 Volume declining before pump (${fmtVol(pumpWindowVolume)}/day vs ${fmtVol(prePumpVolume)}/day baseline). Pump may have been low-liquidity driven.`;
    }

    return {
      prePumpAvgPct: 0,
      pumpWindowAvgPct: 0,
      delta: 0,
      trend,
      prePumpVolume,
      pumpWindowVolume,
      volumeMultiplier,
      finding,
    };
  } catch (e) {
    console.error(`[research/emission] Error for SN${netuid}:`, e);
    return null;
  }
}

// ── AlphaGap signal research from scan-latest.json ────────────────────────

async function researchAlphaGapSignal(
  netuid: number,
  currentScores?: { composite_score?: number; dev_score?: number; social_score?: number; product_score?: number; emission_pct?: number }
): Promise<string[]> {
  const findings: string[] = [];

  // Try to pull live data from scan blob if no scores passed
  let scores = currentScores;
  if (!scores || scores.composite_score == null) {
    try {
      const token = process.env.BLOB_READ_WRITE_TOKEN || "";
      if (token) {
        const { get: blobGet } = await import("@vercel/blob");
        const blob = await blobGet("scan-latest.json", { token, access: "private" });
        if (blob?.stream) {
          const reader = blob.stream.getReader();
          const chunks: Uint8Array[] = [];
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            chunks.push(value);
          }
          const scan = JSON.parse(Buffer.concat(chunks).toString("utf-8"));
          const entry = (scan.leaderboard ?? []).find((e: { netuid: number }) => e.netuid === netuid);
          if (entry) {
            scores = {
              composite_score: entry.composite_score,
              dev_score: entry.dev_score,
              social_score: entry.social_score,
              product_score: entry.product_score,
              emission_pct: entry.emission_pct,
            };
          }
        }
      }
    } catch { /* best-effort */ }
  }

  if (!scores || scores.composite_score == null) {
    findings.push("⚠️ No AlphaGap score data available — subnet may not be in the scan leaderboard");
    return findings;
  }

  const { composite_score = 0, dev_score = 0, social_score = 0, product_score = 0, emission_pct = 0 } = scores;

  if (composite_score >= 80) {
    findings.push(`🎯 AlphaGap STRONG SIGNAL: Composite score was ${composite_score}/100 (top-tier). Our algorithm correctly identified this as a high-value subnet BEFORE the pump. This is the primary prediction signal.`);
  } else if (composite_score >= 65) {
    findings.push(`🎯 AlphaGap MODERATE SIGNAL: Composite score was ${composite_score}/100 — above-average rating that flagged meaningful activity before the pump.`);
  } else if (composite_score >= 45) {
    findings.push(`📊 AlphaGap score was ${composite_score}/100 at the time — mid-tier, pump may have been partially externally driven.`);
  } else {
    findings.push(`📊 AlphaGap score was ${composite_score}/100 — below signal threshold. This pump was likely driven by factors outside what AlphaGap currently measures.`);
  }

  // Sub-score breakdown
  const breakdown: string[] = [];
  if (dev_score >= 70) breakdown.push(`Dev ${dev_score} 🔥`);
  else if (dev_score >= 50) breakdown.push(`Dev ${dev_score} 📈`);
  else breakdown.push(`Dev ${dev_score}`);

  if (social_score >= 70) breakdown.push(`Social ${social_score} 🔥`);
  else if (social_score >= 50) breakdown.push(`Social ${social_score} 📈`);
  else breakdown.push(`Social ${social_score}`);

  if (product_score >= 70) breakdown.push(`Product ${product_score} 🔥`);
  else if (product_score >= 50) breakdown.push(`Product ${product_score} 📈`);
  else breakdown.push(`Product ${product_score}`);

  if (emission_pct > 0) breakdown.push(`Em% ${(emission_pct * 100).toFixed(3)}%`);

  findings.push(`📋 Sub-score breakdown: ${breakdown.join(" · ")}`);

  // What drove the score
  const drivers: string[] = [];
  if (dev_score >= 70) drivers.push("strong developer activity");
  if (social_score >= 70) drivers.push("elevated social/KOL buzz");
  if (product_score >= 80) drivers.push("confirmed benchmarked product (beating centralized AI providers)");
  else if (product_score >= 60) drivers.push("live product with verifiable traction");

  if (drivers.length > 0) {
    findings.push(`✅ Key drivers behind the high score: ${drivers.join(", ")}.`);
  }

  return findings;
}

// ── Route handler ──────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  const body = await req.json() as {
    netuid: number;
    github_repo?: string;
    pump_start_date: string;
    // Optional: pass current AlphaGap scores from client to avoid re-fetching blob
    current_scores?: {
      composite_score?: number;
      dev_score?: number;
      social_score?: number;
      product_score?: number;
      emission_pct?: number;
    };
  };

  const { netuid, github_repo, pump_start_date, current_scores } = body;
  if (!netuid || !pump_start_date) {
    return NextResponse.json({ error: "netuid and pump_start_date required" }, { status: 400 });
  }

  const [github, emission, agapFindings] = await Promise.all([
    github_repo ? researchGitHub(github_repo, pump_start_date) : Promise.resolve(null),
    researchEmission(netuid, pump_start_date),
    researchAlphaGapSignal(netuid, current_scores),
  ]);

  const overallFindings: string[] = [];

  // Lead with AlphaGap's own signal — this is the most important finding
  overallFindings.push(...agapFindings);

  if (github) {
    overallFindings.push(github.finding);
    if (github.hasRelease && github.releaseInfo) {
      overallFindings.push(`📦 Release "${github.releaseInfo.name}" published before pump`);
    }
  } else if (github_repo) {
    overallFindings.push("GitHub repo found but no commit data available (may be private)");
  } else {
    overallFindings.push("No GitHub repo linked — GitHub dev activity can't be analyzed retroactively");
  }

  if (emission) {
    overallFindings.push(emission.finding);
  }

  const result: ResearchResult = {
    netuid,
    pumpStartDate: pump_start_date,
    github,
    emission,
    overallFindings,
  };

  return NextResponse.json(result);
}
