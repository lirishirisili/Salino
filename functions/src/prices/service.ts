import { gunzipSync, gzipSync } from "node:zlib";
import { getStorage } from "firebase-admin/storage";
import { CHAIN_DB_VERSION, ingestChain, type ChainDb, type IngestStats } from "./compile";
import { buildDataset, type ListItemInput, type LoadedChain } from "./engine";
import { addressKey, cityName, fetchCities, geocodeMissing, type GeoCache } from "./geo";
import { CHAINS } from "./sources";

export const PRICES_BUCKET = "salino-aaf86-prices";
const PREFIX = "prices/v1";
const CITIES_TTL_MS = 30 * 24 * 60 * 60 * 1000;

const bucket = () => getStorage().bucket(PRICES_BUCKET);

async function writeObject(path: string, data: unknown, gzip = false): Promise<void> {
  // stringify once; for gzip, pass the same buffer through zlib without keeping both long-term.
  const json = Buffer.from(JSON.stringify(data));
  const body = gzip ? gzipSync(json, { level: 6 }) : json;
  await bucket()
    .file(`${PREFIX}/${path}`)
    .save(body, {
      resumable: false,
      contentType: gzip ? "application/gzip" : "application/json",
      metadata: { cacheControl: "no-cache" },
    });
}

async function readObject<T>(path: string): Promise<{ data: T; generation: string } | null> {
  const file = bucket().file(`${PREFIX}/${path}`);
  try {
    const [buf] = await file.download();
    const [meta] = await file.getMetadata();
    const raw = buf.length >= 2 && buf[0] === 0x1f && buf[1] === 0x8b ? gunzipSync(buf) : buf;
    return { data: JSON.parse(raw.toString("utf8")) as T, generation: String(meta.generation ?? "") };
  } catch (err) {
    if ((err as { code?: number }).code === 404) return null;
    throw err;
  }
}

async function generationOf(path: string): Promise<string | null> {
  try {
    const [meta] = await bucket().file(`${PREFIX}/${path}`).getMetadata();
    return String(meta.generation ?? "");
  } catch (err) {
    if ((err as { code?: number }).code === 404) return null;
    throw err;
  }
}

// --- Ingestion ----------------------------------------------------------------------------------

type StatusFile = IngestStats & { lastGoodAt?: number | null; lastGoodStores?: number };

export interface StoresListFile {
  key: string;
  name: string;
  generatedAt: number;
  stores: { id: string; n: string; a: string; city: string; cityCode: number | null; t: number; ts: string }[];
}

export async function runIngest(keys: string[], log: (m: string) => void): Promise<IngestStats[]> {
  const all: IngestStats[] = [];
  for (const key of keys) {
    const chain = CHAINS.find((c) => c.key === key);
    if (!chain) continue;
    try {
      const { db, stats } = await ingestChain(chain, { log });
      const prev = (await readObject<StatusFile>(`status/${key}.json`))?.data;
      const prevStores = prev?.lastGoodStores ?? 0;
      // A sudden collapse usually means the portal served a partial listing; keep the last good data.
      if (!stats.ok || (prevStores >= 10 && stats.storesWithPrices < prevStores * 0.5)) {
        stats.ok = false;
        stats.message = `kept previous data: ${stats.storesWithPrices} stores vs ${prevStores}`;
        log(`${key}: ${stats.message}`);
        await writeObject(`status/${key}.json`, { ...stats, lastGoodAt: prev?.lastGoodAt ?? null, lastGoodStores: prevStores });
        all.push(stats);
        continue;
      }
      await writeObject(`chains/${key}.json.gz`, db, true);
      const storesFile: StoresListFile = {
        key,
        name: chain.name,
        generatedAt: db.generatedAt,
        stores: db.stores.map((s) => ({ id: s.id, n: s.n, a: s.a, city: s.city, cityCode: s.cityCode, t: s.t, ts: s.ts })),
      };
      await writeObject(`stores/${key}.json`, storesFile);
      await writeObject(`status/${key}.json`, { ...stats, lastGoodAt: db.generatedAt, lastGoodStores: stats.storesWithPrices });
      log(`${key}: ${JSON.stringify(stats)}`);
      all.push(stats);
    } catch (err) {
      const message = (err as Error)?.message ?? String(err);
      log(`${key}: FAILED ${message}`);
      const stats: IngestStats = {
        key,
        ok: false,
        storesListed: 0,
        storesWithPrices: 0,
        items: 0,
        priceGroups: 0,
        promos: 0,
        errors: 1,
        durationMs: 0,
        message,
      };
      const prev = (await readObject<StatusFile>(`status/${key}.json`).catch(() => null))?.data;
      await writeObject(`status/${key}.json`, { ...stats, lastGoodAt: prev?.lastGoodAt ?? null, lastGoodStores: prev?.lastGoodStores ?? 0 });
      all.push(stats);
    }
  }
  return all;
}

