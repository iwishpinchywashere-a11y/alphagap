// AlphaGap — HuggingFace Scanner
// Scans ALL Bittensor subnets for HuggingFace presence and NEW model/dataset/space drops.
// "New" = createdAt within last 48h — not just "has content" (which never changes).
// Auto-discovers HF orgs from subnet GitHub org names so coverage grows automatically.

import { put, get as blobGet } from "@vercel/blob";

const HF_TOKEN = process.env.HUGGINGFACE_TOKEN || "";
const HF_API = "https://huggingface.co/api";

function hfHeaders(): Record<string, string> {
  const h: Record<string, string> = { "User-Agent": "AlphaGap/1.0" };
  if (HF_TOKEN) h.Authorization = `Bearer ${HF_TOKEN}`;
  return h;
}

// ── Known subnet → HF org mappings ───────────────────────────────
// Verified manually. netuid = undefined means we track org but can't link to a subnet.
// Expand this list as we discover new orgs.
const KNOWN_HF_ORGS: Array<{ org: string; netuid?: number }> = [
  // Opentensor Foundation (core, no specific subnet)
  { org: "opentensor" },
  // SN1 — Apex / Macrocosm
  { org: "macrocosm-os", netuid: 1 },
  // SN4 — Targon by Manifold
  { org: "manifold-inc", netuid: 4 },
  // SN6 — Nous Research
  { org: "NousResearch", netuid: 6 },
  // SN9 — Pretraining / Rao Foundation
  { org: "RaoFoundation", netuid: 9 },
  // SN17 — Vidaio / 404-Gen
  { org: "404-Gen", netuid: 17 },
  // SN18 — Cortex.t
  { org: "CortexLM", netuid: 18 },
  // SN20 — BitAgent
  { org: "BitAgent", netuid: 20 },
  // SN24 — Omega Labs
  { org: "omegalabsinc", netuid: 24 },
  // SN34 — BitMind (image detection)
  { org: "bitmind", netuid: 34 },
  { org: "bitmind-ai", netuid: 34 },
  // Others with known HF presence (subnet TBD)
  { org: "tensorplex-labs" },
  { org: "coldint" },
  { org: "borggAI" },
  { org: "SocialTensor" },
];

// ── Types ─────────────────────────────────────────────────────────

export interface HFScanResult {
  netuid: number;
  orgs: string[];           // all HF orgs that map to this subnet
  totalModels: number;
  totalDatasets: number;
  totalSpaces: number;
  totalDownloads: number;
  // Genuinely new content (createdAt in last 48h)
  newModels: number;
  newDatasets: number;
  newSpaces: number;
  newModelNames: string[];
  newDatasetNames: string[];
  newSpaceNames: string[];
  // All content (for context in signals)
  allModelNames: string[];
  allDatasetNames: string[];
  latestDate: string;
}

interface HFItem {
  id: string;
  author: string;
  lastModified: string;
  createdAt?: string;
  downloads?: number;
  likes?: number;
}

// ── HF API helpers ────────────────────────────────────────────────

async function fetchHFItems(
  type: "models" | "datasets" | "spaces",
  org: string,
  limit = 20
): Promise<HFItem[]> {
  try {
    const res = await fetch(
      `${HF_API}/${type}?author=${encodeURIComponent(org)}&sort=createdAt&direction=-1&limit=${limit}`,
      { headers: hfHeaders(), signal: AbortSignal.timeout(8000) }
    );
    if (!res.ok) return [];
    return res.json();
  } catch {
    return [];
  }
}

async function orgHasHFPresence(org: string): Promise<boolean> {
  try {
    // Quick check: models first (most common)
    const res = await fetch(
      `${HF_API}/models?author=${encodeURIComponent(org)}&limit=1`,
      { headers: hfHeaders(), signal: AbortSignal.timeout(5000) }
    );
    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data) && data.length > 0) return true;
    }
    // Also check datasets (some orgs only have datasets)
    const dsRes = await fetch(
      `${HF_API}/datasets?author=${encodeURIComponent(org)}&limit=1`,
      { headers: hfHeaders(), signal: AbortSignal.timeout(5000) }
    );
    if (dsRes.ok) {
      const data = await dsRes.json();
      if (Array.isArray(data) && data.length > 0) return true;
    }
    return false;
  } catch {
    return false;
  }
}

