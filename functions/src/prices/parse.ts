import { allValues, blocks, decodeText, decompress, fields, headerField, num } from "./xml";

export interface RawStore {
  storeId: string;
  subChainId: string;
  subChainName: string;
  name: string;
  address: string;
  city: string;
  cityCode: number | null;
  zip: string;
  /** 1 = physical, 2 = online, 3 = both (per the regulation). */
  type: number;
}

export interface RawItem {
  code: string;
  /** False for chain-internal codes (produce, bakery) that cannot be compared across chains. */
  global: boolean;
  name: string;
  manufacturer: string;
  quantity: number | null;
  unit: string;
  weighted: boolean;
  /** Shekels; for weighted items this is the price per kg. */
  price: number;
}

export interface RawPromo {
  id: string;
  description: string;
  endsAt: number;
  /** 0 = everyone, 1 = chain club, 2 = credit card, 3 = other. */
  clubId: number;
  minQty: number;
  /** Total price for `minQty` units (or per kg for weighted items). */
  bundlePrice: number;
  itemCodes: string[];
}

export function bufferToXml(buf: Buffer): string {
  return decodeText(decompress(buf));
}

/** Barcodes come zero-padded to different widths per chain; compare them without padding. */
export function normalizeCode(raw: string): string {
  const digits = raw.replace(/\D/g, "");
  const trimmed = digits.replace(/^0+/, "");
  return trimmed || digits;
}

export function parseStores(xml: string): { chainId: string; chainName: string; stores: RawStore[] } {
  const chainId = headerField(xml, "ChainID") || headerField(xml, "ChainId");
  const chainName = headerField(xml, "ChainName");
  const stores: RawStore[] = [];
  const seen = new Set<string>();

  const push = (f: Record<string, string>, subChainId: string, subChainName: string) => {
    const storeId = normalizeCode(f.storeid ?? "");
    if (!storeId || seen.has(storeId)) return;
    seen.add(storeId);
    const cityRaw = (f.city ?? "").trim();
    const cityCode = /^\d+$/.test(cityRaw) ? Number(cityRaw) : null;
    stores.push({
      storeId,
      subChainId: normalizeCode(f.subchainid ?? subChainId) || "0",
      subChainName: f.subchainname ?? subChainName,
      name: (f.storename ?? "").replace(/\s+/g, " ").trim(),
      address: (f.address ?? "").replace(/\s+/g, " ").trim(),
      city: cityCode == null ? cityRaw : "",
      cityCode,
      zip: f.zipcode ?? "",
      type: num(f.storetype) ?? 1,
    });
  };

  let anySub = false;
  for (const sub of blocks(xml, "SubChain")) {
    anySub = true;
    const subChainId = /<SubChainID\s*>([^<]*)</i.exec(sub)?.[1] ?? "0";
    const subChainName = /<SubChainName\s*>([^<]*)</i.exec(sub)?.[1] ?? "";
    for (const st of blocks(sub, "Store")) push(fields(st), subChainId, subChainName.trim());
  }
  if (!anySub) {
    for (const st of blocks(xml, "Store")) push(fields(st), "0", "");
  }
  return { chainId, chainName, stores };
}

const MAX_SANE_PRICE = 5000;

export function parsePriceFile(xml: string): RawItem[] {
  const items: RawItem[] = [];
  const seen = new Set<string>();
  for (const tag of ["Item", "Product"]) {
    for (const b of blocks(xml, tag)) {
      const f = fields(b);
      const rawCode = f.itemcode ?? "";
      const code = normalizeCode(rawCode);
      const price = num(f.itemprice);
      if (!code || price == null || price <= 0 || price > MAX_SANE_PRICE) continue;
      const itemType = num(f.itemtype);
      // Real barcodes are 7+ digits; short codes are scale/plu codes even when ItemType says otherwise.
      const global = itemType !== 0 && code.length >= 7;
      const key = (global ? "" : "i") + code;
      if (seen.has(key)) continue;
      seen.add(key);
      const name = (f.itemname || f.itemnm || f.manufactureitemdescription || "").replace(/\s+/g, " ").trim();
      if (!name) continue;
      const weightedFlag = (f.bisweighted ?? f.bweighted ?? "").trim();
      items.push({
        code: key,
        global,
        name,
        manufacturer: (f.manufacturename || f.manufacturername || "").replace(/\s+/g, " ").trim(),
        quantity: num(f.quantity),
        unit: (f.unitqty || f.unitofmeasure || "").trim(),
        weighted: weightedFlag === "1" || weightedFlag.toLowerCase() === "true",
        price,
      });
    }
    if (items.length > 0) break;
  }
  return items;
}

