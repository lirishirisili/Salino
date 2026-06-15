package com.salino.sali.data.service

import com.salino.sali.util.normalizeItemName

internal object ItemNameAutocompleteMatcher {

    fun prefixMatchScore(displayName: String, query: String): Int {
        val normalizedQuery = normalizeItemName(query)
        if (normalizedQuery.isBlank()) return 0

        val normalizedDisplay = normalizeItemName(displayName)
        if (normalizedDisplay.isBlank()) return 0

        if (normalizedDisplay.startsWith(normalizedQuery)) {
            return if (normalizedDisplay == normalizedQuery) 120 else 100
        }

        val firstToken = normalizedDisplay.split(" ").firstOrNull().orEmpty()
        return if (firstToken.startsWith(normalizedQuery)) 80 else 0
    }

    fun matchesPrefix(displayName: String, query: String): Boolean =
        prefixMatchScore(displayName, query) > 0
}
