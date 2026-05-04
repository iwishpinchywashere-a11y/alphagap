// AlphaGap — Direct GitHub Scanner
// Queries GitHub API in real-time for EVERY subnet's repo on each scan.
// Replaces TaoStats commits_1d (stale daily snapshot) with true live data.
// Called 4x/day (every 6h). Uses GITHUB_PAT for 5,000 req/hr rate limit.

const GITHUB_PAT = process.env.GITHUB_PAT || "";

function ghHeaders(): Record<string, string> {
  const h: Record<string, string> = { Accept: "application/vnd.github+json" };
  if (GITHUB_PAT) h.Authorization = `Bearer ${GITHUB_PAT}`;
  return h;
}

// ── Types ─────────────────────────────────────────────────────────

export interface GitHubScanResult {
  netuid: number;
  owner: string;
  repo: string;
  repoUrl: string;
  // 24h activity (direct from GitHub API — always fresh)
  commits24h: number;
  contributors24h: number;
  commitMessages: string[];     // up to 15 most recent, formatted for AI
  // New release in last 24h
  hasNewRelease: boolean;
  releaseTag?: string;
  releaseName?: string;
  releaseBody?: string;
  releaseDate?: string;
  // Repo metadata (from GET /repos/{owner}/{repo})
  stars?: number;
  forks?: number;
  pushedAt?: string;
  // 30-day lines of code (additions + deletions) from GitHub's weekly stats
  // Undefined = GitHub returned 202 Computing (will populate next scan)
  loc_30d?: number;
}

// ── Parse GitHub repo URL ─────────────────────────────────────────

export function parseGitHubRepo(url: string): { owner: string; repo: string } | null {
  if (!url) return null;
  let path = url.trim();
  if (path.includes("github.com/")) {
    path = path.split("github.com/")[1];
  }
  path = path.replace(/^\/|\/$/g, "").replace(/\.git$/, "");
  const parts = path.split("/");
  if (parts.length < 2 || !parts[0] || !parts[1]) return null;
  return { owner: parts[0], repo: parts[1] };
}

// ── Main scanner ─────────────────────────────────────────────────