function parseDate(s: string | undefined): number | null {
  if (!s) return null;
  const t = s.trim().replace(" ", "T");
  const ms = Date.parse(t.length === 10 ? `${t}T23:59:59` : t);
  return Number.isFinite(ms) ? ms : null;
}

/**
 * Keeps only promotions a shopper can count on at the shelf: single-group, item-specific,
 * no coupon, no basket minimum, currently running, with a usable bundle price.
 */
export function parsePromoFile(xml: string, now: number, priceOf: (code: string) => number | undefined): RawPromo[] {
  const out: RawPromo[] = [];
  for (const b of blocks(xml, "Promotion")) {
    const f = fields(b);
    const groups = (b.match(/<Group\s*>/gi) ?? []).length;
    if (groups > 1) continue;
    if (f.additionaliscoupon === "1") continue;
    if ((num(f.minpurchaseamount) ?? 0) > 0) continue;
    if (f.isgiftitem === "1") continue;
    const start = parseDate(f.promotionstartdate ? `${f.promotionstartdate}T${f.promotionstarthour || "00:00:00"}` : f.promotionstartdatetime);
    const end = parseDate(f.promotionenddate ? `${f.promotionenddate}T${f.promotionendhour || "23:59:59"}` : f.promotionenddatetime);
    if (start != null && start > now) continue;
    if (end == null || end < now) continue;
    const clubId = Number(/^\s*(\d+)/.exec(f.clubid ?? "0")?.[1] ?? 0);

    const codes = [...new Set(allValues(b, "ItemCode").map(normalizeCode).filter((c) => c && !/^0*$/.test(c)))];
    if (codes.length === 0 || codes.length > 400) continue;

    const minQty = Math.max(1, num(f.minqty) ?? num(f.minnoofitemoffered) ?? 1);
    const discounted = num(f.discountedprice);
    const rate = num(f.discountrate);
    const regular = priceOf(codes[0]);
    if (regular == null) continue;

    let bundle: number | null = null;
    if (discounted != null && discounted > 0) {
      bundle = resolveBundlePrice(discounted, minQty, regular, rate);
    } else if (rate != null && rate > 0 && rate < 100) {
      bundle = Math.round(regular * minQty * (1 - rate / 100) * 100) / 100;
    }
    if (bundle == null) continue;
    const ratio = bundle / (regular * minQty);
    // Drop "discounts" that cost more, and implausible ones that usually signal bad data.
    if (!(ratio < 0.995 && ratio > 0.1)) continue;

    out.push({
      id: (f.promotionid ?? "").trim(),
      description: (f.promotiondescription ?? "").replace(/\s+/g, " ").trim().slice(0, 80),
      endsAt: end,
      clubId,
      minQty,
      bundlePrice: bundle,
      itemCodes: codes,
    });
  }
  return out;
}

/**
 * `DiscountedPrice` is the bundle total for most chains ("2 for ₪25") but the per-unit
 * price for some. The published discount rate, or failing that the regular price, tells which.
 */
export function resolveBundlePrice(discounted: number, minQty: number, regular: number, rate: number | null): number | null {
  if (minQty <= 1) return discounted;
  const asTotal = discounted;
  const asUnit = discounted * minQty;
  if (rate != null && rate > 0 && rate < 100) {
    const expected = regular * minQty * (1 - rate / 100);
    return Math.abs(asTotal - expected) <= Math.abs(asUnit - expected) ? asTotal : asUnit;
  }
  if (asTotal < regular * minQty && asTotal > regular * 0.5) return asTotal;
  if (asUnit < regular * minQty) return asUnit;
  return null;
}
