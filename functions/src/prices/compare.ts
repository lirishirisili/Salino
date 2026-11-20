import {
  bestInStore,
  describeSize,
  priceAt,
  resolveItem,
  type LinePrice,
  type ListItemInput,
  type LoadedChain,
  type Resolution,
} from "./engine";
import { normalize, tokenize, sameSize, sizeFromText } from "./text";
import type { CompiledStore } from "./compile";

export const MAX_ITEMS = 120;
export const MAX_STORES = 15;

export interface CompareRequest {
  items: ListItemInput[];
  /** "chainKey:storeId" */
  stores: string[];
  clubs: string[];
  now: number;
}

export interface ItemResult {
  id: string;
  matched: boolean;
  mode: Resolution["mode"];
  product: { name: string; code: string | null; size: string; weighted: boolean } | null;
  cheapest: { store: string; cost: number } | null;
}

export interface StoreLine {
  id: string;
  n: string;
  c: string | null;
  size: string;
  cost: number;
  regular: number;
  amount: number;
  weighted: boolean;
  promo: { d: string; club: boolean } | null;
  hint: { d: string; min: number; b: number } | null;
  /** A different pack size, priced per unit; `cost` is scaled, `packCost` is what the pack costs. */
  approx: boolean;
  packCost: number | null;
}

export interface StoreResult {
  key: string;
  chain: string;
  chainName: string;
  name: string;
  address: string;
  cityCode: number | null;
  city: string;
  online: boolean;
  /** Agorot for the items this store has. */
  total: number;
  /** Agorot including estimates for missing items, used for ranking. */
  estimated: number;
  promoSavings: number;
  found: number;
  missing: string[];
  updatedAt: string;
  lines: StoreLine[];
}

export interface CompareResult {
  generatedAt: number;
  matchedItems: number;
  items: ItemResult[];
  stores: StoreResult[];
  split: { stores: [string, string]; total: number; saving: number; assign: Record<string, string> } | null;
}

function median(values: number[]): number {
  const s = [...values].sort((a, b) => a - b);
  const m = s.length >> 1;
  return s.length % 2 ? s[m] : Math.round((s[m - 1] + s[m]) / 2);
}

export function parseStoreRef(ref: string): { chain: string; store: string } | null {
  const m = /^([a-z0-9_-]{2,30}):(\d{1,6})$/.exec(String(ref));
  return m ? { chain: m[1], store: m[2].replace(/^0+/, "") || "0" } : null;
}

export function compareBasket(chains: Map<string, LoadedChain>, req: CompareRequest): CompareResult {
  const picked: { key: string; chain: LoadedChain; store: CompiledStore }[] = [];
  for (const ref of req.stores.slice(0, MAX_STORES)) {
    const p = parseStoreRef(ref);
    const chain = p && chains.get(p.chain);
    const store = p && chain?.stores.get(p.store);
    if (chain && store && !picked.some((x) => x.key === ref)) picked.push({ key: `${chain.key}:${store.id}`, chain, store });
  }
  const used = [...new Set(picked.map((p) => p.chain))];
  const opts = { clubChains: new Set(req.clubs), now: req.now };
  const items = req.items.slice(0, MAX_ITEMS);

  const resolutionCache = new Map<string, Resolution>();
  const resolutions = items.map((it) => {
    const key = `${normalize(it.name)}|${it.code ?? ""}`;
    let r = resolutionCache.get(key);
    if (!r) resolutionCache.set(key, (r = resolveItem(it, used, picked)));
    return r;
  });

  // lines[s][i]
  const lines: (LinePrice | null)[][] = picked.map(({ chain, store }) =>
    items.map((it, i) => (resolutions[i].anchor ? bestInStore(chain, store, resolutions[i], it, opts) : null))
  );

  const estimates = items.map((_, i) => {
    const costs = lines.map((row) => row[i]?.cost).filter((c): c is number => c != null);
    return costs.length ? median(costs) : null;
  });
  const matchedIdx = items.map((_, i) => i).filter((i) => estimates[i] != null);

  const storeResults: StoreResult[] = picked.map(({ key, chain, store }, s) => {
    let total = 0;
    let estimated = 0;
    let promoSavings = 0;
    const missing: string[] = [];
    const out: StoreLine[] = [];
    for (const i of matchedIdx) {
      const line = lines[s][i];
      if (!line) {
        missing.push(items[i].id);
        estimated += estimates[i]!;
        continue;
      }
      total += line.cost;
      estimated += line.cost;
      promoSavings += line.regular - line.cost;
      const w = chain.items.w[line.idx] === 1;
      const code = chain.items.c[line.idx];
      out.push({
        id: items[i].id,
        n: chain.names[line.idx],
        c: code.startsWith("i") ? null : code,
        size: describeSize(chain.sizes[line.idx], w),
        cost: line.cost,
        regular: line.regular,
        amount: line.amount,
        weighted: w,
        promo: line.promo,
        hint: line.hint,
        approx: line.approx === true,
        packCost: line.packCost ?? null,
      });
    }
    return {
      key,
      chain: chain.key,
      chainName: chain.name,
      name: store.n,
      address: store.a,
      cityCode: store.cityCode,
      city: store.city,
      online: store.t === 2,
      total,
      estimated,
      promoSavings,
      found: out.length,
      missing,
      updatedAt: store.ts,
      lines: out,
    };
  });

  const coverageFloor = Math.ceil(matchedIdx.length * 0.6);
  const order = storeResults
    .map((r, s) => ({ r, s }))
    .sort((a, b) => {
      const aLow = a.r.found < coverageFloor ? 1 : 0;
      const bLow = b.r.found < coverageFloor ? 1 : 0;
      return aLow - bLow || a.r.estimated - b.r.estimated || b.r.found - a.r.found;
    });

  const itemResults: ItemResult[] = items.map((it, i) => {
    const res = resolutions[i];
    let cheapest: ItemResult["cheapest"] = null;
    lines.forEach((row, s) => {
      const l = row[i];
      if (l && (!cheapest || l.cost < cheapest.cost)) cheapest = { store: picked[s].key, cost: l.cost };
    });
    const a = res.anchor;
    return {
      id: it.id,
      matched: estimates[i] != null,
      mode: res.mode,
      product: a
        ? { name: a.name, code: a.code.startsWith("i") ? null : a.code, size: describeSize(a.size, a.weighted), weighted: a.weighted }
        : null,
      cheapest,
    };
  });

  return {
    generatedAt: Math.min(...used.map((c) => c.generatedAt), Date.now()),
    matchedItems: matchedIdx.length,
    items: itemResults,
    stores: order.map((o) => o.r),
    split: bestSplit(order.map((o) => o.s).slice(0, 8), picked, lines, estimates, matchedIdx, items, storeResults),
  };
}

