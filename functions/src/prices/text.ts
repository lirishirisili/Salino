const FINALS: Record<string, string> = { "ך": "כ", "ם": "מ", "ן": "נ", "ף": "פ", "ץ": "צ" };

/** Lower-cases, strips niqqud and quote marks, unifies final letters, separates digits from letters. */
export function normalize(s: string): string {
  return s
    .toLowerCase()
    .replace(/[\u0591-\u05c7]/g, "")
    .replace(/[ךםןףץ]/g, (c) => FINALS[c])
    .replace(/["'`׳״’‘“”]/g, "")
    // Plene spelling varies between chains (מינרליים / מינרלים).
    .replace(/יי/g, "י")
    .replace(/וו/g, "ו")
    .replace(/(\d)\s*%/g, "$1% ")
    .replace(/(\d),(\d)/g, "$1.$2")
    .replace(/([0-9])([^\d\s.%])/g, "$1 $2")
    .replace(/([^\d\s.])([0-9])/g, "$1 $2")
    .replace(/[^\p{L}\p{N}%.\s]/gu, " ")
    .replace(/(^|\s)\.+|\.+(\s|$)/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Light Hebrew stemmer for singular/plural: עגבניה/עגבניות, ביצה/ביצים, פיתה/פיתות.
 * Conservative on purpose — שמנת (cream) must not collapse into שמן (oil).
 */
/** Construct-state plurals that shoppers and chains spell differently (תפוחי אדמה / תפוח אדמה). */
const CONSTRUCT: Record<string, string> = {
  "תפוחי": "תפוח",
  "עלי": "עלה",
  "פרחי": "פרח",
  "גרעיני": "גרעינ",
  "גבינת": "גבינה",
  "עוגת": "עוגה",
  "חטיפי": "חטיפ",
  "פתיתי": "פתית",
  "שקדי": "שקד",
  "דגני": "דגנ",
  "קרקרי": "קרקר",
  "ביצי": "ביצה",
};

export function stem(token: string): string {
  if (!/[\u05d0-\u05ea]/.test(token)) return token;
  if (CONSTRUCT[token]) return stem(CONSTRUCT[token]);
  if (token.length >= 5 && token.endsWith("ות")) return token.slice(0, -2);
  if (token.length >= 5 && token.endsWith("ימ")) return token.slice(0, -2);
  if (token.length >= 4 && token.endsWith("ה")) return token.slice(0, -1);
  return token;
}

const UNIT_WORDS = new Set(
  [
    "גרם", "גר", "ג", "גרמים", "קג", "קילו", "קילוגרם", "ק", "מל", "מיליליטר", "מיליליטרים", "ליטר", "ליטרים", "ל", "יח", "יחידה", "יחידות",
    "מטר", "מטרים", "סמ", "מ", "g", "gr", "kg", "ml", "l", "lt", "ltr", "x", "יחי", "מארז", "באריזה", "אריזה", "שקית", "בשקית",
  ].map((w) => normalize(w))
);

const STOP = new Set(["של", "עם", "ב", "ו", "ה", "או", "את", "על", "the", "and", "with", "of", "in", "for"]);

export interface Tokens {
  /** Stemmed word tokens (no numbers or units). */
  words: string[];
  /** Fat/strength percentages such as "3%". */
  percents: string[];
}

export function tokenize(s: string): Tokens {
  const words: string[] = [];
  const percents: string[] = [];
  for (const raw of normalize(s).split(" ")) {
    if (!raw) continue;
    if (/^\d+(\.\d+)?%$/.test(raw)) {
      percents.push(String(Number(raw.slice(0, -1))) + "%");
      continue;
    }
    if (/^\d/.test(raw)) continue;
    if (UNIT_WORDS.has(raw) || STOP.has(raw)) continue;
    if (raw.length < 2 && !/[a-z]/.test(raw)) continue;
    words.push(stem(raw));
  }
  return { words, percents };
}

export type Dimension = "mass" | "volume" | "count";

export interface Size {
  dim: Dimension;
  /** Grams, millilitres, or units. */
  amount: number;
}

const UNIT_MAP: [RegExp, Dimension, number][] = [
  [/^(ק\s*ג|קג|קילו|קילוגרמ|kg)$/, "mass", 1000],
  [/^(גרמ|גרם|גר|ג|גרמימ|g|gr)$/, "mass", 1],
  [/^(מ\s*ל|מל|מיליליטר|מיליליטרימ|ml)$/, "volume", 1],
  [/^(ליטר|ליטרימ|ל|lt|ltr|l)$/, "volume", 1000],
  [/^(יח|יחידה|יחידות|יחי|units?|גליל|גלילימ|רול|רולימ)$/, "count", 1],
];

function unitOf(word: string): [Dimension, number] | null {
  const w = normalize(word).replace(/\s+/g, " ");
  for (const [re, dim, mul] of UNIT_MAP) if (re.test(w)) return [dim, mul];
  return null;
}

/** Package size from the structured Quantity/UnitQty fields, falling back to the name. */
export function parseSize(quantity: number | null, unit: string, name: string): Size | null {
  if (quantity != null && quantity > 0 && unit) {
    const u = unitOf(unit);
    if (u && !(u[0] === "count" && (quantity === 1 || !Number.isInteger(quantity)))) return { dim: u[0], amount: quantity * u[1] };
  }
  return sizeFromText(name);
}

export function sizeFromText(name: string): Size | null {
  const n = normalize(name);
  const m = /(\d+(?:\.\d+)?)\s*(ק\s?ג|קג|קילו|גרמ|גרם|גר|ג|מל|מ\s?ל|ליטר|ל|kg|g|ml|l)(?=\s|$)/.exec(n);
  if (m) {
    const u = unitOf(m[2]);
    const v = Number(m[1]);
    if (u && v > 0) return { dim: u[0], amount: v * u[1] };
  }
  const c =
    /(\d+)\s*(יח|יחידות|יחי|גלילימ|גליל|רולימ)(?=\s|$)/.exec(n) ?? /(?:^|\s)(?:x|מארז)\s*(\d+)(?=\s|$)/.exec(n);
  if (c) {
    const v = Number(c[1]);
    if (v > 1 && v < 500) return { dim: "count", amount: v };
  }
  return null;
}

export function sameSize(a: Size | null, b: Size | null, tolerance = 0.15): boolean {
  if (!a || !b) return a === b;
  // Chains label the same dairy/drink pack in grams or millilitres interchangeably.
  const liquidSolid = a.dim !== "count" && b.dim !== "count";
  if (a.dim !== b.dim && !liquidSolid) return false;
  return Math.abs(a.amount - b.amount) <= tolerance * Math.max(a.amount, b.amount);
}
