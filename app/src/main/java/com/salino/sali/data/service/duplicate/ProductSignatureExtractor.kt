package com.salino.sali.data.service.duplicate

import javax.inject.Inject

/**
 * Extracts a ProductSignature from a normalized item name.
 * Uses protected phrases, a base-product dictionary, and qualifier classification.
 */
class ProductSignatureExtractor @Inject constructor(
    private val normalizer: ItemTextNormalizer,
    private val phraseMatcher: ProtectedPhraseMatcher
) {

    fun extract(rawName: String, category: String? = null): ProductSignature {
        val normalizedText = normalizer.normalize(rawName)
        val tokens = normalizer.tokenize(normalizedText)
        if (tokens.isEmpty()) {
            return ProductSignature(normalizedText, null, null, emptySet(), emptySet(), null, category, emptyList())
        }

        // 1. Check for protected phrase
        val phraseMatch = phraseMatcher.findMatch(tokens)

        // 2. Identify percentage qualifier
        val percentageQualifier = tokens.firstOrNull { PERCENTAGE_PATTERN.matches(it) }

        // 3. Build remaining tokens (excluding phrase tokens and percentage)
        val consumedTokens = buildSet {
            phraseMatch?.tokensConsumed?.forEach { add(it) }
            percentageQualifier?.let { add(it) }
        }
        val remainingTokens = tokens.filter { it !in consumedTokens }

        // 4. Classify remaining tokens into qualifiers
        val strongQualifiers = mutableSetOf<String>()
        val weakQualifiers = mutableSetOf<String>()
        val unclassified = mutableListOf<String>()

        for (token in remainingTokens) {
            when {
                token in STRONG_QUALIFIERS -> strongQualifiers.add(token)
                token in WEAK_QUALIFIERS -> weakQualifiers.add(token)
                token in NOISE_TOKENS -> { /* skip */ }
                else -> unclassified.add(token)
            }
        }

        // 5. Determine base product
        val baseProduct = when {
            phraseMatch != null -> phraseMatch.canonicalId
            else -> resolveBaseProduct(tokens, consumedTokens)
        }

        // If the base product token was used, remove from unclassified
        if (baseProduct != null && phraseMatch == null) {
            val baseSynonym = findBaseSynonymToken(tokens, consumedTokens)
            if (baseSynonym != null) {
                unclassified.remove(baseSynonym)
            }
        }

        // Any unclassified tokens that aren't the base product become strong qualifiers
        // (unknown words like brand names may change product identity)
        strongQualifiers.addAll(unclassified)

        return ProductSignature(
            normalizedText = normalizedText,
            baseProduct = baseProduct,
            matchedPhraseId = phraseMatch?.canonicalId,
            strongQualifiers = strongQualifiers,
            weakQualifiers = weakQualifiers,
            percentageQualifier = percentageQualifier,
            category = category,
            remainingTokens = unclassified
        )
    }

    /**
     * Resolve base product from tokens using the synonym dictionary.
     */
    private fun resolveBaseProduct(tokens: List<String>, consumed: Set<String>): String? {
        for (token in tokens) {
            if (token in consumed) continue
            val normalized = normalizer.normalizePlural(token)
            val id = BASE_PRODUCT_SYNONYMS[token] ?: BASE_PRODUCT_SYNONYMS[normalized]
            if (id != null) return id
        }
        return null
    }

    private fun findBaseSynonymToken(tokens: List<String>, consumed: Set<String>): String? {
        for (token in tokens) {
            if (token in consumed) continue
            val normalized = normalizer.normalizePlural(token)
            if (token in BASE_PRODUCT_SYNONYMS || normalized in BASE_PRODUCT_SYNONYMS) return token
        }
        return null
    }

    companion object {
        private val PERCENTAGE_PATTERN = Regex("\\d+%")

        /**
         * Strong qualifiers fundamentally change what the product is.
         */
        private val STRONG_QUALIFIERS = setOf(
            // Hebrew
            "שקדים", "קוקוס", "סויה", "עיזים", "ילדים",
            "ללא", "לקטוז", "גלוטן", "סוכר",
            "אורגני", "טבעוני", "דל", "מלא",
            "לבן", "לבנה", "צהוב", "צהובה",
            "חמוצה", "מתוקה",
            "מלוח", "מתוק", "חריף",
            "light", "lite", "diet", "zero", "organic", "vegan",
            "whole", "skim", "low", "free",
            // English
            "almond", "coconut", "soy", "oat", "goat",
            "lactose", "gluten", "sugar",
            "kids", "children", "baby",
            // Russian
            "миндальное", "кокосовое", "соевое", "козье", "овсяное",
            "без", "лактозы", "глютена",
            "органический", "органическое", "веганский",
            "белый", "белая", "желтый", "желтая",
            "соленый", "сладкий", "острый",
            "детский", "детское",
            "диетический", "обезжиренный",
            // Arabic (normalized — hamza removed from alef)
            "لوز", "جوز", "هند", "صويا", "شوفان", "ماعز",
            "بدون", "خالي",
            "عضوي", "نباتي",
            "اصفر", "ابيض",
            "مالح", "حلو", "حار",
            "اطفال",
            "دايت", "لايت",
            // French (accents removed by NFD)
            "amande", "coco", "soja", "avoine", "chevre",
            "sans",
            "bio", "biologique", "vegetal",
            "blanc", "blanche", "jaune",
            "sale", "sucre", "epice",
            "enfant", "enfants", "bebe",
            "allege", "ecreme",
            // Spanish (accents removed by NFD)
            "almendras", "cabra",
            "sin",
            "organico", "vegano",
            "amarillo", "blanco", "blanca",
            "salado", "dulce", "picante",
            "ninos", "descremado",
            // Amharic
            "ኦርጋኒክ", "ቪጋን",
            "ያለ", "ለልጆች",
            "ጨዋማ", "ጣፋጭ",
        )

        /**
         * Weak qualifiers: size, brand hints, packaging — don't change what the product IS.
         */
        private val WEAK_QUALIFIERS = setOf(
            // Hebrew
            "גדול", "קטן", "בינוני", "ענק", "מיני",
            "xl", "xxl", "xs",
            "רגיל", "משפחתי", "זוגי", "אישי",
            // English
            "large", "small", "medium", "big", "mini", "family", "regular",
            "pack", "box", "bag", "bottle", "can",
            // Russian
            "большой", "маленький", "средний", "семейный",
            "упаковка", "пакет", "бутылка", "банка",
            // Arabic
            "كبير", "صغير", "وسط", "عائلي",
            "علبة", "كيس", "زجاجة",
            // French
            "grand", "petit", "moyen", "familial",
            "paquet", "bouteille", "boite",
            // Spanish
            "grande", "pequeno", "mediano", "familiar",
            "paquete", "botella", "lata", "caja",
            // Amharic
            "ትልቅ", "ትንሽ", "መካከለኛ",
        )

        /**
         * Noise tokens that should be ignored in comparison.
         */
        private val NOISE_TOKENS = setOf(
            // Hebrew
            "של", "עם", "או", "גם", "רק", "טרי", "טריים", "טרייה",
            "מבצע", "הנחה", "חדש", "חדשה",
            // English
            "the", "a", "an", "of", "with", "and", "or",
            "sale", "promo", "new",
            // Russian
            "и", "или", "с", "для", "тоже",
            "свежий", "свежая", "свежее",
            "акция", "скидка", "новый", "новая",
            // Arabic
            "و", "او", "مع", "من", "في",
            "طازج", "طازجة",
            "عرض", "تخفيض", "جديد", "جديدة",
            // French
            "de", "du", "des", "le", "la", "les", "l", "d", "au", "aux", "un", "une",
            "frais", "fraiche",
            "promotion", "nouveau", "nouvelle",
            // Spanish
            "del", "el", "los", "las", "una", "con",
            "fresco", "fresca",
            "oferta", "descuento", "nuevo", "nueva",
            // Amharic
            "እና", "ወይም", "ከ", "ለ", "በ",
            "ትኩስ", "አዲስ",
        )

        /**
         * Maps individual tokens (and their plural-normalized forms) to canonical base product IDs.
         */
        private val BASE_PRODUCT_SYNONYMS: Map<String, String> = buildMap {
            // Dairy
            putAll("חלב" to "milk", "milk" to "milk")
            putAll("יוגורט" to "yogurt", "yogurt" to "yogurt")
            putAll("שמנת" to "cream", "cream" to "cream")
            putAll("גבינה" to "cheese", "גבינת" to "cheese", "cheese" to "cheese")
            putAll("חמאה" to "butter", "butter" to "butter", "חמאת" to "butter")
            putAll("ביצים" to "eggs", "ביצה" to "eggs", "eggs" to "eggs", "egg" to "eggs")
            // Bakery
            putAll("לחם" to "bread", "bread" to "bread")
            putAll("פיתה" to "pita", "פיתות" to "pita", "pita" to "pita")
            putAll("חלה" to "challah", "challah" to "challah")
            putAll("לחמניה" to "bun", "לחמניות" to "bun", "bun" to "bun", "buns" to "bun")
            putAll("קמח" to "flour", "flour" to "flour")
            // Fruits & Vegetables
            putAll("תפוח" to "apple", "תפוחים" to "apple", "apple" to "apple", "apples" to "apple")
            putAll("בננה" to "banana", "בננות" to "banana", "banana" to "banana", "bananas" to "banana")
            putAll("עגבניה" to "tomato", "עגבניות" to "tomato", "tomato" to "tomato", "tomatoes" to "tomato")
            putAll("מלפפון" to "cucumber", "מלפפונים" to "cucumber", "cucumber" to "cucumber")
            putAll("בצל" to "onion", "onion" to "onion", "onions" to "onion")
            putAll("תפוז" to "orange", "תפוזים" to "orange", "orange" to "orange", "oranges" to "orange")
            putAll("לימון" to "lemon", "לימונים" to "lemon", "lemon" to "lemon")
            putAll("אבוקדו" to "avocado", "avocado" to "avocado")
            // Meat & Fish
            putAll("עוף" to "chicken", "chicken" to "chicken")
            putAll("בשר" to "meat", "meat" to "meat")
            putAll("דג" to "fish", "דגים" to "fish", "fish" to "fish")
            putAll("שניצל" to "schnitzel", "schnitzel" to "schnitzel")
            putAll("נקניק" to "sausage", "נקניקיות" to "sausage", "sausage" to "sausage")
            // Pantry
            putAll("אורז" to "rice", "rice" to "rice")
            putAll("פסטה" to "pasta", "pasta" to "pasta")
            putAll("שמן" to "oil", "oil" to "oil")
            putAll("סוכר" to "sugar_product", "sugar" to "sugar_product")
            putAll("מלח" to "salt", "salt" to "salt")
            putAll("רסק" to "paste", "paste" to "paste")
            putAll("קטשופ" to "ketchup", "ketchup" to "ketchup")
            putAll("חומוס" to "hummus", "hummus" to "hummus")
            putAll("טחינה" to "tahini", "tahini" to "tahini")
            // Beverages
            putAll("מים" to "water", "water" to "water")
            putAll("קולה" to "cola", "cola" to "cola")
            putAll("מיץ" to "juice", "juice" to "juice")
            putAll("בירה" to "beer", "beer" to "beer")
            putAll("יין" to "wine", "wine" to "wine")
            putAll("קפה" to "coffee", "coffee" to "coffee")
            putAll("תה" to "tea", "tea" to "tea")
            // Cleaning
            putAll("אקונומיקה" to "bleach", "bleach" to "bleach")
            putAll("סבון" to "soap", "soap" to "soap")
            putAll("שמפו" to "shampoo", "shampoo" to "shampoo")
            putAll("מרכך" to "conditioner", "conditioner" to "conditioner")
            // Snacks
            putAll("במבה" to "bamba", "bamba" to "bamba")
            putAll("ביסלי" to "bisli", "bisli" to "bisli")
            putAll("שוקולד" to "chocolate", "chocolate" to "chocolate")
            putAll("עוגיות" to "cookies", "עוגיה" to "cookies", "cookies" to "cookies")
            putAll("חטיף" to "snack_bar", "חטיפים" to "snack_bar")
            // Pharmacy
            putAll("אקמול" to "acamol", "acamol" to "acamol")
            putAll("אדוויל" to "advil", "advil" to "advil")
            // Household items
            putAll("נייר" to "paper", "paper" to "paper")
            putAll("טואלט" to "toilet", "toilet" to "toilet")

            // ── Russian (Русский) ──
            putAll("молоко" to "milk")
            putAll("йогурт" to "yogurt")
            putAll("сливки" to "cream")
            putAll("сыр" to "cheese")
            putAll("масло" to "butter")
            putAll("яйца" to "eggs", "яйцо" to "eggs")
            putAll("хлеб" to "bread")
            putAll("мука" to "flour")
            putAll("яблоко" to "apple", "яблоки" to "apple")
            putAll("банан" to "banana", "бананы" to "banana")
            putAll("помидор" to "tomato", "помидоры" to "tomato")
            putAll("огурец" to "cucumber", "огурцы" to "cucumber")
            putAll("лук" to "onion")
            putAll("апельсин" to "orange")
            putAll("лимон" to "lemon")
            putAll("авокадо" to "avocado")
            putAll("курица" to "chicken")
            putAll("мясо" to "meat")
            putAll("рыба" to "fish")
            putAll("рис" to "rice")
            putAll("макароны" to "pasta", "паста" to "pasta")
            putAll("сахар" to "sugar_product")
            putAll("соль" to "salt")
            putAll("кетчуп" to "ketchup")
            putAll("хумус" to "hummus")
            putAll("вода" to "water")
            putAll("кола" to "cola")
            putAll("сок" to "juice")
            putAll("пиво" to "beer")
            putAll("вино" to "wine")
            putAll("кофе" to "coffee")
            putAll("чай" to "tea")
            putAll("мыло" to "soap")
            putAll("шампунь" to "shampoo")
            putAll("шоколад" to "chocolate")
            putAll("печенье" to "cookies")
            putAll("сметана" to "sour_cream")
            putAll("бумага" to "paper")

            // ── Arabic (العربية) — normalized forms ──
            putAll("حليب" to "milk")
            putAll("لبن" to "yogurt", "زبادي" to "yogurt")
            putAll("قشطة" to "cream")
            putAll("جبنة" to "cheese", "جبن" to "cheese")
            putAll("زبدة" to "butter")
            putAll("بيض" to "eggs")
            putAll("خبز" to "bread")
            putAll("طحين" to "flour", "دقيق" to "flour")
            putAll("تفاح" to "apple")
            putAll("موز" to "banana")
            putAll("طماطم" to "tomato", "بندورة" to "tomato")
            putAll("خيار" to "cucumber")
            putAll("بصل" to "onion")
            putAll("برتقال" to "orange")
            putAll("ليمون" to "lemon")
            putAll("افوكادو" to "avocado")
            putAll("دجاج" to "chicken")
            putAll("لحم" to "meat")
            putAll("سمك" to "fish")
            putAll("ارز" to "rice")
            putAll("معكرونة" to "pasta")
            putAll("سكر" to "sugar_product")
            putAll("ملح" to "salt")
            putAll("كاتشب" to "ketchup")
            putAll("حمص" to "hummus")
            putAll("طحينة" to "tahini")
            putAll("ماء" to "water", "مياه" to "water", "ميه" to "water")
            putAll("كولا" to "cola")
            putAll("عصير" to "juice")
            putAll("بيرة" to "beer")
            putAll("قهوة" to "coffee")
            putAll("شاي" to "tea")
            putAll("صابون" to "soap")
            putAll("شامبو" to "shampoo")
            putAll("شوكولاتة" to "chocolate", "شوكولا" to "chocolate")
            putAll("بسكويت" to "cookies")
            putAll("ورق" to "paper")

            // ── French (Français) — accents removed by NFD normalization ──
            putAll("lait" to "milk")
            putAll("yaourt" to "yogurt", "yogourt" to "yogurt")
            putAll("creme" to "cream")
            putAll("fromage" to "cheese")
            putAll("beurre" to "butter")
            putAll("oeufs" to "eggs", "oeuf" to "eggs", "œufs" to "eggs", "œuf" to "eggs")
            putAll("pain" to "bread")
            putAll("farine" to "flour")
            putAll("pomme" to "apple", "pommes" to "apple")
            putAll("banane" to "banana")
            putAll("tomate" to "tomato")
            putAll("concombre" to "cucumber")
            putAll("oignon" to "onion")
            putAll("citron" to "lemon")
            putAll("avocat" to "avocado")
            putAll("poulet" to "chicken")
            putAll("viande" to "meat")
            putAll("poisson" to "fish")
            putAll("riz" to "rice")
            putAll("pates" to "pasta")
            putAll("sel" to "salt")
            putAll("eau" to "water")
            putAll("jus" to "juice")
            putAll("biere" to "beer")
            putAll("vin" to "wine")
            putAll("cafe" to "coffee")
            putAll("savon" to "soap")
            putAll("shampooing" to "shampoo", "shampoing" to "shampoo")
            putAll("chocolat" to "chocolate")
            putAll("biscuits" to "cookies", "biscuit" to "cookies")
            putAll("papier" to "paper")

            // ── Spanish (Español) — accents removed by NFD normalization ──
            putAll("leche" to "milk")
            putAll("yogur" to "yogurt")
            putAll("crema" to "cream")
            putAll("queso" to "cheese")
            putAll("mantequilla" to "butter")
            putAll("huevos" to "eggs", "huevo" to "eggs")
            putAll("pan" to "bread")
            putAll("harina" to "flour")
            putAll("manzana" to "apple", "manzanas" to "apple")
            putAll("platano" to "banana")
            putAll("pepino" to "cucumber")
            putAll("cebolla" to "onion")
            putAll("naranja" to "orange")
            putAll("limon" to "lemon")
            putAll("aguacate" to "avocado")
            putAll("pollo" to "chicken")
            putAll("carne" to "meat")
            putAll("pescado" to "fish")
            putAll("arroz" to "rice")
            putAll("azucar" to "sugar_product")
            putAll("sal" to "salt")
            putAll("agua" to "water")
            putAll("jugo" to "juice", "zumo" to "juice")
            putAll("cerveza" to "beer")
            putAll("vino" to "wine")
            putAll("te" to "tea")
            putAll("jabon" to "soap")
            putAll("champu" to "shampoo")
            putAll("galletas" to "cookies", "galleta" to "cookies")
            putAll("papel" to "paper")

            // ── Amharic (አማርኛ) ──
            putAll("ወተት" to "milk")
            putAll("እርጎ" to "yogurt")
            putAll("ቅቤ" to "butter")
            putAll("አይብ" to "cheese")
            putAll("እንቁላል" to "eggs")
            putAll("ዳቦ" to "bread")
            putAll("ዱቄት" to "flour")
            putAll("ፖም" to "apple")
            putAll("ሙዝ" to "banana")
            putAll("ቲማቲም" to "tomato")
            putAll("ሽንኩርት" to "onion")
            putAll("ሎሚ" to "lemon")
            putAll("አቮካዶ" to "avocado")
            putAll("ዶሮ" to "chicken")
            putAll("ስጋ" to "meat")
            putAll("ዓሳ" to "fish")
            putAll("ሩዝ" to "rice")
            putAll("ስኳር" to "sugar_product")
            putAll("ጨው" to "salt")
            putAll("ውሃ" to "water")
            putAll("ቡና" to "coffee")
            putAll("ሻይ" to "tea")
            putAll("ሳሙና" to "soap")
            putAll("ሻምፑ" to "shampoo")
            putAll("ቸኮሌት" to "chocolate")
            putAll("ጭማቂ" to "juice")
            putAll("ቢራ" to "beer")
            putAll("ወይን" to "wine")
            putAll("ዘይት" to "oil")
            putAll("ወረቀት" to "paper")
        }

        private fun <K, V> MutableMap<K, V>.putAll(vararg pairs: Pair<K, V>) {
            for ((key, value) in pairs) {
                this[key] = value
            }
        }
    }
}
