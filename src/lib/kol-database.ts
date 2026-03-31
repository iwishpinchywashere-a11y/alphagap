// Bittensor KOL Database — sourced from Stitch3.ai/kols?ecosystems=tao
// Top 100 Key Opinion Leaders ranked by Stitch3 influence score
// Weight tiers: Tier 1 (founders/core) = 100, Tier 2 (major KOLs) = 60-80, Tier 3 (community) = 30-50, Tier 4 (ecosystem) = 10-25

export interface KOL {
  handle: string;       // X/Twitter handle (lowercase)
  name: string;         // Display name
  stitch3Score: number; // Stitch3 influence score
  followers: number;    // Approximate follower count
  weight: number;       // Our weighted score (0-100) for social scoring
  tier: 1 | 2 | 3 | 4;
}

// Weight formula: Based on Stitch3 score, follower count, and account type
// Tier 1: Bittensor founders, core team, OTF — their tweets move markets
// Tier 2: Top subnet accounts, major crypto KOLs covering Bittensor
// Tier 3: Active community members, subnet-specific accounts, analysts
// Tier 4: Broader ecosystem accounts that occasionally mention Bittensor

export const KOL_DATABASE: KOL[] = [
  // === TIER 1: Founders & Core (weight 80-100) ===
  { handle: "const_reborn", name: "const", stitch3Score: 1059, followers: 24340, weight: 100, tier: 1 },
  { handle: "opentensor", name: "Opentensor Foundation", stitch3Score: 998, followers: 171863, weight: 95, tier: 1 },
  { handle: "bittensor", name: "Bittensor", stitch3Score: 482, followers: 11659, weight: 90, tier: 1 },
  { handle: "yumagroup", name: "Yuma", stitch3Score: 500, followers: 11193, weight: 85, tier: 1 },
  { handle: "markjeffrey", name: "Mark Jeffrey", stitch3Score: 990, followers: 70101, weight: 85, tier: 1 },
  { handle: "barrysilbert", name: "Barry Silbert", stitch3Score: 314, followers: 789333, weight: 80, tier: 1 },

  // === TIER 2: Major KOLs & Subnet Leads (weight 50-75) ===
  { handle: "tplr_ai", name: "templar", stitch3Score: 935, followers: 13305, weight: 75, tier: 2 },
  { handle: "jason", name: "@jason", stitch3Score: 696, followers: 1100000, weight: 70, tier: 2 },
  { handle: "targoncompute", name: "Targon", stitch3Score: 601, followers: 3802, weight: 70, tier: 2 },
  { handle: "chutes_ai", name: "Chutes", stitch3Score: 508, followers: 9475, weight: 68, tier: 2 },
  { handle: "cryptozpunisher", name: "Punisher ττ", stitch3Score: 548, followers: 8471, weight: 65, tier: 2 },
  { handle: "subnetsummertao", name: "Subnet Summer", stitch3Score: 516, followers: 1358, weight: 63, tier: 2 },
  { handle: "bitcast_network", name: "Bitcast | SN93", stitch3Score: 508, followers: 2946, weight: 60, tier: 2 },
  { handle: "twistartups", name: "This Week in Startups", stitch3Score: 504, followers: 94975, weight: 60, tier: 2 },
  { handle: "siamkidd", name: "siamkidd", stitch3Score: 444, followers: 25704, weight: 58, tier: 2 },
  { handle: "bittingthembits", name: "Andy ττ", stitch3Score: 426, followers: 11267, weight: 56, tier: 2 },
  { handle: "webuildscore", name: "Score - Subnet 44", stitch3Score: 418, followers: 8156, weight: 55, tier: 2 },
  { handle: "macrocosmosai", name: "Macrocosmos", stitch3Score: 406, followers: 6310, weight: 55, tier: 2 },
  { handle: "ridges_ai", name: "Ridges AI", stitch3Score: 393, followers: 7536, weight: 53, tier: 2 },
  { handle: "diststateandme", name: "Distributed State", stitch3Score: 381, followers: 4264, weight: 52, tier: 2 },
  { handle: "old_samster", name: "Sami Kassab", stitch3Score: 375, followers: 17768, weight: 52, tier: 2 },
  { handle: "dreadbong0", name: "DREAD BONGO", stitch3Score: 345, followers: 138679, weight: 55, tier: 2 },
  { handle: "altcoindaily", name: "Altcoin Daily", stitch3Score: 324, followers: 2100000, weight: 50, tier: 2 },

  // === TIER 3: Active Community (weight 25-48) ===
  { handle: "exploitsummit", name: "Exploit Summit", stitch3Score: 373, followers: 482, weight: 48, tier: 3 },
  { handle: "taodaily_io", name: "The TAO Daily", stitch3Score: 373, followers: 2839, weight: 48, tier: 3 },
  { handle: "metanova_labs", name: "METANOVA", stitch3Score: 369, followers: 3657, weight: 46, tier: 3 },
  { handle: "dsvfund", name: "dsvfund", stitch3Score: 359, followers: 2280, weight: 45, tier: 3 },
  { handle: "gordonfrayne", name: "Gordon Frayne", stitch3Score: 358, followers: 10740, weight: 45, tier: 3 },
  { handle: "leadpoetai", name: "Leadpoet", stitch3Score: 349, followers: 2347, weight: 44, tier: 3 },
  { handle: "macrozack", name: "macrozack", stitch3Score: 324, followers: 1289, weight: 42, tier: 3 },
  { handle: "iota_sn9", name: "IOTA SN9", stitch3Score: 322, followers: 1992, weight: 42, tier: 3 },
  { handle: "taoapp_", name: "Tao.App", stitch3Score: 322, followers: 7595, weight: 42, tier: 3 },
  { handle: "grayscale", name: "Grayscale", stitch3Score: 319, followers: 680345, weight: 45, tier: 3 },
  { handle: "bitstarterai", name: "bitstarter", stitch3Score: 318, followers: 2515, weight: 40, tier: 3 },
  { handle: "covenant_ai", name: "covenant", stitch3Score: 314, followers: 2725, weight: 40, tier: 3 },
  { handle: "subnetsummert", name: "subnetsummert", stitch3Score: 313, followers: 2631, weight: 40, tier: 3 },
  { handle: "mogmachine", name: "mogmachine", stitch3Score: 303, followers: 9397, weight: 38, tier: 3 },
  { handle: "keithsingery", name: "Keith Singery", stitch3Score: 300, followers: 7479, weight: 38, tier: 3 },
  { handle: "stillcorecap", name: "Stillcore Capital", stitch3Score: 297, followers: 3511, weight: 37, tier: 3 },
  { handle: "synthdataco", name: "Synthdata", stitch3Score: 295, followers: 5845, weight: 37, tier: 3 },
  { handle: "maxscore", name: "Max", stitch3Score: 292, followers: 4931, weight: 36, tier: 3 },
  { handle: "cointelegraph", name: "Cointelegraph", stitch3Score: 290, followers: 2900000, weight: 40, tier: 3 },
  { handle: "zeussubnet", name: "Zeus | SN18", stitch3Score: 288, followers: 2226, weight: 36, tier: 3 },
  { handle: "bt_commons", name: "Bittensor Commons", stitch3Score: 286, followers: 392, weight: 35, tier: 3 },
  { handle: "base", name: "base", stitch3Score: 277, followers: 1200000, weight: 35, tier: 3 },
  { handle: "numinous_ai", name: "Numinous", stitch3Score: 275, followers: 1450, weight: 34, tier: 3 },
  { handle: "vidaio_", name: "Vidaio", stitch3Score: 271, followers: 1943, weight: 34, tier: 3 },
  { handle: "manifoldlabs", name: "Manifold", stitch3Score: 269, followers: 4912, weight: 33, tier: 3 },
  { handle: "markcreaser", name: "Mark Creaser", stitch3Score: 267, followers: 14539, weight: 33, tier: 3 },
  { handle: "macrocrux", name: "macrocrux", stitch3Score: 264, followers: 2359, weight: 33, tier: 3 },
  { handle: "josephjacks_", name: "JJ", stitch3Score: 264, followers: 41582, weight: 35, tier: 3 },
  { handle: "handshake_58", name: "Handshake58", stitch3Score: 263, followers: 921, weight: 32, tier: 3 },
  { handle: "basilic_ai", name: "basilica", stitch3Score: 263, followers: 1530, weight: 32, tier: 3 },
  { handle: "resilabsai", name: "RESI", stitch3Score: 261, followers: 1413, weight: 32, tier: 3 },
  { handle: "taostats", name: "taostats", stitch3Score: 253, followers: 9705, weight: 35, tier: 3 },
  { handle: "sobczak_mariusz", name: "Mariuszek", stitch3Score: 252, followers: 4388, weight: 30, tier: 3 },
  { handle: "taotemplar", name: "τao τemplar", stitch3Score: 251, followers: 5477, weight: 30, tier: 3 },
  { handle: "notthreadguy", name: "threadguy", stitch3Score: 248, followers: 358465, weight: 35, tier: 3 },
  { handle: "jesusmartinez", name: "jesusmartinez", stitch3Score: 248, followers: 311257, weight: 32, tier: 3 },
  { handle: "rvcrypto", name: "RVCrypto", stitch3Score: 248, followers: 70734, weight: 32, tier: 3 },

  // === TIER 4: Broader Ecosystem (weight 10-28) ===
  { handle: "venturalabs", name: "Ventura Labs", stitch3Score: 247, followers: 2185, weight: 28, tier: 4 },
  { handle: "coingecko", name: "CoinGecko", stitch3Score: 245, followers: 2400000, weight: 28, tier: 4 },
  { handle: "robin_t100", name: "Robin τ", stitch3Score: 244, followers: 10890, weight: 28, tier: 4 },
  { handle: "marssmuff", name: "Chairman τao", stitch3Score: 239, followers: 1431, weight: 26, tier: 4 },
  { handle: "data_sn13", name: "Data Universe SN13", stitch3Score: 239, followers: 768, weight: 26, tier: 4 },
  { handle: "0xsammy", name: "0xSammy", stitch3Score: 238, followers: 89536, weight: 28, tier: 4 },
  { handle: "here4impact", name: "Michael D. White", stitch3Score: 237, followers: 6311, weight: 25, tier: 4 },
  { handle: "hippius_subnet", name: "Hippius", stitch3Score: 236, followers: 3003, weight: 25, tier: 4 },
  { handle: "chilearmy123", name: "Clemente", stitch3Score: 235, followers: 65598, weight: 25, tier: 4 },
  { handle: "desearch_ai", name: "Desearch.ai", stitch3Score: 226, followers: 1558, weight: 24, tier: 4 },
  { handle: "hackquest_", name: "HackQuest", stitch3Score: 225, followers: 31527, weight: 24, tier: 4 },
  { handle: "crunchdao", name: "Crunch", stitch3Score: 224, followers: 21868, weight: 22, tier: 4 },
  { handle: "tao_dot_com", name: "TAO.com", stitch3Score: 223, followers: 4398, weight: 22, tier: 4 },
  { handle: "bitmind", name: "BitMind", stitch3Score: 223, followers: 3026, weight: 22, tier: 4 },
  { handle: "qbittensorlabs", name: "qBitTensor Labs", stitch3Score: 222, followers: 4351, weight: 20, tier: 4 },
  { handle: "quasarmodels", name: "Quasar", stitch3Score: 221, followers: 1476, weight: 20, tier: 4 },
  { handle: "yanez__ai", name: "Yanez.ai", stitch3Score: 221, followers: 1478, weight: 20, tier: 4 },
  { handle: "proofoftalk", name: "Proof of Talk", stitch3Score: 221, followers: 7495, weight: 20, tier: 4 },
  { handle: "0xarrash", name: "Arrash", stitch3Score: 215, followers: 7510, weight: 18, tier: 4 },
  { handle: "404gen_", name: "404", stitch3Score: 214, followers: 3590, weight: 18, tier: 4 },
  { handle: "taooutsider", name: "Tao Outsider", stitch3Score: 214, followers: 3441, weight: 18, tier: 4 },
  { handle: "evanmalanga", name: "Evan Malanga", stitch3Score: 212, followers: 2712, weight: 16, tier: 4 },
  { handle: "hermessubnet", name: "Hermes SN82", stitch3Score: 207, followers: 1084, weight: 16, tier: 4 },
  { handle: "shiftlayer_ai", name: "ShiftLayer.Ai", stitch3Score: 206, followers: 305, weight: 14, tier: 4 },
  { handle: "jollygreenmoney", name: "Jolly Green Investor", stitch3Score: 203, followers: 120305, weight: 18, tier: 4 },
  { handle: "sportstensor", name: "sportstensor", stitch3Score: 203, followers: 4441, weight: 14, tier: 4 },
  { handle: "bitsecai", name: "Bitsec", stitch3Score: 202, followers: 1810, weight: 14, tier: 4 },
  { handle: "jaltucher", name: "James Altucher", stitch3Score: 199, followers: 221993, weight: 16, tier: 4 },
  { handle: "apex_sn1", name: "Apex SN1", stitch3Score: 194, followers: 539, weight: 12, tier: 4 },
  { handle: "cruciblelabs", name: "Crucible Labs", stitch3Score: 193, followers: 3900, weight: 12, tier: 4 },
  { handle: "rob_svrn", name: "Rob Greer", stitch3Score: 191, followers: 72339, weight: 14, tier: 4 },
  { handle: "tengyanai", name: "Teng Yan", stitch3Score: 187, followers: 42654, weight: 14, tier: 4 },
  { handle: "vanlabs", name: "vaN ττ", stitch3Score: 187, followers: 2283, weight: 12, tier: 4 },
  { handle: "trustedstake", name: "TrustedStake", stitch3Score: 185, followers: 1706, weight: 10, tier: 4 },
];

// Quick lookup map: handle -> KOL data
export const KOL_MAP = new Map<string, KOL>(
  KOL_DATABASE.map(k => [k.handle.toLowerCase(), k])
);

// Get weight for a twitter handle (returns 0 if not a tracked KOL)
export function getKOLWeight(handle: string): number {
  return KOL_MAP.get(handle.toLowerCase())?.weight || 0;
}

// Get tier for a twitter handle
export function getKOLTier(handle: string): number {
  return KOL_MAP.get(handle.toLowerCase())?.tier || 0;
}

// Check if a handle is a tracked KOL
export function isKOL(handle: string): boolean {
  return KOL_MAP.has(handle.toLowerCase());
}
