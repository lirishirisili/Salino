package com.salino.sali.data.service

import com.salino.sali.data.model.ItemCategory
import com.salino.sali.data.model.ItemStatus
import com.salino.sali.data.model.ShoppingItem
import com.salino.sali.domain.model.ItemNameAutocompleteSource
import com.salino.sali.domain.service.ItemNameAutocompleteEngineImpl
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

class ItemNameAutocompleteEngineTest {

    private val detector = KeywordCategoryAutoDetector()
    private val catalog = CategoryKeywordCatalog(detector)
    private val engine = ItemNameAutocompleteEngineImpl(catalog)

    @Test
    fun historySuggestions_appearBeforeCatalog() {
        val history = HouseholdHistoryIndex.from(
            activeItems = listOf(
                ShoppingItem(
                    name = "חלב",
                    normalizedName = "חלב",
                    category = ItemCategory.DAIRY.name
                )
            ),
            boughtItems = emptyList(),
            recurringItems = emptyList()
        )
        val results = engine.suggest("חל", history)
        assertTrue(results.isNotEmpty())
        assertEquals(ItemNameAutocompleteSource.HOUSEHOLD_HISTORY, results.first().source)
    }

    @Test
    fun catalogFills_whenNoHouseholdMatch() {
        val history = HouseholdHistoryIndex.EMPTY
        val results = engine.suggest("חל", history, maxHistory = 0, maxCatalog = 10)
        assertTrue(results.isNotEmpty())
        assertEquals(ItemNameAutocompleteSource.CATEGORY_CATALOG, results.first().source)
        assertTrue(results.any { it.displayName.contains("חלב") })
    }

    @Test
    fun catalogExcludes_historyDisplayNames() {
        val history = HouseholdHistoryIndex.from(
            activeItems = listOf(
                ShoppingItem(name = "חלב", normalizedName = "חלב", category = ItemCategory.DAIRY.name)
            ),
            boughtItems = emptyList(),
            recurringItems = emptyList()
        )
        val results = engine.suggest("חלב", history, maxCatalog = 20)
        val catalogNames = results
            .filter { it.source == ItemNameAutocompleteSource.CATEGORY_CATALOG }
            .map { it.displayName }
        assertTrue(catalogNames.none { it == "חלב" })
    }

    @Test
    fun emptyQuery_returnsEmpty() {
        assertTrue(engine.suggest("", HouseholdHistoryIndex.EMPTY).isEmpty())
    }

    @Test
    fun boughtFrequency_ranksHigher() {
        val bought = listOf(
            ShoppingItem(name = "חלב", normalizedName = "חלב", status = ItemStatus.BOUGHT.name),
            ShoppingItem(name = "חלב", normalizedName = "חלב", status = ItemStatus.BOUGHT.name),
            ShoppingItem(name = "חמאה", normalizedName = "חמאה", status = ItemStatus.BOUGHT.name)
        )
        val history = HouseholdHistoryIndex.from(emptyList(), bought, emptyList())
        val first = engine.suggest("ח", history).first()
        assertEquals("חלב", first.displayName)
    }
}
