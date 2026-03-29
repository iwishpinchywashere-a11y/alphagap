const GITHUB_PAT = process.env.GITHUB_PAT || "";

function headers(etag?: string): Record<string, string> {
  const h: Record<string, string> = { Accept: "application/vnd.github+json" };
  if (GITHUB_PAT) h.Authorization = `Bearer ${GITHUB_PAT}`;
  if (etag) h["If-None-Match"] = etag;
  return h;
}

// ── Rate limit check ─────────────────────────────────────────────
export async function getRateLimit() {
  const res = await fetch("https://api.github.com/rate_limit", { headers: headers() });
  return res.json();
}

// ── Search for Bittensor repos ───────────────────────────────────
export interface GitHubRepo {
  id: number;
  full_name: string;
  name: string;
  owner: { login: string };
  description: string | null;
  html_url: string;
  stargazers_count: number;
  updated_at: string;
  pushed_at: string;
  language: string | null;
  topics: string[];
}

export async function searchBittensorRepos(): Promise<GitHubRepo[]> {
  const queries = [
    "topic:bittensor",
    "bittensor+subnet+in:description",
    "bittensor+in:name",
  ];

  const allRepos = new Map<number, GitHubRepo>();

  for (const q of queries) {
    try {
      const res = await fetch(
        `https://api.github.com/search/repositories?q=${encodeURIComponent(q)}&sort=updated&per_page=100`,
        { headers: headers() }
      );
      if (res.ok) {
        const data = await res.json();
        for (const repo of data.items || []) {
          allRepos.set(repo.id, repo);
        }
      }
    } catch (e) {
      console.error(`GitHub search failed for "${q}":`, e);
    }
  }

  return Array.from(allRepos.values());
}

// ── Get repo events (with ETag support) ──────────────────────────
export interface GitHubEvent {
  id: string;
  type: string;
  actor: { login: string; display_login: string };
  repo: { name: string };
  payload: Record<string, unknown>;
  created_at: string;
}

export interface EventsResult {
  events: GitHubEvent[];
  etag: string | null;
  notModified: boolean;
}

export async function getRepoEvents(
  owner: string,
  repo: string,
  etag?: string
): Promise<EventsResult> {
  const res = await fetch(
    `https://api.github.com/repos/${owner}/${repo}/events?per_page=30`,
    { headers: headers(etag) }
  );

  if (res.status === 304) {
    return { events: [], etag: etag || null, notModified: true };
  }

  if (!res.ok) {
    return { events: [], etag: null, notModified: false };
  }

  const newEtag = res.headers.get("etag");
  const events: GitHubEvent[] = await res.json();
  return { events, etag: newEtag, notModified: false };
}

// ── Get latest releases ──────────────────────────────────────────
export interface GitHubRelease {
  id: number;
  tag_name: string;
  name: string;
  body: string;
  html_url: string;
  published_at: string;
  prerelease: boolean;
  author: { login: string };
}

export async function getRepoReleases(
  owner: string,
  repo: string,
  perPage: number = 5
): Promise<GitHubRelease[]> {
  const res = await fetch(
    `https://api.github.com/repos/${owner}/${repo}/releases?per_page=${perPage}`,
    { headers: headers() }
  );
  if (!res.ok) return [];
  return res.json();
}

// ── Get recent commits ───────────────────────────────────────────
export interface GitHubCommit {
  sha: string;
  commit: {
    message: string;
    author: { name: string; date: string };
  };
  html_url: string;
  author: { login: string } | null;
  stats?: { total: number; additions: number; deletions: number };
}

export async function getRepoCommits(
  owner: string,
  repo: string,
  since?: string,
  perPage: number = 30
): Promise<GitHubCommit[]> {
  let url = `https://api.github.com/repos/${owner}/${repo}/commits?per_page=${perPage}`;
  if (since) url += `&since=${since}`;

  const res = await fetch(url, { headers: headers() });
  if (!res.ok) return [];
  return res.json();
}

// ── Get commit activity stats ────────────────────────────────────
export interface CommitActivity {
  days: number[];
  total: number;
  week: number;
}

export async function getCommitActivity(
  owner: string,
  repo: string
): Promise<CommitActivity[]> {
  const res = await fetch(
    `https://api.github.com/repos/${owner}/${repo}/stats/commit_activity`,
    { headers: headers() }
  );
  if (!res.ok) return [];
  const data = await res.json();
  return Array.isArray(data) ? data : [];
}

// ── Parse event into readable format ─────────────────────────────
export function parseEvent(event: GitHubEvent): {
  title: string;
  description: string;
  significance: number;
  url: string;
} {
  const { type, payload, repo } = event;

  switch (type) {
    case "ReleaseEvent": {
      const release = payload.release as Record<string, unknown>;
      return {
        title: `New Release: ${release?.tag_name || "unknown"}`,
        description: (release?.name as string) || (release?.body as string)?.slice(0, 200) || "",
        significance: 90,
        url: (release?.html_url as string) || "",
      };
    }
    case "PushEvent": {
      const commits = (payload.commits as Array<Record<string, unknown>>) || [];
      const size = payload.size as number || commits.length;
      const sig = size > 10 ? 60 : size > 5 ? 40 : 20;
      const messages = commits
        .slice(0, 3)
        .map((c) => c.message as string)
        .join("; ");
      return {
        title: `${size} commit${size > 1 ? "s" : ""} pushed`,
        description: messages.slice(0, 300),
        significance: sig,
        url: `https://github.com/${repo.name}`,
      };
    }
    case "CreateEvent": {
      const refType = payload.ref_type as string;
      const ref = payload.ref as string;
      if (refType === "tag") {
        return {
          title: `New tag: ${ref}`,
          description: `Tag ${ref} created on ${repo.name}`,
          significance: 70,
          url: `https://github.com/${repo.name}/releases/tag/${ref}`,
        };
      }
      return {
        title: `New ${refType}: ${ref || ""}`,
        description: `${refType} created on ${repo.name}`,
        significance: 30,
        url: `https://github.com/${repo.name}`,
      };
    }
    case "WatchEvent":
      return {
        title: `Starred by ${event.actor.login}`,
        description: "",
        significance: 5,
        url: `https://github.com/${repo.name}`,
      };
    case "ForkEvent":
      return {
        title: `Forked by ${event.actor.login}`,
        description: "",
        significance: 15,
        url: `https://github.com/${repo.name}`,
      };
    case "IssuesEvent": {
      const issue = payload.issue as Record<string, unknown>;
      const action = payload.action as string;
      return {
        title: `Issue ${action}: ${(issue?.title as string) || ""}`,
        description: ((issue?.body as string) || "").slice(0, 200),
        significance: action === "opened" ? 25 : 15,
        url: (issue?.html_url as string) || "",
      };
    }
    case "PullRequestEvent": {
      const pr = payload.pull_request as Record<string, unknown>;
      const action = payload.action as string;
      const merged = action === "closed" && (pr?.merged as boolean);
      return {
        title: merged
          ? `PR merged: ${(pr?.title as string) || ""}`
          : `PR ${action}: ${(pr?.title as string) || ""}`,
        description: ((pr?.body as string) || "").slice(0, 200),
        significance: merged ? 50 : action === "opened" ? 35 : 15,
        url: (pr?.html_url as string) || "",
      };
    }
    default:
      return {
        title: type,
        description: "",
        significance: 5,
        url: `https://github.com/${repo.name}`,
      };
  }
}
