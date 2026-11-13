import type { InlineImage } from '../aiHttp.ts';
import type { AiTask } from '../task.ts';
import { PARSE_LIST_SCHEMA, parseListJson, type ParsedListItem } from './parseList.ts';

/**
 * parse-image: a photo of a handwritten note, a screenshot of a WhatsApp list,
 * a recipe page or a flyer → shopping items (same output as parse-list).
 */

export interface ParseImageInput {
  image: InlineImage;
  locale?: string;
}

export const IMAGE_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/heic'] as const;
/** Base64 length cap (~1.1 MB decoded). The app resizes to ~1280px JPEG first. */
export const MAX_IMAGE_BASE64_CHARS = 1_500_000;

const INSTRUCTIONS = `You read a photo for a family shopping-list app and turn it into shopping list items.
The photo is usually one of: a handwritten note (often Hebrew), a screenshot of a chat with a list, a recipe (ingredients section), a printed list or a supermarket flyer.

Rules:
- One item per product. Read handwriting carefully; skip words you truly cannot read.
- Read quantities and units when written ("2 חלב", "חצי קילו גבינה" = 0.5 KG, "שישיית מים" = 6 BOTTLES). unit is NONE unless a unit is written.
- For a recipe: list the ingredients to buy, with the recipe's amounts. Skip water, and skip salt/pepper/oil unless the recipe needs an unusual amount.
- Keep product names in the ORIGINAL language of the photo. Do not translate.
- note: brand, fat %, size or a short comment written next to the item. Empty string if none.
- category: DAIRY, VEGETABLES, FRUITS, MEAT_FISH, BAKERY, CLEANING, PANTRY, SNACKS, BEVERAGES, PHARMACY (medicine, hygiene, baby care), OTHER.
- Ignore anything that is not something to buy: names, dates, prices, times, chat UI, greetings, cooking steps.
- If there is nothing to buy in the photo, return {"items": []}.`;

export const parseImageTask: AiTask<ParseImageInput, ParsedListItem[]> = {
  id: 'parse_image',
  schema: PARSE_LIST_SCHEMA,
  buildPrompt: (input) =>
    [INSTRUCTIONS, input.locale ? `The app language is "${input.locale}".` : ''].filter(Boolean).join('\n'),
  parse: parseListJson,
  maxOutputTokens: 3_000,
  image: (input) => input.image,
};
