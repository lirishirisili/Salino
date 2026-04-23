import type { ShoppingItem, DuplicateMatch, DuplicateReason } from '../types';

// ─── Text Normalizer ───

function normalize(text: string): string {
  if (!text || !text.trim()) return '';
  let result = text.normalize('NFD').replace(/[\u0300-\u036f\u0591-\u05C7]/g, '');
  result = result.toLowerCase();
  result = result.replace(/(\d+)\s*%/g, '$1%');
  result = result.replace(/(\d+)\s+אחוז/g, '$1%');
  result = result.replace(/(\d+)\s+percent/g, '$1%');
  result = result.replace(/(\d+)\s+процент(?:ов)?/g, '$1%');
  result = result.replace(/(\d+)\s+بالما?ية/g, '$1%');
  result = result.replace(/(\d+)\s+pour\s+cent/g, '$1%');
  result = result.replace(/(\d+)\s+por\s+ciento/g, '$1%');
  result = result.replace(/(\d+)\s+በመቶ/g, '$1%');
  result = result.replace(/[׳'`\u2018\u2019\u201C\u201D]/g, ' ');
  result = result.replace(/[".,!?()\[\]{}:;_\-]+/g, ' ');
  result = result.replace(/\s+/g, ' ').trim();
  return result;
}

function tokenize(text: string): string[] {
  if (!text.trim()) return [];
  return text.split(' ').filter(Boolean);
}

function normalizePlural(token: string): string {
  if (token.length <= 2) return token;
  if (token.endsWith('ים') && token.length > 3) return token.slice(0, -2);
  if (token.endsWith('ות') && token.length > 3) return token.slice(0, -2);
  if (token.endsWith('ה') && token.length > 3) return token.slice(0, -1);
  if (token.endsWith('ات') && token.length > 3) return token.slice(0, -2);
  if (token.endsWith('ون') && token.length > 3) return token.slice(0, -2);
  if (token.endsWith('ين') && token.length > 3) return token.slice(0, -2);
  if (/^[\u0400-\u04FF]+$/.test(token) && token.length > 3) {
    if ('ыияа'.includes(token[token.length - 1])) return token.slice(0, -1);
  }
  if (token.endsWith('ዎች') && token.length > 4) return token.slice(0, -2);
  if (/^[a-z]+es$/.test(token) && token.length > 4) return token.slice(0, -2);
  if (/^[a-z]+s$/.test(token) && token.length > 3) return token.slice(0, -1);
  if (/^[a-z]+x$/.test(token) && token.length > 3) return token.slice(0, -1);
  return token;
}

// ─── Protected Phrases ───

interface PhraseMatch {
  phrase: string;
  canonicalId: string;
  tokensConsumed: string[];
}

const protectedPhrases: [string[], string][] = [
  [['חלב', 'ללא', 'לקטוז'], 'lactose_free_milk'],
  [['שוקולד', 'חלב'], 'chocolate_milk'],
  [['חלב', 'שקדים'], 'almond_milk'],
  [['חלב', 'קוקוס'], 'coconut_milk'],
  [['חלב', 'סויה'], 'soy_milk'],
  [['חלב', 'עיזים'], 'goat_milk'],
  [['חלב', 'שיבולת', 'שועל'], 'oat_milk'],
  [['נייר', 'טואלט'], 'toilet_paper'],
  [['משחת', 'שיניים'], 'toothpaste'],
  [['מברשת', 'שיניים'], 'toothbrush'],
  [['מגבונים', 'לחים'], 'wet_wipes'],
  [['סבון', 'כלים'], 'dish_soap'],
  [['סבון', 'ידיים'], 'hand_soap'],
  [['מרכך', 'כביסה'], 'fabric_softener'],
  [['אבקת', 'כביסה'], 'laundry_detergent'],
  [['נוזל', 'כביסה'], 'laundry_liquid'],
  [['שקיות', 'זבל'], 'trash_bags'],
  [['נייר', 'סופג'], 'paper_towels'],
  [['חמאת', 'בוטנים'], 'peanut_butter'],
  [['שמן', 'זית'], 'olive_oil'],
  [['שמן', 'קנולה'], 'canola_oil'],
  [['רסק', 'עגבניות'], 'tomato_paste'],
  [['קמח', 'מלא'], 'whole_wheat_flour'],
  [['אורז', 'מלא'], 'brown_rice'],
  [['לחם', 'מלא'], 'whole_wheat_bread'],
  [['גבינה', 'צהובה'], 'yellow_cheese'],
  [['גבינה', 'לבנה'], 'white_cheese'],
  [['גבינת', 'קוטג'], 'cottage_cheese'],
  [['שמנת', 'חמוצה'], 'sour_cream'],
  [['שמנת', 'מתוקה'], 'sweet_cream'],
  [['קרם', 'לגוף'], 'body_cream'],
  [['toilet', 'paper'], 'toilet_paper'],
  [['paper', 'towels'], 'paper_towels'],
  [['olive', 'oil'], 'olive_oil'],
  [['peanut', 'butter'], 'peanut_butter'],
  [['chocolate', 'milk'], 'chocolate_milk'],
  [['almond', 'milk'], 'almond_milk'],
  [['coconut', 'milk'], 'coconut_milk'],
  [['oat', 'milk'], 'oat_milk'],
  [['soy', 'milk'], 'soy_milk'],
  [['dish', 'soap'], 'dish_soap'],
  [['trash', 'bags'], 'trash_bags'],
  [['tomato', 'paste'], 'tomato_paste'],
  [['sour', 'cream'], 'sour_cream'],
  [['средство', 'для', 'посуды'], 'dish_soap'],
  [['шоколадное', 'молоко'], 'chocolate_milk'],
  [['миндальное', 'молоко'], 'almond_milk'],
  [['кокосовое', 'молоко'], 'coconut_milk'],
  [['соевое', 'молоко'], 'soy_milk'],
  [['овсяное', 'молоко'], 'oat_milk'],
  [['козье', 'молоко'], 'goat_milk'],
  [['туалетная', 'бумага'], 'toilet_paper'],
  [['бумажные', 'полотенца'], 'paper_towels'],
  [['оливковое', 'масло'], 'olive_oil'],
  [['арахисовая', 'паста'], 'peanut_butter'],
  [['томатная', 'паста'], 'tomato_paste'],
  [['зубная', 'паста'], 'toothpaste'],
  [['зубная', 'щетка'], 'toothbrush'],
  [['мусорные', 'пакеты'], 'trash_bags'],
  [['стиральный', 'порошок'], 'laundry_detergent'],
  [['влажные', 'салфетки'], 'wet_wipes'],
  [['желтый', 'сыр'], 'yellow_cheese'],
  [['белый', 'сыр'], 'white_cheese'],
  [['حليب', 'جوز', 'هند'], 'coconut_milk'],
  [['زبدة', 'فول', 'سوداني'], 'peanut_butter'],
  [['حليب', 'شوكولاتة'], 'chocolate_milk'],
  [['حليب', 'لوز'], 'almond_milk'],
  [['حليب', 'صويا'], 'soy_milk'],
  [['حليب', 'شوفان'], 'oat_milk'],
  [['حليب', 'ماعز'], 'goat_milk'],
  [['ورق', 'تواليت'], 'toilet_paper'],
  [['زيت', 'زيتون'], 'olive_oil'],
  [['معجون', 'طماطم'], 'tomato_paste'],
  [['معجون', 'اسنان'], 'toothpaste'],
  [['فرشاة', 'اسنان'], 'toothbrush'],
  [['صابون', 'جلي'], 'dish_soap'],
  [['اكياس', 'قمامة'], 'trash_bags'],
  [['مناشف', 'ورقية'], 'paper_towels'],
  [['مناديل', 'مبللة'], 'wet_wipes'],
  [['مسحوق', 'غسيل'], 'laundry_detergent'],
  [['جبنة', 'صفراء'], 'yellow_cheese'],
  [['جبنة', 'بيضاء'], 'white_cheese'],
  [['lait', 'chocolat'], 'chocolate_milk'],
  [['lait', 'amande'], 'almond_milk'],
  [['lait', 'coco'], 'coconut_milk'],
  [['lait', 'soja'], 'soy_milk'],
  [['lait', 'avoine'], 'oat_milk'],
  [['lait', 'chevre'], 'goat_milk'],
  [['papier', 'toilette'], 'toilet_paper'],
  [['huile', 'olive'], 'olive_oil'],
  [['beurre', 'cacahuete'], 'peanut_butter'],
  [['concentre', 'tomate'], 'tomato_paste'],
  [['essuie', 'tout'], 'paper_towels'],
  [['brosse', 'dents'], 'toothbrush'],
  [['liquide', 'vaisselle'], 'dish_soap'],
  [['sacs', 'poubelle'], 'trash_bags'],
  [['lingettes', 'humides'], 'wet_wipes'],
  [['lessive', 'liquide'], 'laundry_liquid'],
  [['fromage', 'blanc'], 'white_cheese'],
  [['creme', 'fraiche'], 'sour_cream'],
  [['leche', 'chocolate'], 'chocolate_milk'],
  [['leche', 'almendras'], 'almond_milk'],
  [['leche', 'coco'], 'coconut_milk'],
  [['leche', 'soja'], 'soy_milk'],
  [['leche', 'avena'], 'oat_milk'],
  [['leche', 'cabra'], 'goat_milk'],
  [['papel', 'higienico'], 'toilet_paper'],
  [['aceite', 'oliva'], 'olive_oil'],
  [['pasta', 'dientes'], 'toothpaste'],
  [['cepillo', 'dientes'], 'toothbrush'],
  [['jabon', 'platos'], 'dish_soap'],
  [['bolsas', 'basura'], 'trash_bags'],
  [['papel', 'cocina'], 'paper_towels'],
  [['toallitas', 'humedas'], 'wet_wipes'],
  [['queso', 'amarillo'], 'yellow_cheese'],
  [['queso', 'blanco'], 'white_cheese'],
  [['crema', 'agria'], 'sour_cream'],
  [['detergente', 'ropa'], 'laundry_detergent'],
  [['ዘይት', 'ወይራ'], 'olive_oil'],
  [['የጥርስ', 'ሳሙና'], 'toothpaste'],
  [['የጥርስ', 'ብሩሽ'], 'toothbrush'],
  [['ቸኮሌት', 'ወተት'], 'chocolate_milk'],
  [['የሽንት', 'ቤት', 'ወረቀት'], 'toilet_paper'],
];

function findPhraseMatch(tokens: string[]): PhraseMatch | null {
  if (!tokens.length) return null;
  for (const [phraseTokens, canonicalId] of protectedPhrases) {
    if (phraseTokens.length > tokens.length) continue;
    const remaining = [...tokens];
    let allFound = true;
    for (const pt of phraseTokens) {
      const idx = remaining.indexOf(pt);
      if (idx === -1) { allFound = false; break; }
      remaining.splice(idx, 1);
    }
    if (allFound) {
      return { phrase: phraseTokens.join(' '), canonicalId, tokensConsumed: phraseTokens };
    }
  }
  return null;
}

// ─── Product Signature ───

interface ProductSignature {
  normalizedText: string;
  baseProduct: string | null;
  matchedPhraseId: string | null;
  strongQualifiers: Set<string>;
  weakQualifiers: Set<string>;
  percentageQualifier: string | null;
  category: string | null;
  remainingTokens: string[];
}

const PERCENTAGE_PATTERN = /^\d+%$/;

const STRONG_QUALIFIERS = new Set([
  'שקדים', 'קוקוס', 'סויה', 'עיזים', 'ילדים',
  'ללא', 'לקטוז', 'גלוטן', 'סוכר',
  'אורגני', 'טבעוני', 'דל', 'מלא',
  'לבן', 'לבנה', 'צהוב', 'צהובה',
  'חמוצה', 'מתוקה',
  'מלוח', 'מתוק', 'חריף',
  'light', 'lite', 'diet', 'zero', 'organic', 'vegan',
  'whole', 'skim', 'low', 'free',
  'almond', 'coconut', 'soy', 'oat', 'goat',
  'lactose', 'gluten', 'sugar',
  'kids', 'children', 'baby',
  'миндальное', 'кокосовое', 'соевое', 'козье', 'овсяное',
  'без', 'лактозы', 'глютена',
  'органический', 'органическое', 'веганский',
  'белый', 'белая', 'желтый', 'желтая',
  'соленый', 'сладкий', 'острый',
  'детский', 'детское',
  'диетический', 'обезжиренный',
  'لوز', 'جوز', 'هند', 'صويا', 'شوفان', 'ماعز',
  'بدون', 'خالي',
  'عضوي', 'نباتي',
  'اصفر', 'ابيض',
  'مالح', 'حلو', 'حار',
  'اطفال', 'دايت', 'لايت',
  'amande', 'coco', 'soja', 'avoine', 'chevre',
  'sans',
  'bio', 'biologique', 'vegetal',
  'blanc', 'blanche', 'jaune',
  'sale', 'sucre', 'epice',
  'enfant', 'enfants', 'bebe',
  'allege', 'ecreme',
  'almendras', 'cabra',
  'sin',
  'organico', 'vegano',
  'amarillo', 'blanco', 'blanca',
  'salado', 'dulce', 'picante',
  'ninos', 'descremado',
  'ኦርጋኒክ', 'ቪጋን',
  'ያለ', 'ለልጆች',
  'ጨዋማ', 'ጣፋጭ',
]);

const WEAK_QUALIFIERS = new Set([
  'גדול', 'קטן', 'בינוני', 'ענק', 'מיני',
  'xl', 'xxl', 'xs',
  'רגיל', 'משפחתי', 'זוגי', 'אישי',
  'large', 'small', 'medium', 'big', 'mini', 'family', 'regular',
  'pack', 'box', 'bag', 'bottle', 'can',
  'большой', 'маленький', 'средний', 'семейный',
  'упаковка', 'пакет', 'бутылка', 'банка',
  'كبير', 'صغير', 'وسط', 'عائلي',
  'علبة', 'كيس', 'زجاجة',
  'grand', 'petit', 'moyen', 'familial',
  'paquet', 'bouteille', 'boite',
  'grande', 'pequeno', 'mediano', 'familiar',
  'paquete', 'botella', 'lata', 'caja',
  'ትልቅ', 'ትንሽ', 'መካከለኛ',
]);

const NOISE_TOKENS = new Set([
  'של', 'עם', 'או', 'גם', 'רק', 'טרי', 'טריים', 'טרייה',
  'מבצע', 'הנחה', 'חדש', 'חדשה',
  'the', 'a', 'an', 'of', 'with', 'and', 'or',
  'sale', 'promo', 'new',
  'и', 'или', 'с', 'для', 'тоже',
  'свежий', 'свежая', 'свежее',
  'акция', 'скидка', 'новый', 'новая',
  'و', 'او', 'مع', 'من', 'في',
  'طازج', 'طازجة',
  'عرض', 'تخفيض', 'جديد', 'جديدة',
  'de', 'du', 'des', 'le', 'la', 'les', 'l', 'd', 'au', 'aux', 'un', 'une',
  'frais', 'fraiche',
  'promotion', 'nouveau', 'nouvelle',
  'del', 'el', 'los', 'las', 'con',
  'fresco', 'fresca',
  'oferta', 'descuento', 'nuevo', 'nueva',
  'እና', 'ወይም', 'ከ', 'ለ', 'በ',
  'ትኩስ', 'አዲስ',
]);

const BASE_PRODUCT_SYNONYMS: Record<string, string> = {
  'חלב': 'milk', 'milk': 'milk',
  'יוגורט': 'yogurt', 'yogurt': 'yogurt',
  'שמנת': 'cream', 'cream': 'cream',
  'גבינה': 'cheese', 'גבינת': 'cheese', 'cheese': 'cheese',
  'חמאה': 'butter', 'butter': 'butter', 'חמאת': 'butter',
  'ביצים': 'eggs', 'ביצה': 'eggs', 'eggs': 'eggs', 'egg': 'eggs',
  'לחם': 'bread', 'bread': 'bread',
  'פיתה': 'pita', 'פיתות': 'pita', 'pita': 'pita',
  'חלה': 'challah', 'challah': 'challah',
  'לחמניה': 'bun', 'לחמניות': 'bun', 'bun': 'bun', 'buns': 'bun',
  'קמח': 'flour', 'flour': 'flour',
  'תפוח': 'apple', 'תפוחים': 'apple', 'apple': 'apple', 'apples': 'apple',
  'בננה': 'banana', 'בננות': 'banana', 'banana': 'banana', 'bananas': 'banana',
  'עגבניה': 'tomato', 'עגבניות': 'tomato', 'tomato': 'tomato', 'tomatoes': 'tomato',
  'מלפפון': 'cucumber', 'מלפפונים': 'cucumber', 'cucumber': 'cucumber',
  'בצל': 'onion', 'onion': 'onion', 'onions': 'onion',
  'תפוז': 'orange', 'תפוזים': 'orange', 'orange': 'orange', 'oranges': 'orange',
  'לימון': 'lemon', 'לימונים': 'lemon', 'lemon': 'lemon',
  'אבוקדו': 'avocado', 'avocado': 'avocado',
  'עוף': 'chicken', 'chicken': 'chicken',
  'בשר': 'meat', 'meat': 'meat',
  'דג': 'fish', 'דגים': 'fish', 'fish': 'fish',
  'שניצל': 'schnitzel', 'schnitzel': 'schnitzel',
  'נקניק': 'sausage', 'נקניקיות': 'sausage', 'sausage': 'sausage',
  'אורז': 'rice', 'rice': 'rice',
  'פסטה': 'pasta', 'pasta': 'pasta',
  'שמן': 'oil', 'oil': 'oil',
  'סוכר': 'sugar_product', 'sugar': 'sugar_product',
  'מלח': 'salt', 'salt': 'salt',
  'רסק': 'paste', 'paste': 'paste',
  'קטשופ': 'ketchup', 'ketchup': 'ketchup',
  'חומוס': 'hummus', 'hummus': 'hummus',
  'טחינה': 'tahini', 'tahini': 'tahini',
  'מים': 'water', 'water': 'water',
  'קולה': 'cola', 'cola': 'cola',
  'מיץ': 'juice', 'juice': 'juice',
  'בירה': 'beer', 'beer': 'beer',
  'יין': 'wine', 'wine': 'wine',
  'קפה': 'coffee', 'coffee': 'coffee',
  'תה': 'tea', 'tea': 'tea',
  'אקונומיקה': 'bleach', 'bleach': 'bleach',
  'סבון': 'soap', 'soap': 'soap',
  'שמפו': 'shampoo', 'shampoo': 'shampoo',
  'מרכך': 'conditioner', 'conditioner': 'conditioner',
  'במבה': 'bamba', 'bamba': 'bamba',
  'ביסלי': 'bisli', 'bisli': 'bisli',
  'שוקולד': 'chocolate', 'chocolate': 'chocolate',
  'עוגיות': 'cookies', 'עוגיה': 'cookies', 'cookies': 'cookies',
  'חטיף': 'snack_bar', 'חטיפים': 'snack_bar',
  'אקמול': 'acamol', 'acamol': 'acamol',
  'אדוויל': 'advil', 'advil': 'advil',
  'נייר': 'paper', 'paper': 'paper',
  'טואלט': 'toilet', 'toilet': 'toilet',
  // Russian
  'молоко': 'milk', 'йогурт': 'yogurt', 'сливки': 'cream', 'сыр': 'cheese',
  'масло': 'butter', 'яйца': 'eggs', 'яйцо': 'eggs', 'хлеб': 'bread',
  'мука': 'flour', 'яблоко': 'apple', 'яблоки': 'apple', 'банан': 'banana',
  'бананы': 'banana', 'помидор': 'tomato', 'помидоры': 'tomato',
  'огурец': 'cucumber', 'огурцы': 'cucumber', 'лук': 'onion',
  'апельсин': 'orange', 'лимон': 'lemon', 'авокадо': 'avocado',
  'курица': 'chicken', 'мясо': 'meat', 'рыба': 'fish',
  'рис': 'rice', 'макароны': 'pasta', 'паста': 'pasta',
  'сахар': 'sugar_product', 'соль': 'salt', 'кетчуп': 'ketchup',
  'хумус': 'hummus', 'вода': 'water', 'кола': 'cola',
  'сок': 'juice', 'пиво': 'beer', 'вино': 'wine',
  'кофе': 'coffee', 'чай': 'tea', 'мыло': 'soap',
  'шампунь': 'shampoo', 'шоколад': 'chocolate', 'печенье': 'cookies',
  'сметана': 'sour_cream', 'бумага': 'paper',
  // Arabic
  'حليب': 'milk', 'لبن': 'yogurt', 'زبادي': 'yogurt', 'قشطة': 'cream',
  'جبنة': 'cheese', 'جبن': 'cheese', 'زبدة': 'butter', 'بيض': 'eggs',
  'خبز': 'bread', 'طحين': 'flour', 'دقيق': 'flour',
  'تفاح': 'apple', 'موز': 'banana', 'طماطم': 'tomato', 'بندورة': 'tomato',
  'خيار': 'cucumber', 'بصل': 'onion', 'برتقال': 'orange', 'ليمون': 'lemon',
  'افوكادو': 'avocado', 'دجاج': 'chicken', 'لحم': 'meat', 'سمك': 'fish',
  'ارز': 'rice', 'معكرونة': 'pasta', 'سكر': 'sugar_product', 'ملح': 'salt',
  'كاتشب': 'ketchup', 'حمص': 'hummus', 'طحينة': 'tahini',
  'ماء': 'water', 'مياه': 'water', 'ميه': 'water',
  'كولا': 'cola', 'عصير': 'juice', 'بيرة': 'beer',
  'قهوة': 'coffee', 'شاي': 'tea', 'صابون': 'soap',
  'شامبو': 'shampoo', 'شوكولاتة': 'chocolate', 'شوكولا': 'chocolate',
  'بسكويت': 'cookies', 'ورق': 'paper',
  // French
  'lait': 'milk', 'yaourt': 'yogurt', 'yogourt': 'yogurt', 'fromage': 'cheese',
  'beurre': 'butter', 'oeufs': 'eggs', 'oeuf': 'eggs', 'pain': 'bread',
  'farine': 'flour', 'pomme': 'apple', 'pommes': 'apple', 'banane': 'banana',
  'tomate': 'tomato', 'concombre': 'cucumber', 'oignon': 'onion', 'citron': 'lemon',
  'avocat': 'avocado', 'poulet': 'chicken', 'viande': 'meat', 'poisson': 'fish',
  'riz': 'rice', 'pates': 'pasta', 'sel': 'salt', 'eau': 'water',
  'jus': 'juice', 'biere': 'beer', 'vin': 'wine', 'cafe': 'coffee',
  'savon': 'soap', 'shampooing': 'shampoo', 'shampoing': 'shampoo',
  'chocolat': 'chocolate', 'biscuits': 'cookies', 'biscuit': 'cookies', 'papier': 'paper',
  // Spanish
  'leche': 'milk', 'yogur': 'yogurt', 'queso': 'cheese',
  'mantequilla': 'butter', 'huevos': 'eggs', 'huevo': 'eggs', 'pan': 'bread',
  'harina': 'flour', 'manzana': 'apple', 'manzanas': 'apple', 'platano': 'banana',
  'pepino': 'cucumber', 'cebolla': 'onion', 'naranja': 'orange', 'limon': 'lemon',
  'aguacate': 'avocado', 'pollo': 'chicken', 'carne': 'meat', 'pescado': 'fish',
  'arroz': 'rice', 'azucar': 'sugar_product', 'agua': 'water',
  'jugo': 'juice', 'zumo': 'juice', 'cerveza': 'beer', 'vino': 'wine',
  'te': 'tea', 'jabon': 'soap', 'champu': 'shampoo',
  'galletas': 'cookies', 'galleta': 'cookies', 'papel': 'paper',
  // Amharic
  'ወተት': 'milk', 'እርጎ': 'yogurt', 'ቅቤ': 'butter', 'አይብ': 'cheese',
  'እንቁላል': 'eggs', 'ዳቦ': 'bread', 'ዱቄት': 'flour', 'ፖም': 'apple',
  'ሙዝ': 'banana', 'ቲማቲም': 'tomato', 'ሽንኩርት': 'onion', 'ሎሚ': 'lemon',
  'አቮካዶ': 'avocado', 'ዶሮ': 'chicken', 'ስጋ': 'meat', 'ዓሳ': 'fish',
  'ሩዝ': 'rice', 'ስኳር': 'sugar_product', 'ጨው': 'salt', 'ውሃ': 'water',
  'ቡና': 'coffee', 'ሻይ': 'tea', 'ሳሙና': 'soap', 'ሻምፑ': 'shampoo',
  'ቸኮሌት': 'chocolate', 'ጭማቂ': 'juice', 'ቢራ': 'beer', 'ወይን': 'wine',
  'ዘይት': 'oil', 'ወረቀት': 'paper',
};

function extractSignature(rawName: string, category?: string | null): ProductSignature {
  const normalizedText = normalize(rawName);
  const tokens = tokenize(normalizedText);
  if (!tokens.length) {
    return { normalizedText, baseProduct: null, matchedPhraseId: null, strongQualifiers: new Set(), weakQualifiers: new Set(), percentageQualifier: null, category: category ?? null, remainingTokens: [] };
  }

  const phraseMatch = findPhraseMatch(tokens);
  const percentageQualifier = tokens.find((t) => PERCENTAGE_PATTERN.test(t)) ?? null;

  const consumedTokens = new Set<string>();
  phraseMatch?.tokensConsumed.forEach((t) => consumedTokens.add(t));
  if (percentageQualifier) consumedTokens.add(percentageQualifier);

  const remainingTokens = tokens.filter((t) => !consumedTokens.has(t));
  const strongQualifiers = new Set<string>();
  const weakQualifiers = new Set<string>();
  const unclassified: string[] = [];

  for (const token of remainingTokens) {
    if (STRONG_QUALIFIERS.has(token)) strongQualifiers.add(token);
    else if (WEAK_QUALIFIERS.has(token)) weakQualifiers.add(token);
    else if (!NOISE_TOKENS.has(token)) unclassified.push(token);
  }

  let baseProduct: string | null = null;
  if (phraseMatch) {
    baseProduct = phraseMatch.canonicalId;
  } else {
    for (const token of tokens) {
      if (consumedTokens.has(token)) continue;
      const id = BASE_PRODUCT_SYNONYMS[token] ?? BASE_PRODUCT_SYNONYMS[normalizePlural(token)];
      if (id) { baseProduct = id; break; }
    }
  }

  if (baseProduct && !phraseMatch) {
    for (const token of tokens) {
      if (consumedTokens.has(token)) continue;
      if (BASE_PRODUCT_SYNONYMS[token] || BASE_PRODUCT_SYNONYMS[normalizePlural(token)]) {
        const idx = unclassified.indexOf(token);
        if (idx >= 0) unclassified.splice(idx, 1);
        break;
      }
    }
  }

  unclassified.forEach((t) => strongQualifiers.add(t));

  return {
    normalizedText,
    baseProduct,
    matchedPhraseId: phraseMatch?.canonicalId ?? null,
    strongQualifiers,
    weakQualifiers,
    percentageQualifier,
    category: category ?? null,
    remainingTokens: unclassified,
  };
}

// ─── Comparison Engine ───

const SCORE_EXACT_TEXT = 100;
const SCORE_SAME_PHRASE = 60;
const SCORE_SAME_BASE_PRODUCT = 50;
const SCORE_SAME_PERCENTAGE = 15;
const SCORE_CONFLICTING_PERCENTAGE = 5;
const SCORE_PER_COMMON_STRONG = 10;
const SCORE_PER_CONFLICTING_STRONG = 20;
const SCORE_PER_COMMON_WEAK = 3;
const SCORE_SAME_CATEGORY = 5;
const SCORE_PLURAL_MATCH_BONUS = 30;
const SCORE_MAX_TOKEN_OVERLAP = 45;
const SCORE_MIN_TOKEN_OVERLAP = 15;
const THRESHOLD_EXACT = 75;
const THRESHOLD_POSSIBLE = 45;
const THRESHOLD_SIMILAR = 25;

function setIntersection<T>(a: Set<T>, b: Set<T>): Set<T> {
  const result = new Set<T>();
  for (const v of a) if (b.has(v)) result.add(v);
  return result;
}

function compareSignatures(draft: ProductSignature, existing: ProductSignature): { score: number; reason: DuplicateReason | null } {
  if (!draft.normalizedText || !existing.normalizedText) return { score: 0, reason: null };

  if (draft.normalizedText === existing.normalizedText) {
    return { score: SCORE_EXACT_TEXT, reason: 'EXACT_DUPLICATE' };
  }

  let score = 0;

  if (draft.matchedPhraseId && existing.matchedPhraseId) {
    if (draft.matchedPhraseId === existing.matchedPhraseId) {
      score += SCORE_SAME_PHRASE;
    } else {
      return { score: 0, reason: null };
    }
  } else if (draft.matchedPhraseId && !existing.matchedPhraseId) {
    return { score: 0, reason: null };
  } else if (!draft.matchedPhraseId && existing.matchedPhraseId) {
    return { score: 0, reason: null };
  }

  if (draft.baseProduct && existing.baseProduct) {
    if (draft.baseProduct === existing.baseProduct) {
      score += SCORE_SAME_BASE_PRODUCT;
    } else {
      return { score: 0, reason: null };
    }
  } else if (!draft.baseProduct && !existing.baseProduct) {
    score += computeTokenOverlap(draft, existing);
  } else {
    const overlap = computeTokenOverlap(draft, existing);
    score += overlap;
    if (score < SCORE_MIN_TOKEN_OVERLAP) return { score: 0, reason: null };
  }

  if (draft.percentageQualifier || existing.percentageQualifier) {
    if (draft.percentageQualifier === existing.percentageQualifier) {
      score += SCORE_SAME_PERCENTAGE;
    } else if (draft.percentageQualifier && existing.percentageQualifier) {
      score -= SCORE_CONFLICTING_PERCENTAGE;
    }
  }

  const commonStrong = setIntersection(draft.strongQualifiers, existing.strongQualifiers);
  const draftOnly = new Set([...draft.strongQualifiers].filter((x) => !existing.strongQualifiers.has(x)));
  const existingOnly = new Set([...existing.strongQualifiers].filter((x) => !draft.strongQualifiers.has(x)));
  score += commonStrong.size * SCORE_PER_COMMON_STRONG;
  score -= (draftOnly.size + existingOnly.size) * SCORE_PER_CONFLICTING_STRONG;

  const commonWeak = setIntersection(draft.weakQualifiers, existing.weakQualifiers);
  score += commonWeak.size * SCORE_PER_COMMON_WEAK;

  if (draft.category && existing.category && draft.category === existing.category) {
    score += SCORE_SAME_CATEGORY;
  }

  const draftTokens = tokenize(draft.normalizedText);
  const existingTokens = tokenize(existing.normalizedText);
  if (draftTokens.length === 1 && existingTokens.length === 1) {
    const dn = normalizePlural(draftTokens[0]);
    const en = normalizePlural(existingTokens[0]);
    if (dn === en && dn !== draftTokens[0]) {
      score += SCORE_PLURAL_MATCH_BONUS;
    }
  }

  let reason: DuplicateReason | null = null;
  if (score >= THRESHOLD_EXACT) reason = 'EXACT_DUPLICATE';
  else if (score >= THRESHOLD_POSSIBLE) reason = 'POSSIBLE_DUPLICATE';
  else if (score >= THRESHOLD_SIMILAR) reason = 'SIMILAR_ITEM';

  return { score, reason };
}

function computeTokenOverlap(a: ProductSignature, b: ProductSignature): number {
  const aTokens = new Set(tokenize(a.normalizedText).map(normalizePlural));
  const bTokens = new Set(tokenize(b.normalizedText).map(normalizePlural));
  if (!aTokens.size || !bTokens.size) return 0;
  const intersection = setIntersection(aTokens, bTokens).size;
  const union = new Set([...aTokens, ...bTokens]).size;
  if (!union) return 0;
  return (intersection / union) * SCORE_MAX_TOKEN_OVERLAP;
}

// ─── Public API ───

export function findDuplicate(
  draftName: string,
  existingItems: ShoppingItem[],
  excludeItemId?: string
): DuplicateMatch | null {
  const normalizedDraft = normalize(draftName);
  if (!normalizedDraft || normalizedDraft.length < 2) return null;

  const draftSig = extractSignature(draftName);
  let bestMatch: DuplicateMatch | null = null;
  let bestScore = 0;

  for (const item of existingItems) {
    if (item.id === excludeItemId) continue;
    const itemSig = extractSignature(item.name, item.category);
    const result = compareSignatures(draftSig, itemSig);
    if (result.reason && result.score > bestScore) {
      bestScore = result.score;
      bestMatch = {
        item,
        reason: result.reason,
        score: result.score,
        suggestedQuantity: item.quantity + 1,
      };
    }
  }

  return bestMatch;
}