function parseGitHubOrg(repoUrl: string): string | null {
  if (!repoUrl) return null;
  let path = repoUrl.trim();
  if (path.includes("github.com/")) path = path.split("github.com/")[1];
  const parts = path.replace(/^\//, "").split("/");
  return parts[0] || null;
}

// ── Discovery cache (persisted in Vercel Blob) ────────────────────
// Stores: { [orgLower]: netuid | null }
// null = checked, not found on HF
// netuid = found, maps to this subnet

async function loadDiscoveryCache(): Promise<Record<string, number | null>> {
  if (!process.env.BLOB_READ_WRITE_TOKEN) return {};
  try {
    const blob = await blobGet("hf-discovery-cache.json", {
      token: process.env.BLOB_READ_WRITE_TOKEN,
      access: "private",
    });
    if (!blob?.stream) return {};
    const reader = blob.stream.getReader();
    const chunks: Uint8Array[] = [];
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      chunks.push(value);
    }
    return JSON.parse(Buffer.concat(chunks).toString("utf-8"));
  } catch {
    return {};
  }
}

async function saveDiscoveryCache(cache: Record<string, number | null>): Promise<void> {
  if (!process.env.BLOB_READ_WRITE_TOKEN) return;
  try {
    await put("hf-discovery-cache.json", JSON.stringify(cache), {
      access: "private",
      addRandomSuffix: false,
      allowOverwrite: true,
      contentType: "application/json",
    });
  } catch { /* non-critical */ }
}

// ── Main scanner ─────────────────────────────────────────────────

