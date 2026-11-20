import { unpackPriceGroup } from "./codec";
import type { ChainDb, CompiledPromo, CompiledStore } from "./compile";
import { expandGeneric } from "./defaults";
import { normalize, parseSize, sameSize, sizeFromText, stem, tokenize, type Size, type Tokens } from "./text";

const MULTIPACK = /מארז|\d\s*\*\s*\d|\d\s*[x×]\s*\d|\d+\s*\*|\*\s*\d+/i;

/** Descriptive words that do not change what the product is. */
const NOISE = new Set(
  [
    "טרי", "טריה", "טריים", "בקרטון", "קרטון", "בבקבוק", "בקבוק", "ארוז", "ארוזה", "מארז", "אריזה", "חיסכון", "חסכון", "משפחתי", "משפחתית",
    "ישראלי", "ישראלית", "מובחר", "מובחרת", "איכותי", "סוג", "א", "מהדרין", "כשר", "כשרות", "בדצ", "חדש", "חדשה", "מבצע", "יחידה", "פרימיום",
    "גדול", "גדולה", "גדולים", "בתפזורת", "תפזורת", "במשקל", "משקל", "ליחידה", "רגיל", "רגילה", "קלאסי", "קלאסית", "מקורי", "מקורית",
    "פרוס", "פרוסה", "פרוסות", "בפרוסות", "צמחי", "ואקום", "בואקום", "שקוף", "בדצ", "גלאט", "בודד", "בודדת", "טבעי", "טבעיים",
  ].map((w) => stem(normalize(w)))
);

/** Words that make a different product when one side has them and the other does not. */
const TYPE_CHANGERS = new Set(
  [
    "סויה", "שקדים", "שקד", "אורז", "שיבולת", "קוקוס", "ללא", "לקטוז", "גלוטן", "סוכר", "שוקו", "שוקולד", "וניל", "תות", "בננה", "קפה", "מוקה",
    "אבקה", "מרוכז", "עיזים", "עזים", "כבשים", "דל", "דיאט", "לייט", "light", "זירו", "zero", "אורגני", "אורגנית", "מלא", "מלאה", "שיפון",
    "כוסמין", "מחמצת", "מתוק", "מתוקה", "חריף", "חריפה", "מעושן", "מעושנת", "קפוא", "קפואה", "קפואים", "טחון", "טחונה", "מגורר", "מגוררת",
    "מבושל", "מוכן", "שימורים", "בשימורים", "כבוש", "כבושים", "חמוץ", "חמוצים", "מיובש", "מיובשים", "דמררה",
    "שרי", "בייבי", "מיני", "ממולא", "ממולאים", "מטוגן", "צלוי", "אפוי", "ילדים", "תינוקות", "פרו", "חלבון", "ביו", "פרוביוטי", "קל", "קלה",
    "שמנת", "חמאה", "גבינה", "יוגורט", "משקה", "מעדן", "ממרח", "רוטב", "תרכיז", "מיץ", "נקטר", "סירופ", "ריבה", "חטיף", "עוגיות", "עוגה",
    "טעם", "בטעם", "מתובל", "מתובלת", "פחות", "מופחת", "מופחתת", "מועשר", "מועשרת",
    "אדום", "אדומה", "ירוק", "ירוקה", "צהוב", "צהובה", "כתום", "סגול", "שחור", "שחורה", "חום", "מבעבע", "מבעבעים", "מוגז",
    "מגורד", "מגורדת", "יווני", "יוונית", "למיקרוגל", "מיקרוגל", "קצוץ", "קצוצה", "מוקפא", "מוקפאת", "פירה", "צ'יפס", "ציפס",
    "סודה", "תוסס", "פיקנטי", "שום", "בצל", "עגבניות", "פטריות", "זיתים", "תירס", "טונה", "עוף", "הודו", "בקר", "כבש", "דג", "סלמון",
  ].map((w) => stem(normalize(w)))
);

