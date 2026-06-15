package com.salino.sali.data.service

import com.salino.sali.data.model.ItemCategory

/**
 * Conservative keyword scoring: never guess from similarity.
 * Only exact full name, phrase boundaries, multi-word phrases, or exact token hits count.
 * Uncertain items return null and flow to AI classification.
 */
internal object CategoryScoringRules {

    const val SCORE_EXACT_FULL = 120
    const val SCORE_PHRASE_BOUNDARY = 70
    const val SCORE_MULTI_WORD_PHRASE = 65
    const val SCORE_EXACT_TOKEN = 26

    const val HIGH_CONFIDENCE_THRESHOLD = 70
    const val TOKEN_ONLY_THRESHOLD = 26

    fun phraseBoundaryScore(normalized: String, normalizedKeyword: String): Int {
        if (normalized == normalizedKeyword) return SCORE_EXACT_FULL
        if (normalized.startsWith("$normalizedKeyword ") || normalized.endsWith(" $normalizedKeyword")) {
            return SCORE_PHRASE_BOUNDARY
        }
        if (normalizedKeyword.contains(' ') && normalized.contains(normalizedKeyword)) {
            return SCORE_MULTI_WORD_PHRASE
        }
        return 0
    }

    fun exactTokenScore(tokens: List<String>, normalizedKeyword: String): Int {
        if (normalizedKeyword.contains(' ')) return 0
        val keywordToken = normalizedKeyword.trim()
        if (keywordToken.isBlank()) return 0
        return if (tokens.any { it == keywordToken }) SCORE_EXACT_TOKEN else 0
    }

    fun pickConfidentCategory(scores: Map<ItemCategory, Int>): ItemCategory? {
        if (scores.isEmpty()) return null
        val ranked = scores.entries.sortedByDescending { it.value }
        val best = ranked.first()
        val secondScore = ranked.getOrNull(1)?.value ?: 0

        if (best.value >= HIGH_CONFIDENCE_THRESHOLD) return best.key
        if (best.value >= TOKEN_ONLY_THRESHOLD && secondScore == 0) return best.key
        return null
    }
}
