/**
 * Live subnet market data, read directly from the Bittensor chain.
 *
 * WHY THIS EXISTS. Subnet charts went flat at least five times. Every time,
 * the same two things were true:
 *
 *   1. The paid TaoStats API had stopped answering (the account ran out of
 *      credits, twice, twelve days apart).
 *   2. Some cache then replayed the last answer it had as if it were live:
 *      once our own pool-cache.json, once the Next.js fetch cache. Nothing
 *      checked how old the rows were, so days-old prices were written into
 *      history hour after hour. On 2026-09-19 the "live" prices were up to
 *      2.2x off the real on-chain price.
 *
 * Price, market cap, emissions and flow are not TaoStats' data. They are chain
 * state, and TaoStats is a paid mirror of it. Reading the chain directly is
 * free, cannot run out of credits, and every reading carries the block it came
 * from, so its age is always provable. One runtime call returns every subnet.
 *
 * EVERY FORMULA BELOW WAS VERIFIED AGAINST LIVE DATA on 2026-09-19:
 *   price        = SubnetTAO / SubnetAlphaIn           (matches TaoStats/TMC)
 *   market cap   = price x (alphaIn + TotalAlphaStaked + SubnetProtocolAlpha)
 *                  (TaoStats' own definition; SN120 matched to 99.999%)
 *   emission %   = (SubnetTaoInEmission + SubnetExcessTao) / sum over subnets
 *                  (matches TaoMarketCap within 0.001pp on all 88 emitting)
 *   EMA TAO flow = SubnetEmaTaoFlow, I64F64 in rao     (matches TMC exactly)
 *   moving price = SubnetMovingPrice, I96F32           (matches TMC exactly)
 *   injection    = taoInEmission + excessTao per block (a trade-free block
 *                  grows SubnetTAO by exactly this, to the rao)
 *   net flow 24h = change in SubnetTAO over 7200 blocks, minus injection
 *   volume 24h   = change in the cumulative SubnetVolume counter
 *   % changes    = price now vs price at head-300 / -7200 / -50400 / -216000
 *                  blocks, read from the archive node
 */

import type { ApiPromise } from "@polkadot/api";

const HEAD_RPC = "wss://entrypoint-finney.opentensor.ai:443";
// The public entrypoint only keeps recent state. Anything older than a few
// hundred blocks needs the archive node.
const ARCHIVE_RPC = "wss://archive.chain.opentensor.ai:443";
const RAO = 1e9;

/** 12-second blocks. */
export const BLOCKS = { h1: 300, h24: 7200, d7: 50400, d30: 216000 } as const;

/** A reading older than this is not "live" and must not be recorded as such. */
export const MAX_MARKET_AGE_MS = 15 * 60_000;

export interface ChainSubnet {
  netuid: number;
  name: string;
  symbol: string;
  priceTao: number;
  taoIn: number;              // TAO in the pool
  alphaIn: number;            // alpha in the pool
  alphaOut: number;           // alpha outstanding
  alphaStaked: number;        // TotalAlphaStaked + SubnetProtocolAlpha
  totalAlpha: number;         // alphaIn + alphaOut
  marketCapTao: number;
  /** Fraction 0-1 of all TAO emission going to subnets. */
  emissionShare: number;
  emissionEnabled: boolean;
  /** SubnetEmaTaoFlow in rao, the flow the v440 emission gate acts on. */
  emaTaoFlowRao: number | null;
  movingPriceTao: number | null;
  /** Percent. null when the archive read for that horizon failed. */
  change1h: number | null;
  change24h: number | null;
  change7d: number | null;
  change30d: number | null;
  volume24hTao: number | null;
  /** User stake in minus stake out over 24h, protocol injection removed. */
  netFlow24hTao: number | null;
  /** UIDs holding a validator permit, and total registered UIDs. */
  validators: number | null;
  neurons: number | null;
  /** Block this netuid was registered at. Netuids get recycled; history from
   *  before this block belongs to a different project. */
  registeredAtBlock: number | null;
}

export interface ChainMarket {
  block: number;
  /** Timestamp of the head block itself, not of when we asked. */
  observedAt: string;
  subnets: Map<number, ChainSubnet>;
  /** Which history horizons were read successfully. */
  horizons: { h1: boolean; h24: boolean; d7: boolean; d30: boolean };
}

function withTimeout<T>(p: Promise<T>, ms: number, label: string): Promise<T> {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error(`${label} timed out after ${ms}ms`)), ms);
    p.then(v => { clearTimeout(t); resolve(v); }, e => { clearTimeout(t); reject(e); });
  });
}

