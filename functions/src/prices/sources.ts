import { CookieJar, getBuffer, getText, request } from "./http";

export type FileKind = "price" | "promo" | "stores";

export interface SourceFile {
  name: string;
  kind: FileKind;
  chainId: string;
  /** Normalized (unpadded) store id; null for the chain's stores file. */
  storeId: string | null;
  /** yyyymmddhhmmss, for picking the newest file per store. */
  stamp: string;
  download: () => Promise<Buffer>;
}

export type SourceDef =
  | { kind: "shufersal" }
  | { kind: "cerberus"; user: string }
  | { kind: "carrefour" }
  | { kind: "hazihinam" };

export interface ChainDef {
  key: string;
  chainId: string;
  /** Hebrew display name; English is in the app's locale files keyed by `key`. */
  name: string;
  source: SourceDef;
}

export const CHAINS: ChainDef[] = [
  { key: "shufersal", chainId: "7290027600007", name: "שופרסל", source: { kind: "shufersal" } },
  { key: "ramilevy", chainId: "7290058140886", name: "רמי לוי", source: { kind: "cerberus", user: "RamiLevi" } },
  { key: "carrefour", chainId: "7290055700007", name: "קרפור", source: { kind: "carrefour" } },
  { key: "hazihinam", chainId: "7290700100008", name: "חצי חינם", source: { kind: "hazihinam" } },
  { key: "yohananof", chainId: "7290803800003", name: "יוחננוף", source: { kind: "cerberus", user: "yohananof" } },
  { key: "osherad", chainId: "7290103152017", name: "אושר עד", source: { kind: "cerberus", user: "osherad" } },
  { key: "tivtaam", chainId: "7290873255550", name: "טיב טעם", source: { kind: "cerberus", user: "TivTaam" } },
  { key: "keshet", chainId: "7290785400000", name: "קשת טעמים", source: { kind: "cerberus", user: "Keshet" } },
  { key: "stopmarket", chainId: "7290639000004", name: "סטופ מרקט", source: { kind: "cerberus", user: "Stop_Market" } },
  { key: "freshmarket", chainId: "7290876100000", name: "פרש מרקט", source: { kind: "cerberus", user: "freshmarket" } },
  { key: "salachdabach", chainId: "7290526500006", name: "סאלח דבאח", source: { kind: "cerberus", user: "SalachD" } },
  { key: "politzer", chainId: "7291059100008", name: "פוליצר", source: { kind: "cerberus", user: "politzer" } },
];

export function parseFileName(name: string): Omit<SourceFile, "download" | "name"> | null {
  const base = name.split("/").pop()!.replace(/(\.(xml|gz|zip))+$/i, "");
  const m = /^(PriceFull|PromoFull|StoresFull|Stores)(\d{13})-(.+)$/i.exec(base);
  if (!m) return null;
  const prefix = m[1].toLowerCase();
  const chainId = m[2];
  const parts = m[3].split("-");
  const pad = (s: string) => (s + "00000000000000").slice(0, 14);
  if (prefix.startsWith("stores")) {
    return { kind: "stores", chainId, storeId: null, stamp: pad(parts.filter((p) => p.length >= 8).join("")) };
  }
  const kind: FileKind = prefix === "pricefull" ? "price" : "promo";
  let store: string;
  let stamp: string;
  if (parts.length >= 4) {
    store = parts[1];
    stamp = parts.slice(2).join("");
  } else if (parts.length === 3) {
    store = parts[1];
    stamp = parts[2];
  } else if (parts.length === 2) {
    store = parts[0];
    stamp = parts[1];
  } else {
    return null;
  }
  const storeId = store.replace(/^0+/, "") || "0";
  return { kind, chainId, storeId, stamp: pad(stamp.replace(/\D/g, "")) };
}

/** Newest full price/promo file per store plus the newest stores file. */
export function pickLatest(files: SourceFile[], chainId: string): {
  stores: SourceFile | null;
  prices: Map<string, SourceFile>;
  promos: Map<string, SourceFile>;
} {
  let stores: SourceFile | null = null;
  const prices = new Map<string, SourceFile>();
  const promos = new Map<string, SourceFile>();
  for (const f of files) {
    if (f.chainId !== chainId) continue;
    if (f.kind === "stores") {
      if (!stores || f.stamp > stores.stamp) stores = f;
      continue;
    }
    const map = f.kind === "price" ? prices : promos;
    const cur = map.get(f.storeId!);
    if (!cur || f.stamp > cur.stamp) map.set(f.storeId!, f);
  }
  return { stores, prices, promos };
}

export async function listFiles(chain: ChainDef): Promise<SourceFile[]> {
  switch (chain.source.kind) {
    case "shufersal":
      return listShufersal();
    case "cerberus":
      return listCerberus(chain.source.user);
    case "carrefour":
      return listCarrefour();
    case "hazihinam":
      return listHaziHinam();
  }
}

function make(name: string, download: () => Promise<Buffer>): SourceFile | null {
  const meta = parseFileName(name);
  return meta ? { ...meta, name, download } : null;
}

