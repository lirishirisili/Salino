import { createHash } from "node:crypto";
import { packPriceGroup } from "./codec";
import { pool } from "./http";
import { bufferToXml, parsePriceFile, parsePromoFile, parseStores, type RawItem, type RawStore } from "./parse";
import { listFiles, pickLatest, type ChainDef, type SourceFile } from "./sources";

export const CHAIN_DB_VERSION = 1;

export interface CompiledStore {
  id: string;
  sub: string;
  subName: string;
  n: string;
  a: string;
  city: string;
  cityCode: number | null;
  t: number;
  /** Index into priceGroups / promoGroups. */
  pg: number;
  mg: number;
  /** yyyymmddhhmmss of the price file the store's prices came from. */
  ts: string;
}

export interface CompiledPromo {
  d: string;
  e: number;
  club: number;
  min: number;
  /** Bundle price in agorot. */
  b: number;
  i: number[];
}

export interface ChainDb {
  v: number;
  key: string;
  chainId: string;
  name: string;
  generatedAt: number;
  stores: CompiledStore[];
  items: { c: string[]; n: string[]; m: string[]; q: (number | null)[]; u: string[]; w: number[] };
  /** One packed group per distinct store price list (see codec.ts). */
  priceGroups: { n: number; d: string }[];
  promos: CompiledPromo[];
  promoGroups: number[][];
}

export interface IngestStats {
  key: string;
  ok: boolean;
  storesListed: number;
  storesWithPrices: number;
  items: number;
  priceGroups: number;
  promos: number;
  errors: number;
  durationMs: number;
  message?: string;
}

const MAX_STALE_MS = 4 * 24 * 60 * 60 * 1000;

/**
 * Parsed fields are V8 sliced strings that keep their whole source XML (tens of MB) alive.
 * Anything kept past one store's file must be copied out, or every file stays in memory.
 */
function own(s: string): string {
  return s === "" ? "" : Buffer.from(s, "utf8").toString("utf8");
}

function stampToMs(stamp: string): number {
  const m = /^(\d{4})(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})/.exec(stamp);
  if (!m) return 0;
  return Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4], +m[5], +m[6]);
}

