import { ItemUnit } from '../models';

/**
 * Parses what a user TYPES or PASTES into the quick-add field:
 *   "2 חלב"            → 2 × חלב
 *   "חלב 3 ליטר"        → 3 L חלב
 *   "ביצים x2" / "2x"   → 2 × ביצים
 *   "חלב, לחם, ביצים"   → three items
 *   a WhatsApp list ("- חלב\n• 2 לחם\n1. ביצים") → one item per line
 *
 * Token-based on purpose: JS `\b` does not see Hebrew/Arabic/Cyrillic letters as
 * word characters, so regex word boundaries (as in voiceInputParser) miss them.
 */
export interface ParsedQuickAddItem {
  name: string;
  quantity: number;
  unit: ItemUnit | null;
}

const UNIT_WORDS: Record<string, ItemUnit> = {};
function units(unit: ItemUnit, words: string[]) {
  for (const w of words) UNIT_WORDS[w.toLowerCase()] = unit;
}
units(ItemUnit.KG, ['קילו', 'ק"ג', 'קג', 'קילוגרם', 'kg', 'kilo', 'kilos', 'kilogram', 'kilograms', 'كيلو', 'كغ', 'кг', 'кило', 'килограмм', 'kilogramo', 'kilogramos', 'kilogramme', 'kilogrammes']);
units(ItemUnit.GRAMS, ['גרם', 'גר', 'g', 'gr', 'gram', 'grams', 'غرام', 'جرام', 'г', 'гр', 'грамм', 'gramo', 'gramos', 'gramme', 'grammes']);
units(ItemUnit.LITERS, ['ליטר', 'ליטרים', 'l', 'liter', 'liters', 'litre', 'litres', 'لتر', 'л', 'литр', 'литра', 'литров', 'litro', 'litros']);
units(ItemUnit.PACKS, ['חבילה', 'חבילות', 'pack', 'packs', 'package', 'packages', 'عبوة', 'عبوات', 'упаковка', 'упаковки', 'paquete', 'paquetes', 'paquet', 'paquets']);
units(ItemUnit.BOTTLES, ['בקבוק', 'בקבוקים', 'bottle', 'bottles', 'زجاجة', 'زجاجات', 'бутылка', 'бутылки', 'botella', 'botellas', 'bouteille', 'bouteilles']);
units(ItemUnit.BAGS, ['שקית', 'שקיות', 'bag', 'bags', 'كيس', 'أكياس', 'пакет', 'пакета', 'bolsa', 'bolsas', 'sac', 'sacs']);
units(ItemUnit.PIECES, ['יח', "יח'", 'יחידה', 'יחידות', 'pc', 'pcs', 'piece', 'pieces', 'шт', 'шт.']);

/** "2", "1.5", "1,5", "x2", "2x", "×2", "*2". */
function readQuantity(token: string): number | null {
  const m = token.match(/^(?:[x×*])?(\d{1,4}(?:[.,]\d{1,3})?)(?:[x×*])?$/i);
  if (!m) return null;
  const value = parseFloat(m[1].replace(',', '.'));
  return Number.isFinite(value) && value > 0 ? value : null;
}

/** Strips list markers WhatsApp/notes add: "- ", "• ", "* ", "1. ", "2) ", "☐ ", "[ ] ". */
function stripListMarker(line: string): string {
  return line
    .replace(/^\s*(?:[-–—•·*▪◦☐☑✓✔]|\[\s?[xX]?\s?\])\s*/, '')
    .replace(/^\s*\d{1,3}[.)]\s+/, '')
    .trim();
}

export function parseQuickAddLine(raw: string): ParsedQuickAddItem | null {
  const text = stripListMarker(raw).replace(/\s+/g, ' ').trim();
  if (!text) return null;

  let tokens = text.split(' ');
  let quantity: number | null = null;
  let unit: ItemUnit | null = null;

  // Quantity: first or last token (never the only token: "7" alone is a name).
  if (tokens.length > 1) {
    const first = readQuantity(tokens[0]);
    const last = readQuantity(tokens[tokens.length - 1]);
    if (first != null) {
      quantity = first;
      tokens = tokens.slice(1);
    } else if (last != null) {
      quantity = last;
      tokens = tokens.slice(0, -1);
    }
  }

  // Unit: a unit word right after a leading quantity, or the last token.
  if (tokens.length > 1) {
    const firstUnit = UNIT_WORDS[tokens[0].toLowerCase()];
    const lastUnit = UNIT_WORDS[tokens[tokens.length - 1].toLowerCase()];
    if (firstUnit && quantity != null) {
      unit = firstUnit;
      tokens = tokens.slice(1);
    } else if (lastUnit) {
      unit = lastUnit;
      tokens = tokens.slice(0, -1);
      // "חלב 3 ליטר": the number sits before the trailing unit.
      if (quantity == null && tokens.length > 1) {
        const q = readQuantity(tokens[tokens.length - 1]);
        if (q != null) {
          quantity = q;
          tokens = tokens.slice(0, -1);
        }
      }
    }
  }

  const name = tokens.join(' ').replace(/^[,;:]+|[,;:]+$/g, '').trim();
  if (!name) {
    // Nothing but numbers/units: keep the original text as the name.
    return { name: text, quantity: 1, unit: null };
  }
  return { name, quantity: quantity ?? 1, unit };
}

/** Splits typed/pasted text into items: by line, then by comma / Arabic comma / semicolon. */
export function parseQuickAddText(text: string): ParsedQuickAddItem[] {
  const pieces = text
    .split(/\r?\n/)
    .flatMap((line) => line.split(/[,،;]/))
    .map((p) => p.trim())
    // "רשימה לשבת:" / "Shopping list:" — a header line, not an item.
    .filter((p) => p && !/[:：]$/.test(p));
  const out: ParsedQuickAddItem[] = [];
  for (const piece of pieces) {
    const parsed = parseQuickAddLine(piece);
    if (parsed) out.push(parsed);
  }
  return out;
}
