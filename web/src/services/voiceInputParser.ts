import type { ItemUnit } from '../types';

interface ParsedVoiceItem {
  name: string;
  quantity: number;
  unit: ItemUnit | null;
}

const WB = '(?<=\\s|^)';
const WE = '(?=\\s|$)';

const unitPatterns: [ItemUnit, RegExp[]][] = [
  ['KG', [
    new RegExp(`${WB}(?:קילו(?:גרם)?|ק״ג|ק"ג)${WE}`, 'i'),
    new RegExp(`${WB}(?:kilo(?:gram)?s?|kg)${WE}`, 'i'),
    new RegExp(`${WB}(?:كيلو(?:غرام)?)${WE}`, 'i'),
    new RegExp(`${WB}(?:килограмм(?:ов)?|кг)${WE}`, 'i'),
    new RegExp(`${WB}(?:ኪሎ(?:ግራም)?)${WE}`, 'i'),
  ]],
  ['GRAMS', [
    new RegExp(`${WB}(?:גרם)${WE}`, 'i'),
    new RegExp(`${WB}(?:grams?|gr)${WE}`, 'i'),
    new RegExp(`${WB}(?:غرام)${WE}`, 'i'),
    new RegExp(`${WB}(?:грамм(?:ов)?)${WE}`, 'i'),
    new RegExp(`${WB}(?:ግራም)${WE}`, 'i'),
  ]],
  ['LITERS', [
    new RegExp(`${WB}(?:ליטר(?:ים)?)${WE}`, 'i'),
    new RegExp(`${WB}(?:liters?|litres?|ltr)${WE}`, 'i'),
    new RegExp(`${WB}(?:لتر)${WE}`, 'i'),
    new RegExp(`${WB}(?:литр(?:ов|а)?)${WE}`, 'i'),
    new RegExp(`${WB}(?:ሊትር)${WE}`, 'i'),
  ]],
  ['PACKS', [
    new RegExp(`${WB}(?:חבילות|חבילה|אריזות|אריזה)${WE}`, 'i'),
    new RegExp(`${WB}(?:packs?|packages?)${WE}`, 'i'),
    new RegExp(`${WB}(?:علبة|علب|حزمة)${WE}`, 'i'),
    new RegExp(`${WB}(?:упаковк[аи]|пачек|пачк[аи])${WE}`, 'i'),
    new RegExp(`${WB}(?:ፓኬት|ጥቅል)${WE}`, 'i'),
  ]],
  ['BOTTLES', [
    new RegExp(`${WB}(?:בקבוקים|בקבוק)${WE}`, 'i'),
    new RegExp(`${WB}(?:bottles?)${WE}`, 'i'),
    new RegExp(`${WB}(?:زجاجة|زجاجات|قنينة)${WE}`, 'i'),
    new RegExp(`${WB}(?:бутылк[аи]|бутылок)${WE}`, 'i'),
    new RegExp(`${WB}(?:ጠርሙስ|ጠርሙሶች)${WE}`, 'i'),
  ]],
  ['BAGS', [
    new RegExp(`${WB}(?:שקיות|שקית)${WE}`, 'i'),
    new RegExp(`${WB}(?:bags?)${WE}`, 'i'),
    new RegExp(`${WB}(?:كيس|أكياس)${WE}`, 'i'),
    new RegExp(`${WB}(?:пакет(?:ов|а|ы)?)${WE}`, 'i'),
    new RegExp(`${WB}(?:ከረጢት)${WE}`, 'i'),
  ]],
  ['PIECES', [
    new RegExp(`${WB}(?:יחידות|יחידה)${WE}`, 'i'),
    new RegExp(`${WB}(?:pieces?|pcs)${WE}`, 'i'),
    new RegExp(`${WB}(?:قطعة|قطع)${WE}`, 'i'),
    new RegExp(`${WB}(?:штук[аи]?)${WE}`, 'i'),
    new RegExp(`${WB}(?:ቁራጭ)${WE}`, 'i'),
  ]],
];