// --- Shufersal: paginated HTML listing with expiring Azure blob links ---------------------------

async function listShufersal(): Promise<SourceFile[]> {
  const base = "https://prices.shufersal.co.il/FileObject/UpdateCategory";
  const out: SourceFile[] = [];
  // catID: 2 = PriceFull, 4 = PromoFull, 5 = Stores.
  for (const catID of [5, 2, 4]) {
    for (let page = 1, maxPage = 1; page <= maxPage && page <= 60; page++) {
      const html = await getText(`${base}?catID=${catID}&storeId=0&page=${page}`);
      for (const m of html.matchAll(/href="(https:\/\/pricesprodpublic[^"]+)"/g)) {
        const url = m[1].replace(/&amp;/g, "&");
        const f = make(decodeURIComponent(url.split("?")[0].split("/").pop()!), () => getBuffer(url));
        if (f) out.push(f);
      }
      for (const p of html.matchAll(/[?&;]page=(\d+)/g)) maxPage = Math.max(maxPage, Number(p[1]));
    }
  }
  return out;
}

// --- Cerberus (url.retail.publishedprices.co.il): public per-chain logins with empty password ----

async function listCerberus(user: string): Promise<SourceFile[]> {
  const BASE = "https://url.retail.publishedprices.co.il";
  const jar = new CookieJar();
  const call = async (path: string, init: { method?: string; body?: string } = {}) => {
    const res = await request(BASE + path, {
      lenientTls: true,
      redirect: "manual",
      method: init.method ?? "GET",
      body: init.body,
      headers: {
        Cookie: jar.header(),
        ...(init.body ? { "Content-Type": "application/x-www-form-urlencoded" } : {}),
      },
    });
    jar.absorb(res);
    return res;
  };
  const csrfOf = (html: string) => /name="csrftoken" content="([^"]+)"/.exec(html)?.[1] ?? "";

  let html = await (await call("/login")).text();
  const login = await call("/login/user", {
    method: "POST",
    body: new URLSearchParams({ r: "", username: user, password: "", Submit: "Sign in", csrftoken: csrfOf(html) }).toString(),
  });
  await login.body?.cancel();
  if (!login.headers.get("location")?.includes("/file")) throw new Error(`cerberus login failed for ${user}`);

  html = await (await call("/file")).text();
  const dir = await call("/file/json/dir", {
    method: "POST",
    body: new URLSearchParams({
      sEcho: "1",
      iDisplayStart: "0",
      iDisplayLength: "100000",
      sSearch: "",
      mDataProp_0: "fname",
      iSortCol_0: "0",
      sSortDir_0: "asc",
      cd: "/",
      csrftoken: csrfOf(html),
    }).toString(),
  });
  const json = (await dir.json()) as { aaData?: { fname: string }[] };
  const out: SourceFile[] = [];
  for (const row of json.aaData ?? []) {
    const name = row.fname;
    const f = make(name, async () => {
      const res = await call(`/file/d/${encodeURIComponent(name)}`);
      if (!res.ok) throw new Error(`cerberus download ${res.status} ${name}`);
      return Buffer.from(await res.arrayBuffer());
    });
    if (f) out.push(f);
  }
  return out;
}

// --- Carrefour: file list embedded as JSON in the landing page ----------------------------------

async function listCarrefour(): Promise<SourceFile[]> {
  const html = await getText("https://prices.carrefour.co.il/");
  const path = /const path = '([^']+)'/.exec(html)?.[1];
  const filesJson = /const files = (\[[\s\S]*?\]);/.exec(html)?.[1];
  if (!path || !filesJson) throw new Error("carrefour: file list not found");
  const files = JSON.parse(filesJson) as { name: string }[];
  const out: SourceFile[] = [];
  for (const { name } of files) {
    const url = `https://prices.carrefour.co.il/${path}/${encodeURIComponent(name)}`;
    const f = make(name, () => getBuffer(url));
    if (f) out.push(f);
  }
  return out;
}

// --- Hazi Hinam: paginated listing per file type ------------------------------------------------

async function listHaziHinam(): Promise<SourceFile[]> {
  const out: SourceFile[] = [];
  const seen = new Set<string>();
  // t: 1 = prices, 2 = promos, 3 = stores.
  for (const t of [3, 1, 2]) {
    for (let p = 1; p <= 30; p++) {
      const html = await getText(`https://shop.hazi-hinam.co.il/Prices?t=${t}&p=${p}`);
      const links = [...html.matchAll(/https:\/\/hazihinamprod01[^"'<>\s]+/g)].map((m) => m[0].replace(/&amp;/g, "&"));
      let added = 0;
      for (const url of links) {
        if (seen.has(url)) continue;
        seen.add(url);
        added++;
        const f = make(decodeURIComponent(url.split("?")[0].split("/").pop()!), () => getBuffer(url));
        if (f) out.push(f);
      }
      if (added === 0) break;
    }
  }
  return out;
}
