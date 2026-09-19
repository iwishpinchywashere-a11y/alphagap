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

// ── Snapshot cache ───────────────────────────────────────────────────────
//
// The public archive node rations historical reads ("Historical work rate
// limit exceeded"), and a scan every 10 minutes asking for four past blocks
// would lean on that budget forever. But every scan already reads the head of
// the chain; kept for a week, those readings ARE the past. So each scan stores
// its own head state, and the 1h/24h/7d comparisons read from that store. The
// archive is only asked for a horizon the store has nothing near (the first
// week after deploy, or after an outage), and that answer is stored too.
//
// Entries within 26h keep what the 24h volume and net flow need; older ones
// keep only the price, which is all the 7d comparison uses.

const SNAPSHOT_BLOB = "chain-snapshots.json";
type Snap = { t: number; block: number; s: Record<string, number[]> }; // [price, taoIn, volCum, injPerBlock] (TAO)
const TOLERANCE_MS: Record<"h1" | "h24" | "d7", number> = { h1: 8 * 60_000, h24: 40 * 60_000, d7: 60 * 60_000 };
const OFFSET_MS = { h1: 3600_000, h24: 86_400_000, d7: 7 * 86_400_000, d30: 30 * 86_400_000 };

const sig = (x: number) => Number(x.toPrecision(10));

async function readSnapshots(token: string): Promise<Snap[]> {
  if (!token) return [];
  const { get } = await import("@vercel/blob");
  try {
    const b = await get(SNAPSHOT_BLOB, { token, access: "private", abortSignal: AbortSignal.timeout(8_000) });
    if (!b?.stream) return [];
    const r = b.stream.getReader(); const cs: Uint8Array[] = [];
    while (true) { const { done, value } = await r.read(); if (done) break; cs.push(value); }
    const parsed = JSON.parse(Buffer.concat(cs).toString("utf-8"));
    return Array.isArray(parsed?.snaps) ? parsed.snaps : [];
  } catch { return []; }
}

/** Every scan for 2h, one per hour to 8 days; beyond 26h, price only. */
function pruneSnapshots(snaps: Snap[], nowMs: number): Snap[] {
  const sorted = [...snaps].sort((a, b) => b.t - a.t);
  const seenHours = new Set<number>();
  const out: Snap[] = [];
  for (const sn of sorted) {
    const age = nowMs - sn.t;
    if (age > 8 * 86_400_000) continue;
    if (age > 2 * 3600_000) {
      const hour = Math.floor(sn.t / 3600_000);
      if (seenHours.has(hour)) continue;
      seenHours.add(hour);
    }
    if (age > 26 * 3600_000) {
      out.push({ t: sn.t, block: sn.block, s: Object.fromEntries(Object.entries(sn.s).map(([k, v]) => [k, [v[0]]])) });
    } else out.push(sn);
  }
  return out.sort((a, b) => a.t - b.t);
}

function nearest(snaps: Snap[], target: number, tol: number): Snap | null {
  let best: Snap | null = null, bd = Infinity;
  for (const sn of snaps) { const d = Math.abs(sn.t - target); if (d < bd) { bd = d; best = sn; } }
  return best && bd <= tol ? best : null;
}

/**
 * Read every subnet's market state from chain. Returns null only if the head
 * of the chain cannot be read at all; missing history horizons degrade to null
 * change values rather than failing the whole read.
 */
