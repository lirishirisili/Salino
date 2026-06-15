import { ItemCategory } from '../models';
import { normalizeItemName } from '../utils/textUtils';
import { exactTokenScore, phraseBoundaryScore, pickConfidentCategory } from './categoryScoringRules';
import { mergeIsraeliHebrewKeywords } from './israeliHebrewCategoryKeywords';

/**
 * Score-based multi-language keyword category detection.
 * Mirrors Android's KeywordCategoryAutoDetector + CategoryScoringRules.
 */

interface KeywordEntry {
  keywords: string[];
  category: ItemCategory;
}

export const KEYWORD_MAP: KeywordEntry[] = [
  {
    category: ItemCategory.DAIRY,
    keywords: [
      'milk', 'cheese', 'yogurt', 'butter', 'cream', 'cottage',
      'חלב', 'גבינה', 'יוגורט', 'חמאה', 'שמנת', 'קוטג', 'לבנה',
      'حليب', 'جبن', 'زبادي', 'زبدة', 'قشطة',
      'lait', 'fromage', 'yaourt', 'beurre', 'crème',
      'leche', 'queso', 'yogur', 'mantequilla',
      'молоко', 'сыр', 'йогурт', 'масло', 'сметана', 'творог',
    ],
  },
  {
    category: ItemCategory.VEGETABLES,
    keywords: [
      'tomato', 'cucumber', 'onion', 'potato', 'carrot', 'pepper', 'lettuce', 'broccoli', 'spinach',
      'עגבנ', 'מלפפון', 'בצל', 'תפוח אדמה', 'גזר', 'פלפל', 'חסה', 'ברוקולי', 'תרד',
      'طماطم', 'خيار', 'بصل', 'بطاطا', 'جزر', 'فلفل', 'خس',
      'tomate', 'concombre', 'oignon', 'pomme de terre', 'carotte', 'poivron',
      'помидор', 'огурец', 'лук', 'картофель', 'морковь', 'перец',
    ],
  },
  {
    category: ItemCategory.FRUITS,
    keywords: [
      'apple', 'banana', 'orange', 'grape', 'strawberry', 'mango', 'watermelon', 'lemon',
      'תפוח', 'בננה', 'תפוז', 'ענב', 'תות', 'מנגו', 'אבטיח', 'לימון',
      'تفاح', 'موز', 'برتقال', 'عنب', 'فراولة', 'مانجو', 'بطيخ', 'ليمون',
      'pomme', 'banane', 'raisin', 'fraise', 'mangue', 'pastèque', 'citron',
      'яблоко', 'банан', 'апельсин', 'виноград', 'клубника', 'манго', 'арбуз', 'лимон',
    ],
  },
  {
    category: ItemCategory.MEAT_FISH,
    keywords: [
      'chicken', 'beef', 'fish', 'salmon', 'tuna', 'meat', 'steak', 'turkey', 'shrimp',
      'עוף', 'בקר', 'דג', 'סלמון', 'טונה', 'בשר', 'סטייק', 'הודו',
      'دجاج', 'لحم', 'سمك', 'سلمون', 'تونة', 'ستيك', 'ديك رومي',
      'poulet', 'boeuf', 'poisson', 'saumon', 'thon', 'viande', 'dinde',
      'курица', 'говядина', 'рыба', 'лосось', 'тунец', 'мясо', 'стейк', 'индейка',
    ],
  },
  {
    category: ItemCategory.BAKERY,
    keywords: [
      'bread', 'roll', 'croissant', 'bagel', 'pita', 'baguette', 'cake', 'muffin',
      'לחם', 'לחמני', 'קרואסון', 'בייגל', 'פיתה', 'באגט', 'עוגה', 'מאפה',
      'خبز', 'كرواسون', 'بيتا', 'باغيت', 'كعكة',
      'pain', 'baguette', 'gâteau',
      'хлеб', 'булка', 'круассан', 'багет', 'лаваш', 'торт',
    ],
  },
  {
    category: ItemCategory.CLEANING,
    keywords: [
      'soap', 'detergent', 'bleach', 'sponge', 'cleaner', 'wipes', 'trash bags', 'paper towel',
      'סבון', 'אקונומיקה', 'נוזל כלים', 'ספוג', 'מנקה', 'מגבון', 'שקית אשפה', 'נייר סופג',
      'صابون', 'منظف', 'مبيض', 'إسفنجة', 'مناديل', 'أكياس قمامة',
      'savon', 'détergent', 'éponge', 'nettoyant', 'sac poubelle',
      'мыло', 'порошок', 'средство', 'губка', 'салфетки', 'мусорные пакеты',
    ],
  },
  {
    category: ItemCategory.PANTRY,
    keywords: [
      'rice', 'pasta', 'flour', 'sugar', 'oil', 'salt', 'sauce', 'canned', 'cereal', 'oat',
      'אורז', 'פסטה', 'קמח', 'סוכר', 'שמן', 'מלח', 'רוטב', 'שימורים', 'דגני בוקר',
      'أرز', 'معكرونة', 'دقيق', 'سكر', 'زيت', 'ملح', 'صلصة', 'معلبات',
      'riz', 'pâtes', 'farine', 'sucre', 'huile', 'sel', 'sauce', 'conserve', 'céréales',
      'рис', 'макароны', 'мука', 'сахар', 'масло', 'соль', 'соус', 'консервы', 'хлопья',
    ],
  },
  {
    category: ItemCategory.SNACKS,
    keywords: [
      'chips', 'chocolate', 'cookies', 'candy', 'popcorn', 'nuts', 'crackers', 'biscuit',
      'צ\'יפס', 'שוקולד', 'עוגיות', 'סוכריות', 'פופקורן', 'אגוזים', 'קרקר', 'ביסקוויט',
      'شيبس', 'شوكولاتة', 'كوكيز', 'حلوى', 'فشار', 'مكسرات',
      'chocolat', 'biscuits', 'bonbons', 'noix',
      'чипсы', 'шоколад', 'печенье', 'конфеты', 'попкорн', 'орехи',
    ],
  },
  {
    category: ItemCategory.BEVERAGES,
    keywords: [
      'water', 'juice', 'soda', 'coffee', 'tea', 'beer', 'wine', 'cola', 'energy drink',
      'מים', 'מיץ', 'סודה', 'קפה', 'תה', 'בירה', 'יין', 'קולה',
      'ماء', 'عصير', 'صودا', 'قهوة', 'شاي', 'بيرة', 'نبيذ', 'كولا',
      'eau', 'jus', 'café', 'thé', 'bière', 'vin',
      'вода', 'сок', 'газировка', 'кофе', 'чай', 'пиво', 'вино', 'кола',
    ],
  },
  {
    category: ItemCategory.PHARMACY,
    keywords: [
      'shampoo', 'toothpaste', 'deodorant', 'razor', 'medicine', 'bandage', 'vitamin', 'cream',
      'שמפו', 'משחת שיניים', 'דאודורנט', 'סכין גילוח', 'תרופה', 'ויטמין', 'קרם',
      'شامبو', 'معجون أسنان', 'مزيل عرق', 'دواء', 'فيتامين', 'كريم',
      'shampooing', 'dentifrice', 'déodorant', 'médicament', 'vitamine',
      'шампунь', 'зубная паста', 'дезодорант', 'лекарство', 'витамин', 'крем',
    ],
  },
];

