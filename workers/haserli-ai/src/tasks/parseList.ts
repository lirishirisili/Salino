import type { SchemaNode } from '../aiHttp.ts';
import { extractJsonText, TaskOutputError, type AiTask } from '../task.ts';

/**
 * parse-list: free text (a WhatsApp list, a sentence, a note) → shopping items.
 * Enum values mirror mobile/src/models/enums.ts (ItemCategory, ItemUnit).
 */

export const CATEGORIES = [
  'DAIRY',
  'VEGETABLES',
  'FRUITS',
  'MEAT_FISH',
  'BAKERY',
  'CLEANING',
  'PANTRY',
  'SNACKS',
  'BEVERAGES',
  'PHARMACY',
  'OTHER',
] as const;
/** "NONE" instead of null: strict JSON-schema modes handle a plain enum more reliably. */
export const UNITS = ['NONE', 'PIECES', 'KG', 'GRAMS', 'LITERS', 'PACKS', 'BOTTLES', 'BAGS'] as const;

export type Category = (typeof CATEGORIES)[number];
export type Unit = Exclude<(typeof UNITS)[number], 'NONE'>;

export interface ParsedListItem {
  name: string;
  quantity: number;
  unit: Unit | null;
  category: Category;
  note: string;
}

export interface ParseListInput {
  text: string;
  /** App language, e.g. "he". Only a hint — names stay in the text's own language. */
  locale?: string;
}

export const MAX_INPUT_CHARS = 4_000;
export const MAX_ITEMS = 100;
const MAX_NAME_CHARS = 80;
const MAX_NOTE_CHARS = 120;
const MAX_QUANTITY = 999;

const ITEM_SCHEMA: SchemaNode = {
  type: 'object',
  properties: {
    name: { type: 'string', description: 'Product name only, in the original language, singular form as written.' },
    quantity: { type: 'number', description: 'How many / how much. 1 when not stated.' },
    unit: { type: 'string', format: 'enum', enum: [...UNITS] },
    category: { type: 'string', format: 'enum', enum: [...CATEGORIES] },
    note: { type: 'string', description: 'Brand, fat %, size or a short comment. Empty string if none.' },
  },
  required: ['name', 'quantity', 'unit', 'category', 'note'],
};

export const PARSE_LIST_SCHEMA: SchemaNode = {
  type: 'object',
  properties: {
    // No `maxItems`: Gemini answers 400 INVALID_ARGUMENT to it. parseListJson caps the count.
    items: { type: 'array', items: ITEM_SCHEMA },
  },
  required: ['items'],
};

const INSTRUCTIONS = `You turn text that someone pasted into a family shopping-list app into shopping list items.
The text is often a WhatsApp message in Hebrew (sometimes English, Russian, Arabic, French, Spanish or Amharic): a list, a sentence, or a mix with greetings.

Rules:
- One item per product. Split "חלב ולחם" / "milk and bread" into two items.
- Read quantities written as digits or words: "2 חלב", "חלב x2", "שתי חבילות פסטה" (2 PACKS), "חצי קילו גבינה" (0.5 KG), "תריסר ביצים" (12), "שישיית מים" (6 BOTTLES).
- unit: KG, GRAMS, LITERS, PACKS, BOTTLES, BAGS or PIECES only when the text names that unit (קילו, גרם, ליטר, חבילה, בקבוק, שקית, יחידות…); otherwise NONE. "חלב x2" is quantity 2 with unit NONE.
- Keep product names in the ORIGINAL language and wording, without the quantity or unit. Do not translate.
- note: brand, fat %, size or a short comment the writer added ("3%", "רק של תנובה", "the big one"). Empty string if none.
- category: the supermarket section — DAIRY, VEGETABLES, FRUITS, MEAT_FISH, BAKERY, CLEANING, PANTRY, SNACKS, BEVERAGES, PHARMACY (medicine, hygiene, baby care), OTHER.
- Ignore everything that is not something to buy: greetings, names, thanks, emoji, dates, "תודה", "אל תשכח", questions, headings like "רשימה:".
- Vague requests become a sensible product: "משהו לנקות את הכיור" → a sink/kitchen cleaner (CLEANING).
- The same product twice → one item with the quantities added.
- If there is nothing to buy in the text, return {"items": []}.`;