export async function fetchChainMarket(): Promise<ChainMarket | null> {
  const token = process.env.BLOB_READ_WRITE_TOKEN || "";
  let head: ApiPromise | null = null;
  let archive: ApiPromise | null = null;
  let archiveTried = false;
  const getArchive = async () => {
    if (!archiveTried) {
      archiveTried = true;
      archive = await connect(ARCHIVE_RPC, 20_000).catch(e => {
        console.warn(`[market] archive unavailable: ${e instanceof Error ? e.message : e}`);
        return null;
      });
    }
    return archive;
  };
  try {
    head = await connect(HEAD_RPC, 20_000).catch(e => {
      console.warn(`[market] head RPC failed (${e instanceof Error ? e.message : e}), using archive for head`);
      return null;
    });
    const headApi = head ?? (await getArchive());
    if (!headApi) return null;

    const [header, nowTs, dyn, staked, protocol, taoInEm, excess, enabled, ema, permits, neuronsN, snapsLoaded] = await withTimeout(Promise.all([
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
      readSnapshots(token),
    ]), 30_000, "head state");

    const block = header.number.toNumber();
    const nowMs = Number(nowTs.toString());
    const observedAt = new Date(nowMs).toISOString();

    // Head state in snapshot form: [price, taoIn, volumeCum, injection/block], TAO.
    const headSnap: Snap = { t: nowMs, block, s: {} };
    for (const [id, r] of dyn) {
      if (id === 0) continue;
      const aIn = num(r.alphaIn);
      if (aIn <= 0) continue;
      headSnap.s[id] = [
        sig(num(r.taoIn) / aIn),
        sig(num(r.taoIn) / RAO),
        sig(num(r.subnetVolume) / RAO),
        sig((num(taoInEm.get(id)) + num(excess.get(id))) / RAO),
      ];
    }
    let snaps = snapsLoaded;

    // ── Past states: snapshot store first, archive only for gaps ────────
    const horizons = { h1: false, h24: false, d7: false, d30: false };
    const past: Partial<Record<keyof typeof BLOCKS, Record<string, number[]>>> = {};
    const fromArchive: string[] = [];
    for (const key of ["h1", "h24", "d7"] as const) {
      const hit = nearest(snaps, nowMs - OFFSET_MS[key], TOLERANCE_MS[key]);
      // 24h needs the full tuple (volume, injection); older entries hold price only.
      if (hit && (key !== "h24" || Object.values(hit.s)[0]?.length === 4)) {
        past[key] = hit.s; horizons[key] = true; continue;
      }
      const arch = await getArchive();
      if (!arch) continue;
      try {
        const hash = (await arch.rpc.chain.getBlockHash(block - BLOCKS[key])).toString();
        const at = await arch.at(hash);
        const [rows, tsPast, tin, ex] = await withTimeout(Promise.all([
          dynamicAt(arch, hash),
          at.query.timestamp.now(),
          key === "h24" ? perNetuidAt(at, "subnetTaoInEmission") : Promise.resolve(new Map<number, unknown>()),
          key === "h24" ? perNetuidAt(at, "subnetExcessTao") : Promise.resolve(new Map<number, unknown>()),
        ]), 25_000, `history ${key}`);
        const snap: Snap = { t: Number(tsPast.toString()), block: block - BLOCKS[key], s: {} };
        for (const [id, r] of rows) {
          const aIn = num(r.alphaIn);
          if (id === 0 || aIn <= 0) continue;
          snap.s[id] = [sig(num(r.taoIn) / aIn), sig(num(r.taoIn) / RAO), sig(num(r.subnetVolume) / RAO), sig((num(tin.get(id)) + num(ex.get(id))) / RAO)];
        }
        past[key] = snap.s; horizons[key] = true;
        snaps = [...snaps, snap];
        fromArchive.push(key);
      } catch (e) {
        console.warn(`[market] history ${key} failed: ${e instanceof Error ? e.message : e}`);
      }
    }
    // 30d: the chain-derived daily price archive, else one archive read.
    const daily = await readPriceDaily(token);
    const d30Day = new Date(nowMs - OFFSET_MS.d30).toISOString().slice(0, 10);
    if (daily?.days?.[d30Day]) {
      past.d30 = Object.fromEntries(Object.entries(daily.days[d30Day]).map(([k, v]) => [k, [v]]));
      horizons.d30 = true;
    } else {
      const arch = await getArchive();
      if (arch) {
        try {
          const hash = (await arch.rpc.chain.getBlockHash(block - BLOCKS.d30)).toString();
          const rows = await withTimeout(dynamicAt(arch, hash), 25_000, "history d30");
          past.d30 = {};
          for (const [id, r] of rows) { const aIn = num(r.alphaIn); if (id !== 0 && aIn > 0) past.d30[id] = [num(r.taoIn) / aIn]; }
          horizons.d30 = true;
          fromArchive.push("d30");
        } catch (e) {
          console.warn(`[market] history d30 failed: ${e instanceof Error ? e.message : e}`);
        }
      }
    }

    // Store this reading for future scans.
    await (async () => {
      if (!token) return;
      const { put } = await import("@vercel/blob");
      await put(SNAPSHOT_BLOB, JSON.stringify({ snaps: pruneSnapshots([...snaps, headSnap], nowMs) }), {
        access: "private", addRandomSuffix: false, allowOverwrite: true, token, contentType: "application/json",
      });
    })().catch(e => console.warn(`[market] snapshot save failed: ${e instanceof Error ? e.message : e}`));

    // ── Assemble ──────────────────────────────────────────────────────
    let emissionTotal = 0;
    for (const [id] of dyn) if (id !== 0) emissionTotal += num(taoInEm.get(id)) + num(excess.get(id));
    const pct = (now: number, then: number | undefined) =>
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
      const injectionNow = (num(taoInEm.get(id)) + num(excess.get(id))) / RAO;

      const p24 = past.h24?.[id];
      let volume24hTao: number | null = null;
      let netFlow24hTao: number | null = null;
      if (p24 && p24.length === 4) {
        const [, taoInThen, volThen, injThen] = p24;
        const volNow = num(r.subnetVolume) / RAO;
        volume24hTao = Math.max(0, volNow - volThen);
        // Actual elapsed blocks, since a snapshot may sit a few minutes off 24h.
        const blocks = Math.max(1, (nowMs - (snapTime(snaps, past.h24) ?? nowMs - OFFSET_MS.h24)) / 12_000);
        const injected = ((injectionNow + injThen) / 2) * blocks;
        netFlow24hTao = (taoIn - taoInThen) - injected;
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
        emissionShare: emissionTotal > 0 ? (num(taoInEm.get(id)) + num(excess.get(id))) / emissionTotal : 0,
        emissionEnabled: enabled.get(id) === true,
        emaTaoFlowRao: Array.isArray(emaRaw) ? fixedToNumber(emaRaw[1]?.bits, 64, 128) : null,
        movingPriceTao: r.movingPrice ? fixedToNumber(r.movingPrice.bits, 32, 128) : null,
        change1h: pct(priceTao, past.h1?.[id]?.[0]),
        change24h: pct(priceTao, p24?.[0]),
        change7d: pct(priceTao, past.d7?.[id]?.[0]),
        change30d: pct(priceTao, past.d30?.[id]?.[0]),
        volume24hTao,
        netFlow24hTao,
        validators: Array.isArray(permits.get(id)) ? (permits.get(id) as boolean[]).filter(Boolean).length : null,
        neurons: neuronsN.has(id) ? num(neuronsN.get(id)) : null,
        registeredAtBlock: r.networkRegisteredAt != null ? num(r.networkRegisteredAt) : null,
      });
    }

    console.log(
      `[market] chain block ${block} @ ${observedAt}: ${subnets.size} subnets, history ` +
      Object.entries(horizons).map(([k, v]) => `${k}${v ? "" : "(missing)"}`).join(" ") +
      ` (archive reads: ${fromArchive.length ? fromArchive.join(",") : "none"}, snapshots: ${snaps.length})`,
    );
    return { block, observedAt, subnets, horizons };
  } catch (e) {
    console.error(`[market] chain read failed: ${e instanceof Error ? e.message : e}`);
    return null;
  } finally {
    await Promise.all([
      (head as ApiPromise | null)?.disconnect().catch(() => {}),
      (archive as ApiPromise | null)?.disconnect().catch(() => {}),
    ]);
  }
}

