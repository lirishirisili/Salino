import { getText, sleep } from "./http";

export interface GeoEntry {
  lat?: number;
  lng?: number;
  /** a = street address, c = city centre, x = not found. */
  q: "a" | "c" | "x";
  at: number;
}

export type GeoCache = Record<string, GeoEntry>;

export interface StoreForGeo {
  address: string;
  city: string;
  cityCode: number | null;
  type: number;
  /** Branch name; some chains leave the city empty and name branches after it. */
  name?: string;
}

const ISRAEL_BBOX = { minLat: 29.4, maxLat: 33.4, minLng: 34.2, maxLng: 35.95 };
const RETRY_MISSING_MS = 14 * 24 * 60 * 60 * 1000;
const NOMINATIM = "https://nominatim.openstreetmap.org/search";
const UA = "HaserliPrices/1.0 (+https://hsr.lirshir.com)";

/** CBS settlement code → Hebrew name, from the government open-data portal. */
export async function fetchCities(): Promise<Record<string, string>> {
  const url =
    "https://data.gov.il/api/3/action/datastore_search?resource_id=5c78e9fa-c2e2-4771-93ff-7f400a12f7ba&limit=5000";
  const json = JSON.parse(await getText(url, { timeoutMs: 60_000 })) as {
    result?: { records?: Record<string, string | number>[] };
  };
  const out: Record<string, string> = {};
  for (const r of json.result?.records ?? []) {
    const code = String(r["סמל_ישוב"] ?? "").trim();
    const name = String(r["שם_ישוב"] ?? "").replace(/\s+/g, " ").trim();
    if (code && name && code !== "0") out[String(Number(code))] = name;
  }
  return out;
}

const cityPrefixes = new WeakMap<Record<string, string>, string[]>();

function knownCityPrefixes(cities: Record<string, string>): string[] {
  let list = cityPrefixes.get(cities);
  if (!list) {
    const set = new Set<string>();
    for (const name of Object.values(cities)) {
      set.add(name);
      const head = name.split(/\s*-\s*/)[0];
      if (head.length >= 3) set.add(head);
    }
    list = [...set].filter((n) => n.length >= 3).sort((a, b) => b.length - a.length);
    cityPrefixes.set(cities, list);
  }
  return list;
}

/** Only a prefix at a word boundary counts, so "מודיעין כרמים" is not mistaken for kibbutz Kramim. */
function cityFromName(name: string, cities: Record<string, string>): string {
  const clean = name.replace(/\s+/g, " ").trim();
  const candidates = [clean, clean.replace(/^\S+\s/, "")];
  for (const city of knownCityPrefixes(cities)) {
    for (const c of candidates) {
      if (c.startsWith(city) && (c.length === city.length || /[\s,\-–()]/.test(c[city.length]))) return city;
    }
  }
  return "";
}

export function cityName(store: StoreForGeo, cities: Record<string, string>): string {
  const byCode = store.cityCode ? cities[String(store.cityCode)] : undefined;
  const city = byCode ?? store.city.replace(/\s+/g, " ").trim();
  if (city || !store.name) return city;
  return cityFromName(store.name, cities);
}

function cleanAddress(address: string, city: string): string {
  let a = address.replace(/\s+/g, " ").trim();
  if (/^https?:|www\./i.test(a) || /^(unknown|null|לא ידוע|-|0)$/i.test(a)) return "";
  a = a.replace(/,?\s*ישראל\s*$/, "");
  if (city) a = a.split(city).join(" ");
  return a
    .replace(/\(.*?\)/g, " ")
    .replace(/[,;]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function addressKey(store: StoreForGeo, cities: Record<string, string>): string | null {
  const city = cityName(store, cities);
  const street = cleanAddress(store.address, city);
  if (!city && !street) return null;
  return `a|${street}|${city}`;
}

function inIsrael(lat: number, lng: number): boolean {
  return lat >= ISRAEL_BBOX.minLat && lat <= ISRAEL_BBOX.maxLat && lng >= ISRAEL_BBOX.minLng && lng <= ISRAEL_BBOX.maxLng;
}

async function nominatim(params: Record<string, string>): Promise<{ lat: number; lng: number } | null> {
  const qs = new URLSearchParams({ format: "jsonv2", limit: "1", countrycodes: "il", "accept-language": "he", ...params });
  const text = await getText(`${NOMINATIM}?${qs}`, { headers: { "User-Agent": UA }, timeoutMs: 30_000, retries: 1 });
  const arr = JSON.parse(text) as { lat: string; lon: string }[];
  if (!arr.length) return null;
  const lat = Number(arr[0].lat);
  const lng = Number(arr[0].lon);
  return Number.isFinite(lat) && Number.isFinite(lng) && inIsrael(lat, lng) ? { lat, lng } : null;
}

/**
 * Geocodes stores missing from the cache, respecting Nominatim's one-request-per-second policy.
 * Mutates and returns the cache; stops after `budget` HTTP requests or once `deadline` passes.
 */
export async function geocodeMissing(
  stores: StoreForGeo[],
  cache: GeoCache,
  cities: Record<string, string>,
  budget: number,
  log: (m: string) => void = () => undefined,
  deadline = Infinity,
  onProgress?: () => Promise<void>
): Promise<{ requests: number; resolved: number }> {
  let requests = 0;
  let resolved = 0;
  const now = Date.now();
  const call = async (params: Record<string, string>) => {
    requests++;
    await sleep(1100);
    try {
      return await nominatim(params);
    } catch (err) {
      log(`nominatim error: ${(err as Error).message}`);
      return null;
    }
  };

  for (const store of stores) {
    if (requests >= budget || Date.now() > deadline) break;
    if (store.type === 2) continue;
    const key = addressKey(store, cities);
    if (!key) continue;
    const cur = cache[key];
    if (cur && (cur.q !== "x" || now - cur.at < RETRY_MISSING_MS)) continue;

    const city = cityName(store, cities);
    const street = cleanAddress(store.address, city);
    let hit: { lat: number; lng: number } | null = null;
    if (street && city) hit = await call({ street, city });
    if (!hit && street) hit = await call({ q: city ? `${street}, ${city}` : street });
    if (hit) {
      cache[key] = { ...hit, q: "a", at: now };
      resolved++;
      if (onProgress) await onProgress();
      continue;
    }
    if (city) {
      const ck = `c|${city}`;
      let c = cache[ck];
      if (!c || (c.q === "x" && now - c.at > RETRY_MISSING_MS)) {
        const ch = await call({ city });
        c = cache[ck] = ch ? { ...ch, q: "c", at: now } : { q: "x", at: now };
      }
      if (c.q !== "x") {
        cache[key] = { lat: c.lat, lng: c.lng, q: "c", at: now };
        resolved++;
        if (onProgress) await onProgress();
        continue;
      }
    }
    cache[key] = { q: "x", at: now };
    if (onProgress) await onProgress();
  }
  return { requests, resolved };
}