export async function ingestChain(chain: ChainDef, opts: { concurrency?: number; log?: (msg: string) => void } = {}): Promise<{ db: ChainDb; stats: IngestStats }> {
  const started = Date.now();
  const log = opts.log ?? (() => undefined);
  const files = await listFiles(chain);
  const { stores: storesFile, prices, promos } = pickLatest(files, chain.chainId);
  log(`${chain.key}: listed ${files.length} files, ${prices.size} stores with prices`);
  if (!storesFile) throw new Error(`${chain.key}: no stores file`);

  const storesParsed = parseStores(bufferToXml(await storesFile.download()));
  const storeMeta = new Map<string, RawStore>(
    storesParsed.stores.map((s) => [
      s.storeId,
      {
        ...s,
        storeId: own(s.storeId),
        subChainId: own(s.subChainId),
        subChainName: own(s.subChainName),
        name: own(s.name),
        address: own(s.address),
        city: own(s.city),
        zip: own(s.zip),
      },
    ])
  );

  const newest = Math.max(0, ...[...prices.values()].map((f) => stampToMs(f.stamp)));
  const fresh = [...prices.values()].filter((f) => storeMeta.has(f.storeId!) && newest - stampToMs(f.stamp) <= MAX_STALE_MS);

  const itemIndex = new Map<string, number>();
  const items: ChainDb["items"] = { c: [], n: [], m: [], q: [], u: [], w: [] };
  const indexOf = (it: RawItem): number => {
    let idx = itemIndex.get(it.code);
    if (idx === undefined) {
      idx = items.c.length;
      const code = own(it.code);
      itemIndex.set(code, idx);
      items.c.push(code);
      items.n.push(own(it.name));
      items.m.push(own(it.manufacturer));
      items.q.push(it.quantity);
      items.u.push(own(it.unit));
      items.w.push(it.weighted ? 1 : 0);
    }
    return idx;
  };

  const priceGroupByHash = new Map<string, number>();
  const priceGroups: ChainDb["priceGroups"] = [];
  const promoIndexByKey = new Map<string, number>();
  const compiledPromos: CompiledPromo[] = [];
  const promoGroupByHash = new Map<string, number>();
  const promoGroups: number[][] = [];
  const compiledStores: CompiledStore[] = [];
  const now = Date.now();

  const work = async (file: SourceFile) => {
    const raw = parsePriceFile(bufferToXml(await file.download()));
    if (raw.length < 50) throw new Error(`${chain.key} store ${file.storeId}: only ${raw.length} items`);
    // Keys must be detached copies: Map retention of XML slices keeps whole files alive.
    const priceByCode = new Map<string, number>();
    const pairs: [number, number][] = [];
    for (const it of raw) {
      const code = own(it.code);
      priceByCode.set(code, it.price);
      if (!it.global) priceByCode.set(own(code.startsWith("i") ? code.slice(1) : code), it.price);
      pairs.push([indexOf(it), Math.round(it.price * 100)]);
    }
    pairs.sort((a, b) => a[0] - b[0]);
    const packed = packPriceGroup(
      pairs.map((x) => x[0]),
      pairs.map((x) => x[1])
    );
    const hash = createHash("sha1").update(packed.d).digest("base64");
    let pg = priceGroupByHash.get(hash);
    if (pg === undefined) {
      pg = priceGroups.length;
      priceGroupByHash.set(hash, pg);
      priceGroups.push(packed);
    }

    const storePromoIdx: number[] = [];
    const promoFile = promos.get(file.storeId!);
    if (promoFile) {
      try {
        const parsed = parsePromoFile(bufferToXml(await promoFile.download()), now, (code) => priceByCode.get(code));
        for (const pr of parsed) {
          const idxs = pr.itemCodes
            .map((c) => itemIndex.get(c) ?? itemIndex.get("i" + c))
            .filter((x): x is number => x !== undefined)
            .sort((a, b) => a - b);
          if (idxs.length === 0) continue;
          const b = Math.round(pr.bundlePrice * 100);
          const key = own(`${pr.id}|${pr.clubId}|${pr.minQty}|${b}|${idxs.join(",")}`);
          let pi = promoIndexByKey.get(key);
          if (pi === undefined) {
            pi = compiledPromos.length;
            promoIndexByKey.set(key, pi);
            compiledPromos.push({ d: own(pr.description), e: pr.endsAt, club: pr.clubId, min: pr.minQty, b, i: idxs });
          }
          storePromoIdx.push(pi);
        }
      } catch (err) {
        log(`${chain.key} store ${file.storeId}: promo parse failed: ${(err as Error).message}`);
      }
    }
    priceByCode.clear();
    storePromoIdx.sort((a, b) => a - b);
    const promoHash = storePromoIdx.join(",");
    let mg = promoGroupByHash.get(promoHash);
    if (mg === undefined) {
      mg = promoGroups.length;
      promoGroupByHash.set(promoHash, mg);
      promoGroups.push(storePromoIdx);
    }

    const meta = storeMeta.get(file.storeId!)!;
    compiledStores.push({
      id: meta.storeId,
      sub: meta.subChainId,
      subName: meta.subChainName,
      n: meta.name,
      a: meta.address,
      city: meta.city,
      cityCode: meta.cityCode,
      t: meta.type,
      pg,
      mg,
      ts: file.stamp,
    });
  };

  // Large chains (Shufersal ~425 stores) OOM at concurrency 6 on 2GiB; keep peak XML buffers small.
  const concurrency = opts.concurrency ?? (fresh.length > 120 ? 2 : fresh.length > 60 ? 3 : 6);
  const { errors } = await pool(fresh, concurrency, work);
  for (const e of errors.slice(0, 5)) log(`${chain.key}: ${(e.error as Error)?.message ?? e.error}`);
  compiledStores.sort((a, b) => Number(a.id) - Number(b.id));

  const db: ChainDb = {
    v: CHAIN_DB_VERSION,
    key: chain.key,
    chainId: chain.chainId,
    name: chain.name,
    generatedAt: Date.now(),
    stores: compiledStores,
    items,
    priceGroups,
    promos: compiledPromos,
    promoGroups,
  };
  const stats: IngestStats = {
    key: chain.key,
    ok: compiledStores.length > 0,
    storesListed: storesParsed.stores.length,
    storesWithPrices: compiledStores.length,
    items: items.c.length,
    priceGroups: priceGroups.length,
    promos: compiledPromos.length,
    errors: errors.length,
    durationMs: Date.now() - started,
  };
  return { db, stats };
}
