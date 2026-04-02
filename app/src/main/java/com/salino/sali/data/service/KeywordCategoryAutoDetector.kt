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
            add(cleaned.removeEnglishPluralSuffix())
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

    private val keywordMap: LinkedHashMap<ItemCategory, List<String>> = linkedMapOf(
        ItemCategory.DAIRY to listOf(
            "milk", "cheese", "yogurt", "butter", "cream", "cottage",
            "חלב", "גבינה", "יוגורט", "חמאה", "שמנת", "קוטג",
            "מעדן", "לבנה", "גבינה צהובה", "מוצרלה", "קצפת", "אשל", "גיל", 
            "שוקו", "צפתית", "בולגרית", "מילקי", "דניק", "חמד", "ריקוטה", 
            "גבינת עזים", "גבינה לבנה", "גבינת שמנת", "שמנת מתוקה", "שמנת לבישול", "חמאת שום"
        ),
        ItemCategory.BAKERY to listOf(
            "bread", "roll", "bagel", "pita", "croissant", "cake",
            "לחם", "לחמניה", "בייגל", "פיתה", "קרואסון", "עוגה",
            "חלה", "טוסט", "באגט", "בורקס", "פיתות", "לחמניות", 
            "עוגיות", "מארז חלות", "פוקאצ'ה", "לחם שום", "מאפה", 
            "קובנה", "ג'חנון", "מלאווח", "רוגלך", "לחם כוסמין", "לחם שיפון", "טורטיה"
        ),
        ItemCategory.FRUITS to listOf(
            "apple", "banana", "orange", "melon", "grape", "pear",
            "תפוח", "בננה", "תפוז", "מלון", "ענבים", "אגס",
            "אבטיח", "קלמנטינה", "מנגו", "אבוקדו", "אפרסק", "שזיף", 
            "תות", "תותים", "רימון", "קיווי", "לימון", "פומלה", 
            "פומלית", "אשכולית", "אפרסמון", "דובדבנים", "פפאיה", "תאנים", "נקטרינה"
        ),
        ItemCategory.VEGETABLES to listOf(
            "tomato", "cucumber", "onion", "potato", "carrot", "pepper",
            "עגבניה", "מלפפון", "בצל", "תפוח אדמה", "גזר", "פלפל",
            "חסה", "כרוב", "קישוא", "פטריות", "שום", "תפוחי אדמה", 
            "עגבניות", "מלפפונים", "בטטה", "חציל", "ברוקולי", "כרובית", 
            "תירס", "פטרוזיליה", "כוסברה", "שמיר", "נענע", "סלרי", 
            "סלק", "צנון", "צנונית", "שורש", "קולורבי", "פלפל חריף", "שעועית ירוקה", "בצל ירוק", "עלי בייבי"
        ),
        ItemCategory.MEAT_FISH to listOf(
            "chicken", "beef", "fish", "salmon", "turkey", "meat",
            "עוף", "בשר", "דג", "סלמון", "הודו", "קציצות",
            "פרגית", "טונה", "שניצל", "נקניק", "פסטרמה", "בקר", 
            "חזה עוף", "סטייק", "אנטריקוט", "צלעות", "שווארמה", "כבד", 
            "לבבות", "נקניקיות", "קבב", "המבורגר", "דניס", "מושט", 
            "לברק", "אמנון", "נסיכת הנילוס", "סרדינים", "בשר טחון", "קורנביף", "רוסטביף"
        ),
        ItemCategory.CLEANING to listOf(
            "soap", "detergent", "bleach", "sponge", "cleaner", "trash bag",
            "סבון", "אבקת כביסה", "אקונומיקה", "ספוג", "מנקה", "שקיות זבל",
            "נוזל כלים", "מרכך", "מטלית", "מגבונים", "נייר טואלט", "פיירי", 
            "ג'ל כביסה", "סנט מוריץ", "מסיר שומנים", "מנקה חלונות", "מטליות", 
            "כריות יפניות", "מטאטא", "יעה", "סמרטוט", "מבשם אוויר", "קפסולות כביסה", 
            "ג'ל לניקוי", "ספוג הפלא", "מטליות לחות", "מבריק רצפות", "נוזל רצפות", "פנטסטיק", "פח זבל"
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
            "חמאת בוטנים", "טריאקי", "רוטב", "צ'ילי מתוק", "מייפל", "קרוטונים", "פיצוחים לאפייה"
        ),
        ItemCategory.SNACKS to listOf(
            "chips", "cookie", "cookies", "cracker", "chocolate", "snack",
            "ציפס", "עוגיות", "קרקר", "שוקולד", "חטיף", "ביסלי",
            "במבה", "וופל", "סוכריות", "פופקורן", "תפוצ'יפס", "דוריתוס", 
            "צ'יטוס", "אפרופו", "כיפלי", "דובונים", "קרמבו", "טוויקס", 
            "פסק זמן", "מרשמלו", "מסטיק", "שוקולד פרה", "טעמי", "טורטית", 
            "קליק", "בייגלה", "פיצוחים", "גרעינים", "קבוקים", "פיסטוקים", 
            "בוטנים", "קשיו", "שקדים", "אגוזים", "פתי בר", "מנצ'ס", "עדלאידע", "מקופלת"
        ),
        ItemCategory.BEVERAGES to listOf(
            "water", "juice", "cola", "coffee", "tea", "drink",
            "מים", "מיץ", "קולה", "קפה", "תה", "משקה",
            "סודה", "יין", "בירה", "משקה אנרגיה", "זירו", "ספרייט", 
            "פאנטה", "נסטי", "פיוז טי", "תפוזים", "לימונדה", "אשכוליות", 
            "מיץ תפוחים", "מים מינרלים", "נס קפה", "קפה שחור", "אספרסו", 
            "קפסולות קפה", "תה צמחים", "משקה קל", "XL", "בלו", 
            "מוגז", "ויטמינצ'יק", "קאווה", "וודקה", "ויסקי", "תירוש"
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
            "טיטולים", "חיתולים", "סבון תינוקות", "משחת החתלה", "תחליף חלב"
        )
    )

    companion object {
        private const val MIN_ACCEPT_SCORE = 24
    }
}