const numberWords: [string, number][] = [
  ['חצי', 0.5], ['אחד', 1], ['אחת', 1], ['שניים', 2], ['שתיים', 2],
  ['שלוש', 3], ['שלושה', 3], ['ארבע', 4], ['ארבעה', 4],
  ['חמש', 5], ['חמישה', 5], ['שש', 6], ['שישה', 6],
  ['שבע', 7], ['שבעה', 7], ['שמונה', 8], ['תשע', 9], ['תשעה', 9],
  ['עשר', 10], ['עשרה', 10],
  ['half', 0.5], ['one', 1], ['two', 2], ['three', 3], ['four', 4],
  ['five', 5], ['six', 6], ['seven', 7], ['eight', 8], ['nine', 9], ['ten', 10],
  ['نصف', 0.5], ['واحد', 1], ['اثنين', 2], ['ثلاثة', 3], ['أربعة', 4],
  ['خمسة', 5], ['ستة', 6], ['سبعة', 7], ['ثمانية', 8], ['تسعة', 9], ['عشرة', 10],
  ['пол', 0.5], ['половина', 0.5], ['один', 1], ['одна', 1], ['два', 2], ['две', 2],
  ['три', 3], ['четыре', 4], ['пять', 5], ['шесть', 6],
  ['семь', 7], ['восемь', 8], ['девять', 9], ['десять', 10],
  ['demi', 0.5], ['un', 1], ['une', 1], ['deux', 2], ['trois', 3], ['quatre', 4],
  ['cinq', 5], ['six', 6], ['sept', 7], ['huit', 8], ['neuf', 9], ['dix', 10],
  ['medio', 0.5], ['media', 0.5], ['uno', 1], ['una', 1], ['dos', 2], ['tres', 3],
  ['cuatro', 4], ['cinco', 5], ['seis', 6], ['siete', 7], ['ocho', 8], ['nueve', 9], ['diez', 10],
  ['ግማሽ', 0.5], ['አንድ', 1], ['ሁለት', 2], ['ሶስት', 3], ['አራት', 4],
  ['አምስት', 5], ['ስድስት', 6], ['ሰባት', 7], ['ስምንት', 8], ['ዘጠኝ', 9], ['አስር', 10],
];

const leadingNumberPattern = /^(\d+(?:[.,]\d+)?)\s*/;
const trailingNumberPattern = /\s*(\d+(?:[.,]\d+)?)$/;
const leadingConnectorPattern = /^(?:of|de|של|من|的)\s+/i;
const trailingConnectorPattern = /\s+(?:of|de|של|من|的)$/i;

function parseNumber(s: string): number | null {
  const n = parseFloat(s.replace(',', '.'));
  return isNaN(n) ? null : n;
}

function cleanupConnectors(text: string): string {
  return text
    .replace(leadingConnectorPattern, '')
    .replace(trailingConnectorPattern, '')
    .replace(/\s+/g, ' ')
    .trim();
}

export function parseVoiceInput(spokenText: string): ParsedVoiceItem {
  const trimmed = spokenText.trim();
  if (!trimmed) return { name: '', quantity: 1, unit: null };

  let remaining = trimmed;
  let detectedUnit: ItemUnit | null = null;
  let detectedQuantity: number | null = null;

  // 1. Find and extract unit keyword
  for (const [unit, patterns] of unitPatterns) {
    for (const pattern of patterns) {
      const match = pattern.exec(remaining);
      if (match) {
        detectedUnit = unit;
        remaining = (remaining.slice(0, match.index) + remaining.slice(match.index + match[0].length)).trim();
        break;
      }
    }
    if (detectedUnit) break;
  }

  // 2. Leading number
  const leadingMatch = leadingNumberPattern.exec(remaining);
  if (leadingMatch) {
    detectedQuantity = parseNumber(leadingMatch[1]);
    if (detectedQuantity !== null) {
      remaining = remaining.slice(leadingMatch[0].length).trim();
    }
  }

  // 3. Trailing number
  if (detectedQuantity === null) {
    const trailingMatch = trailingNumberPattern.exec(remaining);
    if (trailingMatch) {
      detectedQuantity = parseNumber(trailingMatch[1]);
      if (detectedQuantity !== null) {
        remaining = remaining.slice(0, trailingMatch.index).trim();
      }
    }
  }

  // 4. Number words
  if (detectedQuantity === null) {
    for (const [word, value] of numberWords) {
      const escaped = word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const wordPattern = new RegExp(`(?<=\\s|^)${escaped}(?=\\s|$)`, 'i');
      const match = wordPattern.exec(remaining);
      if (match) {
        detectedQuantity = value;
        remaining = (remaining.slice(0, match.index) + remaining.slice(match.index + match[0].length)).trim();
        break;
      }
    }
  }

  remaining = cleanupConnectors(remaining);

  return {
    name: remaining || trimmed,
    quantity: detectedQuantity ?? 1,
    unit: detectedUnit,
  };
}
