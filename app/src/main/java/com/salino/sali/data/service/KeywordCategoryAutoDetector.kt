package com.salino.sali.data.service

import com.salino.sali.data.model.ItemCategory
import com.salino.sali.domain.service.CategoryAutoDetector
import com.salino.sali.util.normalizeItemName
import javax.inject.Inject
import kotlin.math.min

class KeywordCategoryAutoDetector @Inject constructor() : CategoryAutoDetector {

    override fun detectCategory(itemName: String): ItemCategory? {
        val normalized = normalizeItemName(itemName)
        if (normalized.isBlank()) return null

        val tokens = normalized
            .split(" ")
            .flatMap { token -> tokenVariants(token) }
            .distinct()

        val scored = keywordMap.mapValues { (_, keywords) ->
            scoreCategory(normalized = normalized, tokens = tokens, keywords = keywords)
        }

        val best = scored.maxByOrNull { it.value } ?: return null
        return best.key.takeIf { best.value >= MIN_ACCEPT_SCORE }
    }

    private fun scoreCategory(
        normalized: String,
        tokens: List<String>,
        keywords: List<String>
    ): Int {
        var score = 0

        keywords.forEach { keyword ->
            val normalizedKeyword = normalizeItemName(keyword)
            if (normalizedKeyword.isBlank()) return@forEach

            when {
                normalized == normalizedKeyword -> score += 120
                normalized.startsWith("$normalizedKeyword ") || normalized.endsWith(" $normalizedKeyword") -> score += 70
                normalized.contains(normalizedKeyword) -> score += if (normalizedKeyword.contains(' ')) 65 else 40
            }

            val keywordTokens = normalizedKeyword.split(" ")
            keywordTokens.forEach { keywordToken ->
                if (keywordToken.isBlank()) return@forEach

                if (tokens.any { it == keywordToken }) {
                    score += 26
                } else if (tokens.any { fuzzyTokenMatch(it, keywordToken) }) {
                    score += 14
                }
            }
        }

        return score
    }

    private fun tokenVariants(token: String): List<String> {
        val cleaned = token.trim()
        if (cleaned.isBlank()) return emptyList()

        return buildList {
            add(cleaned)
            add(cleaned.removeCommonHebrewPrefixes())
            add(cleaned.removeCommonHebrewSuffixes())
            add(cleaned.removeCommonHebrewPrefixes().removeCommonHebrewSuffixes())
            add(cleaned.hebrewConstructToBase())
            add(cleaned.removeCommonHebrewPrefixes().hebrewConstructToBase())
            add(cleaned.removeEnglishPluralSuffix())
            add(cleaned.removeArabicDefiniteArticle())
        }.filter { it.isNotBlank() }.distinct()
    }

    private fun fuzzyTokenMatch(input: String, keyword: String): Boolean {
        if (input.length < 3 || keyword.length < 3) return false
        val maxDistance = when (min(input.length, keyword.length)) {
            in 0..4 -> 1
            in 5..7 -> 2
            else -> 3
        }
        return levenshteinDistance(input, keyword) <= maxDistance
    }

    private fun levenshteinDistance(a: String, b: String): Int {
        if (a == b) return 0
        if (a.isEmpty()) return b.length
        if (b.isEmpty()) return a.length

        val costs = IntArray(b.length + 1) { it }
        for (i in 1..a.length) {
            var previousDiagonal = costs[0]
            costs[0] = i
            for (j in 1..b.length) {
                val temp = costs[j]
                val substitutionCost = if (a[i - 1] == b[j - 1]) 0 else 1
                costs[j] = minOf(
                    costs[j] + 1,
                    costs[j - 1] + 1,
                    previousDiagonal + substitutionCost
                )
                previousDiagonal = temp
            }
        }
        return costs[b.length]
    }

    private fun String.removeCommonHebrewPrefixes(): String =
        removePrefix("ה").removePrefix("ו").removePrefix("ב").removePrefix("ל")

    private fun String.removeCommonHebrewSuffixes(): String =
        removeSuffix("ים").removeSuffix("ות").removeSuffix("ה")

    private fun String.removeEnglishPluralSuffix(): String =
        when {
            endsWith("es") && length > 4 -> removeSuffix("es")
            endsWith("s") && length > 3 -> removeSuffix("s")
            else -> this
        }

    private fun String.hebrewConstructToBase(): String =
        if (endsWith("\u05EA") && length > 2) removeSuffix("\u05EA") + "\u05D4" else this

