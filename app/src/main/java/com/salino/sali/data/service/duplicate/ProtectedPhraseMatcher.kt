package com.salino.sali.data.service.duplicate

import javax.inject.Inject

/**
 * Detects multi-word phrases that should be treated as a single product concept.
 * For example, "שוקולד חלב" (chocolate milk) should not match "חלב" (milk).
 */
class ProtectedPhraseMatcher @Inject constructor() {

    data class PhraseMatch(
        val phrase: String,
        val canonicalId: String,
        val tokensConsumed: List<String>
    )

    /**
     * Protected phrases mapped to canonical product IDs.
     * Order matters: longer/more specific phrases should come first.
     */
    private val protectedPhrases: List<Pair<List<String>, String>> = listOf(
        // Milk variants — must come before standalone "חלב"
        listOf("חלב", "ללא", "לקטוז") to "lactose_free_milk",
        listOf("שוקולד", "חלב") to "chocolate_milk",
        listOf("חלב", "שקדים") to "almond_milk",
        listOf("חלב", "קוקוס") to "coconut_milk",
        listOf("חלב", "סויה") to "soy_milk",
        listOf("חלב", "עיזים") to "goat_milk",
        listOf("חלב", "שיבולת", "שועל") to "oat_milk",
        // Hygiene / household
        listOf("נייר", "טואלט") to "toilet_paper",
        listOf("משחת", "שיניים") to "toothpaste",
        listOf("מברשת", "שיניים") to "toothbrush",
        listOf("מגבונים", "לחים") to "wet_wipes",
        listOf("סבון", "כלים") to "dish_soap",
        listOf("סבון", "ידיים") to "hand_soap",
        listOf("מרכך", "כביסה") to "fabric_softener",
        listOf("אבקת", "כביסה") to "laundry_detergent",
        listOf("נוזל", "כביסה") to "laundry_liquid",
        listOf("שקיות", "זבל") to "trash_bags",
        listOf("נייר", "סופג") to "paper_towels",
        // Food compounds
        listOf("חמאת", "בוטנים") to "peanut_butter",
        listOf("שמן", "זית") to "olive_oil",
        listOf("שמן", "קנולה") to "canola_oil",
        listOf("רסק", "עגבניות") to "tomato_paste",
        listOf("קמח", "מלא") to "whole_wheat_flour",
        listOf("אורז", "מלא") to "brown_rice",
        listOf("לחם", "מלא") to "whole_wheat_bread",
        listOf("גבינה", "צהובה") to "yellow_cheese",
        listOf("גבינה", "לבנה") to "white_cheese",
        listOf("גבינת", "קוטג") to "cottage_cheese",
        listOf("שמנת", "חמוצה") to "sour_cream",
        listOf("שמנת", "מתוקה") to "sweet_cream",
        listOf("קרם", "לגוף") to "body_cream",
        // English compounds
        listOf("toilet", "paper") to "toilet_paper",
        listOf("paper", "towels") to "paper_towels",
        listOf("olive", "oil") to "olive_oil",
        listOf("peanut", "butter") to "peanut_butter",
        listOf("chocolate", "milk") to "chocolate_milk",
        listOf("almond", "milk") to "almond_milk",
        listOf("coconut", "milk") to "coconut_milk",
        listOf("oat", "milk") to "oat_milk",
        listOf("soy", "milk") to "soy_milk",
        listOf("dish", "soap") to "dish_soap",
        listOf("trash", "bags") to "trash_bags",
        listOf("tomato", "paste") to "tomato_paste",
        listOf("sour", "cream") to "sour_cream",

        // ── Russian (Русский) ──
        listOf("средство", "для", "посуды") to "dish_soap",
        listOf("шоколадное", "молоко") to "chocolate_milk",
        listOf("миндальное", "молоко") to "almond_milk",
        listOf("кокосовое", "молоко") to "coconut_milk",
        listOf("соевое", "молоко") to "soy_milk",
        listOf("овсяное", "молоко") to "oat_milk",
        listOf("козье", "молоко") to "goat_milk",
        listOf("туалетная", "бумага") to "toilet_paper",
        listOf("бумажные", "полотенца") to "paper_towels",
        listOf("оливковое", "масло") to "olive_oil",
        listOf("арахисовая", "паста") to "peanut_butter",
        listOf("томатная", "паста") to "tomato_paste",
        listOf("зубная", "паста") to "toothpaste",
        listOf("зубная", "щетка") to "toothbrush",
        listOf("мусорные", "пакеты") to "trash_bags",
        listOf("стиральный", "порошок") to "laundry_detergent",
        listOf("влажные", "салфетки") to "wet_wipes",
        listOf("желтый", "сыр") to "yellow_cheese",
        listOf("белый", "сыр") to "white_cheese",

        // ── Arabic (العربية) — using normalized forms (hamza removed from alef) ──
        listOf("حليب", "جوز", "هند") to "coconut_milk",
        listOf("زبدة", "فول", "سوداني") to "peanut_butter",
        listOf("حليب", "شوكولاتة") to "chocolate_milk",
        listOf("حليب", "لوز") to "almond_milk",
        listOf("حليب", "صويا") to "soy_milk",
        listOf("حليب", "شوفان") to "oat_milk",
        listOf("حليب", "ماعز") to "goat_milk",
        listOf("ورق", "تواليت") to "toilet_paper",
        listOf("زيت", "زيتون") to "olive_oil",
        listOf("معجون", "طماطم") to "tomato_paste",
        listOf("معجون", "اسنان") to "toothpaste",
        listOf("فرشاة", "اسنان") to "toothbrush",
        listOf("صابون", "جلي") to "dish_soap",
        listOf("اكياس", "قمامة") to "trash_bags",
        listOf("مناشف", "ورقية") to "paper_towels",
        listOf("مناديل", "مبللة") to "wet_wipes",
        listOf("مسحوق", "غسيل") to "laundry_detergent",
        listOf("جبنة", "صفراء") to "yellow_cheese",
        listOf("جبنة", "بيضاء") to "white_cheese",

        // ── French (Français) — accents removed by NFD normalization ──
        listOf("lait", "chocolat") to "chocolate_milk",
        listOf("lait", "amande") to "almond_milk",
        listOf("lait", "coco") to "coconut_milk",
        listOf("lait", "soja") to "soy_milk",
        listOf("lait", "avoine") to "oat_milk",
        listOf("lait", "chevre") to "goat_milk",
        listOf("papier", "toilette") to "toilet_paper",
        listOf("huile", "olive") to "olive_oil",
        listOf("beurre", "cacahuete") to "peanut_butter",
        listOf("concentre", "tomate") to "tomato_paste",
        listOf("essuie", "tout") to "paper_towels",
        listOf("brosse", "dents") to "toothbrush",
        listOf("liquide", "vaisselle") to "dish_soap",
        listOf("sacs", "poubelle") to "trash_bags",
        listOf("lingettes", "humides") to "wet_wipes",
        listOf("lessive", "liquide") to "laundry_liquid",
        listOf("fromage", "blanc") to "white_cheese",
        listOf("creme", "fraiche") to "sour_cream",

        // ── Spanish (Español) — accents removed by NFD normalization ──
        listOf("leche", "chocolate") to "chocolate_milk",
        listOf("leche", "almendras") to "almond_milk",
        listOf("leche", "coco") to "coconut_milk",
        listOf("leche", "soja") to "soy_milk",
        listOf("leche", "avena") to "oat_milk",
        listOf("leche", "cabra") to "goat_milk",
        listOf("papel", "higienico") to "toilet_paper",
        listOf("aceite", "oliva") to "olive_oil",
        listOf("pasta", "dientes") to "toothpaste",
        listOf("cepillo", "dientes") to "toothbrush",
        listOf("jabon", "platos") to "dish_soap",
        listOf("bolsas", "basura") to "trash_bags",
        listOf("papel", "cocina") to "paper_towels",
        listOf("toallitas", "humedas") to "wet_wipes",
        listOf("queso", "amarillo") to "yellow_cheese",
        listOf("queso", "blanco") to "white_cheese",
        listOf("crema", "agria") to "sour_cream",
        listOf("detergente", "ropa") to "laundry_detergent",

        // ── Amharic (አማርኛ) ──
        listOf("ዘይት", "ወይራ") to "olive_oil",
        listOf("የጥርስ", "ሳሙና") to "toothpaste",
        listOf("የጥርስ", "ብሩሽ") to "toothbrush",
        listOf("ቸኮሌት", "ወተት") to "chocolate_milk",
        listOf("የሽንት", "ቤት", "ወረቀት") to "toilet_paper",
    )

    /**
     * Finds the best (longest) protected phrase match in the given tokens.
     * Returns null if no protected phrase is found.
     */
    fun findMatch(tokens: List<String>): PhraseMatch? {
        if (tokens.isEmpty()) return null

        // Try longest phrases first (they appear first in the list by construction)
        for ((phraseTokens, canonicalId) in protectedPhrases) {
            if (phraseTokens.size > tokens.size) continue
            if (containsAllTokens(tokens, phraseTokens)) {
                return PhraseMatch(
                    phrase = phraseTokens.joinToString(" "),
                    canonicalId = canonicalId,
                    tokensConsumed = phraseTokens
                )
            }
        }
        return null
    }

    private fun containsAllTokens(inputTokens: List<String>, phraseTokens: List<String>): Boolean {
        val remaining = inputTokens.toMutableList()
        for (pt in phraseTokens) {
            val idx = remaining.indexOf(pt)
            if (idx == -1) return false
            remaining.removeAt(idx)
        }
        return true
    }
}
