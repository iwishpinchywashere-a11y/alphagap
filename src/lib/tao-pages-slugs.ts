/**
 * tao-pages-slugs.ts
 * Utility functions and mappings for TAO Pages — expanded to all ~110 subnets.
 */

import { getDb } from "./db";
import type { SubnetType } from "./tao-pages-data";

// ── Slugify ────────────────────────────────────────────────────────

/**
 * Converts a subnet name to a URL-safe slug.
 * - Lowercases
 * - Replaces τ/Τ → t
 * - Strips non-ASCII characters
 * - Replaces runs of non-alphanumeric characters with a single dash
 * - Trims leading/trailing dashes
 * - Falls back to `sn{netuid}` if result is empty
 */
export function slugify(name: string, netuid?: number): string {
  const result = name
    .toLowerCase()
    .replace(/[τΤ]/g, "t")
    // eslint-disable-next-line no-control-regex
    .replace(/[^\x00-\x7F]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

  if (!result) {
    return netuid !== undefined ? `sn${netuid}` : "sn0";
  }
  return result;
}

// ── Subnet type mapping ────────────────────────────────────────────

/**
 * Comprehensive type assignments for all ~110 subnets.
 * Types: Inference | Training | Compute | Storage | Finance | Data |
 *        Science | Creative | Agents | Tools
 */
export const SUBNET_TYPES: Record<number, SubnetType> = {
  // Inference — running AI on demand
  1:   "Inference",
  4:   "Inference",
  19:  "Inference",
  22:  "Inference",
  24:  "Inference",
  59:  "Inference",
  64:  "Inference",
  114: "Inference",

  // Training — building/fine-tuning models
  3:   "Training",
  9:   "Training",
  31:  "Training",
  38:  "Training",
  56:  "Training",
  80:  "Training",
  81:  "Training",
  94:  "Training",

  // Compute — raw GPU/infrastructure
  7:   "Compute",
  12:  "Compute",
  27:  "Compute",
  39:  "Compute",
  51:  "Compute",
  65:  "Compute",
  97:  "Compute",
  105: "Compute",
  128: "Compute",

  // Storage — file/data storage
  26:  "Storage",
  40:  "Storage",
  75:  "Storage",

  // Finance — trading, DeFi, financial
  6:   "Finance",
  8:   "Finance",
  10:  "Finance",
  14:  "Finance",
  35:  "Finance",
  41:  "Finance",
  43:  "Finance",
  48:  "Finance",
  50:  "Finance",
  55:  "Finance",
  67:  "Finance",
  73:  "Finance",
  77:  "Finance",
  79:  "Finance",
  88:  "Finance",
  89:  "Finance",
  103: "Finance",
  110: "Finance",
  112: "Finance",
  113: "Finance",
  116: "Finance",
  118: "Finance",
  125: "Finance",
  127: "Finance",

  // Data — data collection/labeling/intelligence
  13:  "Data",
  23:  "Data",
  46:  "Data",
  52:  "Data",
  54:  "Data",
  57:  "Data",
  71:  "Data",
  72:  "Data",
  82:  "Data",
  87:  "Data",
  119: "Data",

  // Science — research, biotech, scientific
  18:  "Science",
  25:  "Science",
  49:  "Science",
  63:  "Science",
  68:  "Science",
  83:  "Science",
  84:  "Science",
  107: "Science",
  124: "Science",

  // Creative — generative media, creative AI
  11:  "Creative",
  17:  "Creative",
  85:  "Creative",
  92:  "Creative",
  93:  "Creative",
  98:  "Creative",
  99:  "Creative",
  117: "Creative",
  126: "Creative",

  // Agents — autonomous AI agents
  5:   "Agents",
  15:  "Agents",
  20:  "Agents",
  21:  "Agents",
  36:  "Agents",
  45:  "Agents",
  58:  "Agents",
  62:  "Agents",
  66:  "Agents",
  78:  "Agents",
  86:  "Agents",
  100: "Agents",
  115: "Agents",
  121: "Agents",

  // Tools — everything else
  2:   "Tools",
  16:  "Tools",
  29:  "Tools",
  32:  "Tools",
  33:  "Tools",
  34:  "Tools",
  37:  "Tools",
  44:  "Tools",
  47:  "Tools",
  53:  "Tools",
  60:  "Tools",
  61:  "Tools",
  70:  "Tools",
  74:  "Tools",
  76:  "Tools",
  91:  "Tools",
  96:  "Tools",
  102: "Tools",
  106: "Tools",
  108: "Tools",
  111: "Tools",
  120: "Tools",
  122: "Tools",
  123: "Tools",
};

// ── Explicit slug overrides ────────────────────────────────────────

/**
 * Override slugs for featured subnets and special cases.
 * These take precedence over the auto-generated slugify() result.
 */
export const EXPLICIT_SLUGS: Record<number, string> = {
  64:  "chutes",
  4:   "targon",
  120: "affine",
  51:  "lium",
  8:   "vanta",
  62:  "ridges",
  44:  "score",
  9:   "iota",
  75:  "hippius",
  56:  "gradients",
  68:  "nova",
  17:  "404gen",
  // Special case: "for sale (burn to uid1)"
  104: "sn104",
};

// ── Filtered names that should not appear as TAO pages ────────────

const EXCLUDED_NAMES = new Set(["Unknown", "Pending", "Reserved"]);

// ── getAllSubnetRows ───────────────────────────────────────────────

export interface SubnetRow {
  netuid: number;
  name: string;
  slug: string;
  subnetType: SubnetType;
}

/**
 * Queries the DB and returns all valid subnets as typed rows.
 * Filters out null/Unknown/Pending/Reserved names.
 * Synchronous (better-sqlite3).
 */
export function getAllSubnetRows(): SubnetRow[] {
  const db = getDb();

  const rows = db
    .prepare(
      `SELECT netuid, name FROM subnets
       WHERE name IS NOT NULL
       AND name NOT IN ('Unknown', 'Pending', 'Reserved')
       ORDER BY netuid ASC`
    )
    .all() as Array<{ netuid: number; name: string }>;

  return rows.map((row) => {
    const slug =
      EXPLICIT_SLUGS[row.netuid] ??
      slugify(row.name, row.netuid);

    const subnetType: SubnetType =
      SUBNET_TYPES[row.netuid] ?? "Tools";

    return {
      netuid: row.netuid,
      name: row.name,
      slug,
      subnetType,
    };
  }).filter((row) => !EXCLUDED_NAMES.has(row.name));
}

// ── findBySlug ────────────────────────────────────────────────────

/**
 * Finds a subnet row by its URL slug.
 * Returns undefined if not found.
 */
export function findBySlug(slug: string): SubnetRow | undefined {
  const rows = getAllSubnetRows();
  return rows.find((r) => r.slug === slug);
}

// ── getSubnetDbInfo ───────────────────────────────────────────────

export interface SubnetDbInfo {
  name: string;
  description: string | null;
  website: string | null;
  github_url: string | null;
  discord: string | null;
}

/**
 * Returns raw DB info for a subnet by netuid, or null if not found.
 */
export function getSubnetDbInfo(netuid: number): SubnetDbInfo | null {
  const db = getDb();
  const row = db
    .prepare(
      `SELECT name, description, website, github_url, discord
       FROM subnets WHERE netuid = ? LIMIT 1`
    )
    .get(netuid) as SubnetDbInfo | undefined;

  return row ?? null;
}
