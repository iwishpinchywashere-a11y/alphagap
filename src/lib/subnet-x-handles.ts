/**
 * Official X (Twitter) handles per netuid.
 *
 * The on-chain identity registry carries a handle for about half the subnets;
 * this map fills the gaps and is consulted AFTER the registry (a handle the
 * team set on-chain always wins). Used by the scan's social scoring and by
 * the revenue-watch cron that reads these accounts for revenue, run-rate and
 * buyback announcements.
 *
 * Netuids change hands: when the valuation research (src/data/valuation.json)
 * says a slot has a new tenant, the old handle must go, otherwise we attribute
 * a departed team's posts to the new one. Entries marked "verified" were
 * checked against the account's own bio/posts on the date given.
 */

import type { SubnetIdentity } from "@/lib/taostats";

export const TWITTER_HANDLE_OVERRIDES: Record<number, string> = {
  1: "macrocosmosai", // Macrocosmos (SN1 Apex)
  2: "omron_ai", // Omron (zkML / Inference)
  3: "tplr_ai", // Templar (τemplar)
  4: "TargonCompute", // Targon
  5: "traininghone", // Hone (SN5) - official product account; @manifoldlabs is the dev company
  6: "numinous_ai", // Numinous
  7: "SubVortexTao", // SubVortex
  8: "VantaTrading", // Vanta
  9: "IOTA_SN9", // IOTA (Macrocosmos pretraining)
  10: "_taofi_", // SN10 (verified 2026-07-21)
  12: "ComputeHorde", // Compute Horde
  13: "Data_SN13", // Data Universe
  14: "cacheon_ai", // TAOHash
  15: "oroagents", // ORO
  16: "bitads_ai", // BitAds
  17: "404gen_", // 404-GEN
  18: "zeussubnet", // Zeus
  19: "blockmachine_io", // NineteenAI (Rayon Labs)
  20: "groundlayerhq", // BitAgent / Rizzo (SN20)
  21: "adtao_ppcrebel", // OMEGA Any-to-Any (Omega Labs)
  22: "desearch_ai", // DeSearch
  23: "trishoolai", // Trishool
  24: "QuasarModels", // Quasar
  26: "perturbaix", // Kinitro
  27: "nodex0_", // Nodexo
  28: "say_gm_", // Foundry S&P 500 Oracle
  29: "cacheon_ai", // SN29 (verified 2026-07-21)
  32: "ai_detection", // It's AI (LLM Detection)
  33: "ReadyAI_", // ReadyAI
  34: "BitMindAI", // BitMind
  35: "0x_Markets", // SN35 (verified 2026-07-21)
  36: "rendix_network", // Web Agents - Autoppia
  37: "aureliusaligned", // Aurelius
  38: "chronollm", // SN38 (verified 2026-07-21)
  39: "basilic_ai", // Basilica
  40: "vectorchatai", // Ralph (SN40) - rebranded from Chunking; official X is @vectorchatai
  41: "almnc_ai", // Almanac (ex-Sportstensor); handle from the team's own posts, 2026-10
  42: "getmasafi", // Masa (real-time social data)
  43: "GraphiteSubnet", // Graphite
  44: "webuildscore", // Score; handle from the team's own posts
  45: "TeamRizzoAI", // Talisman AI / SWE-Rizzo (SN45)
  46: "resilabsai", // SN46 (verified 2026-07-21)
  48: "qBitTensorLabs", // SN48 (verified 2026-07-21)
  50: "SynthdataCo", // Synth
  51: "lium_io", // lium.io
  52: "TensorplexLabs", // Dojo (SN52)
  53: "totheagi", // Engy (SN53) - no official subnet account yet; founder Ning Ren (Hanlin AI). NOT @the_engy (a band)
  54: "yanez__ai", // Yanez MIID
  55: "NiomeAI", // NIOME (was GenomesDAO); handle from 2026-10 posts
  56: "gradients_ai", // Gradients
  57: "Gaia_AI_", // Gaia (Geospatial / Weather)
  58: "greevils_ai", // Handshake
  59: "babelbit", // Babelbit
  60: "bitsecai", // Bitsec.ai
  61: "_redteam_", // RedTeam
  62: "ridges_ai", // Ridges
  63: "qbittensorlabs", // qBitTensor (SN63)
  64: "chutes_ai", // Chutes
  65: "TPN_Labs", // TAO Private Network
  // 66: "Ninja_Subnet" removed 2026-10-11 - conjectures: slot changed hands from ninja (2026-09); handle unknown, add when found
  67: "harnyx_ai", // Tenex (DeFi margin)
  68: "metanova_labs", // NOVA (MetaNova Labs)
  70: "nexisgen_ai", // Vericore / dFusion AI
  71: "LeadpoetAI", // Leadpoet
  72: "natixnetwork", // StreetVision / NATIX
  74: "gittensor_io", // Gittensor
  75: "hippius_subnet", // Hippius
  78: "Loosh_ai", // Loosh (machine consciousness)
  79: "taos_im", // SN79 (verified 2026-07-21)
  80: "openroboto", // OpenRoboto; x.com link in valuation research
  81: "reliquary_ai", // Reliquary (slot was Grail/Covenant); handle from 2026-10 posts
  82: "HermesSubnet", // Hermes (SubQuery)
  85: "vidaio_", // Vidaio
  88: "Investing88ai", // Investing (SN88)
  // 91: "bitstarterAI" removed 2026-10-11 - cascade: slot changed hands from Bitstarter; handle unknown
  93: "Bitcast_network", // Bitcast
  // 97: "arbos_born" removed 2026-10-11 - Albedo: slot changed hands from distil/Arbo; handle unknown
  98: "neverplayalone_", // Creator (CreatorBid agents)
  106: "nodexo", // SN106 (verified 2026-07-21)
  107: "theminos_ai", // Minos; handle from 2026-10 posts
  110: "green_compute_", // Green Compute; x.com link in valuation research
  111: "DeSciClaims", // SN111 (verified 2026-07-21)
  113: "tensorusd", // LongShort / TensorUSD; x.com link in valuation research
  114: "SomaSubnet", // SOMA; handle from valuation research
  116: "carbonphysicsai", // Carbon Physics; handle from Hash Rate ep.188 post
  117: "glyphresearch", // SN117 (verified 2026-07-21)
  118: "heydittoai", // SN118 (verified 2026-07-21)
  120: "affine_io", // Affine (SN120)
  121: "sundaebar_ai", // sundae_bar
  122: "cookingtao_", // Bitrecs
  124: "SwarmSubnet", // Swarm
};

const clean = (h: string | null | undefined) =>
  (h || "").replace(/https?:\/\/(twitter|x)\.com\//g, "").replace(/^@/, "").replace(/\/$/, "").trim();

/** netuid -> handle (no @): registry first, then the override map. */
export function resolveSubnetHandles(identities: Pick<SubnetIdentity, "netuid" | "twitter">[]): Map<number, string> {
  const out = new Map<number, string>();
  for (const id of identities) {
    const h = clean(id.twitter) || TWITTER_HANDLE_OVERRIDES[id.netuid] || "";
    if (h) out.set(id.netuid, h);
  }
  for (const [n, h] of Object.entries(TWITTER_HANDLE_OVERRIDES)) if (!out.has(Number(n))) out.set(Number(n), h);
  return out;
}