const INLINE_SCHEMA = `Answer with JSON only, exactly this shape:
{"items":[{"name":string,"quantity":number,"unit":"NONE"|"PIECES"|"KG"|"GRAMS"|"LITERS"|"PACKS"|"BOTTLES"|"BAGS","category":"DAIRY"|"VEGETABLES"|"FRUITS"|"MEAT_FISH"|"BAKERY"|"CLEANING"|"PANTRY"|"SNACKS"|"BEVERAGES"|"PHARMACY"|"OTHER","note":string}]}`;

export function buildParseListPrompt(input: ParseListInput, options: { inlineSchema: boolean }): string {
  const text = input.text.slice(0, MAX_INPUT_CHARS);
  return [
    INSTRUCTIONS,
    input.locale ? `The app language is "${input.locale}".` : '',
    options.inlineSchema ? INLINE_SCHEMA : '',
    'Text:',
    '"""',
    text,
    '"""',
  ]
    .filter(Boolean)
    .join('\n');
}

function asString(value: unknown, max: number): string {
  return typeof value === 'string' ? value.replace(/\s+/g, ' ').trim().slice(0, max) : '';
}

function asQuantity(value: unknown): number {
  const n = typeof value === 'number' ? value : typeof value === 'string' ? parseFloat(value.replace(',', '.')) : NaN;
  if (!Number.isFinite(n) || n <= 0) return 1;
  return Math.min(Math.round(n * 1000) / 1000, MAX_QUANTITY);
}

function asEnum<T extends string>(value: unknown, allowed: readonly T[], fallback: T): T {
  const upper = typeof value === 'string' ? value.trim().toUpperCase() : '';
  return (allowed as readonly string[]).includes(upper) ? (upper as T) : fallback;
}

/**
 * Validates a model answer. Bad fields are repaired (quantity → 1, unknown
 * category → OTHER). An answer that isn't JSON / has no items array is a
 * TaskOutputError (the race tries the next provider). An EMPTY list is a valid
 * answer — "nothing to buy here" — returned at once instead of waiting for every
 * other provider to agree; the route turns it into a 422.
 */
export function parseListJson(raw: string): ParsedListItem[] {
  let data: unknown;
  try {
    data = JSON.parse(extractJsonText(raw));
  } catch {
    throw new TaskOutputError('answer is not JSON');
  }
  const list = Array.isArray(data)
    ? data
    : data && typeof data === 'object' && Array.isArray((data as { items?: unknown }).items)
      ? (data as { items: unknown[] }).items
      : null;
  if (!list) throw new TaskOutputError('answer has no items array');

  const byName = new Map<string, ParsedListItem>();
  for (const entry of list) {
    if (!entry || typeof entry !== 'object') continue;
    const e = entry as Record<string, unknown>;
    const name = asString(e.name, MAX_NAME_CHARS);
    if (!name) continue;
    const unitValue = asEnum(e.unit, UNITS, 'NONE');
    const item: ParsedListItem = {
      name,
      quantity: asQuantity(e.quantity),
      unit: unitValue === 'NONE' ? null : unitValue,
      category: asEnum(e.category, CATEGORIES, 'OTHER'),
      note: asString(e.note, MAX_NOTE_CHARS),
    };
    const key = name.toLowerCase();
    const existing = byName.get(key);
    if (existing && existing.unit === item.unit) {
      existing.quantity = Math.min(existing.quantity + item.quantity, MAX_QUANTITY);
      if (!existing.note && item.note) existing.note = item.note;
    } else if (!existing) {
      byName.set(key, item);
    }
    if (byName.size >= MAX_ITEMS) break;
  }
  // Entries were there but none had a name: a malformed answer, not "nothing to buy".
  if (byName.size === 0 && list.length > 0) throw new TaskOutputError('answer items have no names');
  return [...byName.values()];
}

export const parseListTask: AiTask<ParseListInput, ParsedListItem[]> = {
  id: 'parse_list',
  schema: PARSE_LIST_SCHEMA,
  buildPrompt: buildParseListPrompt,
  parse: parseListJson,
  maxOutputTokens: 3_000,
};
