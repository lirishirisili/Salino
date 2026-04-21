package com.salino.sali.data.service

import com.salino.sali.data.model.ItemUnit
import com.salino.sali.domain.service.ParsedVoiceItem
import com.salino.sali.domain.service.VoiceInputParser
import javax.inject.Inject

/**
 * Parses spoken text like "3 loaves of bread", "חלב 3 אחוז", "2 קילו עגבניות"
 * into a structured [ParsedVoiceItem] with name, quantity, and optional unit.
 */
class KeywordVoiceInputParser @Inject constructor() : VoiceInputParser {

    override fun parse(spokenText: String): ParsedVoiceItem {
        val trimmed = spokenText.trim()
        if (trimmed.isBlank()) return ParsedVoiceItem(name = "")

        // Try to extract unit first (before removing quantity) so we can remove unit words from name
        var remaining = trimmed
        var detectedUnit: ItemUnit? = null
        var detectedQuantity: Double? = null

        // 1. Try to find a unit keyword and extract it
        for ((unit, patterns) in unitPatterns) {
            for (pattern in patterns) {
                val match = pattern.find(remaining)
                if (match != null) {
                    detectedUnit = unit
                    remaining = remaining.removeRange(match.range).trim()
                    break
                }
            }
            if (detectedUnit != null) break
        }

        // 2. Try to extract a leading number: "3 bread" / "3.5 tomatoes"
        val leadingNumber = leadingNumberPattern.find(remaining)
        if (leadingNumber != null) {
            detectedQuantity = parseNumber(leadingNumber.groupValues[1])
            if (detectedQuantity != null) {
                remaining = remaining.removeRange(leadingNumber.range).trim()
            }
        }

        // 3. Try trailing number: "bread 3" / "עגבניות 2"
        if (detectedQuantity == null) {
            val trailingNumber = trailingNumberPattern.find(remaining)
            if (trailingNumber != null) {
                detectedQuantity = parseNumber(trailingNumber.groupValues[1])
                if (detectedQuantity != null) {
                    remaining = remaining.removeRange(trailingNumber.range).trim()
                }
            }
        }

        // 4. Try Hebrew/Arabic number words: "שלוש", "خمسة"
        if (detectedQuantity == null) {
            for ((word, value) in numberWords) {
                val wordPattern = Regex("(?<=\\s|^)${Regex.escape(word)}(?=\\s|$)", RegexOption.IGNORE_CASE)
                val match = wordPattern.find(remaining)
                if (match != null) {
                    detectedQuantity = value
                    remaining = remaining.removeRange(match.range).trim()
                    break
                }
            }
        }

        // Clean up leftover prepositions/connectors
        remaining = cleanupConnectors(remaining)

        return ParsedVoiceItem(
            name = remaining.ifBlank { trimmed },
            quantity = detectedQuantity ?: 1.0,
            unit = detectedUnit
        )
    }

    private fun parseNumber(s: String): Double? {
        return s.replace(',', '.').toDoubleOrNull()
    }

    private fun cleanupConnectors(text: String): String {
        return text
            .replace(leadingConnectorPattern, "")
            .replace(trailingConnectorPattern, "")
            .replace(Regex("\\s+"), " ")
            .trim()
    }