/** Private-label and big-brand words that appear inside product names. */
const BRAND_WORDS = new Set(
  [
    "תנובה", "טרה", "יטבתה", "שטראוס", "עלית", "אסם", "תלמה", "שופרסל", "רמי", "לוי", "קרפור", "יוחננוף", "ויקטורי", "מחלבות", "הרדוף",
    "זוגלובק", "סנו", "נסטלה", "אנגל", "ברמן", "וילי", "סוגת", "תפוגן", "ויסוצקי", "פרילי", "שופרסלשלי", "גדמחלבות", "יוניליוור", "דנונה",
  ].map((w) => stem(normalize(w)))
);

export interface LoadedChain {
  key: string;
  name: string;
  chainId: string;
  generatedAt: number;
  stores: Map<string, CompiledStore>;
  items: ChainDb["items"];
  /** Display names: the most complete name any chain publishes for the barcode. */
  names: string[];
  codeToIdx: Map<string, number>;
  index: Map<string, number[]>;
  tokens: Tokens[];
  makerWords: Set<string>[];
  sizes: (Size | null)[];
  /** 1 when the product is a multipack (מארז, 6*1.5…). */
  multi: Uint8Array;
  groups: { idx: Int32Array; price: Int32Array }[];
  storeShare: Float32Array;
  promos: CompiledPromo[];
  promoGroups: number[][];
  promoByGroup: Map<number, Map<number, number[]>>;
}

export interface BarcodeInfo {
  name: Map<string, string>;
  size: Map<string, Size>;
}

/**
 * Several chains truncate names to ~20 characters or omit units; the same barcode elsewhere
 * usually has both. Collect the best name and size per barcode across all chains.
 */
export function collectBarcodeInfo(dbs: ChainDb[]): BarcodeInfo {
  const name = new Map<string, string>();
  const size = new Map<string, Size>();
  for (const db of dbs) {
    for (let i = 0; i < db.items.c.length; i++) {
      const code = db.items.c[i];
      if (code.startsWith("i")) continue;
      const n = db.items.n[i];
      const cur = name.get(code);
      if (!cur || n.length > cur.length) name.set(code, n);
      if (!db.items.w[i] && !size.has(code)) {
        const s = parseSize(db.items.q[i], db.items.u[i], n);
        if (s) size.set(code, s);
      }
    }
  }
  return { name, size };
}

export function buildDataset(dbs: ChainDb[]): Map<string, LoadedChain> {
  const info = collectBarcodeInfo(dbs);
  return new Map(dbs.map((db) => [db.key, loadChain(db, info)]));
}

export function loadChain(db: ChainDb, info?: BarcodeInfo): LoadedChain {
  const n = db.items.c.length;
  const tokens: Tokens[] = new Array(n);
  const makerWords: Set<string>[] = new Array(n);
  const sizes: (Size | null)[] = new Array(n);
  const names: string[] = new Array(n);
  const multi = new Uint8Array(n);
  const index = new Map<string, number[]>();
  const codeToIdx = new Map<string, number>();
  for (let i = 0; i < n; i++) {
    const code = db.items.c[i];
    const own = db.items.n[i];
    const better = info?.name.get(code);
    names[i] = better && better.length > own.length ? better : own;
    multi[i] = MULTIPACK.test(names[i]) ? 1 : 0;
    const t = tokenize(names[i]);
    tokens[i] = t;
    const maker = new Set(tokenize(db.items.m[i] ?? "").words);
    makerWords[i] = maker;
    sizes[i] = db.items.w[i] ? null : (parseSize(db.items.q[i], db.items.u[i], own) ?? info?.size.get(code) ?? sizeFromText(names[i]));
    codeToIdx.set(code, i);
    const seen = new Set<string>();
    for (const w of [...t.words, ...maker]) {
      if (seen.has(w)) continue;
      seen.add(w);
      let list = index.get(w);
      if (!list) index.set(w, (list = []));
      list.push(i);
    }
  }
  const groups = db.priceGroups.map(unpackPriceGroup);
  const counts = new Uint32Array(n);
  for (const g of groups) for (let k = 0; k < g.idx.length; k++) counts[g.idx[k]]++;
  const storeShare = new Float32Array(n);
  const denom = Math.max(1, groups.length);
  for (let i = 0; i < n; i++) storeShare[i] = counts[i] / denom;

  return {
    key: db.key,
    name: db.name,
    chainId: db.chainId,
    generatedAt: db.generatedAt,
    stores: new Map(db.stores.map((s) => [s.id, s])),
    items: db.items,
    names,
    codeToIdx,
    index,
    tokens,
    makerWords,
    sizes,
    multi,
    groups,
    storeShare,
    promos: db.promos,
    promoGroups: db.promoGroups,
    promoByGroup: new Map(),
  };
}