function bestSplit(
  ranked: number[],
  picked: { key: string }[],
  lines: (LinePrice | null)[][],
  estimates: (number | null)[],
  matchedIdx: number[],
  items: ListItemInput[],
  storeResults: StoreResult[]
): CompareResult["split"] {
  if (ranked.length < 2 || matchedIdx.length < 2) return null;
  const physical = ranked.filter((s) => !storeResults[s].online);
  if (physical.length < 2) return null;
  const single = storeResults[physical[0]].estimated;
  let best: CompareResult["split"] = null;
  for (let x = 0; x < physical.length; x++) {
    for (let y = x + 1; y < physical.length; y++) {
      const a = physical[x];
      const b = physical[y];
      let total = 0;
      let countA = 0;
      let countB = 0;
      const assign: Record<string, string> = {};
      for (const i of matchedIdx) {
        const ca = lines[a][i]?.cost;
        const cb = lines[b][i]?.cost;
        if (ca == null && cb == null) {
          total += estimates[i]!;
          continue;
        }
        if (cb == null || (ca != null && ca <= cb)) {
          total += ca!;
          assign[items[i].id] = picked[a].key;
          countA++;
        } else {
          total += cb;
          assign[items[i].id] = picked[b].key;
          countB++;
        }
      }
      // A second stop is only worth it when each store carries a real share of the basket.
      if (countA < 2 || countB < 2) continue;
      const saving = single - total;
      if (!best || saving > best.saving) best = { stores: [picked[a].key, picked[b].key], total, saving, assign };
    }
  }
  if (!best || best.saving < Math.max(1000, single * 0.03)) return null;
  return best;
}

export interface ProductHit {
  code: string;
  name: string;
  maker: string;
  size: string;
  weighted: boolean;
  chains: number;
  minPrice: number | null;
  maxPrice: number | null;
}

/** Product picker: barcoded products matching free text, with a price range across the given stores. */
export function searchProducts(chains: Map<string, LoadedChain>, query: string, storeRefs: string[], limit = 25): ProductHit[] {
  const q = tokenize(query);
  if (q.words.length === 0) return [];
  const qSize = sizeFromText(query);
  const stores = storeRefs
    .map(parseStoreRef)
    .filter((p): p is { chain: string; store: string } => !!p)
    .map((p) => ({ chain: chains.get(p.chain), store: chains.get(p.chain)?.stores.get(p.store) }))
    .filter((x): x is { chain: LoadedChain; store: CompiledStore } => !!x.chain && !!x.store);
  const hits = new Map<string, ProductHit & { score: number }>();
  for (const chain of chains.values()) {
    const lists = [...new Set(q.words)].map((w) => chain.index.get(w) ?? []);
    if (lists.some((l) => l.length === 0)) continue;
    lists.sort((a, b) => a.length - b.length);
    let ids = lists[0];
    for (const other of lists.slice(1)) {
      const set = new Set(other);
      ids = ids.filter((i) => set.has(i));
    }
    for (const idx of ids.slice(0, 5000)) {
      const code = chain.items.c[idx];
      if (code.startsWith("i")) continue;
      if (qSize && !sameSize(qSize, chain.sizes[idx], 0.2)) continue;
      const t = chain.tokens[idx];
      if (q.percents.length && !q.percents.every((p) => t.percents.includes(p))) continue;
      const score = (t.words[0] === q.words[0] ? 20 : 0) - t.words.length + 10 * chain.storeShare[idx];
      const cur = hits.get(code);
      if (cur) {
        cur.chains++;
        cur.score = Math.max(cur.score, score) + 3;
      } else {
        hits.set(code, {
          code,
          name: chain.names[idx],
          maker: chain.items.m[idx] ?? "",
          size: describeSize(chain.sizes[idx], chain.items.w[idx] === 1),
          weighted: chain.items.w[idx] === 1,
          chains: 1,
          minPrice: null,
          maxPrice: null,
          score,
        });
      }
    }
  }
  const top = [...hits.values()].sort((a, b) => b.score - a.score).slice(0, limit);
  for (const h of top) {
    for (const { chain, store } of stores) {
      const idx = chain.codeToIdx.get(h.code);
      if (idx === undefined) continue;
      const p = priceAt(chain, store.pg, idx);
      if (p == null) continue;
      h.minPrice = h.minPrice == null ? p : Math.min(h.minPrice, p);
      h.maxPrice = h.maxPrice == null ? p : Math.max(h.maxPrice, p);
    }
  }
  return top.map((h) => ({
    code: h.code,
    name: h.name,
    maker: h.maker,
    size: h.size,
    weighted: h.weighted,
    chains: h.chains,
    minPrice: h.minPrice,
    maxPrice: h.maxPrice,
  }));
}
