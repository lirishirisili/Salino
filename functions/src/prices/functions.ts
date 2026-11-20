import { logger } from "firebase-functions/v2";
import { HttpsError, onCall, onRequest } from "firebase-functions/v2/https";
import { onSchedule } from "firebase-functions/v2/scheduler";
import { compareBasket, MAX_STORES, searchProducts } from "./compare";
import { allowRequest, getDataset, getStoresIndex, runGeocode, runIngest, sanitizeItems, sanitizeRefs } from "./service";
import { CHAINS } from "./sources";

/** Tel Aviv: chain portals block most non-Israeli IPs, and it is closest to shoppers. */
const PRICES_REGION = "me-west1";
const TIME_ZONE = "Asia/Jerusalem";

const log = (m: string) => logger.info(m);

/** Owner account used to bootstrap / force-refresh price jobs from the app or CLI. */
const OPS_EMAILS = new Set(["lironsh11@gmail.com"]);

function ingestJob(name: string, keys: string[], schedule: string, memory: "2GiB" | "4GiB" | "8GiB") {
  return onSchedule(
    {
      schedule,
      timeZone: TIME_ZONE,
      region: PRICES_REGION,
      memory,
      timeoutSeconds: 1800,
      maxInstances: 1,
      retryCount: 1,
      cpu: memory === "8GiB" ? 2 : 1,
    },
    async () => {
      const stats = await runIngest(keys, log);
      const failed = stats.filter((s) => !s.ok);
      if (failed.length) logger.error(`${name}: ${failed.length} chain(s) not refreshed`, { failed });
      else logger.info(`${name}: done`, { stats });
    }
  );
}

const REGIONAL = CHAINS.map((c) => c.key).filter(
  (k) => !["shufersal", "ramilevy", "carrefour", "hazihinam"].includes(k)
);

// Full price files are published overnight; promotions change during the day, so refresh twice.
// One chain per heavy job: shared 2GiB OOMed after Shufersal / Carrefour.
export const ingestPricesShufersal = ingestJob("shufersal", ["shufersal"], "40 6,13 * * *", "8GiB");
export const ingestPricesRamilevy = ingestJob("ramilevy", ["ramilevy"], "50 6,13 * * *", "4GiB");
export const ingestPricesCarrefour = ingestJob("carrefour", ["carrefour"], "55 6,13 * * *", "4GiB");
export const ingestPricesHazihinam = ingestJob("hazihinam", ["hazihinam"], "0 7,14 * * *", "4GiB");
export const ingestPricesRegional = ingestJob("regional", REGIONAL, "5 7,14 * * *", "4GiB");

export const geocodePriceStores = onSchedule(
  {
    schedule: "30 7,14 * * *",
    timeZone: TIME_ZONE,
    region: PRICES_REGION,
    memory: "512MiB",
    timeoutSeconds: 1800,
    maxInstances: 1,
    retryCount: 0,
  },
  async () => {
    // Nominatim ~1 req/s. Stop well before the timeout so progress is saved;
    // the next run continues from the cache.
    const result = await runGeocode(1400, log, Date.now() + 22 * 60 * 1000);
    logger.info("geocodePriceStores done", result);
  }
);

/**
 * Single callable for the app so one warm instance serves stores, comparisons and search
 * from the same in-memory dataset.
 */
