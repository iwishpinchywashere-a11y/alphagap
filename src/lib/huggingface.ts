import { getDb } from "./db";

const HF_TOKEN = process.env.HUGGINGFACE_TOKEN || "";
const HF_API = "https://huggingface.co/api";

function hfHeaders(): Record<string, string> {
  const h: Record<string, string> = {};
  if (HF_TOKEN) h.Authorization = `Bearer ${HF_TOKEN}`;
  return h;
}

// ── Seed list of known Bittensor orgs (starting point) ───────────
const SEED_HF_ORGS: { org: string; netuid?: number }[] = [
  { org: "opentensor" },
  { org: "macrocosm-os", netuid: 1 },
  { org: "RaoFoundation", netuid: 9 },
  { org: "bitmind", netuid: 34 },
  { org: "omegalabsinc", netuid: 24 },
  { org: "BitAgent", netuid: 20 },
  { org: "404-Gen", netuid: 17 },
  { org: "CortexLM", netuid: 18 },
  { org: "tensorplex-labs" },
  { org: "coldint" },
  { org: "borggAI" },
  { org: "NousResearch", netuid: 6 },
  { org: "manifold-inc", netuid: 4 },
];

// ── Generic item types ───────────────────────────────────────────
export interface HFItem {
  _id: string;
  id: string;
  modelId?: string;
  author: string;
  sha?: string;
  lastModified: string;
  createdAt?: string;
  private: boolean;
  disabled?: boolean;
  downloads?: number;
  likes?: number;
  tags?: string[];
  pipeline_tag?: string;
  library_name?: string;
  cardData?: Record<string, unknown>;
}

// ── List models by author ────────────────────────────────────────
export async function listModelsByAuthor(author: string, limit: number = 20): Promise<HFItem[]> {
  try {
    const res = await fetch(
      `${HF_API}/models?author=${encodeURIComponent(author)}&sort=createdAt&direction=-1&limit=${limit}`,
      { headers: hfHeaders() }
    );
    if (!res.ok) return [];
    return res.json();
  } catch { return []; }
}

// ── List datasets by author ──────────────────────────────────────
export async function listDatasetsByAuthor(author: string, limit: number = 20): Promise<HFItem[]> {
  try {
    const res = await fetch(
      `${HF_API}/datasets?author=${encodeURIComponent(author)}&sort=createdAt&direction=-1&limit=${limit}`,
      { headers: hfHeaders() }
    );
    if (!res.ok) return [];
    return res.json();
  } catch { return []; }
}

// ── List spaces by author ────────────────────────────────────────
export async function listSpacesByAuthor(author: string, limit: number = 20): Promise<HFItem[]> {
  try {
    const res = await fetch(
      `${HF_API}/spaces?author=${encodeURIComponent(author)}&sort=createdAt&direction=-1&limit=${limit}`,
      { headers: hfHeaders() }
    );
    if (!res.ok) return [];
    return res.json();
  } catch { return []; }
}

// ── Check if an org exists on HuggingFace ────────────────────────
async function orgExistsOnHF(orgName: string): Promise<boolean> {
  try {
    // Quick check: try to list models by this author (returns [] if not found, not an error)
    const res = await fetch(
      `${HF_API}/models?author=${encodeURIComponent(orgName)}&limit=1`,
      { headers: hfHeaders() }
    );
    if (!res.ok) return false;
    const data = await res.json();
    if (data.length > 0) return true;

    // Also check datasets
    const dsRes = await fetch(
      `${HF_API}/datasets?author=${encodeURIComponent(orgName)}&limit=1`,
      { headers: hfHeaders() }
    );
    if (!dsRes.ok) return false;
    const dsData = await dsRes.json();
    if (dsData.length > 0) return true;

    // And spaces
    const spRes = await fetch(
      `${HF_API}/spaces?author=${encodeURIComponent(orgName)}&limit=1`,
      { headers: hfHeaders() }
    );
    if (!spRes.ok) return false;
    const spData = await spRes.json();
    return spData.length > 0;
  } catch {
    return false;
  }
}