export function priceAt(chain: LoadedChain, groupIdx: number, item: number): number | null {
  const g = chain.groups[groupIdx];
  if (!g) return null;
  let lo = 0;
  let hi = g.idx.length - 1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    const v = g.idx[mid];
    if (v === item) return g.price[mid];
    if (v < item) lo = mid + 1;
    else hi = mid - 1;
  }
  return null;
}

function promosFor(chain: LoadedChain, promoGroup: number, item: number): CompiledPromo[] {
  let map = chain.promoByGroup.get(promoGroup);
  if (!map) {
    map = new Map();
    for (const pi of chain.promoGroups[promoGroup] ?? []) {
      for (const it of chain.promos[pi].i) {
        let list = map.get(it);
        if (!list) map.set(it, (list = []));
        list.push(pi);
      }
    }
    chain.promoByGroup.set(promoGroup, map);
  }
  return (map.get(item) ?? []).map((pi) => chain.promos[pi]);
}

// --- Matching -----------------------------------------------------------------------------------

export interface ListItemInput {
  id: string;
  name: string;
  quantity: number;
  /** App unit enum: PIECES, KG, GRAMS, LITERS, PACKS, BOTTLES, BAGS, or null. */
  unit: string | null;
  /** Locked barcode: compare this exact product. */
  code?: string | null;
}

interface Candidate {
  chain: LoadedChain;
  idx: number;
  score: number;
}

export interface Resolution {
  mode: "exact" | "similar" | "none";
  anchor: { chainKey: string; idx: number; code: string; name: string; weighted: boolean; size: Size | null } | null;
  /** Per chain: equivalent item indices, best match first. */
  equivalents: Map<string, number[]>;
  /** Same product in a different pack size; priced per unit when a store has no exact equivalent. */
  loose: Map<string, number[]>;
}

const MAX_CANDIDATES_PER_CHAIN = 400;

function descriptors(chain: LoadedChain, idx: number): string[] {
  const maker = chain.makerWords[idx];
  return chain.tokens[idx].words.filter((w) => !NOISE.has(w) && !BRAND_WORDS.has(w) && !maker.has(w));
}

function scoreCandidate(chain: LoadedChain, idx: number, q: Tokens, qSize: Size | null): number | null {
  const t = chain.tokens[idx];
  if (q.percents.length && !q.percents.every((p) => t.percents.includes(p))) return null;
  const weighted = chain.items.w[idx] === 1;
  if (qSize && !weighted && !sameSize(qSize, chain.sizes[idx], 0.2)) return null;
  const qWords = new Set(q.words);
  let score = 0;
  const head = t.words[0];
  if (head === q.words[0]) score += 30;
  else if (t.words[1] === q.words[0]) score += 8;
  else score -= 10;
  for (const w of descriptors(chain, idx)) {
    if (qWords.has(w)) continue;
    score -= TYPE_CHANGERS.has(w) ? 25 : 6;
  }
  score += 12 * chain.storeShare[idx];
  if (weighted && !qSize) score += 2;
  return score;
}

function chainCandidates(chain: LoadedChain, q: Tokens, qSize: Size | null, wantsMulti: boolean): Candidate[] {
  if (q.words.length === 0) return [];
  let lists: number[][] = [];
  for (const w of new Set(q.words)) {
    const list = chain.index.get(w);
    if (!list) return [];
    lists.push(list);
  }
  lists = lists.sort((a, b) => a.length - b.length);
  let ids = lists[0];
  for (const other of lists.slice(1)) {
    const set = new Set(other);
    ids = ids.filter((i) => set.has(i));
  }
  const out: Candidate[] = [];
  for (const idx of ids.slice(0, 20000)) {
    const score = scoreCandidate(chain, idx, q, qSize);
    // A bare list entry means a single pack, not the multipack.
    if (score != null) out.push({ chain, idx, score: score - (!wantsMulti && chain.multi[idx] ? 8 : 0) });
  }
  out.sort((a, b) => b.score - a.score);
  return out.slice(0, MAX_CANDIDATES_PER_CHAIN);
}

