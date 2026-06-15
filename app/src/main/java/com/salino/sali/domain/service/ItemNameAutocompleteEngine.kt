package com.salino.sali.domain.service

import com.salino.sali.data.service.CategoryKeywordCatalog
import com.salino.sali.data.service.HouseholdHistoryIndex
import com.salino.sali.domain.model.ItemNameAutocompleteSource
import com.salino.sali.domain.model.ItemNameAutocompleteSuggestion
import com.salino.sali.util.normalizeItemName
import javax.inject.Inject
import javax.inject.Singleton

interface ItemNameAutocompleteEngine {
    fun suggest(
        query: String,
        historyIndex: HouseholdHistoryIndex,
        maxHistory: Int = 8,
        maxCatalog: Int = 8
    ): List<ItemNameAutocompleteSuggestion>
}

@Singleton
class ItemNameAutocompleteEngineImpl @Inject constructor(
    private val catalog: CategoryKeywordCatalog
) : ItemNameAutocompleteEngine {

    override fun suggest(
        query: String,
        historyIndex: HouseholdHistoryIndex,
        maxHistory: Int,
        maxCatalog: Int
    ): List<ItemNameAutocompleteSuggestion> {
        val trimmed = query.trim()
        if (trimmed.isEmpty()) return emptyList()

        val history = historyIndex.search(trimmed, maxHistory)
        val historyNormalized = history.map { normalizeItemName(it.displayName) }.toSet()

        val catalogSuggestions = catalog.search(
            query = trimmed,
            excludeNormalized = historyNormalized,
            limit = maxCatalog
        ).map { entry ->
            ItemNameAutocompleteSuggestion(
                displayName = entry.displayName,
                source = ItemNameAutocompleteSource.CATEGORY_CATALOG
            )
        }

        return history + catalogSuggestions
    }
}
