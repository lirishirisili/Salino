import { GoogleGenerativeAI, SchemaType } from "@google/generative-ai";
import { initializeApp } from "firebase-admin/app";
import { getFirestore, FieldValue, Timestamp } from "firebase-admin/firestore";
import { getMessaging, Message } from "firebase-admin/messaging";
import { defineSecret } from "firebase-functions/params";
import { onCall, HttpsError } from "firebase-functions/v2/https";
import {
  onDocumentCreated,
  onDocumentUpdated,
} from "firebase-functions/v2/firestore";

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

// ---------------------------------------------------------------------------
// Push notifications
// ---------------------------------------------------------------------------

const NOTIFICATION_REGION = "europe-west1";
const NOTIFICATION_CHANNEL_ID = "shopping_updates";

type NotificationType =
  | "itemAdded"
  | "urgentItem"
  | "shoppingComplete"
  | "memberJoined";

const SUPPORTED_LANGS = ["en", "he", "ar", "fr", "es", "ru", "am"] as const;

/** Localized app name, mirrors app.json branding per language. */
const APP_NAME: Record<string, string> = {
  en: "Haserli",
  he: "חסרלי",
  ar: "حصرلي",
  fr: "Haserli",
  es: "Haserli",
  ru: "Хасерли",
  am: "ሃሰርሊ",
};

/** Localized notification body templates. {{name}} and {{item}} are replaced. */
const NOTIFICATION_BODIES: Record<NotificationType, Record<string, string>> = {
  itemAdded: {
    en: "{{name}} added: {{item}}",
    he: "{{name}} הוסיף/ה: {{item}}",
    ar: "{{name}} أضاف: {{item}}",
    fr: "{{name}} a ajouté : {{item}}",
    es: "{{name}} añadió: {{item}}",
    ru: "{{name}} добавил(а): {{item}}",
    am: "{{name}} ጨመረ፦ {{item}}",
  },
  urgentItem: {
    en: "{{name}} added an urgent item: {{item}}",
    he: "{{name}} הוסיף/ה פריט דחוף: {{item}}",
    ar: "{{name}} أضاف عنصرًا عاجلاً: {{item}}",
    fr: "{{name}} a ajouté un article urgent : {{item}}",
    es: "{{name}} añadió un artículo urgente: {{item}}",
    ru: "{{name}} добавил(а) срочный товар: {{item}}",
    am: "{{name}} አስቸኳይ ንጥል ጨመረ፦ {{item}}",
  },
  shoppingComplete: {
    en: "{{name}} finished the shopping!",
    he: "{{name}} סיים/ה את הקניות!",
    ar: "{{name}} أنهى التسوق!",
    fr: "{{name}} a terminé les courses !",
    es: "¡{{name}} terminó las compras!",
    ru: "{{name}} завершил(а) покупки!",
    am: "{{name}} ግዢውን ጨረሰ!",
  },
  memberJoined: {
    en: "{{name}} joined the household",
    he: "{{name}} הצטרף/ה למשק הבית",
    ar: "{{name}} انضم إلى المنزل",
    fr: "{{name}} a rejoint le foyer",
    es: "{{name}} se unió al hogar",
    ru: "{{name}} присоединился(ась) к семье",
    am: "{{name}} ወደ ቤተሰቡ ተቀላቀለ",
  },
};

function normalizeLang(lang: unknown): string {
  if (typeof lang !== "string") return "en";
  const short = lang.trim().toLowerCase().split(/[-_]/)[0];
  return (SUPPORTED_LANGS as readonly string[]).includes(short) ? short : "en";
}

function buildBody(
  type: NotificationType,
  lang: string,
  params: { name: string; item?: string }
): string {
  const table = NOTIFICATION_BODIES[type];
  const template = table[lang] ?? table.en;
  return template
    .replace("{{name}}", params.name)
    .replace("{{item}}", params.item ?? "");
}

/**
 * Sends a localized push notification to every household member (except
 * `excludeUid`) who has enabled the given notification type. Invalid tokens are
 * pruned from the recipient's profile.
 */