/** Same product kind as the anchor. `sizeTolerance` 0.15 = same pack; 0.5 = up to twice/half the size. */
function equivalent(anchor: Candidate, c: Candidate, q: Tokens, sizeTolerance: number, refSize: Size | null): boolean {
  const ac = anchor.chain;
  const cc = c.chain;
  if (ac.items.c[anchor.idx] === cc.items.c[c.idx] && !ac.items.c[anchor.idx].startsWith("i")) return true;
  const aw = ac.items.w[anchor.idx] === 1;
  if (aw !== (cc.items.w[c.idx] === 1)) return false;
  const at = ac.tokens[anchor.idx];
  const ct = cc.tokens[c.idx];
  if (at.words[0] !== ct.words[0]) return false;
  if (at.percents.join() !== ct.percents.join()) return false;
  const anchorSize = refSize ?? ac.sizes[anchor.idx];
  if (!aw && !sameSize(anchorSize, cc.sizes[c.idx], sizeTolerance)) return false;
  const qWords = new Set(q.words);
  const ad = new Set(descriptors(ac, anchor.idx));
  const cd = new Set(descriptors(cc, c.idx));
  const extra = [...cd].filter((w) => !ad.has(w) && !qWords.has(w));
  const lacking = [...ad].filter((w) => !cd.has(w) && !qWords.has(w));
  if (extra.some((w) => TYPE_CHANGERS.has(w)) || lacking.some((w) => TYPE_CHANGERS.has(w))) return false;
  // Without a known pack size, only a near-identical name is safe to treat as the same product.
  if (!aw && !anchorSize) return extra.length === 0 && lacking.length === 0;
  // Leftover words are mostly brand names (עין גדי, נביעות); product-type words were rejected above.
  return extra.length <= 2 && lacking.length <= 2;
}

