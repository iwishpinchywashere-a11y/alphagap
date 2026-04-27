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

const EXCLUDED_NAMES = new Set(["Unknown", "Pending", "Reserved", "for sale (burn to uid1)", "Root"]);

// ── Static fallback list (used when DB is unavailable at build time) ──

/**
 * Hardcoded snapshot of all subnets — used as a fallback in generateStaticParams
 * when the SQLite database cannot be reached (e.g. during Vercel build).
 * Keep this in sync with the production DB whenever new subnets are registered.
 */
const STATIC_SUBNET_LIST: Array<{ netuid: number; name: string }> = [
  { netuid: 0,   name: "Root" },
  { netuid: 1,   name: "Apex" },
  { netuid: 2,   name: "DSperse" },
  { netuid: 3,   name: "τemplar" },
  { netuid: 4,   name: "Targon" },
  { netuid: 5,   name: "Hone" },
  { netuid: 6,   name: "Numinous" },
  { netuid: 7,   name: "Allways" },
  { netuid: 8,   name: "Vanta" },
  { netuid: 9,   name: "iota" },
  { netuid: 10,  name: "Swap" },
  { netuid: 11,  name: "TrajectoryRL" },
  { netuid: 12,  name: "Compute Horde" },
  { netuid: 13,  name: "Data Universe" },
  { netuid: 14,  name: "TAOHash" },
  { netuid: 15,  name: "ORO" },
  { netuid: 16,  name: "BitAds" },
  { netuid: 17,  name: "404—GEN" },
  { netuid: 18,  name: "Zeus" },
  { netuid: 19,  name: "blockmachine" },
  { netuid: 20,  name: "GroundLayer" },
  { netuid: 21,  name: "AdTAO" },
  { netuid: 22,  name: "Desearch" },
  { netuid: 23,  name: "Trishool" },
  { netuid: 24,  name: "Quasar" },
  { netuid: 25,  name: "Mainframe" },
  { netuid: 26,  name: "Kinitro" },
  { netuid: 27,  name: "Nodexo" },
  { netuid: 29,  name: "Coldint" },
  { netuid: 31,  name: "Halftime" },
  { netuid: 32,  name: "ItsAI" },
  { netuid: 33,  name: "ReadyAI" },
  { netuid: 34,  name: "BitMind" },
  { netuid: 35,  name: "Cartha" },
  { netuid: 36,  name: "Web Agents - Autoppia" },
  { netuid: 37,  name: "Aurelius" },
  { netuid: 38,  name: "colosseum" },
  { netuid: 39,  name: "basilica" },
  { netuid: 40,  name: "Chunking" },
  { netuid: 41,  name: "Almanac" },
  { netuid: 43,  name: "Graphite" },
  { netuid: 44,  name: "Score" },
  { netuid: 45,  name: "Talisman AI" },
  { netuid: 46,  name: "RESI" },
  { netuid: 47,  name: "EvolAI" },
  { netuid: 48,  name: "Quantum Compute" },
  { netuid: 49,  name: "Nepher Robotics" },
  { netuid: 50,  name: "Synth" },
  { netuid: 51,  name: "lium.io" },
  { netuid: 52,  name: "Dojo" },
  { netuid: 53,  name: "EfficientFrontier" },
  { netuid: 54,  name: "Yanez MIID" },
  { netuid: 55,  name: "NIOME" },
  { netuid: 56,  name: "Gradients" },
  { netuid: 57,  name: "Sparket.AI" },
  { netuid: 58,  name: "Handshake" },
  { netuid: 59,  name: "Babelbit" },
  { netuid: 60,  name: "Bitsec.ai" },
  { netuid: 61,  name: "RedTeam" },
  { netuid: 62,  name: "Ridges" },
  { netuid: 63,  name: "Quantum Innovate" },
  { netuid: 64,  name: "Chutes" },
  { netuid: 65,  name: "TAO Private Network" },
  { netuid: 66,  name: "AlphaCore" },
  { netuid: 67,  name: "Harnyx" },
  { netuid: 68,  name: "NOVA" },
  { netuid: 70,  name: "NexisGen" },
  { netuid: 71,  name: "Leadpoet" },
  { netuid: 72,  name: "StreetVision by NATIX" },
  { netuid: 73,  name: "MetaHash" },
  { netuid: 74,  name: "Gittensor" },
  { netuid: 75,  name: "Hippius" },
  { netuid: 76,  name: "Byzantium" },
  { netuid: 77,  name: "Liquidity" },
  { netuid: 78,  name: "Loosh" },
  { netuid: 79,  name: "MVTRX" },
  { netuid: 80,  name: "dogelayer" },
  { netuid: 81,  name: "grail" },
  { netuid: 82,  name: "Hermes" },
  { netuid: 83,  name: "CliqueAI" },
  { netuid: 84,  name: "ChipForge (Tatsu)" },
  { netuid: 85,  name: "Vidaio" },
  { netuid: 86,  name: "⚒" },
  { netuid: 87,  name: "Luminar Network" },
  { netuid: 88,  name: "Investing" },
  { netuid: 89,  name: "InfiniteHash" },
  { netuid: 91,  name: "Bitstarter #1" },
  { netuid: 92,  name: "TensorClaw" },
  { netuid: 93,  name: "Bitcast" },
  { netuid: 94,  name: "Bitsota" },
  { netuid: 96,  name: "X" },
  { netuid: 97,  name: "Constantinople" },
  { netuid: 98,  name: "ForeverMoney" },
  { netuid: 99,  name: "Leoma" },
  { netuid: 100, name: "Plaτform" },
  { netuid: 102, name: "ConnitoAI" },
  { netuid: 103, name: "Djinn" },
  { netuid: 105, name: "Beam" },
  { netuid: 106, name: "VoidAI" },
  { netuid: 107, name: "Minos" },
  { netuid: 108, name: "TalkHead" },
  { netuid: 110, name: "Rich Kids of TAO" },
  { netuid: 111, name: "oneoneone" },
  { netuid: 112, name: "minotaur" },
  { netuid: 113, name: "TensorUSD" },
  { netuid: 114, name: "SOMA" },
  { netuid: 115, name: "HashiChain" },
  { netuid: 116, name: "TaoLend" },
  { netuid: 117, name: "BrainPlay" },
  { netuid: 118, name: "HODL ETF" },
  { netuid: 119, name: "Satori" },
  { netuid: 120, name: "Affine" },
  { netuid: 121, name: "sundae_bar" },
  { netuid: 122, name: "Bitrecs" },
  { netuid: 123, name: "MANTIS" },
  { netuid: 124, name: "Swarm" },
  { netuid: 125, name: "8 Ball" },
  { netuid: 126, name: "Poker44" },
  { netuid: 127, name: "Astrid" },
  { netuid: 128, name: "ByteLeap" },
];

// ── getAllSubnetRows ───────────────────────────────────────────────

export interface SubnetRow {
  netuid: number;
  name: string;
  slug: string;
  subnetType: SubnetType;
}

/**
 * Queries the DB and returns all valid subnets as typed rows.
 * Falls back to STATIC_SUBNET_LIST if the DB is unavailable (e.g. at build time).
 * Filters out null/Unknown/Pending/Reserved names.
 * Synchronous (better-sqlite3).
 */
export function getAllSubnetRows(): SubnetRow[] {
  let rawRows: Array<{ netuid: number; name: string }> = [];

  try {
    const db = getDb();
    rawRows = db
      .prepare(
        `SELECT netuid, name FROM subnets
         WHERE name IS NOT NULL
         AND name NOT IN ('Unknown', 'Pending', 'Reserved')
         ORDER BY netuid ASC`
      )
      .all() as Array<{ netuid: number; name: string }>;
  } catch {
    // DB unavailable (e.g. during Vercel build) — fall back to static snapshot
  }

  // If DB returned no rows (empty DB on Vercel at build time), use the static snapshot
  if (rawRows.length === 0) {
    rawRows = STATIC_SUBNET_LIST;
  }

  return rawRows.map((row) => {
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