export const prices = onCall(
  {
    region: PRICES_REGION,
    // All 12 chain DBs stay resident for fast compare/search after the first warm.
    memory: "4GiB",
    timeoutSeconds: 60,
    maxInstances: 5,
    concurrency: 40,
    cpu: 1,
  },
  async (request) => {
    const uid = request.auth?.uid;
    if (!uid) throw new HttpsError("unauthenticated", "Sign in required.");
    const data = (request.data ?? {}) as Record<string, unknown>;
    const action = String(data.action ?? "");

    // Sent when the app shows the price card, so the shopper's first comparison hits a warm
    // instance. Awaited: Cloud Run throttles CPU once a response is sent.
    if (action === "warm") {
      if (!allowRequest(uid, 5, "warm")) return { ok: true };
      const chains = await getDataset();
      return { ok: chains.size > 0 };
    }

    if (action === "stores") {
      if (!allowRequest(uid, 10, "stores")) throw new HttpsError("resource-exhausted", "Too many requests.");
      const index = await getStoresIndex();
      if (!index) throw new HttpsError("unavailable", "Price data is not ready yet.");
      return index;
    }

    if (action === "compare") {
      if (!allowRequest(uid, 30, "compare")) throw new HttpsError("resource-exhausted", "Too many requests.");
      const items = sanitizeItems(data.items);
      const stores = sanitizeRefs(data.stores, MAX_STORES);
      const clubs = sanitizeRefs(data.clubs, 30);
      if (items.length === 0 || stores.length === 0) throw new HttpsError("invalid-argument", "items and stores are required.");
      const chains = await getDataset();
      if (chains.size === 0) throw new HttpsError("unavailable", "Price data is not ready yet.");
      return compareBasket(chains, { items, stores, clubs, now: Date.now() });
    }

    if (action === "search") {
      if (!allowRequest(uid, 60, "search")) throw new HttpsError("resource-exhausted", "Too many requests.");
      const query = typeof data.query === "string" ? data.query.trim().slice(0, 80) : "";
      if (query.length < 2) return { results: [] };
      const stores = sanitizeRefs(data.stores, MAX_STORES);
      const chains = await getDataset();
      return { results: searchProducts(chains, query, stores) };
    }

    throw new HttpsError("invalid-argument", "Unknown action.");
  }
);

async function runOps(data: Record<string, unknown>): Promise<unknown> {
  const action = String(data.action ?? "");

  if (action === "geocode") {
    const budget = typeof data.budget === "number" ? Math.min(2000, Math.max(1, data.budget)) : 1400;
    const result = await runGeocode(budget, log, Date.now() + 25 * 60 * 1000);
    return { ok: true, result };
  }

  if (action === "ingest") {
    const keysRaw = Array.isArray(data.keys) ? data.keys.filter((k): k is string => typeof k === "string") : [];
    const keys = keysRaw.length ? keysRaw : CHAINS.map((c) => c.key);
    const known = new Set(CHAINS.map((c) => c.key));
    const filtered = keys.filter((k) => known.has(k));
    if (!filtered.length) throw new HttpsError("invalid-argument", "No valid chain keys.");
    // One chain at a time so peak memory stays inside 8GiB.
    const stats = [];
    for (const key of filtered) {
      stats.push(...(await runIngest([key], log)));
    }
    return { ok: stats.every((s) => s.ok), stats };
  }

  if (action === "status") {
    const index = await getStoresIndex();
    const chains = await getDataset();
    return {
      ok: true,
      stores: index?.stores.length ?? 0,
      chains: [...chains.keys()],
      generatedAt: index?.generatedAt ?? null,
    };
  }

  throw new HttpsError("invalid-argument", "Unknown action.");
}

/**
 * Owner-only bootstrap: force an ingest / geocode without waiting for the nightly schedule.
 * Used once after deploy and whenever a chain portal recovers from an outage.
 */
export const pricesOps = onCall(
  {
    region: PRICES_REGION,
    memory: "8GiB",
    timeoutSeconds: 1800,
    maxInstances: 1,
    cpu: 2,
  },
  async (request) => {
    const email = (request.auth?.token?.email as string | undefined)?.toLowerCase();
    if (!email || !OPS_EMAILS.has(email)) {
      throw new HttpsError("permission-denied", "Owner only.");
    }
    return runOps((request.data ?? {}) as Record<string, unknown>);
  }
);

/**
 * Same ops as `pricesOps`, for Cloud Run IAM / Cloud Scheduler callers.
 * Not public: only principals with `roles/run.invoker` can call it.
 */
export const pricesOpsHttp = onRequest(
  {
    region: PRICES_REGION,
    memory: "8GiB",
    timeoutSeconds: 1800,
    maxInstances: 1,
    cpu: 2,
    invoker: "private",
  },
  async (req, res) => {
    try {
      if (req.method !== "POST") {
        res.status(405).json({ error: "POST only" });
        return;
      }
      const body = (typeof req.body === "object" && req.body) || {};
      const out = await runOps(body as Record<string, unknown>);
      res.status(200).json(out);
    } catch (err) {
      const code = (err as { code?: string })?.code;
      const status = code === "invalid-argument" ? 400 : code === "permission-denied" ? 403 : 500;
      logger.error("pricesOpsHttp failed", err);
      res.status(status).json({ error: (err as Error).message ?? String(err) });
    }
  }
);