    private fun String.removeArabicDefiniteArticle(): String =
        removePrefix("\u0627\u0644")

    private val keywordMap: LinkedHashMap<ItemCategory, List<String>> = linkedMapOf(
        ItemCategory.DAIRY to listOf(
            "milk", "cheese", "yogurt", "butter", "cream", "cottage",
            "חלב", "גבינה", "יוגורט", "חמאה", "שמנת", "קוטג",
            "מעדן", "לבנה", "גבינה צהובה", "מוצרלה", "קצפת", "אשל", "גיל", 
            "שוקו", "צפתית", "בולגרית", "מילקי", "דניק", "חמד", "ריקוטה", 
            "גבינת עזים", "גבינה לבנה", "גבינת שמנת", "שמנת מתוקה", "שמנת לבישול", "חמאת שום",
            "lait", "fromage", "yaourt", "beurre", "creme", "crème", "fromage blanc", "labneh", "mozzarella",
            "leche", "queso", "yogur", "mantequilla", "crema", "requeson", "requesón", "queso cottage",
            "молоко", "сыр", "йогурт", "масло", "сливки", "творог", "сметана", "лабне", "моцарелла",
            "حليب", "جبنة", "جبن", "زبادي", "لبن", "زبدة", "كريمة", "لبنة", "موزاريلا", "قشطة",
            "መተት", "አይብ", "እርጎ", "ቅቤ", "ክሬም", "ላብኔ", "ሞዛሬላ", "ኮተጅ",
            // Compound phrases
            "chocolate milk", "soy milk", "almond milk", "oat milk", "coconut milk", "goat milk",
            "cream cheese", "sour cream", "whipped cream", "cottage cheese", "string cheese",
            "חלב שוקולד", "חלב סויה", "חלב שקדים", "חלב שיבולת שועל", "חלב קוקוס", "חלב עיזים",
            "lait chocolat\u00e9", "lait de soja", "lait d'amande", "lait d'avoine", "lait de coco",
            "leche con chocolate", "leche de soja", "leche de almendras", "leche de avena", "leche de coco",
            "шоколадное молоко", "соевое молоко", "миндальное молоко", "овсяное молоко", "кокосовое молоко",
            "حليب شوكولاتة", "حليب صويا", "حليب لوز", "حليب شوفان", "حليب جوز الهند"
        ),
        ItemCategory.BAKERY to listOf(
            "bread", "roll", "bagel", "pita", "croissant", "cake",
            "לחם", "לחמניה", "בייגל", "פיתה", "קרואסון", "עוגה",
            "חלה", "טוסט", "באגט", "בורקס", "פיתות", "לחמניות", 
            "עוגיות", "מארז חלות", "פוקאצ'ה", "לחם שום", "מאפה", 
            "קובנה", "ג'חנון", "מלאווח", "רוגלך", "לחם כוסמין", "לחם שיפון", "טורטיה",
            "pain", "petit pain", "baguette", "bagel", "pita", "croissant", "gateau", "gâteau", "brioche", "viennoiserie", "tortilla",
            "pan", "panecillo", "bagel", "pita", "cruasan", "croissant", "pastel", "baguette", "bolleria", "bollería", "tortilla",
            "хлеб", "булочка", "бейгл", "пита", "круассан", "торт", "багет", "выпечка", "лаваш", "лепешка",
            "خبز", "كعك", "بيغل", "بيتا", "كرواسون", "كيك", "رغيف", "باجيت", "معجنات", "تورتيلا",
            "ዳቦ", "ቡን", "ቤግል", "ፒታ", "ክሮሳን", "ኬክ", "ባጤት", "መጋገሪያ", "ቶርቲያ",
            // Compound phrases
            "chocolate cake", "cheesecake", "birthday cake", "sourdough bread", "banana bread", "whole wheat bread",
            "עוגת שוקולד", "עוגת גבינה", "עוגת יום הולדת", "עוגת תפוחים", "עוגת דבש", "לחם מחמצת", "לחם מקמח מלא",
            "g\u00e2teau au chocolat", "g\u00e2teau au fromage",
            "pastel de chocolate", "tarta de queso",
            "шоколадный торт", "чизкейк",
            "كيكة شوكولاتة", "تشيز كيك"
        ),
        ItemCategory.FRUITS to listOf(
            "apple", "banana", "orange", "melon", "grape", "pear",
            "תפוח", "בננה", "תפוז", "מלון", "ענבים", "אגס",
            "אבטיח", "קלמנטינה", "מנגו", "אבוקדו", "אפרסק", "שזיף", 
            "תות", "תותים", "רימון", "קיווי", "לימון", "פומלה", 
            "פומלית", "אשכולית", "אפרסמון", "דובדבנים", "פפאיה", "תאנים", "נקטרינה",
            "pomme", "banane", "orange", "melon", "pastèque", "pasteque", "raisin", "poire", "mangue", "avocat", "fraise", "citron",
            "manzana", "platano", "plátano", "banana", "naranja", "melon", "melón", "uva", "pera", "sandia", "sandía", "mango", "aguacate", "fresa", "limon", "limón",
            "яблоко", "банан", "апельсин", "дыня", "виноград", "груша", "арбуз", "манго", "авокадо", "персик", "клубника", "лимон",
            "تفاح", "موز", "برتقال", "شمام", "عنب", "كمثرى", "بطيخ", "مانجو", "أفوكادو", "خوخ", "فراولة", "ليمون",
            "ፖም", "ሙዝ", "ብርቱካን", "ሜሎን", "ወይን", "ፒር", "ሐብሐብ", "ማንጎ", "አቮካዶ", "እንጆሪ", "ሎሚ",
            // Compound phrases
            "dried fruit", "fresh fruit", "fruit salad",
            "פירות יבשים", "סלט פירות",
            "fruits secs", "salade de fruits",
            "fruta seca", "ensalada de frutas",
            "сухофрукты", "фруктовый салат",
            "فواكه مجففة", "سلطة فواكه"
        ),
        ItemCategory.VEGETABLES to listOf(
            "tomato", "cucumber", "onion", "potato", "carrot", "pepper",
            "עגבניה", "מלפפון", "בצל", "תפוח אדמה", "גזר", "פלפל",
            "חסה", "כרוב", "קישוא", "פטריות", "שום", "תפוחי אדמה", 
            "עגבניות", "מלפפונים", "בטטה", "חציל", "ברוקולי", "כרובית", 
            "תירס", "פטרוזיליה", "כוסברה", "שמיר", "נענע", "סלרי", 
            "סלק", "צנון", "צנונית", "שורש", "קולורבי", "פלפל חריף", "שעועית ירוקה", "בצל ירוק", "עלי בייבי",
            "tomate", "concombre", "oignon", "pomme de terre", "carotte", "poivron", "laitue", "chou", "courgette", "champignon", "ail", "brocoli", "chou fleur", "persil", "coriandre", "céleri", "celeri",
            "tomate", "pepino", "cebolla", "patata", "papa", "zanahoria", "pimiento", "lechuga", "col", "calabacin", "calabacín", "champiñones", "ajo", "berenjena", "brocoli", "brócoli", "coliflor", "perejil", "cilantro", "apio",
            "помидор", "огурец", "лук", "картофель", "картошка", "морковь", "перец", "салат", "капуста", "кабачок", "грибы", "чеснок", "батат", "баклажан", "брокколи", "цветная капуста", "петрушка", "кинза", "сельдерей",
            "طماطم", "خيار", "بصل", "بطاطا", "بطاطس", "جزر", "فلفل", "خس", "ملفوف", "كوسا", "فطر", "ثوم", "باذنجان", "بروكلي", "قرنبيط", "بقدونس", "كزبرة", "كرفس",
            "ቲማቲም", "ሽንኩርት", "ድንች", "ካሮት", "ቃሪያ", "ሰላጣ", "ጎመን", "ዙኪኒ", "እንጉዳይ", "ነጭ ሽንኩርት", "ብሮኮሊ", "አበባ ጎመን", "ፓርስሌ", "ሴለሪ"
        ),
        ItemCategory.MEAT_FISH to listOf(
            "chicken", "beef", "fish", "salmon", "turkey", "meat",
            "עוף", "בשר", "דג", "סלמון", "הודו", "קציצות",
            "פרגית", "טונה", "שניצל", "נקניק", "פסטרמה", "בקר", 
            "חזה עוף", "סטייק", "אנטריקוט", "צלעות", "שווארמה", "כבד", 
            "לבבות", "נקניקיות", "קבב", "המבורגר", "דניס", "מושט", 
            "לברק", "אמנון", "נסיכת הנילוס", "סרדינים", "בשר טחון", "קורנביף", "רוסטביף",
            "poulet", "boeuf", "bœuf", "poisson", "saumon", "dinde", "viande", "thon", "escalope", "steak", "saucisse", "kebab",
            "pollo", "ternera", "res", "pescado", "salmon", "salmón", "pavo", "carne", "atun", "atún", "filete", "salchicha", "hamburguesa", "kebab",
            "курица", "говядина", "рыба", "лосось", "индейка", "мясо", "тунец", "шницель", "стейк", "сосиски", "котлеты", "фарш",
            "دجاج", "لحم بقري", "سمك", "سلمون", "ديك رومي", "لحم", "تونة", "شنيتسل", "ستيك", "نقانق", "كباب", "برغر",
            "ዶሮ", "የበሬ ሥጋ", "ዓሣ", "ሳልሞን", "ቱርክ", "ስጋ", "ቱና", "ስቴክ", "ሶሴጅ", "ኬባብ", "ሀምበርገር"
        ),
        ItemCategory.CLEANING to listOf(
            "soap", "detergent", "bleach", "sponge", "cleaner", "trash bag",
            "סבון", "אבקת כביסה", "אקונומיקה", "ספוג", "מנקה", "שקיות זבל",
            "נוזל כלים", "מרכך", "מטלית", "מגבונים", "נייר טואלט", "פיירי", 
            "ג'ל כביסה", "סנט מוריץ", "מסיר שומנים", "מנקה חלונות", "מטליות", 
            "כריות יפניות", "מטאטא", "יעה", "סמרטוט", "מבשם אוויר", "קפסולות כביסה", 
            "ג'ל לניקוי", "ספוג הפלא", "מטליות לחות", "מבריק רצפות", "נוזל רצפות", "פנטסטיק", "פח זבל",
            "savon", "lessive", "eau de javel", "éponge", "eponge", "nettoyant", "sac poubelle", "liquide vaisselle", "adoucissant", "lingettes", "papier toilette", "balai",
            "jabon", "jabón", "detergente", "lejia", "lejía", "esponja", "limpiador", "bolsa de basura", "lavavajillas", "suavizante", "toallitas", "papel higienico", "papel higiénico", "escoba",
            "мыло", "стиральный порошок", "отбеливатель", "губка", "чистящее средство", "мешки для мусора", "жидкость для посуды", "кондиционер для белья", "салфетки", "туалетная бумага", "веник",
            "صابون", "منظف", "مبيض", "إسفنجة", "اسفنجة", "أكياس قمامة", "سائل جلي", "منعم", "مناديل مبللة", "ورق تواليت", "مكنسة",
            "ሳሙና", "የልብስ ሳሙና", "ነጭ ማጽጃ", "ስፖንጅ", "ማጽጃ", "የቆሻሻ ለረጢት", "የእቃ ማጠቢያ", "ለስላሳ ማድረጊያ", "የመጽዳጃ ወረቀት", "መጥረጊያ",
            // Compound phrases
            "dish soap", "floor cleaner", "glass cleaner", "laundry detergent", "fabric softener", "air freshener",
            "סבון כלים", "סבון רצפה", "סבון ידיים",
            "savon vaisselle", "nettoyant sol", "nettoyant vitres",
            "jab\u00f3n de platos", "limpiador de pisos", "limpiador de vidrios",
            "средство для мытья посуды", "средство для пола",
            "صابون أطباق", "منظف أرضيات"
        ),
        ItemCategory.PANTRY to listOf(
            "rice", "pasta", "flour", "oil", "salt", "sugar",
            "אורז", "פסטה", "קמח", "שמן", "מלח", "סוכר",
            "עדשים", "חומוס", "קינואה", "שיבולת שועל", "רסק", "קוסקוס", 
            "פתיתים", "בורגול", "שעועית", "אפונה", "זיתים", "תירס", 
            "מיונז", "קטשופ", "חרדל", "טחינה", "סויה", "סילאן", 
            "דבש", "שמן זית", "חומץ", "תבלינים", "פלפל שחור", "פפריקה", 
            "כמון", "כורכום", "זעתר", "אבקת מרק", "רסק עגבניות", "שימורים", 
            "דגני בוקר", "קורנפלקס", "גרנולה", "ריבה", "שוקולד למריחה", "נוטלה", 
            "חמאת בוטנים", "טריאקי", "רוטב", "צ'ילי מתוק", "מייפל", "קרוטונים", "פיצוחים לאפייה",
            "riz", "pâtes", "pates", "farine", "huile", "sel", "sucre", "lentilles", "pois chiches", "quinoa", "avoine", "couscous", "ketchup", "moutarde", "tahini", "miel", "épices", "epices", "confiture",
            "arroz", "pasta", "harina", "aceite", "sal", "azucar", "azúcar", "lentejas", "garbanzos", "quinoa", "avena", "cuscus", "ketchup", "mostaza", "tahini", "miel", "especias", "mermelada",
            "рис", "макароны", "мука", "масло", "соль", "сахар", "чечевица", "нут", "киноа", "овсянка", "кускус", "кетчуп", "горчица", "тахини", "мед", "специи", "варенье",
            "أرز", "معكرونة", "طحين", "زيت", "ملح", "سكر", "عدس", "حمص", "كينوا", "شوفان", "كسكس", "كاتشب", "خردل", "طحينة", "عسل", "بهارات", "مربى",
            "ሩዝ", "ፓስታ", "ዱቄት", "ዘይት", "ጨው", "ስኳር", "ምስር", "ሽምብራ", "ኪኖዋ", "አጃ", "ኩስኩስ", "ኬችፕ", "ሰናፍጭ", "ጣሂኒ", "ማር", "ቅመማ ቅመም", "ጀም",
            // Compound phrases - food syrups (NOT pharmacy)
            "grape syrup", "maple syrup", "chocolate syrup", "date syrup", "agave syrup",
            "strawberry syrup", "caramel syrup", "vanilla syrup", "pancake syrup",
            "soy sauce", "hot sauce", "bbq sauce", "barbecue sauce", "tomato sauce", "pasta sauce",
            "teriyaki sauce", "worcestershire sauce", "chocolate spread",
            "סירופ ענבים", "סירופ מייפל", "סירופ שוקולד", "סירופ תות", "סירופ דבש",
            "סירופ תמרים", "סירופ אגבה", "סירופ קרמל", "סירופ וניל",
            "דבש תמרים", "מי ורדים", "תמצית וניל",
            "רוטב סויה", "רוטב צ'ילי", "רוטב ברבקיו", "רוטב עגבניות", "רוטב פסטה", "רוטב חריף",
            "ממרח שוקולד", "ממרח לוטוס", "ממרח ביסקוף",
            "sirop d'\u00e9rable", "sirop de chocolat", "sauce tomate", "sauce soja", "sauce piquante", "p\u00e2te \u00e0 tartiner",
            "jarabe de arce", "sirope de chocolate", "salsa de tomate", "salsa de soja", "salsa picante",
            "кленовый сироп", "шоколадный сироп", "виноградный сироп", "финиковый сироп",
            "соевый соус", "томатный соус", "острый соус",
            "دبس عنب", "دبس تمر", "شراب القيقب", "صلصة طماطم", "صلصة صويا", "صلصة حارة"
        ),
        ItemCategory.SNACKS to listOf(
            "chips", "cookie", "cookies", "cracker", "chocolate", "snack",
            "ציפס", "עוגיות", "קרקר", "שוקולד", "חטיף", "ביסלי",
            "במבה", "וופל", "סוכריות", "פופקורן", "תפוצ'יפס", "דוריתוס", 
            "צ'יטוס", "אפרופו", "כיפלי", "דובונים", "קרמבו", "טוויקס", 
            "פסק זמן", "מרשמלו", "מסטיק", "שוקולד פרה", "טעמי", "טורטית", 
            "קליק", "בייגלה", "פיצוחים", "גרעינים", "קבוקים", "פיסטוקים", 
            "בוטנים", "קשיו", "שקדים", "אגוזים", "פתי בר", "מנצ'ס", "עדלאידע", "מקופלת",
            "chips", "biscuit", "biscuits", "cracker", "chocolat", "snack", "bonbons", "popcorn", "bretzel", "noix", "amandes", "cacahuètes", "cacahuetes", "guimauve", "gomme",
            "patatas fritas", "galleta", "galletas", "cracker", "chocolate", "snack", "caramelos", "palomitas", "pretzel", "frutos secos", "pistachos", "cacahuetes", "malvaviscos", "chicle",
            "чипсы", "печенье", "крекер", "шоколад", "снэк", "конфеты", "попкорн", "крендель", "орехи", "фисташки", "арахис", "маршмеллоу", "жвачка",
            "شيبس", "بسكويت", "كراكر", "شوكولاتة", "سناك", "حلويات", "فشار", "بريتزل", "مكسرات", "فستق", "فول سوداني", "مارشميلو", "علكة",
            "ቺፕስ", "ብስኩት", "ክራከር", "ቸኮሌት", "ስናክ", "ለረሜላ", "ፖፕኮርን", "ፕረትዘል", "ፍሬ ነት", "ፒስታሽዮ", "ኦኆሎኒ", "ማርሽማሎ", "ማስቲካ",
            // Compound phrases
            "chocolate bar", "protein bar", "granola bar", "energy bar",
            "milk chocolate", "dark chocolate", "white chocolate",
            "שוקולד חלב", "שוקולד מריר", "שוקולד לבן", "חטיף חלבון", "חטיף אנרגיה",
            "chocolat au lait", "chocolat noir", "barre prot\u00e9in\u00e9e",
            "chocolate con leche", "chocolate negro", "barra de prote\u00edna",
            "молочный шоколад", "т\u0451мный шоколад", "протеиновый батончик",
            "شوكولاتة حليب", "شوكولاتة داكنة", "بار بروتين"
        ),
        ItemCategory.BEVERAGES to listOf(
            "water", "juice", "cola", "coffee", "tea", "drink",
            "מים", "מיץ", "קולה", "קפה", "תה", "משקה",
            "סודה", "יין", "בירה", "משקה אנרגיה", "זירו", "ספרייט", 
            "פאנטה", "נסטי", "פיוז טי", "תפוזים", "לימונדה", "אשכוליות", 
            "מיץ תפוחים", "מים מינרלים", "נס קפה", "קפה שחור", "אספרסו", 
            "קפסולות קפה", "תה צמחים", "משקה קל", "XL", "בלו", 
            "מוגז", "ויטמינצ'יק", "קאווה", "וודקה", "ויסקי", "תירוש",
            "eau", "jus", "cola", "café", "cafe", "thé", "the", "boisson", "soda", "vin", "bière", "biere", "zero", "sprite", "limonade", "espresso",
            "agua", "jugo", "zumo", "cola", "café", "cafe", "té", "te", "bebida", "refresco", "vino", "cerveza", "zero", "sprite", "limonada", "espresso",
            "вода", "сок", "кола", "кофе", "чай", "напиток", "газировка", "вино", "пиво", "зеро", "спрайт", "лимонад", "эспрессо",
            "ماء", "عصير", "كولا", "قهوة", "شاي", "مشروب", "صودا", "نبيذ", "بيرة", "زيرو", "سبرايت", "ليمونادة", "إسبريسو", "اسبريسو",
            "ውሃ", "ጭማቂ", "ኮላ", "ቡና", "ሻይ", "መጠጥ", "ሶዳ", "ወይን", "ቢራ", "ዚሮ", "ስፕራይት", "ሎሚ መጠጥ", "ኤስፕሬሶ",
            // Compound phrases - juice types
            "grape juice", "orange juice", "apple juice", "lemon juice", "cranberry juice",
            "pomegranate juice", "grapefruit juice", "carrot juice", "iced tea", "iced coffee",
            "מיץ ענבים", "מיץ תפוזים", "מיץ אשכוליות", "מיץ גזר", "מיץ לימון", "מיץ רימונים",
            "מיץ אפרסק", "מיץ חמוציות", "תה קר", "קפה קר",
            "jus d'orange", "jus de pomme", "jus de raisin", "th\u00e9 glac\u00e9", "caf\u00e9 glac\u00e9",
            "jugo de naranja", "jugo de manzana", "jugo de uva", "zumo de naranja", "t\u00e9 helado",
            "апельсиновый сок", "яблочный сок", "виноградный сок", "гранатовый сок",
            "عصير برتقال", "عصير تفاح", "عصير عنب", "عصير رمان"
        ),
        ItemCategory.PHARMACY to listOf(
            "vitamin", "painkiller", "shampoo", "toothpaste", "medicine", "bandage",
            "soap", "body wash", "advil", "nurofen", "tissues", "toilet paper",
            "wipes", "cotton", "lotion", "perfume", "razor", "shaving cream",
            "tampons", "pads", "ointment", "conditioner", "mouthwash", "dental floss", "sunscreen",
            "ויטמינים", "אקמול", "שמפו", "משחת שיניים", "תרופה", "פלסטר",
            "דאודורנט", "מרכך", "מרכך שיער", "מברשת שיניים", "תחבושת", "סירופ",
            "סבון", "סבון גוף", "סבון פנים", "משכך כאבים", "אדוויל", "נורופן",
            "אופטלגין", "טישו", "נייר טואלט", "מגבונים", "צמר גפן", "קרם גוף",
            "קרם לחות", "בושם", "סכיני גילוח", "קצף גילוח", "טמפונים", "תחבושות",
            "משחה", "קונדישינר", "מי פה", "חוט דנטלי", "קרם הגנה", "מקלוני אוזניים",
            "אלכוג'ל", "מסכת פנים", "ברזל", "מגבוני פנים", "פינצטה", "טיפות עיניים",
            "עדשות", "תמיסה לעדשות", "מדחום", "מי חמצן", "יוד", "מוצץ", 
            "בקבוק לתינוק", "מטרנה", "סימילאק", "נוטרילון", "פמפרס", "האגיס", 
            "טיטולים", "חיתולים", "סבון תינוקות", "משחת החתלה", "תחליף חלב",
            "vitamine", "antidouleur", "shampoing", "dentifrice", "médicament", "medicament", "pansement", "gel douche", "mouchoirs", "papier toilette", "lingettes", "coton", "lotion", "parfum", "rasoir", "mousse à raser", "mousse a raser", "tampons", "serviettes", "pommade", "après shampoing", "apres shampoing", "bain de bouche", "fil dentaire", "crème solaire", "creme solaire",
            "vitamina", "analgésico", "analgesico", "champú", "champu", "pasta de dientes", "medicina", "venda", "jabón", "jabon", "gel de baño", "advil", "nurofen", "pañuelos", "panuelos", "papel higiénico", "papel higienico", "toallitas", "algodón", "algodon", "loción", "locion", "perfume", "afeitadora", "espuma de afeitar", "tampones", "compresas", "pomada", "acondicionador", "enjuague bucal", "hilo dental", "protector solar",
            "витамины", "обезболивающее", "шампунь", "зубная паста", "лекарство", "пластырь", "мыло", "гель для душа", "адвил", "нурофен", "салфетки", "туалетная бумага", "влажные салфетки", "вата", "лосьон", "духи", "бритва", "пена для бритья", "тампоны", "прокладки", "мазь", "кондиционер", "ополаскиватель для рта", "зубная нить", "солнцезащитный крем",
            "فيتامين", "مسكن", "شامبو", "معجون أسنان", "معجون اسنان", "دواء", "لاصق جروح", "صابون", "غسول جسم", "أدفيل", "ادفيل", "نوروفين", "مناديل", "ورق تواليت", "مناديل مبللة", "قطن", "لوشن", "عطر", "شفرة", "كريم حلاقة", "سدادات قطنية", "فوط", "مرهم", "بلسم", "غسول فم", "خيط أسنان", "خيط اسنان", "واقي شمس",
            "ቪታሚን", "ህመም ማስታገሻ", "ሻምፑ", "የጥርስ ሳሙና", "መድሃኒት", "ፕላስተር", "ሳሙና", "የሰውነት ሳሙና", "አድቪል", "ኑሮፈን", "ቲሹ", "የመፀዳጃ ወረቀት", "እርጥብ መጥረጊያ", "ጥጥ", "ሎሽን", "ሽቶ", "ሬዘር", "የማጭደቂያ ክሬም", "ታምፖን", "ፓድ", "ቅባት", "ኮንዲሽነር", "የአፍ ማጠቢያ", "የጥርስ ክር", "የፀሐይ መከላከያ",
            // Compound phrases - medical syrups (stay in PHARMACY)
            "cough syrup", "children's syrup", "cold medicine", "eye drops", "nasal spray", "hand sanitizer",
            "סירופ שיעול", "סירופ לילדים", "סירופ חום", "טיפות אף", "ספריי לאף", "שמן שיער",
            "סבון גוף", "קרם פנים", "קרם עיניים", "קרם ידיים", "קרם רגליים",
            "sirop pour la toux", "spray nasal", "désinfectant",
            "jarabe para la tos", "spray nasal", "desinfectante",
            "сироп от кашля", "детский сироп", "спрей для носа", "антисептик",
            "شراب السعال", "بخاخ أنف", "معقم يدين"
        )
    )

    companion object {
        private const val MIN_ACCEPT_SCORE = 24
    }
}
