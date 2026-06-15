import { GoogleGenerativeAI, SchemaType } from "@google/generative-ai";
import { initializeApp } from "firebase-admin/app";
import { getFirestore, FieldValue, Timestamp } from "firebase-admin/firestore";
import { defineSecret } from "firebase-functions/params";
import { onCall, HttpsError } from "firebase-functions/v2/https";

initializeApp();

const geminiApiKey = defineSecret("GEMINI_API_KEY");
const GEMINI_MODEL = "gemini-2.0-flash";

const VALID_CATEGORIES = [
  "DAIRY",
  "VEGETABLES",
  "FRUITS",
  "MEAT_FISH",
  "BAKERY",
  "CLEANING",
  "PANTRY",
  "SNACKS",
  "BEVERAGES",
  "PHARMACY",
  "OTHER",
] as const;

const AI_CATEGORIES = [...VALID_CATEGORIES, "UNKNOWN"] as const;

const RATE_LIMIT_MAX = 30;
const RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000;
const CACHE_TTL_MS = 30 * 24 * 60 * 60 * 1000;
const MAX_ITEM_NAME_LENGTH = 120;

function normalizeItemName(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

function cacheDocId(normalized: string): string {
  let hash = 0;
  for (let i = 0; i < normalized.length; i++) {
    hash = (hash * 31 + normalized.charCodeAt(i)) | 0;
  }
  return `n_${(hash >>> 0).toString(16)}`;
}

async function checkRateLimit(uid: string): Promise<void> {
  const db = getFirestore();
  const ref = db.collection("aiCategoryRateLimit").doc(uid);
  const now = Date.now();

  await db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    const data = snap.data();
    const windowStart = (data?.windowStart as Timestamp | undefined)?.toMillis() ?? 0;
    let count = (data?.count as number | undefined) ?? 0;

    if (now - windowStart > RATE_LIMIT_WINDOW_MS) {
      count = 0;
      tx.set(ref, {
        count: 1,
        windowStart: Timestamp.fromMillis(now),
      });
      return;
    }

    if (count >= RATE_LIMIT_MAX) {
      throw new HttpsError(
        "resource-exhausted",
        "Category AI rate limit exceeded. Try again later."
      );
    }

    tx.set(
      ref,
      {
        count: count + 1,
        windowStart: Timestamp.fromMillis(windowStart || now),
      },
      { merge: true }
    );
  });
}

async function readCache(normalized: string): Promise<string | null> {
  const db = getFirestore();
  const doc = await db.collection("categoryAiCache").doc(cacheDocId(normalized)).get();
  if (!doc.exists) return null;

  const data = doc.data();
  const category = data?.category as string | undefined;
  const cachedAt = (data?.cachedAt as Timestamp | undefined)?.toMillis() ?? 0;
  if (!category || Date.now() - cachedAt > CACHE_TTL_MS) return null;
  if (!VALID_CATEGORIES.includes(category as (typeof VALID_CATEGORIES)[number])) return null;
  return category;
}

async function writeCache(normalized: string, category: string): Promise<void> {
  const db = getFirestore();
  await db
    .collection("categoryAiCache")
    .doc(cacheDocId(normalized))
    .set({
      normalizedName: normalized,
      category,
      cachedAt: FieldValue.serverTimestamp(),
    });
}

async function classifyWithGemini(itemName: string, apiKey: string): Promise<string | null> {
  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({
    model: GEMINI_MODEL,
    generationConfig: {
      responseMimeType: "application/json",
      responseSchema: {
        type: SchemaType.OBJECT,
        properties: {
          category: {
            type: SchemaType.STRING,
            format: "enum",
            enum: [...AI_CATEGORIES],
          },
          confidence: {
            type: SchemaType.STRING,
            format: "enum",
            enum: ["high", "low"],
          },
        },
        required: ["category", "confidence"],
      },
    },
  });

  const prompt = `You classify grocery shopping list item names for a supermarket shopping list.

Categories (use the exact token):
${VALID_CATEGORIES.join(", ")}

Rules:
- Input may be Hebrew, English, Arabic, Russian, French, or Spanish.
- The app already matched obvious items locally. You only see names that were NOT confidently matched.
- If you are not highly confident, return category UNKNOWN and confidence low. Never guess.
- Do not assign a category based on spelling similarity alone.
- Non-grocery items (clothing, electronics, etc.) → UNKNOWN.
- OTHER only when the item is clearly a generic grocery product and you are highly confident.
- Return JSON only.`;

  const result = await model.generateContent({
    contents: [{ role: "user", parts: [{ text: `${prompt}\n\nItem: "${itemName}"` }] }],
  });

  const text = result.response.text();
  if (!text) return null;

  let parsed: { category?: string; confidence?: string };
  try {
    parsed = JSON.parse(text) as { category?: string; confidence?: string };
  } catch {
    return null;
  }

  if (parsed.confidence !== "high") return null;
  if (parsed.category === "UNKNOWN") return null;
  if (!parsed.category || !VALID_CATEGORIES.includes(parsed.category as (typeof VALID_CATEGORIES)[number])) {
    return null;
  }

  return parsed.category;
}

export const classifyItemCategory = onCall(
  {
    secrets: [geminiApiKey],
    region: "europe-west1",
    maxInstances: 10,
  },
  async (request) => {
    if (!request.auth?.uid) {
      throw new HttpsError("unauthenticated", "Sign in required.");
    }

    const itemName = typeof request.data?.itemName === "string" ? request.data.itemName.trim() : "";
    if (itemName.length < 2) {
      throw new HttpsError("invalid-argument", "itemName must be at least 2 characters.");
    }
    if (itemName.length > MAX_ITEM_NAME_LENGTH) {
      throw new HttpsError("invalid-argument", "itemName is too long.");
    }

    const normalized = normalizeItemName(itemName);
    const uid = request.auth.uid;

    await checkRateLimit(uid);

    const cached = await readCache(normalized);
    if (cached) {
      return { category: cached };
    }

    const apiKey = geminiApiKey.value();
    if (!apiKey) {
      throw new HttpsError("failed-precondition", "Gemini API key is not configured.");
    }

    const category = await classifyWithGemini(itemName, apiKey);
    if (!category) {
      return { category: null };
    }

    await writeCache(normalized, category);
    return { category };
  }
);
