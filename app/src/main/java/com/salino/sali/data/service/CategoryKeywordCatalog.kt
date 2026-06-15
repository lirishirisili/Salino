package com.salino.sali.data.service

import com.salino.sali.util.normalizeItemName
import javax.inject.Inject
import javax.inject.Singleton

@Singleton
class CategoryKeywordCatalog @Inject constructor(
    private val keywordCategoryAutoDetector: KeywordCategoryAutoDetector
) {
    @Volatile
    private var entries: List<CategoryCatalogEntry> = emptyList()

    @Volatile
    private var byFirstChar: Map<Char, List<CategoryCatalogEntry>> = emptyMap()

    fun warmUp() {
        if (entries.isNotEmpty()) return
        synchronized(this) {
            if (entries.isNotEmpty()) return
            val loaded = keywordCategoryAutoDetector.catalogKeywordEntries()
                .sortedBy { normalizeItemName(it.displayName) }
            entries = loaded
            byFirstChar = loaded.groupBy { entry ->
                normalizeItemName(entry.displayName).firstOrNull() ?: '\u0000'
            }
        }
    }

    fun search(
        query: String,
        excludeNormalized: Set<String>,
        limit: Int
    ): List<CategoryCatalogEntry> {
        if (limit <= 0) return emptyList()
        warmUp()

        val normalizedQuery = normalizeItemName(query)
        if (normalizedQuery.isEmpty()) return emptyList()

        val candidates = byFirstChar[normalizedQuery.first()] ?: return emptyList()

        return candidates
            .asSequence()
            .filter { entry ->
                val normalized = normalizeItemName(entry.displayName)
                normalized !in excludeNormalized &&
                    ItemNameAutocompleteMatcher.matchesPrefix(entry.displayName, query)
            }
            .sortedByDescending { ItemNameAutocompleteMatcher.prefixMatchScore(it.displayName, query) }
            .take(limit)
            .toList()
    }
}