export function resolveItem(
  item: ListItemInput,
  chains: LoadedChain[],
  stores?: { chain: LoadedChain; store: CompiledStore }[],
  debug?: (row: { name: string; s: number; total: number }) => void
): Resolution {
  const equivalents = new Map<string, number[]>();
  const code = item.code ? String(item.code).replace(/\D/g, "").replace(/^0+/, "") : "";
  if (code) {
    let anchor: Resolution["anchor"] = null;
    for (const ch of chains) {
      const idx = ch.codeToIdx.get(code);
      if (idx === undefined) continue;
      equivalents.set(ch.key, [idx]);
      anchor ??= {
        chainKey: ch.key,
        idx,
        code,
        name: ch.names[idx],
        weighted: ch.items.w[idx] === 1,
        size: ch.sizes[idx],
      };
    }
    if (anchor) return { mode: "exact", anchor, equivalents, loose: new Map() };
  }

  const expanded = expandGeneric(item.name);
  let q = tokenize(expanded);
  let qSize = sizeFromText(expanded);
  const wantsMulti = MULTIPACK.test(item.name);
  let perChain = chains.map((ch) => chainCandidates(ch, q, qSize, wantsMulti));
  if (expanded !== item.name && perChain.every((l) => l.length === 0)) {
    q = tokenize(item.name);
    qSize = sizeFromText(item.name);
    perChain = chains.map((ch) => chainCandidates(ch, q, qSize, wantsMulti));
  }
  if (q.words.length === 0) return { mode: "none", anchor: null, equivalents, loose: new Map() };

  // Barcodes stocked by several chains are the mainstream choice for a generic list entry.
  const chainsWithCode = new Map<string, number>();
  for (const list of perChain) {
    const seen = new Set<string>();
    for (const c of list) {
      const cd = c.chain.items.c[c.idx];
      if (cd.startsWith("i") || seen.has(cd)) continue;
      seen.add(cd);
      chainsWithCode.set(cd, (chainsWithCode.get(cd) ?? 0) + 1);
    }
  }
  const ranked: { c: Candidate; s: number }[] = [];
  const seenCodes = new Set<string>();
  for (const list of perChain) {
    for (const c of list.slice(0, 60)) {
      const cd = c.chain.items.c[c.idx];
      const key = cd.startsWith("i") ? `${c.chain.key}:${cd}` : cd;
      if (seenCodes.has(key)) continue;
      seenCodes.add(key);
      const spread = cd.startsWith("i") ? 0 : (chainsWithCode.get(cd) ?? 0) / Math.max(1, chains.length);
      // An anchor without a known pack size can only be matched by name, which covers few stores.
      const sizeless = c.chain.items.w[c.idx] !== 1 && !c.chain.sizes[c.idx];
      ranked.push({ c, s: c.score + 10 * spread - (sizeless ? 12 : 0) });
    }
  }
  ranked.sort((a, b) => b.s - a.s);
  if (!ranked.length || ranked[0].s < 0) return { mode: "none", anchor: null, equivalents, loose: new Map() };

  const equivalentsFor = (anchor: Candidate) => {
    const map = new Map<string, number[]>();
    perChain.forEach((list, k) => {
      const eq = list.filter((c) => c.score >= anchor.score - 30 && equivalent(anchor, c, q, 0.15, qSize)).map((c) => c.idx);
      if (eq.length) map.set(chains[k].key, eq.slice(0, 40));
    });
    return map;
  };

  // Prefer the anchor whose equivalents the chosen stores actually stock, so every store is compared on the same thing.
  let best = ranked[0].c;
  let bestEq = equivalentsFor(best);
  if (stores && stores.length > 1) {
    const coverage = (eq: Map<string, number[]>) =>
      stores.filter(({ chain, store }) => (eq.get(chain.key) ?? []).some((idx) => priceAt(chain, store.pg, idx) != null)).length /
      stores.length;
    let bestTotal = ranked[0].s + 15 * coverage(bestEq);
    debug?.({ name: best.chain.names[best.idx], s: ranked[0].s, total: bestTotal });
    for (const { c, s } of ranked.slice(1, 8)) {
      if (s < ranked[0].s - 12) break;
      const eq = equivalentsFor(c);
      const total = s + 15 * coverage(eq);
      debug?.({ name: c.chain.names[c.idx], s, total });
      if (total > bestTotal) {
        bestTotal = total;
        best = c;
        bestEq = eq;
      }
    }
  }
  for (const [k, v] of bestEq) equivalents.set(k, v);
  const loose = new Map<string, number[]>();
  const refSize = qSize ?? best.chain.sizes[best.idx];
  if (refSize && best.chain.items.w[best.idx] !== 1) {
    perChain.forEach((list, k) => {
      const key = chains[k].key;
      const strict = new Set(bestEq.get(key) ?? []);
      const lq = list
        .filter((c) => !strict.has(c.idx) && c.score >= best.score - 30 && equivalent(best, c, q, 0.5, refSize))
        .map((c) => c.idx);
      if (lq.length) loose.set(key, lq.slice(0, 40));
    });
  }
  return {
    mode: "similar",
    loose,
    anchor: {
      chainKey: best.chain.key,
      idx: best.idx,
      code: best.chain.items.c[best.idx],
      name: best.chain.names[best.idx],
      weighted: best.chain.items.w[best.idx] === 1,
      size: refSize,
    },
    equivalents,
  };
}

// --- Pricing ------------------------------------------------------------------------------------

export interface PriceOptions {
  /** Chains whose loyalty-club prices the shopper gets. */
  clubChains: Set<string>;
  now: number;
}

export interface LinePrice {
  idx: number;
  /** Agorot actually paid for the needed quantity. */
  cost: number;
  /** Agorot at shelf price, without promotions. */
  regular: number;
  /** Packages, or kg for weighted produce. */
  amount: number;
  promo: { d: string; club: boolean } | null;
  /** A promotion the shopper would get by buying more. */
  hint: { d: string; min: number; b: number } | null;
  /** Set when a different pack size was priced per unit; `cost` is then scaled to the anchor size. */
  approx?: boolean;
  /** Agorot actually paid for that different pack. */
  packCost?: number;
}

