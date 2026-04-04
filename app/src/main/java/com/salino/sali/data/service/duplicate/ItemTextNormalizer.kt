package com.salino.sali.data.service.duplicate

import java.text.Normalizer
import java.util.Locale
import javax.inject.Inject

class ItemTextNormalizer @Inject constructor() {

    fun normalize(text: String): String {
        if (text.isBlank()) return ""

        var result = text

        // Remove Hebrew niqqud (diacritics)
        result = Normalizer.normalize(result, Normalizer.Form.NFD)
            .replace(Regex("[\\p{Mn}]"), "")

        result = result.lowercase(Locale.getDefault())

        // Normalize percentage forms in all supported languages
        result = result.replace(Regex("(\\d+)\\s*%"), "$1%")
        result = result.replace(Regex("(\\d+)\\s+אחוז"), "$1%")           // Hebrew
        result = result.replace(Regex("(\\d+)\\s+percent"), "$1%")         // English
        result = result.replace(Regex("(\\d+)\\s+процент(ов)?"), "$1%")   // Russian
        result = result.replace(Regex("(\\d+)\\s+بالما?ية"), "$1%")        // Arabic (normalized)
        result = result.replace(Regex("(\\d+)\\s+pour\\s+cent"), "$1%")   // French
        result = result.replace(Regex("(\\d+)\\s+por\\s+ciento"), "$1%")  // Spanish
        result = result.replace(Regex("(\\d+)\\s+በመቶ"), "$1%")             // Amharic

        // Replace geresh, apostrophes and special quotes with space (helps French elision: l'eau → l eau)
        result = result.replace(Regex("[׳'`\u2018\u2019\u201C\u201D]"), " ")

        // Remove surrounding punctuation but keep % attached to numbers
        result = result.replace(Regex("[\".,!?()\\[\\]{}:;_\\-]+"), " ")

        // Collapse whitespace
        result = result.replace(Regex("\\s+"), " ").trim()

        return result
    }

    fun tokenize(normalizedText: String): List<String> {
        if (normalizedText.isBlank()) return emptyList()
        return normalizedText.split(" ").filter { it.isNotBlank() }
    }

    /**
     * Multilingual singular/plural normalization.
     * Supports: Hebrew, Arabic, Russian, Amharic, English, French, Spanish.
     */
    fun normalizePlural(token: String): String {
        if (token.length <= 2) return token

        // Hebrew plurals
        if (token.endsWith("ים") && token.length > 3) return token.dropLast(2)
        if (token.endsWith("ות") && token.length > 3) return token.dropLast(2)
        if (token.endsWith("ה") && token.length > 3) return token.dropLast(1)

        // Arabic sound plurals
        if (token.endsWith("ات") && token.length > 3) return token.dropLast(2)
        if (token.endsWith("ون") && token.length > 3) return token.dropLast(2)
        if (token.endsWith("ين") && token.length > 3) return token.dropLast(2)

        // Russian plurals (Cyrillic tokens)
        if (token.all { it in '\u0400'..'\u04FF' } && token.length > 3) {
            if (token.endsWith("ы") || token.endsWith("и") ||
                token.endsWith("а") || token.endsWith("я")
            ) {
                return token.dropLast(1)
            }
        }

        // Amharic plural suffix ዎች
        if (token.endsWith("ዎች") && token.length > 4) return token.dropLast(2)

        // Latin-script plurals (English, French, Spanish)
        if (token.matches(Regex("[a-z]+es$")) && token.length > 4) return token.dropLast(2)
        if (token.matches(Regex("[a-z]+s$")) && token.length > 3) return token.dropLast(1)
        if (token.matches(Regex("[a-z]+x$")) && token.length > 3) return token.dropLast(1) // French -x plural

        return token
    }
}