async function connect(url: string, ms: number): Promise<ApiPromise> {
  const { ApiPromise, WsProvider } = await import("@polkadot/api");
  const provider = new WsProvider(url, 2_500);
  try {
    return await withTimeout(ApiPromise.create({ provider, noInitWarn: true, throwOnConnect: true }), ms, `connect ${url}`);
  } catch (e) {
    await provider.disconnect().catch(() => {});
    throw e;
  }
}

const num = (v: unknown): number => {
  if (v == null) return 0;
  if (typeof v === "number") return v;
  if (typeof v === "boolean") return v ? 1 : 0;
  try { return Number(BigInt(String(v))); } catch { return 0; }
};

/** Signed fixed-point (I64F64 / I96F32) held as a hex or decimal bits value. */
function fixedToNumber(bits: unknown, fracBits: number, totalBits: number): number | null {
  if (bits == null) return null;
  let b: bigint;
  try { b = BigInt(String(bits)); } catch { return null; }
  const one = BigInt(1);
  if (b >= one << BigInt(totalBits - 1)) b -= one << BigInt(totalBits);
  return Number(b) / 2 ** fracBits;
}

interface DynamicRow {
  netuid: number;
  taoIn: unknown; alphaIn: unknown; alphaOut: unknown;
  subnetVolume: unknown;
  taoInEmission: unknown;
  movingPrice?: { bits: unknown };
  subnetName?: unknown; tokenSymbol?: unknown;
  networkRegisteredAt?: unknown;
}

function decodeBytes(v: unknown): string {
  if (Array.isArray(v)) return String.fromCharCode(...(v as number[])).replace(/\0/g, "").trim();
  if (typeof v === "string" && v.startsWith("0x")) {
    try { return Buffer.from(v.slice(2), "hex").toString("utf8").replace(/\0/g, "").trim(); } catch { return ""; }
  }
  return typeof v === "string" ? v : "";
}

async function dynamicAt(api: ApiPromise, blockHash?: string): Promise<Map<number, DynamicRow>> {
  const at = blockHash ? await api.at(blockHash) : api;
  const raw = await at.call.subnetInfoRuntimeApi.getAllDynamicInfo();
  const rows = (raw.toJSON() as Array<DynamicRow | null>).filter((r): r is DynamicRow => !!r);
  return new Map(rows.map(r => [r.netuid, r]));
}

async function perNetuid(api: ApiPromise, item: string): Promise<Map<number, unknown>> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const entries = await (api.query.subtensorModule as any)[item].entries();
  const out = new Map<number, unknown>();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  for (const [k, v] of entries as Array<[any, any]>) out.set(k.args.at(-1).toNumber(), v.toJSON());
  return out;
}

/**
 * Read every subnet's market state from chain. Returns null only if the head
 * of the chain cannot be read at all; missing history horizons degrade to null
 * change values rather than failing the whole read.
 */