export async function scanAllSubnetsHF(
  subnets: Array<{ netuid: number; github_repo: string | null }>
): Promise<Map<number, HFScanResult>> {
  const results = new Map<number, HFScanResult>();
  const cutoff48h = new Date(Date.now() - 48 * 60 * 60 * 1000);

  // Build org → netuid map, starting from known list
  const orgToNetuid = new Map<string, number | null>(); // key = org lowercase
  const orgOriginalCase = new Map<string, string>();    // key = org lowercase, value = original case

  for (const { org, netuid } of KNOWN_HF_ORGS) {
    const lower = org.toLowerCase();
    orgToNetuid.set(lower, netuid ?? null);
    orgOriginalCase.set(lower, org);
  }

  // Load discovery cache (which GitHub orgs we've already checked on HF)
  const discoveryCache = await loadDiscoveryCache();
  let cacheUpdated = false;

  // Auto-discover: try GitHub org name on HF for unmapped subnets
  const knownNetuids = new Set(
    [...orgToNetuid.values()].filter((v): v is number => v !== null)
  );

  const toDiscover = subnets.filter(s =>
    s.github_repo && !knownNetuids.has(s.netuid)
  );

  console.log(`[hf-scanner] Auto-discovering HF orgs for ${toDiscover.length} subnets...`);

  const DISC_BATCH = 12;
  for (let i = 0; i < toDiscover.length; i += DISC_BATCH) {
    await Promise.all(toDiscover.slice(i, i + DISC_BATCH).map(async (s) => {
      const ghOrg = parseGitHubOrg(s.github_repo!);
      if (!ghOrg) return;
      const lower = ghOrg.toLowerCase();

      // Skip if already in known list or already checked (cache hit)
      if (orgToNetuid.has(lower)) return;
      if (lower in discoveryCache) {
        // Use cached result
        if (discoveryCache[lower] !== null) {
          orgToNetuid.set(lower, s.netuid);
          orgOriginalCase.set(lower, ghOrg);
        }
        return;
      }

      // Check HF (network call)
      const found = await orgHasHFPresence(ghOrg);
      if (found) {
        orgToNetuid.set(lower, s.netuid);
        orgOriginalCase.set(lower, ghOrg);
        discoveryCache[lower] = s.netuid;
        cacheUpdated = true;
        console.log(`[hf-scanner] 🆕 Discovered: ${ghOrg} on HuggingFace → SN${s.netuid}`);
      } else {
        discoveryCache[lower] = null; // Cache negative so we don't re-check
        cacheUpdated = true;
      }
    }));
    await new Promise(r => setTimeout(r, 300));
  }

  // Also do a broad "bittensor" search on HF to catch orgs we haven't thought of
  try {
    for (const type of ["models", "datasets"] as const) {
      const res = await fetch(
        `${HF_API}/${type}?search=bittensor&sort=createdAt&direction=-1&limit=100`,
        { headers: hfHeaders(), signal: AbortSignal.timeout(12000) }
      );
      if (res.ok) {
        const items: HFItem[] = await res.json();
        for (const item of items) {
          if (!item.author) continue;
          const lower = item.author.toLowerCase();
          if (!orgToNetuid.has(lower) && !(lower in discoveryCache)) {
            // Log unknown bittensor org for review — can be added to KNOWN_HF_ORGS manually
            console.log(`[hf-scanner] 📌 Found untracked bittensor org: ${item.author} (${type})`);
            orgOriginalCase.set(lower, item.author);
            // We don't know which subnet it maps to, so skip for now
            // (it'll show up in logs for manual curation)
          }
        }
      }
    }
  } catch { /* non-critical */ }

  if (cacheUpdated) {
    await saveDiscoveryCache(discoveryCache);
  }

  // Build final list of orgs to scan (only those with a netuid mapping)
  const orgsToScan = [...orgToNetuid.entries()]
    .filter(([, netuid]) => netuid !== null)
    .map(([lower, netuid]) => ({
      org: orgOriginalCase.get(lower) || lower,
      netuid: netuid!,
    }));

  console.log(`[hf-scanner] Scanning ${orgsToScan.length} HF orgs for new content...`);

  // Scan all orgs for models/datasets/spaces (batches of 8)
  const SCAN_BATCH = 8;
  for (let i = 0; i < orgsToScan.length; i += SCAN_BATCH) {
    await Promise.all(orgsToScan.slice(i, i + SCAN_BATCH).map(async ({ org, netuid }) => {
      try {
        const [models, datasets, spaces] = await Promise.all([
          fetchHFItems("models", org, 20),
          fetchHFItems("datasets", org, 20),
          fetchHFItems("spaces", org, 10),
        ]);

        const allItems = [...models, ...datasets, ...spaces];
        if (allItems.length === 0) return;

        const isNew = (item: HFItem) =>
          item.createdAt ? new Date(item.createdAt) >= cutoff48h : false;

        const newModels = models.filter(isNew);
        const newDatasets = datasets.filter(isNew);
        const newSpaces = spaces.filter(isNew);

        const totalDownloads = allItems.reduce((sum, item) => sum + (item.downloads || 0), 0);
        const latestDate = allItems
          .map(item => item.createdAt || item.lastModified || "")
          .filter(Boolean)
          .sort()
          .pop() || new Date().toISOString();

        const existing = results.get(netuid);
        results.set(netuid, {
          netuid,
          orgs: [...(existing?.orgs || []), org],
          totalModels: (existing?.totalModels || 0) + models.length,
          totalDatasets: (existing?.totalDatasets || 0) + datasets.length,
          totalSpaces: (existing?.totalSpaces || 0) + spaces.length,
          totalDownloads: (existing?.totalDownloads || 0) + totalDownloads,
          newModels: (existing?.newModels || 0) + newModels.length,
          newDatasets: (existing?.newDatasets || 0) + newDatasets.length,
          newSpaces: (existing?.newSpaces || 0) + newSpaces.length,
          newModelNames: [...(existing?.newModelNames || []), ...newModels.map(m => m.id)],
          newDatasetNames: [...(existing?.newDatasetNames || []), ...newDatasets.map(d => d.id)],
          newSpaceNames: [...(existing?.newSpaceNames || []), ...newSpaces.map(s => s.id)],
          allModelNames: [...(existing?.allModelNames || []), ...models.slice(0, 5).map(m => `${m.id} (${(m.downloads || 0).toLocaleString()} dl)`)],
          allDatasetNames: [...(existing?.allDatasetNames || []), ...datasets.slice(0, 5).map(d => `${d.id} (${(d.downloads || 0).toLocaleString()} dl)`)],
          latestDate,
        });

        const newTotal = newModels.length + newDatasets.length + newSpaces.length;
        if (newTotal > 0) {
          console.log(
            `[hf-scanner] 🤗 SN${netuid} (${org}): ` +
            `${newModels.length} new models, ${newDatasets.length} new datasets, ${newSpaces.length} new spaces in last 48h`
          );
        }
      } catch { /* skip on error */ }
    }));

    await new Promise(r => setTimeout(r, 200));
  }

  const activeCount = [...results.values()].filter(
    r => r.newModels + r.newDatasets + r.newSpaces > 0
  ).length;

  console.log(
    `[hf-scanner] ✓ ${results.size} subnets with HF presence. ` +
    `${activeCount} with new content in last 48h.`
  );

  return results;
}
