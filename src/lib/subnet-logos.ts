/**
 * Subnet logo URLs -> LOCAL, SELF-HOSTED files under /public/subnets.
 *
 * These were hotlinked from subnet teams sites, GitHub raw, S3 buckets and
 * vercel preview URLs. An audit on 2026-09-07 found 32 of 95 had rotted:
 * 404s, timeouts, a 402, a 530, and several that had started returning HTML
 * error pages instead of images. Every one of those silently fell back to the
 * coloured-initials avatar, which is what "a ton of subnets dont have proper
 * logos" looked like.
 *
 * Hotlinking is the bug: those URLs belong to other people and move without
 * warning. Every logo is now downloaded into /public/subnets and served from
 * our own origin, so a subnet team redesigning their site cannot blank our
 * leaderboard. Images over 100KB were downscaled to 256px (5.5MB -> 2.5MB);
 * they render at 20-40px.
 *
 * Sources, in the order preferred: the previously-working URL, then the
 * TaoStats subnet-identity logo, then the teams GitHub org avatar.
 *
 * To refresh: scripts/refresh-subnet-logos.mjs re-runs the whole audit.
 */
export const SUBNET_LOGOS: Record<number, string> = {
  1: "/subnets/sn1.png", // Apex (github)
  2: "/subnets/sn2.png", // DSperse (existing)
  3: "/subnets/sn3.png", // Teutonic (existing)
  4: "/subnets/sn4.svg", // Targon (existing)
  5: "/subnets/sn5.png", // Hone (github)
  6: "/subnets/sn6.svg", // Numinous (existing)
  7: "/subnets/sn7.png", // Allways (existing)
  8: "/subnets/sn8.png", // Vanta (existing)
  9: "/subnets/sn9.png", // iota (github)
  10: "/subnets/sn10.png", // Pareton (existing)
  11: "/subnets/sn11.jpg", // TrajectoryRL (existing)
  12: "/subnets/sn12.png", // Compute Horde (github)
  13: "/subnets/sn13.png", // Data Universe (github)
  14: "/subnets/sn14.png", // Cacheon (taostats)
  15: "/subnets/sn15.png", // ORO (existing)
  17: "/subnets/sn17.png", // 404—GEN (existing)
  18: "/subnets/sn18.png", // Zeus (existing)
  19: "/subnets/sn19.svg", // blockmachine (taostats)
  20: "/subnets/sn20.png", // ChronoSeek (existing)
  21: "/subnets/sn21.png", // AdTAO (existing)
  22: "/subnets/sn22.jpg", // Desearch (github)
  23: "/subnets/sn23.png", // Trishool (existing)
  24: "/subnets/sn24.png", // Quasar (github)
  25: "/subnets/sn25.svg", // UR (taostats)
  26: "/subnets/sn26.svg", // Perturb (taostats)
  27: "/subnets/sn27.png", // Orion (github)
  28: "/subnets/sn28-gm.svg", // SayGM
  29: "/subnets/sn29.png", // hoτfloaτ (github)
  30: "/subnets/sn30.png", // Endure Network (taostats)
  31: "/subnets/sn31.png", // rec4ll (existing)
  32: "/subnets/sn32.png", // ItsAI (existing)
  33: "/subnets/sn33.png", // ReadyAI (github)
  34: "/subnets/sn34.png", // BitMind (github)
  35: "/subnets/sn35.png", // OxMarkets (existing)
  37: "/subnets/sn37.png", // Aurelius (existing)
  38: "/subnets/sn38.png", // ChronoLLM (github)
  39: "/subnets/sn39.png", // Basilica (existing)
  40: "/subnets/sn40.png", // Ralph (taostats)
  41: "/subnets/sn41.png", // Almanac (existing)
  43: "/subnets/sn43.png", // Graphite (github)
  44: "/subnets/sn44.png", // Score (existing)
  45: "/subnets/sn45.jpg", // AlphaRidge.ai (existing)
  46: "/subnets/sn46.png", // Instant (existing)
  47: "/subnets/sn47.png", // Feval (taostats)
  48: "/subnets/sn48.jpg", // Quantum Compute (existing)
  49: "/subnets/sn49.png", // Nepher Robotics (taostats)
  50: "/subnets/sn50-synth.jpg", // Synth
  51: "/subnets/sn51.jpg", // lium.io (github)
  52: "/subnets/sn52.jpg", // Dojo (github)
  53: "data:image/svg+xml;base64,PHN2ZyB2aWV3Qm94PSIxMzIgMTMyIDc2MCA3NjAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PHJlY3QgeD0iMTMyIiB5PSIxMzIiIHdpZHRoPSI3NjAiIGhlaWdodD0iNzYwIiBmaWxsPSIjZmZmZmZmIi8+PHJlY3QgeD0iMjA1IiB5PSIyNDYiIHdpZHRoPSI0NzIiIGhlaWdodD0iMTMyIiByeD0iNjYiIGZpbGw9IiNGNTUxMUUiLz48cmVjdCB4PSIzNDciIHk9IjQ0NCIgd2lkdGg9IjQ3MiIgaGVpZ2h0PSIxMzQiIHJ4PSI2NyIgZmlsbD0iI0Y1NTExRSIvPjxyZWN0IHg9IjIwNSIgeT0iNjQ3IiB3aWR0aD0iNDcyIiBoZWlnaHQ9IjEzMiIgcng9IjY2IiBmaWxsPSIjRjU1MTFFIi8+PC9zdmc+Cg==", // engy
  54: "/subnets/sn54.png", // Yanez (taostats)
  55: "/subnets/sn55.webp", // NIOME (existing)
  56: "/subnets/sn56.png", // Gradients (existing)
  58: "/subnets/sn58.png", // greevils (existing)
  60: "/subnets/sn60.png", // Bitsec.ai (github)
  61: "/subnets/sn61-redteam.jpg", // RedTeam
  62: "/subnets/sn62.png", // Ridges (existing)
  63: "/subnets/sn63.png", // Enigma (taostats)
  64: "/subnets/sn64.png", // Chutes (existing)
  65: "/subnets/sn65.jpg", // True Performance Network (existing)
  66: "/subnets/sn66.png", // conjectures (github)
  67: "/subnets/sn67.svg", // Harnyx (existing)
  68: "/subnets/sn68.png", // NOVA (existing)
  69: "/subnets/sn69.svg", // Herald (taostats)
  71: "/subnets/sn71.png", // Leadpoet (existing)
  72: "/subnets/sn72.jpg", // StreetVision by NATIX (github)
  73: "/subnets/sn73.jpg", // Parked (existing)
  74: "/subnets/sn74.png", // Gittensor (existing)
  75: "/subnets/sn75.png", // Hippius (existing)
  77: "/subnets/sn77.svg", // Liquidity (existing)
  78: "/subnets/sn78.jpg", // Umi (existing)
  79: "/subnets/sn79.png", // MVTRX (existing)
  80: "/subnets/sn80.png", // OpenRoboto (taostats)
  81: "/subnets/sn81.png", // Reliquary (existing)
  82: "/subnets/sn82.png", // Compelle (taostats)
  83: "/subnets/sn83.png", // CliqueAI (github)
  85: "/subnets/sn85.png", // Vidaio (existing)
  87: "/subnets/sn87.png", // Provenonce (existing)
  88: "/subnets/sn88.png", // Investing (existing)
  89: "/subnets/sn89.jpg", // InfiniteQuant (existing)
  90: "/subnets/sn90.png", // KubeTEE (taostats)
  91: "/subnets/sn91.png", // cascade (taostats)
  92: "/subnets/sn92.png", // MicroTensor (taostats)
  93: "/subnets/sn93.png", // Bitcast (taostats)
  94: "/subnets/sn94.jpg", // pending... (github)
  95: "/subnets/sn95.png", // Actual (taostats)
  96: "/subnets/sn96.png", // Verathos (existing)
  97: "/subnets/sn97.png", // Albedo (existing)
  98: "/subnets/sn98.png", // NeverPlayAlone (existing)
  100: "/subnets/sn100.png", // Cortex (existing)
  101: "/subnets/sn101.png", // Tag101 (github)
  102: "/subnets/sn102.png", // ConnitoAI (taostats)
  103: "/subnets/sn103.png", // Capcomp (existing)
  104: "/subnets/sn104.png", // TAOstatus (github)
  105: "/subnets/sn105.jpg", // Beam (existing)
  106: "/subnets/sn106.png", // Nodexo (taostats)
  107: "/subnets/sn107.png", // Minos (existing)
  108: "/subnets/sn108.svg", // Prometheon (taostats)
  109: "/subnets/sn109.png", // Finsight (site)
  110: "/subnets/sn110.png", // Green Compute (taostats)
  111: "/subnets/sn111.png", // Claims (github)
  112: "/subnets/sn112.png", // parked (existing)
  113: "/subnets/sn113.png", // TensorUSD (existing)
  114: "/subnets/sn114.png", // SOMA (existing)
  115: "/subnets/sn115.png", // MoirAI (existing)
  117: "/subnets/sn117.png", // glyph (taostats)
  118: "/subnets/sn118.png", // Ditto (taostats)
  119: "/subnets/sn119.png", // Satori (github)
  120: "/subnets/sn120.png", // Affine (github)
  121: "/subnets/sn121.png", // sundae_bar (existing)
  122: "/subnets/sn122.png", // CookingTAO (existing)
  123: "/subnets/sn123.png", // MANTIS (github)
  124: "/subnets/sn124.png", // Swarm (existing)
  126: "/subnets/sn126.jpg", // Poker44 (existing)
  127: "/subnets/sn127.png", // Astrid (taostats)
  128: "/subnets/sn128.jpg", // ByteLeap (existing)
};

/** Stable color palette for initials fallback avatars (indexed by netuid % length) */
const AVATAR_COLORS = [
  "bg-violet-800", "bg-blue-800", "bg-cyan-800", "bg-teal-800",
  "bg-green-800", "bg-yellow-800", "bg-orange-800", "bg-rose-800",
  "bg-pink-800", "bg-indigo-800", "bg-sky-800", "bg-emerald-800",
];

export function subnetAvatarColor(netuid: number): string {
  return AVATAR_COLORS[netuid % AVATAR_COLORS.length];
}
