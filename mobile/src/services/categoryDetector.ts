import { ItemCategory } from '../models';

/**
 * Score-based multi-language keyword category detection.
 * Mirrors Android's KeywordCategoryAutoDetector.
 */

const MIN_ACCEPT_SCORE = 24;

interface KeywordEntry {
  keywords: string[];
  category: ItemCategory;
}

const KEYWORD_MAP: KeywordEntry[] = [
  {
    category: ItemCategory.DAIRY,
    keywords: [
      'milk', 'cheese', 'yogurt', 'butter', 'cream', 'cottage',
      'חלב', 'גבינה', 'יוגורט', 'חמאה', 'שמנת', 'קוטג',
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

/**
 * Simple Levenshtein distance for fuzzy matching
 */
function levenshtein(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  if (m === 0) return n;
  if (n === 0) return m;

  const dp: number[][] = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0));
  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      dp[i][j] = Math.min(dp[i - 1][j] + 1, dp[i][j - 1] + 1, dp[i - 1][j - 1] + cost);
    }
  }
  return dp[m][n];
}

/**
 * Strip common Hebrew prefixes/suffixes for better matching
 */
function stripHebrewAffixes(word: string): string {
  // Remove common prefixes: ה, ו, ב, ל, מ, כ, ש
  let stripped = word.replace(/^[הובלמכש]/, '');
  // Remove common suffixes: ים, ות
  stripped = stripped.replace(/(ים|ות)$/, '');
  return stripped.length >= 2 ? stripped : word;
}

export function detectCategory(itemName: string): ItemCategory | null {
  const normalized = itemName.toLowerCase().trim();
  if (!normalized) return null;

  let bestCategory: ItemCategory | null = null;
  let bestScore = 0;

  for (const entry of KEYWORD_MAP) {
    for (const keyword of entry.keywords) {
      let score = 0;

      // Exact match
      if (normalized === keyword || normalized.includes(keyword)) {
        score = 30;
      } else {
        // Try stripped Hebrew form
        const stripped = stripHebrewAffixes(normalized);
        if (stripped === keyword || stripped.includes(keyword) || keyword.includes(stripped)) {
          score = 28;
        } else {
          // Fuzzy match with Levenshtein
          const distance = levenshtein(normalized, keyword);
          const maxLen = Math.max(normalized.length, keyword.length);
          if (maxLen > 0 && distance <= Math.floor(maxLen * 0.3)) {
            score = 25 - distance;
          }
        }
      }

      if (score > bestScore) {
        bestScore = score;
        bestCategory = entry.category;
      }
    }
  }

  return bestScore >= MIN_ACCEPT_SCORE ? bestCategory : null;
}