// --- Store index (geocoded) ---------------------------------------------------------------------

/** [chainKey, storeId, name, address, city, lat|null, lng|null, type, precision] */
export type StoreRow = [string, string, string, string, string, number | null, number | null, number, string];

export interface StoresIndex {
  v: number;
  generatedAt: number;
  chains: { key: string; name: string; updatedAt: number; stores: number }[];
  stores: StoreRow[];
}

async function buildStoresIndex(
  lists: StoresListFile[],
  cache: GeoCache,
  cities: Record<string, string>
): Promise<StoresIndex> {
  const rows: StoreRow[] = [];
  for (const l of lists) {
    for (const s of l.stores) {
      const forGeo = { address: s.a, city: s.city, cityCode: s.cityCode, type: s.t, name: s.n };
      const key = addressKey(forGeo, cities);
      const g = key ? cache[key] : undefined;
      const hasGeo = g && g.q !== "x" && g.lat != null && g.lng != null;
      rows.push([
        l.key,
        s.id,
        s.n,
        s.a,
        cityName(forGeo, cities),
        hasGeo ? Math.round(g!.lat! * 1e5) / 1e5 : null,
        hasGeo ? Math.round(g!.lng! * 1e5) / 1e5 : null,
        s.t,
        hasGeo ? g!.q : "x",
      ]);
    }
  }
  return {
    v: 1,
    generatedAt: Date.now(),
    chains: lists.map((l) => ({ key: l.key, name: l.name, updatedAt: l.generatedAt, stores: l.stores.length })),
    stores: rows,
  };
}

export async function runGeocode(
  budget: number,
  log: (m: string) => void,
  deadline = Infinity
): Promise<{ requests: number; resolved: number; stores: number; withCoords: number }> {
  let cities = (await readObject<{ at: number; map: Record<string, string> }>("cities.json"))?.data;
  if (!cities || Date.now() - cities.at > CITIES_TTL_MS) {
    try {
      cities = { at: Date.now(), map: await fetchCities() };
      await writeObject("cities.json", cities);
    } catch (err) {
      log(`cities fetch failed: ${(err as Error).message}`);
      cities ??= { at: 0, map: {} };
    }
  }
  const cache = (await readObject<GeoCache>("geo.json"))?.data ?? {};
  const lists: StoresListFile[] = [];
  for (const chain of CHAINS) {
    const f = await readObject<StoresListFile>(`stores/${chain.key}.json`);
    if (f) lists.push(f.data);
  }
  const flat = lists.flatMap((l) => l.stores.map((s) => ({ address: s.a, city: s.city, cityCode: s.cityCode, type: s.t, name: s.n })));

  let lastFlush = 0;
  const result = await geocodeMissing(flat, cache, cities.map, budget, log, deadline, async () => {
    // Checkpoint so a Cloud Run timeout never throws away an hour of Nominatim work.
    if (Date.now() - lastFlush < 60_000) return;
    lastFlush = Date.now();
    await writeObject("geo.json", cache);
    log(`geocode checkpoint: ${Object.keys(cache).length} keys`);
  });
  await writeObject("geo.json", cache);

  const index = await buildStoresIndex(lists, cache, cities.map);
  await writeObject("stores-index.json", index);
  storesIndexCache = { at: Date.now(), index };
  const withCoords = index.stores.filter((r) => r[5] != null && r[6] != null).length;
  return { ...result, stores: index.stores.length, withCoords };
}

// --- Read path (callables) ----------------------------------------------------------------------