export async function fetchChainMarket(): Promise<ChainMarket | null> {
  let head: ApiPromise | null = null;
  let archive: ApiPromise | null = null;
  try {
    // Archive connects in parallel; it is only needed for history.
    const archiveP = connect(ARCHIVE_RPC, 20_000).catch(e => {
      console.warn(`[market] archive unavailable: ${e instanceof Error ? e.message : e}`);
      return null;
    });
    head = await connect(HEAD_RPC, 20_000).catch(async e => {
      console.warn(`[market] head RPC failed (${e instanceof Error ? e.message : e}), using archive for head`);
      return null;
    });
    archive = await archiveP;
    const headApi = head ?? archive;
    if (!headApi) return null;

    const [header, nowTs, dyn, staked, protocol, taoInEm, excess, enabled, ema, permits, neuronsN] = await withTimeout(Promise.all([
      headApi.rpc.chain.getHeader(),
      headApi.query.timestamp.now(),
      dynamicAt(headApi),
      perNetuid(headApi, "totalAlphaStaked"),
      perNetuid(headApi, "subnetProtocolAlpha"),
      perNetuid(headApi, "subnetTaoInEmission"),
      perNetuid(headApi, "subnetExcessTao"),
      perNetuid(headApi, "subnetEmissionEnabled"),
      perNetuid(headApi, "subnetEmaTaoFlow"),
      perNetuid(headApi, "validatorPermit"),
      perNetuid(headApi, "subnetworkN"),
    ]), 30_000, "head state");

    const block = header.number.toNumber();
    const observedAt = new Date(Number(nowTs.toString())).toISOString();

    // ── History from the archive, each horizon independent ─────────────
    const horizons = { h1: false, h24: false, d7: false, d30: false };
    const past: Partial<Record<keyof typeof BLOCKS, Map<number, DynamicRow>>> = {};
    const pastInjection = new Map<number, number>();
    if (archive) {
      const arch = archive;
      await Promise.all((Object.keys(BLOCKS) as Array<keyof typeof BLOCKS>).map(async key => {
        try {
          const hash = (await arch.rpc.chain.getBlockHash(block - BLOCKS[key])).toString();
          past[key] = await withTimeout(dynamicAt(arch, hash), 25_000, `history ${key}`);
          horizons[key] = true;
          if (key === "h24") {
            // Injection rate 24h ago, to average with today's for net flow.
            const at = await arch.at(hash);
            const [ti, ex] = await Promise.all([
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              (at.query.subtensorModule as any).subnetTaoInEmission.entries(),
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              (at.query.subtensorModule as any).subnetExcessTao.entries(),
            ]);
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            for (const [k, v] of ti as Array<[any, any]>) pastInjection.set(k.args.at(-1).toNumber(), num(v.toJSON()));
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            for (const [k, v] of ex as Array<[any, any]>) {
              const id = k.args.at(-1).toNumber();
              pastInjection.set(id, (pastInjection.get(id) ?? 0) + num(v.toJSON()));
            }
          }
        } catch (e) {
          console.warn(`[market] history ${key} failed: ${e instanceof Error ? e.message : e}`);
        }
      }));
    }

    // ── Assemble ──────────────────────────────────────────────────────
    let emissionTotal = 0;
    for (const [id] of dyn) if (id !== 0) emissionTotal += num(taoInEm.get(id)) + num(excess.get(id));

    const priceOf = (r?: DynamicRow) => {
      if (!r) return null;
      const a = num(r.alphaIn);
      return a > 0 ? num(r.taoIn) / a : null;
    };
    const pct = (now: number, then: number | null) =>
      then && then > 0 ? (now / then - 1) * 100 : null;

    const subnets = new Map<number, ChainSubnet>();
    for (const [id, r] of dyn) {
      if (id === 0) continue; // root is not a market
      const alphaIn = num(r.alphaIn) / RAO;
      const alphaOut = num(r.alphaOut) / RAO;
      const taoIn = num(r.taoIn) / RAO;
      if (alphaIn <= 0) continue;
      const priceTao = taoIn / alphaIn;
      const alphaStaked = (num(staked.get(id)) + num(protocol.get(id))) / RAO;
      const injectionNow = num(taoInEm.get(id)) + num(excess.get(id));

      const r24 = past.h24?.get(id);
      let volume24hTao: number | null = null;
      let netFlow24hTao: number | null = null;
      if (r24) {
        volume24hTao = Math.max(0, (num(r.subnetVolume) - num(r24.subnetVolume)) / RAO);
        const injectionThen = pastInjection.get(id) ?? injectionNow;
        const injected = ((injectionNow + injectionThen) / 2) * BLOCKS.h24 / RAO;
        netFlow24hTao = (num(r.taoIn) - num(r24.taoIn)) / RAO - injected;
      }

      const emaRaw = ema.get(id) as [unknown, { bits: unknown }] | undefined;
      subnets.set(id, {
        netuid: id,
        name: decodeBytes(r.subnetName),
        symbol: decodeBytes(r.tokenSymbol),
        priceTao,
        taoIn, alphaIn, alphaOut, alphaStaked,
        totalAlpha: alphaIn + alphaOut,
        marketCapTao: priceTao * (alphaIn + alphaStaked),
        emissionShare: emissionTotal > 0 ? injectionNow / emissionTotal : 0,
        emissionEnabled: enabled.get(id) === true,
        emaTaoFlowRao: Array.isArray(emaRaw) ? fixedToNumber(emaRaw[1]?.bits, 64, 128) : null,
        movingPriceTao: r.movingPrice ? fixedToNumber(r.movingPrice.bits, 32, 128) : null,
        change1h: pct(priceTao, priceOf(past.h1?.get(id))),
        change24h: pct(priceTao, priceOf(r24)),
        change7d: pct(priceTao, priceOf(past.d7?.get(id))),
        change30d: pct(priceTao, priceOf(past.d30?.get(id))),
        volume24hTao,
        netFlow24hTao,
        validators: Array.isArray(permits.get(id)) ? (permits.get(id) as boolean[]).filter(Boolean).length : null,
        neurons: neuronsN.has(id) ? num(neuronsN.get(id)) : null,
        registeredAtBlock: r.networkRegisteredAt != null ? num(r.networkRegisteredAt) : null,
      });
    }

    console.log(
      `[market] chain block ${block} @ ${observedAt}: ${subnets.size} subnets, history ` +
      Object.entries(horizons).map(([k, v]) => `${k}${v ? "" : "(missing)"}`).join(" "),
    );
    return { block, observedAt, subnets, horizons };
  } catch (e) {
    console.error(`[market] chain read failed: ${e instanceof Error ? e.message : e}`);
    return null;
  } finally {
    await Promise.all([head?.disconnect().catch(() => {}), archive?.disconnect().catch(() => {})]);
  }
}

