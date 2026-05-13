import { ItemUnit, ParsedVoiceItem } from '../models';

/**
 * Parses spoken text into item name, quantity, and unit.
 * Mirrors Android's KeywordVoiceInputParser with multi-language support.
 */

const UNIT_PATTERNS: { pattern: RegExp; unit: ItemUnit }[] = [
  // Hebrew
  { pattern: /\b(קילו|ק"ג|קילוגרם)\b/i, unit: ItemUnit.KG },
  { pattern: /\b(גרם)\b/i, unit: ItemUnit.GRAMS },
  { pattern: /\b(ליטר)\b/i, unit: ItemUnit.LITERS },
  { pattern: /\b(חבילה|חבילות)\b/i, unit: ItemUnit.PACKS },
  { pattern: /\b(בקבוק|בקבוקים)\b/i, unit: ItemUnit.BOTTLES },
  { pattern: /\b(שקית|שקיות)\b/i, unit: ItemUnit.BAGS },
  // English
  { pattern: /\b(kilo|kilogram|kilograms|kg)\b/i, unit: ItemUnit.KG },
  { pattern: /\b(gram|grams|g)\b/i, unit: ItemUnit.GRAMS },
  { pattern: /\b(liter|liters|litre|litres|l)\b/i, unit: ItemUnit.LITERS },
  { pattern: /\b(pack|packs|package|packages)\b/i, unit: ItemUnit.PACKS },
  { pattern: /\b(bottle|bottles)\b/i, unit: ItemUnit.BOTTLES },
  { pattern: /\b(bag|bags)\b/i, unit: ItemUnit.BAGS },
  { pattern: /\b(piece|pieces|pcs)\b/i, unit: ItemUnit.PIECES },
  // Arabic
  { pattern: /\b(كيلو|كيلوغرام)\b/i, unit: ItemUnit.KG },
  { pattern: /\b(غرام|جرام)\b/i, unit: ItemUnit.GRAMS },
  { pattern: /\b(لتر)\b/i, unit: ItemUnit.LITERS },
  { pattern: /\b(عبوة|عبوات)\b/i, unit: ItemUnit.PACKS },
  { pattern: /\b(زجاجة|زجاجات)\b/i, unit: ItemUnit.BOTTLES },
  { pattern: /\b(كيس|أكياس)\b/i, unit: ItemUnit.BAGS },
  // French
  { pattern: /\b(kilo|kilogramme|kilogrammes)\b/i, unit: ItemUnit.KG },
  { pattern: /\b(gramme|grammes)\b/i, unit: ItemUnit.GRAMS },
  { pattern: /\b(litre|litres)\b/i, unit: ItemUnit.LITERS },
  { pattern: /\b(paquet|paquets)\b/i, unit: ItemUnit.PACKS },
  { pattern: /\b(bouteille|bouteilles)\b/i, unit: ItemUnit.BOTTLES },
  { pattern: /\b(sac|sacs)\b/i, unit: ItemUnit.BAGS },
  // Spanish
  { pattern: /\b(kilogramo|kilogramos)\b/i, unit: ItemUnit.KG },
  { pattern: /\b(gramo|gramos)\b/i, unit: ItemUnit.GRAMS },
  { pattern: /\b(litro|litros)\b/i, unit: ItemUnit.LITERS },
  { pattern: /\b(paquete|paquetes)\b/i, unit: ItemUnit.PACKS },
  { pattern: /\b(botella|botellas)\b/i, unit: ItemUnit.BOTTLES },
  { pattern: /\b(bolsa|bolsas)\b/i, unit: ItemUnit.BAGS },
  // Russian
  { pattern: /\b(кило|килограмм|килограмма)\b/i, unit: ItemUnit.KG },
  { pattern: /\b(грамм|граммов)\b/i, unit: ItemUnit.GRAMS },
  { pattern: /\b(литр|литра|литров)\b/i, unit: ItemUnit.LITERS },
  { pattern: /\b(упаковка|упаковки|упаковок)\b/i, unit: ItemUnit.PACKS },
  { pattern: /\b(бутылка|бутылки|бутылок)\b/i, unit: ItemUnit.BOTTLES },
  { pattern: /\b(пакет|пакета|пакетов)\b/i, unit: ItemUnit.BAGS },
];

const NUMBER_WORDS: Record<string, number> = {
  // English
  one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10,
  // Hebrew
  'אחד': 1, 'שניים': 2, 'שתיים': 2, 'שלוש': 3, 'שלושה': 3, 'ארבע': 4, 'ארבעה': 4,
  'חמש': 5, 'חמישה': 5, 'שש': 6, 'שישה': 6, 'שבע': 7, 'שבעה': 7,
  'שמונה': 8, 'תשע': 9, 'תשעה': 9, 'עשר': 10, 'עשרה': 10,
  // Arabic
  'واحد': 1, 'اثنين': 2, 'ثلاثة': 3, 'أربعة': 4, 'خمسة': 5,
  // French
  'un': 1, 'une': 1, 'deux': 2, 'trois': 3, 'quatre': 4, 'cinq': 5,
  // Spanish
  'uno': 1, 'una': 1, 'dos': 2, 'tres': 3, 'cuatro': 4, 'cinco': 5,
  // Russian
  'один': 1, 'одна': 1, 'два': 2, 'две': 2, 'три': 3, 'четыре': 4, 'пять': 5,
};

// Connectors to clean from name
const CONNECTORS = /\b(of|של|من|de|di)\b/gi;

export function parseVoiceInput(spokenText: string): ParsedVoiceItem {
  let text = spokenText.trim();
  let quantity = 1;
  let unit: ItemUnit | null = null;

  // Extract unit
  for (const { pattern, unit: u } of UNIT_PATTERNS) {
    if (pattern.test(text)) {
      unit = u;
      text = text.replace(pattern, '').trim();
      break;
    }
  }

  // Extract leading number
  const leadingNumberMatch = text.match(/^(\d+(?:\.\d+)?)\s*/);
  if (leadingNumberMatch) {
    quantity = parseFloat(leadingNumberMatch[1]);
    text = text.substring(leadingNumberMatch[0].length);
  } else {
    // Try trailing number
    const trailingNumberMatch = text.match(/\s*(\d+(?:\.\d+)?)$/);
    if (trailingNumberMatch) {
      quantity = parseFloat(trailingNumberMatch[1]);
      text = text.substring(0, text.length - trailingNumberMatch[0].length);
    } else {
      // Try number words
      const words = text.split(/\s+/);
      for (const word of words) {
        const num = NUMBER_WORDS[word.toLowerCase()];
        if (num) {
          quantity = num;
          text = text.replace(new RegExp(`\\b${word}\\b`, 'i'), '').trim();
          break;
        }
      }
    }
  }

  // Clean connectors
  text = text.replace(CONNECTORS, '').trim();
  // Collapse whitespace
  text = text.replace(/\s+/g, ' ').trim();

  return {
    name: text,
    quantity,
    unit,
  };
}
