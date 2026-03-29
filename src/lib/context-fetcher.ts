// Fetches rich context for signals — README content, release notes, model cards, commit details

const GITHUB_PAT = process.env.GITHUB_PAT || "";

function ghHeaders(): Record<string, string> {
  const h: Record<string, string> = { Accept: "application/vnd.github+json" };
  if (GITHUB_PAT) h.Authorization = `Bearer ${GITHUB_PAT}`;
  return h;
}

// ── Fetch GitHub README ──────────────────────────────────────────
export async function fetchReadme(owner: string, repo: string): Promise<string | null> {
  try {
    const res = await fetch(
      `https://api.github.com/repos/${owner}/${repo}/readme`,
      { headers: { ...ghHeaders(), Accept: "application/vnd.github.raw+json" } }
    );
    if (!res.ok) return null;
    const text = await res.text();
    // Truncate to ~3000 chars to save tokens
    return text.slice(0, 3000);
  } catch {
    return null;
  }
}

// ── Fetch latest GitHub release ──────────────────────────────────
export async function fetchLatestRelease(owner: string, repo: string): Promise<{
  tag: string;
  name: string;
  body: string;
  date: string;
} | null> {
  try {
    const res = await fetch(
      `https://api.github.com/repos/${owner}/${repo}/releases/latest`,
      { headers: ghHeaders() }
    );
    if (!res.ok) return null;
    const data = await res.json();
    return {
      tag: data.tag_name,
      name: data.name || data.tag_name,
      body: (data.body || "").slice(0, 2000),
      date: data.published_at,
    };
  } catch {
    return null;
  }
}

// ── Fetch recent commits with FULL messages ──────────────────────
export async function fetchRecentCommits(owner: string, repo: string, count: number = 20): Promise<string[]> {
  try {
    const res = await fetch(
      `https://api.github.com/repos/${owner}/${repo}/commits?per_page=${count}`,
      { headers: ghHeaders() }
    );
    if (!res.ok) return [];
    const data = await res.json();
    return data.map((c: { commit: { message: string; author: { date: string } }; sha: string }) => {
      // Include full commit message (not just first line) — this is where the detail is
      const msg = c.commit.message.slice(0, 300);
      const date = c.commit.author.date?.slice(0, 10) || "";
      return `[${date}] ${c.sha.slice(0, 7)}: ${msg}`;
    });
  } catch {
    return [];
  }
}

// ── Fetch recent merged PRs (rich descriptions of what was built) ──
export async function fetchRecentPRs(owner: string, repo: string, count: number = 10): Promise<string[]> {
  try {
    const res = await fetch(
      `https://api.github.com/repos/${owner}/${repo}/pulls?state=closed&sort=updated&direction=desc&per_page=${count}`,
      { headers: ghHeaders() }
    );
    if (!res.ok) return [];
    const data = await res.json();
    return data
      .filter((pr: { merged_at: string | null }) => pr.merged_at) // only merged PRs
      .map((pr: { title: string; body: string | null; merged_at: string; user: { login: string } }) => {
        const body = (pr.body || "").slice(0, 400);
        const date = pr.merged_at?.slice(0, 10) || "";
        return `[${date}] PR: ${pr.title}${body ? `\n  ${body}` : ""}`;
      });
  } catch {
    return [];
  }
}

// ── Fetch HuggingFace model card ─────────────────────────────────
export async function fetchModelCard(modelId: string): Promise<string | null> {
  try {
    const res = await fetch(`https://huggingface.co/api/models/${modelId}`);
    if (!res.ok) return null;
    const data = await res.json();

    const parts: string[] = [];
    if (data.pipeline_tag) parts.push(`Pipeline: ${data.pipeline_tag}`);
    if (data.library_name) parts.push(`Library: ${data.library_name}`);
    if (data.tags?.length) parts.push(`Tags: ${data.tags.slice(0, 10).join(", ")}`);
    if (data.downloads) parts.push(`Downloads: ${data.downloads}`);
    if (data.likes) parts.push(`Likes: ${data.likes}`);
    if (data.cardData?.model_name) parts.push(`Model: ${data.cardData.model_name}`);
    if (data.cardData?.datasets) parts.push(`Datasets: ${[].concat(data.cardData.datasets).slice(0, 5).join(", ")}`);
    if (data.cardData?.language) parts.push(`Language: ${[].concat(data.cardData.language).join(", ")}`);

    // Also try to get the README/model card text
    const readmeRes = await fetch(`https://huggingface.co/${modelId}/raw/main/README.md`);
    if (readmeRes.ok) {
      const readme = await readmeRes.text();
      parts.push(`\n--- Model Card ---\n${readme.slice(0, 2000)}`);
    }

    return parts.join("\n");
  } catch {
    return null;
  }
}

