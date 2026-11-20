import { test } from "node:test";
import assert from "node:assert/strict";
import { packPriceGroup, unpackPriceGroup } from "./codec";
import { compareBasket } from "./compare";
import type { ChainDb } from "./compile";
import { buildDataset, neededAmount } from "./engine";
import { addressKey, cityName } from "./geo";
import { normalizeCode, parsePriceFile, parsePromoFile, parseStores, resolveBundlePrice } from "./parse";
import { parseFileName } from "./sources";
import { normalize, parseSize, sameSize, stem, tokenize } from "./text";

test("file names: new and legacy layouts", () => {
  assert.deepEqual(parseFileName("PriceFull7290027600007-001-412-20261119-125648.gz"), {
    kind: "price",
    chainId: "7290027600007",
    storeId: "412",
    stamp: "20261119125648",
  });
  assert.equal(parseFileName("pricefull7290058140886-039-202611190518.gz")?.storeId, "39");
  assert.equal(parseFileName("Stores7290027600007-000-20261119-020.gz")?.kind, "stores");
  assert.equal(parseFileName("Price7290027600007-001-412-20261119-125648.gz"), null);
});

test("varint price groups round-trip", () => {
  const idx = [0, 3, 4, 900, 70000];
  const price = [590, 1, 129900, 0, 4500];
  const back = unpackPriceGroup(packPriceGroup(idx, price));
  assert.deepEqual([...back.idx], idx);
  assert.deepEqual([...back.price], price);
});

test("hebrew normalization and stemming", () => {
  assert.equal(normalize("קוטג' 5% 250גר"), "קוטג 5% 250 גר");
  assert.equal(stem(normalize("עגבניות")), stem(normalize("עגבניה")));
  assert.equal(stem(normalize("ביצים")), stem(normalize("ביצה")));
  assert.notEqual(stem(normalize("שמנת")), stem(normalize("שמן")));
  assert.deepEqual(tokenize("תפוחי אדמה").words, tokenize("תפוח אדמה").words);
  assert.deepEqual(tokenize("מים מינרליים").words, tokenize("מים מינרלים").words);
});

test("sizes from fields and names", () => {
  assert.deepEqual(parseSize(1, "ליטר", "חלב"), { dim: "volume", amount: 1000 });
  assert.deepEqual(parseSize(null, "", "קמח לבן 1 ק\"ג"), { dim: "mass", amount: 1000 });
  assert.deepEqual(parseSize(2, "לא ידוע", "חלב 3% 2ל"), { dim: "volume", amount: 2000 });
  assert.equal(parseSize(1, "יחידות", "חסה"), null);
  assert.ok(sameSize({ dim: "mass", amount: 200 }, { dim: "volume", amount: 200 }));
  assert.ok(!sameSize({ dim: "mass", amount: 200 }, { dim: "mass", amount: 500 }));
});

test("barcode normalization", () => {
  assert.equal(normalizeCode("0007290000000466"), "7290000000466");
  assert.equal(normalizeCode("000"), "000");
});

test("bundle price semantics", () => {
  // "2 for 25" with a 15.90 shelf price and a published 21.38% rate is a bundle total.
  assert.equal(resolveBundlePrice(25, 2, 15.9, 21.38), 25);
  // Per-unit DiscountedPrice is scaled to the bundle.
  assert.equal(resolveBundlePrice(4, 3, 5, 20), 12);
  assert.equal(resolveBundlePrice(9.9, 1, 12.9, null), 9.9);
});

test("parsers: stores, prices, promos", () => {
  const stores = parseStores(
    "<Root><ChainID>1</ChainID><SubChains><SubChain><SubChainID>001</SubChainID><Stores><Store><StoreID>007</StoreID><StoreName>סניף</StoreName><Address>הרצל 1</Address><City>3000</City><StoreType>1</StoreType></Store></Stores></SubChain></SubChains></Root>"
  );
  assert.equal(stores.stores[0].storeId, "7");
  assert.equal(stores.stores[0].cityCode, 3000);

  const items = parsePriceFile(
    "<Root><Items><Item><ItemCode>7290000000001</ItemCode><ItemType>1</ItemType><ItemName>חלב 3% 1 ליטר</ItemName><ItemPrice>6.50</ItemPrice><Quantity>1</Quantity><UnitQty>ליטר</UnitQty><bIsWeighted>0</bIsWeighted></Item><Item><ItemCode>12</ItemCode><ItemType>0</ItemType><ItemName>עגבניה</ItemName><ItemPrice>5.90</ItemPrice><bIsWeighted>1</bIsWeighted></Item></Items></Root>"
  );
  assert.equal(items.length, 2);
  assert.equal(items[1].code, "i12");
  assert.equal(items[1].global, false);

  const now = Date.parse("2026-11-19T12:00:00Z");
  const promos = parsePromoFile(
    "<Root><Promotions><Promotion><PromotionID>9</PromotionID><PromotionDescription>2 ב-10</PromotionDescription><PromotionStartDateTime>2026-11-01T00:00:00</PromotionStartDateTime><PromotionEndDateTime>2026-12-01T00:00:00</PromotionEndDateTime><ClubID>0 - כלל הלקוחות</ClubID><AdditionalIsCoupon>0</AdditionalIsCoupon><Groups><Group><MinPurchaseAmount></MinPurchaseAmount><PromotionItems><PromotionItem><ItemCode>7290000000001</ItemCode><MinQty>2</MinQty><DiscountedPrice>10</DiscountedPrice></PromotionItem></PromotionItems></Group></Groups></Promotion></Promotions></Root>",
    now,
    () => 6.5
  );
  assert.equal(promos.length, 1);
  assert.equal(promos[0].bundlePrice, 10);
  assert.equal(promos[0].clubId, 0);
});