function tokenVariants(token: string): string[] {
  const cleaned = token.trim();
  if (!cleaned) return [];
  let noPrefix = cleaned;
  if (noPrefix.startsWith('ה')) noPrefix = noPrefix.slice(1);
  if (noPrefix.startsWith('ו')) noPrefix = noPrefix.slice(1);
  if (noPrefix.startsWith('ב')) noPrefix = noPrefix.slice(1);
  if (noPrefix.startsWith('ל')) noPrefix = noPrefix.slice(1);
  return [...new Set([cleaned, noPrefix])].filter(Boolean);
}

function scoreCategory(normalized: string, tokens: string[], keywords: string[]): number {
  let score = 0;
  for (const keyword of keywords) {
    const normalizedKeyword = normalizeItemName(keyword);
    if (!normalizedKeyword) continue;
    score += phraseBoundaryScore(normalized, normalizedKeyword);
    score += exactTokenScore(tokens, normalizedKeyword);
  }
  return score;
}

export function detectCategory(itemName: string): ItemCategory | null {
  const normalized = normalizeItemName(itemName);
  if (!normalized) return null;

  const tokens = normalized
    .split(' ')
    .flatMap((token) => tokenVariants(token))
    .filter((v, i, a) => a.indexOf(v) === i);

  const scores: Record<string, number> = {};
  for (const entry of KEYWORD_MAP) {
    scores[entry.category] = scoreCategory(
      normalized,
      tokens,
      mergeIsraeliHebrewKeywords(entry.category, entry.keywords)
    );
  }

  return pickConfidentCategory(scores);
}