// ── Fetch HuggingFace dataset info ───────────────────────────────
export async function fetchDatasetInfo(datasetId: string): Promise<string | null> {
  try {
    const res = await fetch(`https://huggingface.co/api/datasets/${datasetId}`);
    if (!res.ok) return null;
    const data = await res.json();

    const parts: string[] = [];
    if (data.tags?.length) parts.push(`Tags: ${data.tags.slice(0, 10).join(", ")}`);
    if (data.downloads) parts.push(`Downloads: ${data.downloads}`);
    if (data.likes) parts.push(`Likes: ${data.likes}`);
    if (data.cardData?.size_categories) parts.push(`Size: ${data.cardData.size_categories}`);

    return parts.join("\n") || null;
  } catch {
    return null;
  }
}

// ── Build context package for a signal ───────────────────────────
export interface SignalContext {
  subnetName: string;
  subnetDescription: string;
  signalType: string;
  signalTitle: string;
  signalDescription: string;
  sourceUrl?: string;
  githubContext?: string;
  hfContext?: string;
  recentCommits?: string[];
  recentPRs?: string[];
  releaseNotes?: string;
  alphaPrice?: number;
  marketCap?: number;
  netFlow?: number;
}

export async function buildSignalContext(signal: {
  netuid: number;
  signal_type: string;
  title: string;
  description: string;
  source: string;
  source_url?: string;
}, subnetInfo: {
  name: string;
  description: string;
  github_url?: string;
  alpha_price?: number;
  market_cap?: number;
  net_flow_24h?: number;
}): Promise<SignalContext> {
  const ctx: SignalContext = {
    subnetName: subnetInfo.name || `Subnet ${signal.netuid}`,
    subnetDescription: subnetInfo.description || "",
    signalType: signal.signal_type,
    signalTitle: signal.title,
    signalDescription: signal.description,
    sourceUrl: signal.source_url,
    alphaPrice: subnetInfo.alpha_price,
    marketCap: subnetInfo.market_cap,
    netFlow: subnetInfo.net_flow_24h,
  };

  // Parse GitHub repo from URL
  let owner = "";
  let repo = "";
  if (subnetInfo.github_url) {
    const parts = subnetInfo.github_url.replace(/.*github\.com\//, "").replace(/\/$/, "").split("/");
    if (parts.length >= 2) {
      owner = parts[0];
      repo = parts[1];
    }
  }

  // Fetch context based on signal type
  if (signal.source === "github" && owner && repo) {
    const [readme, release, commits, prs] = await Promise.all([
      fetchReadme(owner, repo),
      fetchLatestRelease(owner, repo),
      fetchRecentCommits(owner, repo, 20),
      fetchRecentPRs(owner, repo, 10),
    ]);

    if (readme) ctx.githubContext = readme;
    if (release) ctx.releaseNotes = `${release.name} (${release.tag}): ${release.body}`;
    if (commits.length) ctx.recentCommits = commits;
    if (prs.length) ctx.recentPRs = prs;
  }

  if (signal.source === "huggingface" && signal.source_url) {
    // Extract model/dataset ID from URL
    const url = signal.source_url;
    if (url.includes("huggingface.co/")) {
      const pathPart = url.split("huggingface.co/")[1];
      if (signal.signal_type === "hf_drop") {
        if (pathPart.startsWith("datasets/")) {
          const dsId = pathPart.replace("datasets/", "");
          const info = await fetchDatasetInfo(dsId);
          if (info) ctx.hfContext = info;
        } else {
          // It's a model
          const modelId = pathPart.replace("models/", "");
          const card = await fetchModelCard(modelId);
          if (card) ctx.hfContext = card;
        }
      }
    }
  }

  // For flow/taostats signals, fetch GitHub context too if available
  if (signal.source === "taostats" && owner && repo) {
    const [readme, commits, prs] = await Promise.all([
      fetchReadme(owner, repo),
      fetchRecentCommits(owner, repo, 15),
      fetchRecentPRs(owner, repo, 10),
    ]);
    if (readme) ctx.githubContext = readme;
    if (commits.length) ctx.recentCommits = commits;
    if (prs.length) ctx.recentPRs = prs;
  }

  return ctx;
}