function chainDb(key: string, rows: [string, string, number, number | null, string, number][], promos: ChainDb["promos"] = []): ChainDb {
  const items: ChainDb["items"] = { c: [], n: [], m: [], q: [], u: [], w: [] };
  const idx: number[] = [];
  const price: number[] = [];
  rows.forEach(([c, n, agorot, q, u, w], i) => {
    items.c.push(c);
    items.n.push(n);
    items.m.push("");
    items.q.push(q);
    items.u.push(u);
    items.w.push(w);
    idx.push(i);
    price.push(agorot);
  });
  return {
    v: 1,
    key,
    chainId: key,
    name: key,
    generatedAt: Date.now(),
    stores: [{ id: "1", sub: "1", subName: "", n: `${key} store`, a: "", city: "", cityCode: 3000, t: 1, pg: 0, mg: 0, ts: "20261119000000" }],
    items,
    priceGroups: [packPriceGroup(idx, price)],
    promos,
    promoGroups: [promos.map((_, i) => i)],
  };
}

test("basket comparison picks equivalents and applies promotions", () => {
  const a = chainDb(
    "aa",
    [
      ["7290000000001", "חלב 3% 1 ליטר תנובה", 700, 1, "ליטר", 0],
      ["7290000000099", "חלב סויה 1 ליטר", 500, 1, "ליטר", 0],
      ["i5", "עגבניה", 590, null, "", 1],
    ],
    [{ d: "2 ב-12", e: Date.now() + 86_400_000, club: 0, min: 2, b: 1200, i: [0] }]
  );
  const b = chainDb("bb", [
    ["7290000000002", "חלב 3% 1 ליטר טרה", 650, 1, "ליטר", 0],
    ["i77", "עגבניות", 490, null, "", 1],
  ]);
  const chains = buildDataset([a, b]);
  const res = compareBasket(chains, {
    items: [
      { id: "milk", name: "חלב", quantity: 2, unit: null },
      { id: "tom", name: "עגבניות", quantity: 1, unit: "KG" },
    ],
    stores: ["aa:1", "bb:1"],
    clubs: [],
    now: Date.now(),
  });
  const storeA = res.stores.find((s) => s.chain === "aa")!;
  const storeB = res.stores.find((s) => s.chain === "bb")!;
  // Soy milk is cheaper but a different product; the 2-for-12 promotion applies.
  assert.equal(storeA.lines.find((l) => l.id === "milk")!.cost, 1200);
  assert.equal(storeB.lines.find((l) => l.id === "milk")!.cost, 1300);
  assert.equal(storeA.found, 2);
  assert.equal(storeB.found, 2);
  assert.equal(res.stores[0].chain, "aa");
});

test("needed amounts", () => {
  const item = (quantity: number, unit: string | null) => ({ id: "x", name: "x", quantity, unit });
  assert.equal(neededAmount(item(2, null), false, null), 2);
  assert.equal(neededAmount(item(500, "GRAMS"), true, null), 0.5);
  assert.equal(neededAmount(item(2, "KG"), false, { dim: "mass", amount: 1000 }), 2);
  assert.equal(neededAmount(item(6, null), true, null), 1.2);
});

test("store city falls back to a city named at the start of the branch name", () => {
  const cities = { "70": "אשדוד", "1200": "מודיעין-מכבים-רעות", "1094": "כרמים", "2400": "אור יהודה" };
  const store = (name: string, extra: Partial<{ city: string; cityCode: number | null; address: string }> = {}) => ({
    address: "רחוב הפלדה 1",
    city: "",
    cityCode: 0,
    type: 1,
    name,
    ...extra,
  });
  assert.equal(cityName(store("אשדוד"), cities), "אשדוד");
  assert.equal(cityName(store("יוחננוף אור יהודה"), cities), "אור יהודה");
  assert.equal(cityName(store("מודיעין כרמים"), cities), "מודיעין");
  assert.equal(cityName(store("חוצות המפרץ"), cities), "");
  assert.equal(cityName(store("אשדודית"), cities), "");
  assert.equal(cityName(store("x", { cityCode: 70 }), cities), "אשדוד");
  assert.equal(cityName(store("אשדוד", { city: "חיפה" }), cities), "חיפה");
  assert.equal(addressKey(store("חדרה", { address: "unknown" }), cities), null);
});