/** True when this reading is recent enough to be recorded as live. */
export function isFresh(observedAt: string | null | undefined, maxAgeMs = MAX_MARKET_AGE_MS): boolean {
  if (!observedAt) return false;
  const t = new Date(observedAt).getTime();
  return Number.isFinite(t) && Date.now() - t <= maxAgeMs;
}

// ── TAO / USD ────────────────────────────────────────────────────────────
//
// The chain prices subnets in TAO; the dollar rate has to come from an
// exchange. Three independent free sources, first sane answer wins, so no
// single provider (and no paid key) can blank every USD figure on the site.

const USD_SOURCES: Array<[string, () => Promise<number>]> = [
  ["coingecko", async () => {
    const r = await fetch("https://api.coingecko.com/api/v3/simple/price?ids=bittensor&vs_currencies=usd",
      { cache: "no-store", signal: AbortSignal.timeout(6000) });
    return Number((await r.json())?.bittensor?.usd);
  }],
  ["binance", async () => {
    const r = await fetch("https://api.binance.com/api/v3/ticker/price?symbol=TAOUSDT",
      { cache: "no-store", signal: AbortSignal.timeout(6000) });
    return Number((await r.json())?.price);
  }],
  ["kraken", async () => {
    const r = await fetch("https://api.kraken.com/0/public/Ticker?pair=TAOUSD",
      { cache: "no-store", signal: AbortSignal.timeout(6000) });
    const res = (await r.json())?.result ?? {};
    const first = Object.values(res)[0] as { c?: string[] } | undefined;
    return Number(first?.c?.[0]);
  }],
];

/** Sanity band: anything outside this is a bad response, not a price. */
const TAO_USD_MIN = 10;
const TAO_USD_MAX = 20_000;

export async function fetchTaoUsd(): Promise<{ usd: number; source: string } | null> {
  for (const [source, get] of USD_SOURCES) {
    try {
      const usd = await get();
      if (Number.isFinite(usd) && usd >= TAO_USD_MIN && usd <= TAO_USD_MAX) return { usd, source };
      console.warn(`[market] ${source} TAO/USD out of range: ${usd}`);
    } catch (e) {
      console.warn(`[market] ${source} TAO/USD failed: ${e instanceof Error ? e.message : e}`);
    }
  }
  return null;
}

// ── Daily TAO / USD history ──────────────────────────────────────────────
//
// Historical subnet prices from the 1Y endpoint are in TAO. Converting them at
// today's rate would be wrong by however much TAO itself moved (it was ~$346 a
// year before this was written, ~$263 on the day), so each day converts at
// that day's rate. Cached six hours; a year of daily closes barely changes.

const TAO_USD_DAILY_BLOB = "tao-usd-daily.json";
const TAO_USD_DAILY_TTL_MS = 6 * 3600_000;

async function fetchDailyFromSources(): Promise<Array<[string, number]> | null> {
  try {
    const r = await fetch("https://api.coingecko.com/api/v3/coins/bittensor/market_chart?vs_currency=usd&days=365&interval=daily",
      { cache: "no-store", signal: AbortSignal.timeout(10_000) });
    const prices = (await r.json())?.prices as Array<[number, number]> | undefined;
    if (prices?.length) return prices.map(([ms, usd]) => [new Date(ms).toISOString().slice(0, 10), usd]);
  } catch { /* try the next source */ }
  try {
    const r = await fetch("https://api.kraken.com/0/public/OHLC?pair=TAOUSD&interval=1440",
      { cache: "no-store", signal: AbortSignal.timeout(10_000) });
    const res = (await r.json())?.result ?? {};
    const key = Object.keys(res).find(k => k !== "last");
    const rows = (key ? res[key] : []) as Array<[number, string, string, string, string]>;
    if (rows.length) return rows.map(row => [new Date(row[0] * 1000).toISOString().slice(0, 10), Number(row[4])]);
  } catch { /* both failed */ }
  return null;
}