/** Packages to buy, or kilograms for weighted produce. */
export function neededAmount(item: ListItemInput, weighted: boolean, size: Size | null): number {
  const unit = item.unit ?? null;
  const cap = unit === "GRAMS" ? 50_000 : 100;
  const qty = Number.isFinite(item.quantity) && item.quantity > 0 ? Math.min(item.quantity, cap) : 1;
  if (weighted) {
    if (unit === "KG") return qty;
    if (unit === "GRAMS") return Math.max(0.1, qty / 1000);
    return qty <= 3 ? qty : Math.round(qty * 0.2 * 10) / 10;
  }
  if (size && (unit === "KG" || unit === "GRAMS" || unit === "LITERS")) {
    const amount = unit === "GRAMS" ? qty : qty * 1000;
    const dim = unit === "LITERS" ? "volume" : "mass";
    if (size.dim === dim && size.amount > 0) return Math.max(1, Math.round(amount / size.amount));
  }
  return Math.max(1, Math.round(qty));
}

export function priceLine(
  chain: LoadedChain,
  store: CompiledStore,
  idx: number,
  item: ListItemInput,
  opts: PriceOptions
): LinePrice | null {
  const unit = priceAt(chain, store.pg, idx);
  if (unit == null) return null;
  const weighted = chain.items.w[idx] === 1;
  const amount = neededAmount(item, weighted, chain.sizes[idx]);
  const regular = Math.round(unit * amount);
  let cost = regular;
  let promo: LinePrice["promo"] = null;
  let hint: LinePrice["hint"] = null;
  for (const p of promosFor(chain, store.mg, idx)) {
    if (p.e < opts.now) continue;
    const club = p.club === 1;
    if (p.club !== 0 && !(club && opts.clubChains.has(chain.key))) continue;
    let c: number;
    if (weighted) {
      if (p.min > 1) continue;
      c = Math.round(p.b * amount);
    } else if (amount >= p.min) {
      c = Math.floor(amount / p.min) * p.b + (amount % p.min) * unit;
    } else {
      if (!hint || p.b / p.min < hint.b / hint.min) hint = { d: p.d, min: p.min, b: p.b };
      continue;
    }
    if (c < cost) {
      cost = c;
      promo = { d: p.d, club };
    }
  }
  return { idx, cost, regular, amount, promo, hint };
}

/** Cheapest equivalent in a store, judged per anchor-sized unit so a smaller pack cannot win unfairly. */
export function bestInStore(
  chain: LoadedChain,
  store: CompiledStore,
  res: Resolution,
  item: ListItemInput,
  opts: PriceOptions
): LinePrice | null {
  if (!res.anchor) return null;
  const anchorAmount = res.anchor.size?.amount ?? null;
  const pick = (list: number[] | undefined) => {
    let best: LinePrice | null = null;
    let bestNorm = Infinity;
    for (const idx of list ?? []) {
      const line = priceLine(chain, store, idx, item, opts);
      if (!line) continue;
      const sz = chain.sizes[idx];
      const norm = anchorAmount && sz && sz.amount > 0 ? (line.cost * anchorAmount) / sz.amount : line.cost;
      if (norm < bestNorm) {
        bestNorm = norm;
        best = line;
      }
      if (res.mode === "exact") break;
    }
    return best ? { line: best as LinePrice, norm: bestNorm } : null;
  };
  const strict = pick(res.equivalents.get(chain.key));
  if (strict) return strict.line;
  // No same-size pack here: price a different pack per unit so the store still counts, flagged as approximate.
  const loose = pick(res.loose.get(chain.key));
  if (!loose) return null;
  const scale = loose.norm / loose.line.cost;
  return {
    ...loose.line,
    cost: Math.round(loose.norm),
    regular: Math.round(loose.line.regular * scale),
    packCost: loose.line.cost,
    approx: true,
  };
}

export function describeSize(size: Size | null, weighted: boolean): string {
  if (weighted) return "ק\"ג";
  if (!size) return "";
  const fmt = (v: number) => (Number.isInteger(v) ? String(v) : v.toFixed(v < 10 ? 2 : 1).replace(/\.?0+$/, ""));
  if (size.dim === "mass") return size.amount >= 1000 ? `${fmt(size.amount / 1000)} ק"ג` : `${fmt(size.amount)} גרם`;
  if (size.dim === "volume") return size.amount >= 1000 ? `${fmt(size.amount / 1000)} ליטר` : `${fmt(size.amount)} מ"ל`;
  return `${fmt(size.amount)} יח'`;
}