export async function scanAllSubnetGitHub(
  subnets: Array<{ netuid: number; github_repo: string | null }>
): Promise<Map<number, GitHubScanResult>> {
  const results = new Map<number, GitHubScanResult>();
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

  // Filter to subnets with GitHub repos we can parse
  const toScan = subnets
    .filter(s => s.github_repo)
    .map(s => {
      const parsed = parseGitHubRepo(s.github_repo!);
      if (!parsed) return null;
      return { netuid: s.netuid, repoUrl: s.github_repo!, ...parsed };
    })
    .filter((s): s is NonNullable<typeof s> => s !== null);

  console.log(`[github-scanner] Scanning ${toScan.length} subnet repos directly via GitHub API...`);
  if (!GITHUB_PAT) {
    console.warn("[github-scanner] WARNING: No GITHUB_PAT set — rate limit is 60 req/hr (unauthenticated). Add GITHUB_PAT for 5,000/hr.");
  }

  // Process in batches of 15 — each batch = 30 API calls (commits + releases)
  const BATCH = 15;
  for (let i = 0; i < toScan.length; i += BATCH) {
    const batch = toScan.slice(i, i + BATCH);

    await Promise.all(batch.map(async ({ netuid, owner, repo, repoUrl }) => {
      try {
        // Parallel: commits since 24h + releases + 30d LOC stats + repo metadata (stars/forks)
        const [commitsRes, releasesRes, codeFreqRes, repoMetaRes] = await Promise.allSettled([
          fetch(
            `https://api.github.com/repos/${owner}/${repo}/commits?since=${since}&per_page=50`,
            { headers: ghHeaders(), signal: AbortSignal.timeout(10000) }
          ),
          fetch(
            `https://api.github.com/repos/${owner}/${repo}/releases?per_page=3`,
            { headers: ghHeaders(), signal: AbortSignal.timeout(8000) }
          ),
          fetch(
            `https://api.github.com/repos/${owner}/${repo}/stats/code_frequency`,
            { headers: ghHeaders(), signal: AbortSignal.timeout(12000) }
          ),
          fetch(
            `https://api.github.com/repos/${owner}/${repo}`,
            { headers: ghHeaders(), signal: AbortSignal.timeout(8000) }
          ),
        ]);

        // ── Process commits ─────────────────────────────────────
        let commits24h = 0;
        const commitMessages: string[] = [];
        const contributors = new Set<string>();

        if (commitsRes.status === "fulfilled" && commitsRes.value.ok) {
          const data = await commitsRes.value.json();
          if (Array.isArray(data)) {
            commits24h = data.length;
            for (const c of data.slice(0, 15)) {
              // First line of commit message only (rest is detail)
              const msg = (c.commit?.message || "").split("\n")[0].trim().slice(0, 120);
              const date = c.commit?.author?.date?.slice(0, 10) || "";
              const sha = (c.sha || "").slice(0, 7);
              if (msg) commitMessages.push(`[${date}] ${sha}: ${msg}`);
              const author = c.commit?.author?.name || c.author?.login || "";
              if (author) contributors.add(author);
            }
          }
        } else if (commitsRes.status === "fulfilled" && commitsRes.value.status === 409) {
          // Empty repo — skip silently
        } else if (commitsRes.status === "fulfilled" && commitsRes.value.status === 404) {
          // Repo not found or private — skip
          return;
        }

        // ── Process releases ────────────────────────────────────
        let hasNewRelease = false;
        let releaseTag: string | undefined;
        let releaseName: string | undefined;
        let releaseBody: string | undefined;
        let releaseDate: string | undefined;

        if (releasesRes.status === "fulfilled" && releasesRes.value.ok) {
          const releases = await releasesRes.value.json();
          if (Array.isArray(releases) && releases.length > 0) {
            const latest = releases[0];
            const publishedAt = latest.published_at || latest.created_at;
            if (publishedAt && new Date(publishedAt) >= new Date(since)) {
              hasNewRelease = true;
              releaseTag = latest.tag_name || "";
              releaseName = latest.name || latest.tag_name || "";
              releaseBody = (latest.body || "").slice(0, 1500);
              releaseDate = publishedAt;
            }
          }
        }

        // ── Process 30d LOC (code_frequency) ───────────────────────
        // GitHub returns [[weekTimestamp, additions, deletions], ...] for the repo's lifetime.
        // Sum the last 4 complete weeks (+ partial current week) = ~30 days.
        // 202 "Computing" = GitHub is building the stat — skip, will populate next scan.
        let loc_30d: number | undefined;
        if (codeFreqRes.status === "fulfilled" && codeFreqRes.value.status === 200) {
          try {
            const freqData = await codeFreqRes.value.json();
            if (Array.isArray(freqData) && freqData.length > 0) {
              // Take last 5 buckets (covers ~35 days to ensure 30d window)
              const recentWeeks = freqData.slice(-5);
              const thirtyDaysAgoMs = Date.now() - 30 * 24 * 60 * 60 * 1000;
              let total = 0;
              for (const [weekTs, additions, deletions] of recentWeeks) {
                if (weekTs * 1000 >= thirtyDaysAgoMs) {
                  total += Math.abs(additions) + Math.abs(deletions);
                }
              }
              loc_30d = total;
            }
          } catch {
            // JSON parse error — leave undefined
          }
        }
        // 202 = GitHub computing stats in background; undefined means "not yet available"

        // ── Process repo metadata (stars, forks) ────────────────────
        let stars: number | undefined;
        let forks: number | undefined;
        if (repoMetaRes.status === "fulfilled" && repoMetaRes.value.ok) {
          try {
            const meta = await repoMetaRes.value.json();
            if (typeof meta?.stargazers_count === "number") stars = meta.stargazers_count;
            if (typeof meta?.forks_count === "number") forks = meta.forks_count;
          } catch { /* ignore parse error */ }
        }

        results.set(netuid, {
          netuid,
          owner,
          repo,
          repoUrl,
          commits24h,
          contributors24h: contributors.size,
          commitMessages,
          hasNewRelease,
          releaseTag,
          releaseName,
          releaseBody,
          releaseDate,
          stars,
          forks,
          loc_30d,
        });

        if (commits24h > 0 || hasNewRelease) {
          console.log(
            `[github-scanner] SN${netuid} (${owner}/${repo}): ` +
            `${commits24h} commits, ${contributors.size} contributors` +
            (hasNewRelease ? `, 🚀 NEW RELEASE: ${releaseTag}` : "")
          );
        }
      } catch {
        // Skip on error (private repo, network timeout, etc.)
      }
    }));

    // Small delay between batches — be respectful of GitHub rate limits
    if (i + BATCH < toScan.length) {
      await new Promise(r => setTimeout(r, 150));
    }
  }

  const activeCount = [...results.values()].filter(r => r.commits24h > 0 || r.hasNewRelease).length;
  console.log(
    `[github-scanner] ✓ ${results.size} repos scanned. ` +
    `${activeCount} with activity in last 24h.`
  );

  return results;
}