    companion object {
        private val leadingNumberPattern = Regex("^(\\d+(?:[.,]\\d+)?)\\s*")
        private val trailingNumberPattern = Regex("\\s*(\\d+(?:[.,]\\d+)?)$")
        private val leadingConnectorPattern = Regex("^(?:of|de|של|من|的)\\s+", RegexOption.IGNORE_CASE)
        private val trailingConnectorPattern = Regex("\\s+(?:of|de|של|من|的)$", RegexOption.IGNORE_CASE)

        private const val WB = "(?<=\\s|^)"
        private const val WE = "(?=\\s|$)"

        private val unitPatterns: Map<ItemUnit, List<Regex>> = mapOf(
            ItemUnit.KG to listOf(
                Regex("${WB}(?:קילו(?:גרם)?|ק״ג|ק\"ג)${WE}", RegexOption.IGNORE_CASE),
                Regex("${WB}(?:kilo(?:gram)?s?|kg)${WE}", RegexOption.IGNORE_CASE),
                Regex("${WB}(?:كيلو(?:غرام)?)${WE}", RegexOption.IGNORE_CASE),
                Regex("${WB}(?:килограмм(?:ов)?|кг)${WE}", RegexOption.IGNORE_CASE),
                Regex("${WB}(?:ኪሎ(?:ግራም)?)${WE}", RegexOption.IGNORE_CASE)
            ),
            ItemUnit.GRAMS to listOf(
                Regex("${WB}(?:גרם)${WE}", RegexOption.IGNORE_CASE),
                Regex("${WB}(?:grams?|gr)${WE}", RegexOption.IGNORE_CASE),
                Regex("${WB}(?:غرام)${WE}", RegexOption.IGNORE_CASE),
                Regex("${WB}(?:грамм(?:ов)?)${WE}", RegexOption.IGNORE_CASE),
                Regex("${WB}(?:ግራም)${WE}", RegexOption.IGNORE_CASE)
            ),
            ItemUnit.LITERS to listOf(
                Regex("${WB}(?:ליטר(?:ים)?)${WE}", RegexOption.IGNORE_CASE),
                Regex("${WB}(?:liters?|litres?|ltr)${WE}", RegexOption.IGNORE_CASE),
                Regex("${WB}(?:لتر)${WE}", RegexOption.IGNORE_CASE),
                Regex("${WB}(?:литр(?:ов|а)?)${WE}", RegexOption.IGNORE_CASE),
                Regex("${WB}(?:ሊትር)${WE}", RegexOption.IGNORE_CASE)
            ),
            ItemUnit.PACKS to listOf(
                Regex("${WB}(?:חבילות|חבילה|אריזות|אריזה)${WE}", RegexOption.IGNORE_CASE),
                Regex("${WB}(?:packs?|packages?)${WE}", RegexOption.IGNORE_CASE),
                Regex("${WB}(?:علبة|علب|حزمة)${WE}", RegexOption.IGNORE_CASE),
                Regex("${WB}(?:упаковк[аи]|пачек|пачк[аи])${WE}", RegexOption.IGNORE_CASE),
                Regex("${WB}(?:ፓኬት|ጥቅል)${WE}", RegexOption.IGNORE_CASE)
            ),
            ItemUnit.BOTTLES to listOf(
                Regex("${WB}(?:בקבוקים|בקבוק)${WE}", RegexOption.IGNORE_CASE),
                Regex("${WB}(?:bottles?)${WE}", RegexOption.IGNORE_CASE),
                Regex("${WB}(?:زجاجة|زجاجات|قنينة)${WE}", RegexOption.IGNORE_CASE),
                Regex("${WB}(?:бутылк[аи]|бутылок)${WE}", RegexOption.IGNORE_CASE),
                Regex("${WB}(?:ጠርሙስ|ጠርሙሶች)${WE}", RegexOption.IGNORE_CASE)
            ),
            ItemUnit.BAGS to listOf(
                Regex("${WB}(?:שקיות|שקית)${WE}", RegexOption.IGNORE_CASE),
                Regex("${WB}(?:bags?)${WE}", RegexOption.IGNORE_CASE),
                Regex("${WB}(?:كيس|أكياس)${WE}", RegexOption.IGNORE_CASE),
                Regex("${WB}(?:пакет(?:ов|а|ы)?)${WE}", RegexOption.IGNORE_CASE),
                Regex("${WB}(?:ከረጢት)${WE}", RegexOption.IGNORE_CASE)
            ),
            ItemUnit.PIECES to listOf(
                Regex("${WB}(?:יחידות|יחידה)${WE}", RegexOption.IGNORE_CASE),
                Regex("${WB}(?:pieces?|pcs)${WE}", RegexOption.IGNORE_CASE),
                Regex("${WB}(?:قطعة|قطع)${WE}", RegexOption.IGNORE_CASE),
                Regex("${WB}(?:штук[аи]?)${WE}", RegexOption.IGNORE_CASE),
                Regex("${WB}(?:ቁራጭ)${WE}", RegexOption.IGNORE_CASE)
            )
        )

        private val numberWords: List<Pair<String, Double>> = listOf(
            // Hebrew
            "חצי" to 0.5, "אחד" to 1.0, "אחת" to 1.0, "שניים" to 2.0, "שתיים" to 2.0,
            "שלוש" to 3.0, "שלושה" to 3.0, "ארבע" to 4.0, "ארבעה" to 4.0,
            "חמש" to 5.0, "חמישה" to 5.0, "שש" to 6.0, "שישה" to 6.0,
            "שבע" to 7.0, "שבעה" to 7.0, "שמונה" to 8.0, "תשע" to 9.0, "תשעה" to 9.0,
            "עשר" to 10.0, "עשרה" to 10.0,
            // English
            "half" to 0.5, "one" to 1.0, "two" to 2.0, "three" to 3.0, "four" to 4.0,
            "five" to 5.0, "six" to 6.0, "seven" to 7.0, "eight" to 8.0, "nine" to 9.0, "ten" to 10.0,
            // Arabic
            "نصف" to 0.5, "واحد" to 1.0, "اثنين" to 2.0, "ثلاثة" to 3.0, "أربعة" to 4.0,
            "خمسة" to 5.0, "ستة" to 6.0, "سبعة" to 7.0, "ثمانية" to 8.0, "تسعة" to 9.0, "عشرة" to 10.0,
            // Russian
            "пол" to 0.5, "половина" to 0.5, "один" to 1.0, "одна" to 1.0, "два" to 2.0, "две" to 2.0,
            "три" to 3.0, "четыре" to 4.0, "пять" to 5.0, "шесть" to 6.0,
            "семь" to 7.0, "восемь" to 8.0, "девять" to 9.0, "десять" to 10.0,
            // French
            "demi" to 0.5, "un" to 1.0, "une" to 1.0, "deux" to 2.0, "trois" to 3.0, "quatre" to 4.0,
            "cinq" to 5.0, "six" to 6.0, "sept" to 7.0, "huit" to 8.0, "neuf" to 9.0, "dix" to 10.0,
            // Spanish
            "medio" to 0.5, "media" to 0.5, "uno" to 1.0, "una" to 1.0, "dos" to 2.0, "tres" to 3.0,
            "cuatro" to 4.0, "cinco" to 5.0, "seis" to 6.0, "siete" to 7.0, "ocho" to 8.0, "nueve" to 9.0, "diez" to 10.0,
            // Amharic
            "ግማሽ" to 0.5, "አንድ" to 1.0, "ሁለት" to 2.0, "ሶስት" to 3.0, "አራት" to 4.0,
            "አምስት" to 5.0, "ስድስት" to 6.0, "ሰባት" to 7.0, "ስምንት" to 8.0, "ዘጠኝ" to 9.0, "አስር" to 10.0
        )
    }
}
