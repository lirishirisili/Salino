import type { AiTask } from '../task.ts';
import { PARSE_LIST_SCHEMA, parseListJson, type ParsedListItem } from './parseList.ts';

/**
 * generate-list: "Friday dinner for 8", "BBQ for 10", "shakshuka", "3-day camping
 * trip for 4" → a ready shopping list with sensible amounts.
 */

export interface GenerateListInput {
  request: string;
  /** Head count, when the user set one (overrides what the text says). */
  people?: number;
  locale?: string;
}

export const MAX_REQUEST_CHARS = 300;
export const MAX_PEOPLE = 200;

const INSTRUCTIONS = `You are the "smart list" helper of an Israeli family shopping-list app.
The user describes a meal, an event, a dish or a trip. Write the shopping list they need.

Rules:
- Write item names in the language of the request (Hebrew request → Hebrew names). Use everyday supermarket names ("חזה עוף", "פיתות", "חומוס").
- Fit the occasion and Israeli shopping habits: Shabbat dinner (challah, wine/grape juice, candles), holidays (e.g. Rosh Hashana apples & honey, Pesach matzot), mangal (meat, pitot, salads, charcoal, disposable plates), trips (water, snacks, disposables).
- Scale amounts to the number of people. Use KG/GRAMS for meat, produce sold by weight; PACKS/BOTTLES where natural; NONE otherwise.
- For a single dish: its ingredients for the stated servings (default 4). Skip water and basic salt/pepper/oil.
- 6 to 40 items. No duplicates. No cooking instructions.
- note: a short tip only when useful ("לטחינה", "גדול"). Otherwise empty string.
- category: DAIRY, VEGETABLES, FRUITS, MEAT_FISH, BAKERY, CLEANING, PANTRY, SNACKS, BEVERAGES, PHARMACY, OTHER.
- If the request is not about food, an event, a meal, a trip or household shopping, return {"items": []}.`;

const INLINE_SCHEMA = `Answer with JSON only, exactly this shape:
{"items":[{"name":string,"quantity":number,"unit":"NONE"|"PIECES"|"KG"|"GRAMS"|"LITERS"|"PACKS"|"BOTTLES"|"BAGS","category":"DAIRY"|"VEGETABLES"|"FRUITS"|"MEAT_FISH"|"BAKERY"|"CLEANING"|"PANTRY"|"SNACKS"|"BEVERAGES"|"PHARMACY"|"OTHER","note":string}]}`;

export function buildGenerateListPrompt(input: GenerateListInput, options: { inlineSchema: boolean }): string {
  return [
    INSTRUCTIONS,
    input.locale ? `The app language is "${input.locale}".` : '',
    input.people ? `Number of people: ${input.people}.` : '',
    options.inlineSchema ? INLINE_SCHEMA : '',
    'Request:',
    '"""',
    input.request.slice(0, MAX_REQUEST_CHARS),
    '"""',
  ]
    .filter(Boolean)
    .join('\n');
}

export const generateListTask: AiTask<GenerateListInput, ParsedListItem[]> = {
  id: 'generate_list',
  schema: PARSE_LIST_SCHEMA,
  buildPrompt: buildGenerateListPrompt,
  parse: parseListJson,
  maxOutputTokens: 3_000,
};