const RECHECK_MS = 15 * 60 * 1000;
let storesIndexCache: { at: number; index: StoresIndex } | null = null;

export async function getStoresIndex(): Promise<StoresIndex | null> {
  if (storesIndexCache && Date.now() - storesIndexCache.at < RECHECK_MS) return storesIndexCache.index;
  const f = await readObject<StoresIndex>("stores-index.json");
  if (!f) return storesIndexCache?.index ?? null;
  storesIndexCache = { at: Date.now(), index: f.data };
  return f.data;
}

interface Dataset {
  chains: Map<string, LoadedChain>;
  generations: Map<string, string>;
  checkedAt: number;
}

let dataset: Dataset | null = null;
let loading: Promise<Dataset> | null = null;

/** All chains are loaded together: names and sizes are completed across chains by barcode. */
async function loadDataset(): Promise<Dataset> {
  const files = await Promise.all(
    CHAINS.map(async (c) => {
      try {
        return await readObject<ChainDb>(`chains/${c.key}.json.gz`);
      } catch {
        return null;
      }
    })
  );
  const dbs: ChainDb[] = [];
  const generations = new Map<string, string>();
  for (const f of files) {
    if (!f || f.data.v !== CHAIN_DB_VERSION) continue;
    dbs.push(f.data);
    generations.set(f.data.key, f.generation);
  }
  return { chains: buildDataset(dbs), generations, checkedAt: Date.now() };
}

async function datasetChanged(current: Dataset): Promise<boolean> {
  const gens = await Promise.all(CHAINS.map((c) => generationOf(`chains/${c.key}.json.gz`).catch(() => null)));
  return CHAINS.some((c, i) => gens[i] != null && gens[i] !== current.generations.get(c.key));
}

export async function getDataset(): Promise<Map<string, LoadedChain>> {
  if (!dataset) {
    loading ??= loadDataset().finally(() => (loading = null));
    dataset = await loading;
    return dataset.chains;
  }
  if (Date.now() - dataset.checkedAt > RECHECK_MS && !loading) {
    const current = dataset;
    current.checkedAt = Date.now();
    // Refresh in the background; requests keep using the current data meanwhile.
    loading = datasetChanged(current)
      .then(async (changed) => (changed ? loadDataset() : current))
      .then((next) => (dataset = next))
      .catch(() => current)
      .finally(() => (loading = null));
  }
  return dataset.chains;
}

// --- Request validation -------------------------------------------------------------------------

const UNITS = new Set(["PIECES", "KG", "GRAMS", "LITERS", "PACKS", "BOTTLES", "BAGS"]);

export function sanitizeItems(raw: unknown): ListItemInput[] {
  if (!Array.isArray(raw)) return [];
  const out: ListItemInput[] = [];
  for (const r of raw.slice(0, 120)) {
    if (!r || typeof r !== "object") continue;
    const o = r as Record<string, unknown>;
    const name = typeof o.name === "string" ? o.name.trim().slice(0, 120) : "";
    const id = typeof o.id === "string" ? o.id.slice(0, 64) : "";
    if (!name || !id) continue;
    const quantity = typeof o.quantity === "number" && Number.isFinite(o.quantity) ? o.quantity : 1;
    const unit = typeof o.unit === "string" && UNITS.has(o.unit) ? o.unit : null;
    const code = typeof o.code === "string" && /^\d{4,18}$/.test(o.code) ? o.code : null;
    out.push({ id, name, quantity, unit, code });
  }
  return out;
}

export function sanitizeRefs(raw: unknown, max: number): string[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter((r): r is string => typeof r === "string" && r.length <= 40).slice(0, max);
}

const hits = new Map<string, { n: number; at: number }>();

/** Per-instance limiter; cheap guard against runaway clients without a Firestore write per call. */
export function allowRequest(uid: string, perMinute: number, bucketName: string): boolean {
  const key = `${bucketName}:${uid}`;
  const now = Date.now();
  const cur = hits.get(key);
  if (!cur || now - cur.at > 60_000) {
    hits.set(key, { n: 1, at: now });
    if (hits.size > 5000) for (const [k, v] of hits) if (now - v.at > 60_000) hits.delete(k);
    return true;
  }
  cur.n++;
  return cur.n <= perMinute;
}