async function sendToHouseholdMembers(
  householdId: string,
  excludeUid: string,
  type: NotificationType,
  params: { name: string; item?: string }
): Promise<void> {
  const db = getFirestore();

  const membersSnap = await db
    .collection("households")
    .doc(householdId)
    .collection("members")
    .get();

  const recipientIds = membersSnap.docs
    .map((d) => d.id)
    .filter((id) => id && id !== excludeUid);

  if (recipientIds.length === 0) return;

  const messages: Message[] = [];
  const tokenOwners: { uid: string; token: string }[] = [];

  await Promise.all(
    recipientIds.map(async (uid) => {
      const userSnap = await db.collection("users").doc(uid).get();
      if (!userSnap.exists) return;

      const data = userSnap.data() ?? {};
      const tokens: string[] = Array.isArray(data.fcmTokens)
        ? (data.fcmTokens as unknown[]).filter(
            (t): t is string => typeof t === "string" && t.length > 0
          )
        : [];
      if (tokens.length === 0) return;

      const prefs = (data.notificationPreferences ?? {}) as Record<string, unknown>;
      // Preferences default to disabled when unset (opt-in via Settings).
      if (prefs[type] !== true) return;

      const lang = normalizeLang(data.language);
      const title = APP_NAME[lang] ?? APP_NAME.en;
      const body = buildBody(type, lang, params);

      for (const token of tokens) {
        messages.push({
          token,
          notification: { title, body },
          data: { type, householdId },
          android: {
            priority: type === "urgentItem" ? "high" : "normal",
            notification: {
              channelId: NOTIFICATION_CHANNEL_ID,
              priority: type === "urgentItem" ? "high" : "default",
            },
          },
          apns: {
            payload: {
              aps: {
                sound: "default",
              },
            },
          },
        });
        tokenOwners.push({ uid, token });
      }
    })
  );

  if (messages.length === 0) return;

  const response = await getMessaging().sendEach(messages);

  const invalidByUser: Record<string, string[]> = {};
  response.responses.forEach((resp, idx) => {
    if (resp.success) return;
    const code = resp.error?.code;
    if (
      code === "messaging/invalid-registration-token" ||
      code === "messaging/registration-token-not-registered"
    ) {
      const owner = tokenOwners[idx];
      (invalidByUser[owner.uid] ??= []).push(owner.token);
    }
  });

  await Promise.all(
    Object.entries(invalidByUser).map(([uid, tokens]) =>
      db
        .collection("users")
        .doc(uid)
        .update({ fcmTokens: FieldValue.arrayRemove(...tokens) })
        .catch(() => undefined)
    )
  );
}

/** Resolves a member display name, falling back to the members collection. */
async function resolveMemberName(
  householdId: string,
  uid: string | undefined,
  fallbackName: string | undefined
): Promise<string> {
  if (fallbackName && fallbackName.trim().length > 0) return fallbackName;
  if (!uid) return "Someone";
  try {
    const memberSnap = await getFirestore()
      .collection("households")
      .doc(householdId)
      .collection("members")
      .doc(uid)
      .get();
    const name = memberSnap.data()?.displayName as string | undefined;
    if (name && name.trim().length > 0) return name;
  } catch {
    // ignore lookup failures
  }
  return "Someone";
}

export const onItemAdded = onDocumentCreated(
  {
    document: "households/{householdId}/items/{itemId}",
    region: NOTIFICATION_REGION,
    maxInstances: 10,
  },
  async (event) => {
    const snap = event.data;
    if (!snap) return;

    const item = snap.data();
    if (!item) return;

    const householdId = event.params.householdId;
    const addedBy = (item.addedBy as string | undefined) ?? "";
    const name = await resolveMemberName(
      householdId,
      addedBy,
      item.addedByName as string | undefined
    );
    const itemName = (item.name as string | undefined) ?? "";
    const isUrgent = item.isUrgent === true;

    await sendToHouseholdMembers(
      householdId,
      addedBy,
      isUrgent ? "urgentItem" : "itemAdded",
      { name, item: itemName }
    );
  }
);

export const onItemUpdated = onDocumentUpdated(
  {
    document: "households/{householdId}/items/{itemId}",
    region: NOTIFICATION_REGION,
    maxInstances: 10,
  },
  async (event) => {
    const before = event.data?.before.data();
    const after = event.data?.after.data();
    if (!before || !after) return;

    // Only react when an item transitions into BOUGHT.
    if (before.status === after.status) return;
    if (after.status !== "BOUGHT") return;

    const householdId = event.params.householdId;
    const db = getFirestore();

    const itemsSnap = await db
      .collection("households")
      .doc(householdId)
      .collection("items")
      .get();

    if (itemsSnap.empty) return;
    const allBought = itemsSnap.docs.every(
      (d) => (d.data().status as string | undefined) === "BOUGHT"
    );
    if (!allBought) return;

    const boughtBy = (after.boughtBy as string | undefined) ?? "";
    const name = await resolveMemberName(
      householdId,
      boughtBy,
      after.boughtByName as string | undefined
    );

    await sendToHouseholdMembers(householdId, boughtBy, "shoppingComplete", {
      name,
    });
  }
);

export const onMemberJoined = onDocumentCreated(
  {
    document: "households/{householdId}/members/{userId}",
    region: NOTIFICATION_REGION,
    maxInstances: 10,
  },
  async (event) => {
    const snap = event.data;
    if (!snap) return;

    const member = snap.data();
    if (!member) return;

    const householdId = event.params.householdId;
    const userId = event.params.userId;
    const name = (member.displayName as string | undefined) ?? "Someone";

    // When a household is created the owner is the only member, so there are no
    // other recipients and nothing is sent.
    await sendToHouseholdMembers(householdId, userId, "memberJoined", { name });
  }
);