/** Map of YYYY-MM-DD to TAO/USD close. Empty map if nothing is reachable. */
export async function fetchTaoUsdDaily(token: string): Promise<Map<string, number>> {
  const { get, put } = await import("@vercel/blob");
  let cached: { savedAt: string; days: Array<[string, number]> } | null = null;
  try {
    const b = await get(TAO_USD_DAILY_BLOB, { token, access: "private", abortSignal: AbortSignal.timeout(8_000) });
    if (b?.stream) {
      const r = b.stream.getReader(); const cs: Uint8Array[] = [];
      while (true) { const { done, value } = await r.read(); if (done) break; cs.push(value); }
      cached = JSON.parse(Buffer.concat(cs).toString("utf-8"));
    }
  } catch { /* first run */ }
  if (cached && Date.now() - new Date(cached.savedAt).getTime() < TAO_USD_DAILY_TTL_MS) {
    return new Map(cached.days);
  }
  const days = await fetchDailyFromSources();
  if (days?.length) {
    await put(TAO_USD_DAILY_BLOB, JSON.stringify({ savedAt: new Date().toISOString(), days }), {
      access: "private", addRandomSuffix: false, allowOverwrite: true, token, contentType: "application/json",
    }).catch(() => {});
    return new Map(days);
  }
  // Sources down: an older copy of past closes is still correct for the past.
  return new Map(cached?.days ?? []);
}

/** Convert a TAO-denominated series to USD at each day's own rate. */
export function taoSeriesToUsd(
  points: Array<{ timestamp: string; price: number }>,
  daily: Map<string, number>,
  fallbackUsd: number,
): Array<{ timestamp: string; price: number }> {
  const sortedDays = [...daily.keys()].sort();
  const rateFor = (day: string): number => {
    const exact = daily.get(day);
    if (exact) return exact;
    // Nearest earlier close (weekends/gaps), else the live rate.
    let lo = 0, hi = sortedDays.length - 1, best = -1;
    while (lo <= hi) { const mid = (lo + hi) >> 1; if (sortedDays[mid] <= day) { best = mid; lo = mid + 1; } else hi = mid - 1; }
    return best >= 0 ? daily.get(sortedDays[best])! : fallbackUsd;
  };
  return points
    .map(p => ({ timestamp: p.timestamp, price: p.price * rateFor(p.timestamp.slice(0, 10)) }))
    .filter(p => p.price > 0 && Number.isFinite(p.price));
}

// ── Daily price archive (chain-derived) ──────────────────────────────────
//
// One TAO-denominated close per subnet per UTC day, read from chain state.
// Backfilled a year deep from the archive node, then kept current by the scan.
// This is what the 3M and 1Y charts draw, so they no longer depend on a paid
// API that can go quiet and leave the long charts frozen at an old date.

export const PRICE_DAILY_BLOB = "price-daily-tao.json";
export interface PriceDaily {
  savedAt: string;
  days: Record<string, Record<string, number>>;
  /** Registration block per netuid the prices belong to. */
  reg?: Record<string, number>;
}

export async function readPriceDaily(token: string): Promise<PriceDaily | null> {
  const { get } = await import("@vercel/blob");
  try {
    const b = await get(PRICE_DAILY_BLOB, { token, access: "private", abortSignal: AbortSignal.timeout(10_000) });
    if (!b?.stream) return null;
    const r = b.stream.getReader(); const cs: Uint8Array[] = [];
    while (true) { const { done, value } = await r.read(); if (done) break; cs.push(value); }
    return JSON.parse(Buffer.concat(cs).toString("utf-8"));
  } catch { return null; }
}

/** Daily TAO closes for one subnet, oldest first. */
export function dailySeries(archive: PriceDaily | null, netuid: number): Array<{ timestamp: string; price: number }> {
  if (!archive) return [];
  return Object.keys(archive.days).sort()
    .map(day => ({ timestamp: `${day}T23:59:00.000Z`, price: archive.days[day]?.[String(netuid)] ?? 0 }))
    .filter(p => p.price > 0);
}