/** Timestamp of the snapshot whose state object is `state`. */
function snapTime(snaps: Snap[], state: Record<string, number[]> | undefined): number | null {
  if (!state) return null;
  return snaps.find(sn => sn.s === state)?.t ?? null;
}

async function perNetuidAt(at: unknown, item: string): Promise<Map<number, unknown>> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const entries = await (at as any).query.subtensorModule[item].entries();
  const out = new Map<number, unknown>();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  for (const [k, v] of entries as Array<[any, any]>) out.set(k.args.at(-1).toNumber(), v.toJSON());
  return out;
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

/**
 * Fill ONE missing day of the daily archive from the archive node. The scan
 * calls this once per run: reads far back are expensive against the public
 * node's budget (200+ days exhausts it in a single read), so the year fills
 * gently, newest gap first, about six days an hour. Returns the day filled.
 */
export async function fillOneDailyGap(
  archive: PriceDaily,
  currentReg: Map<number, number | null>,
  headBlock: number,
  headMs: number,
  maxDays = 365,
): Promise<string | null> {
  let target: string | null = null;
  for (let i = 1; i <= maxDays; i++) {
    const day = new Date(headMs - i * 86_400_000).toISOString().slice(0, 10);
    if (!archive.days[day]) { target = day; break; }
  }
  if (!target) return null;
  let api: ApiPromise | null = null;
  try {
    api = await connect(ARCHIVE_RPC, 15_000);
    // 12.018s per block, measured over 2.6M blocks on 2026-09-19.
    const t = new Date(`${target}T23:59:00Z`).getTime();
    const block = Math.round(headBlock - (headMs - t) / 12_018);
    const hash = (await api.rpc.chain.getBlockHash(block)).toString();
    const rows = await withTimeout(dynamicAt(api, hash), 25_000, `daily ${target}`);
    const day: Record<string, number> = {};
    for (const [id, r] of rows) {
      const aIn = num(r.alphaIn);
      if (id === 0 || aIn <= 0) continue;
      // Only attribute to the netuid's CURRENT project.
      const reg = currentReg.get(id);
      if (reg != null && r.networkRegisteredAt != null && num(r.networkRegisteredAt) !== reg) continue;
      day[id] = num(r.taoIn) / aIn;
    }
    archive.days[target] = day;
    return target;
  } catch (e) {
    console.warn(`[market] daily gap ${target} not filled: ${e instanceof Error ? e.message : e}`);
    return null;
  } finally {
    await api?.disconnect().catch(() => {});
  }
}