// ── Search HF for bittensor-tagged content ───────────────────────
export async function searchBittensorContent(): Promise<{ org: string; type: string }[]> {
  const found: Map<string, string> = new Map();

  for (const type of ["models", "datasets", "spaces"] as const) {
    try {
      const res = await fetch(
        `${HF_API}/${type}?search=bittensor&sort=createdAt&direction=-1&limit=100`,
        { headers: hfHeaders() }
      );
      if (!res.ok) continue;
      const items: HFItem[] = await res.json();
      for (const item of items) {
        if (item.author && !found.has(item.author)) {
          found.set(item.author, type.slice(0, -1)); // "models" -> "model"
        }
      }
    } catch { /* skip */ }
  }

  return Array.from(found.entries()).map(([org, type]) => ({ org, type }));
}

// ── Auto-discover HF orgs from GitHub org names ──────────────────
export async function discoverHFOrgs(): Promise<number> {
  const db = getDb();
  let discovered = 0;

  // 1. Get all GitHub org names we track
  const ghOrgs = db
    .prepare("SELECT DISTINCT org, netuid FROM github_repos")
    .all() as Array<{ org: string; netuid: number }>;

  // 2. Get orgs we already know about on HF
  const knownHF = new Set(
    (db.prepare("SELECT org_name FROM hf_orgs").all() as Array<{ org_name: string }>)
      .map(r => r.org_name.toLowerCase())
  );

  const upsertOrg = db.prepare(`
    INSERT INTO hf_orgs (netuid, org_name)
    VALUES (?, ?)
    ON CONFLICT(org_name) DO UPDATE SET netuid = COALESCE(excluded.netuid, hf_orgs.netuid)
  `);

  // 3. Ensure seed orgs are in DB
  for (const seed of SEED_HF_ORGS) {
    if (!knownHF.has(seed.org.toLowerCase())) {
      upsertOrg.run(seed.netuid || null, seed.org);
      knownHF.add(seed.org.toLowerCase());
      discovered++;
    }
  }

  // 4. Check GitHub orgs against HuggingFace (batch of unchecked ones)
  const unchecked = ghOrgs.filter(g => !knownHF.has(g.org.toLowerCase()));
  console.log(`Checking ${unchecked.length} GitHub orgs for HuggingFace presence...`);

  for (const ghOrg of unchecked) {
    try {
      const exists = await orgExistsOnHF(ghOrg.org);
      if (exists) {
        upsertOrg.run(ghOrg.netuid, ghOrg.org);
        knownHF.add(ghOrg.org.toLowerCase());
        discovered++;
        console.log(`  Found HF org: ${ghOrg.org} (SN${ghOrg.netuid})`);
      }
      // Small delay to respect rate limits
      await new Promise(r => setTimeout(r, 150));
    } catch { /* skip */ }
  }

  // 5. Search for bittensor-tagged content to find orgs we missed
  try {
    const btOrgs = await searchBittensorContent();
    for (const { org } of btOrgs) {
      if (!knownHF.has(org.toLowerCase())) {
        upsertOrg.run(null, org);
        knownHF.add(org.toLowerCase());
        discovered++;
        console.log(`  Found bittensor-tagged HF org: ${org}`);
      }
    }
  } catch { /* skip */ }

  console.log(`HuggingFace discovery complete: ${discovered} new orgs found, ${knownHF.size} total`);
  return discovered;
}

// ── Fetch items for all tracked orgs ─────────────────────────────
export interface OrgItems {
  org: string;
  netuid?: number;
  models: HFItem[];
  datasets: HFItem[];
  spaces: HFItem[];
}

export async function fetchAllOrgItems(): Promise<OrgItems[]> {
  const db = getDb();
  const results: OrgItems[] = [];

  // Get all HF orgs from DB (not just hardcoded list)
  const orgs = db
    .prepare("SELECT org_name, netuid FROM hf_orgs")
    .all() as Array<{ org_name: string; netuid: number | null }>;

  // If no orgs in DB yet, use seed list
  const orgList = orgs.length > 0
    ? orgs.map(o => ({ org: o.org_name, netuid: o.netuid ?? undefined }))
    : SEED_HF_ORGS;

  for (const { org, netuid } of orgList) {
    const [models, datasets, spaces] = await Promise.all([
      listModelsByAuthor(org, 10),
      listDatasetsByAuthor(org, 10),
      listSpacesByAuthor(org, 10),
    ]);

    // Only include orgs that actually have content
    if (models.length > 0 || datasets.length > 0 || spaces.length > 0) {
      results.push({ org, netuid, models, datasets, spaces });
    }

    await new Promise((r) => setTimeout(r, 150));
  }

  return results;
}
