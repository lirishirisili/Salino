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
            "מעדן", "לבנה", "גבינה צהובה", "מוצרלה", "קצפת"
        ),
        ItemCategory.BAKERY to listOf(
            "bread", "roll", "bagel", "pita", "croissant", "cake",
            "לחם", "לחמניה", "בייגל", "פיתה", "קרואסון", "עוגה",
            "חלה", "טוסט", "באגט", "בורקס"
        ),
        ItemCategory.FRUITS to listOf(
            "apple", "banana", "orange", "melon", "grape", "pear",
            "תפוח", "בננה", "תפוז", "מלון", "ענבים", "אגס",
            "אבטיח", "קלמנטינה", "מנגו", "אבוקדו"
        ),
        ItemCategory.VEGETABLES to listOf(
            "tomato", "cucumber", "onion", "potato", "carrot", "pepper",
            "עגבניה", "מלפפון", "בצל", "תפוח אדמה", "גזר", "פלפל",
            "חסה", "כרוב", "קישוא", "פטריות", "שום"
        ),
        ItemCategory.MEAT_FISH to listOf(
            "chicken", "beef", "fish", "salmon", "turkey", "meat",
            "עוף", "בשר", "דג", "סלמון", "הודו", "קציצות",
            "פרגית", "טונה", "שניצל", "נקניק", "פסטרמה"
        ),
        ItemCategory.CLEANING to listOf(
            "soap", "detergent", "bleach", "sponge", "cleaner", "trash bag",
            "סבון", "אבקת כביסה", "אקונומיקה", "ספוג", "מנקה", "שקיות זבל",
            "נוזל כלים", "מרכך", "מטלית", "מגבונים", "נייר טואלט"
        ),
        ItemCategory.PANTRY to listOf(
            "rice", "pasta", "flour", "oil", "salt", "sugar",
            "אורז", "פסטה", "קמח", "שמן", "מלח", "סוכר",
            "עדשים", "חומוס", "קינואה", "שיבולת שועל", "רסק"
        ),
        ItemCategory.SNACKS to listOf(
            "chips", "cookie", "cookies", "cracker", "chocolate", "snack",
            "ציפס", "עוגיות", "קרקר", "שוקולד", "חטיף", "ביסלי",
            "במבה", "וופל", "סוכריות", "פופקורן"
        ),
        ItemCategory.BEVERAGES to listOf(
            "water", "juice", "cola", "coffee", "tea", "drink",
            "מים", "מיץ", "קולה", "קפה", "תה", "משקה",
            "סודה", "יין", "בירה", "משקה אנרגיה", "זירו"
        ),
        ItemCategory.PHARMACY to listOf(
            "vitamin", "painkiller", "shampoo", "toothpaste", "medicine", "bandage",
            "ויטמינים", "אקמול", "שמפו", "משחת שיניים", "תרופה", "פלסטר",
            "דאודורנט", "מרכך שיער", "מברשת שיניים", "תחבושת", "סירופ"
        )
    )

    companion object {
        private const val MIN_ACCEPT_SCORE = 24
    }
}
