package com.salino.sali.data.service

import com.salino.sali.data.model.ItemCategory
import com.salino.sali.data.model.ItemStatus
import com.salino.sali.data.model.ShoppingItem
import com.salino.sali.domain.model.ItemNameAutocompleteSource
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

class HouseholdHistoryIndexTest {

    @Test
    fun boughtItems_increasePurchaseCount() {
        val bought = listOf(
            item(name = "חלב", bought = true),
            item(name = "חלב", bought = true)
        )
        val index = HouseholdHistoryIndex.from(emptyList(), bought, emptyList())
        val results = index.search("חל", limit = 5)
        assertEquals(1, results.size)
        assertEquals("חלב", results.first().displayName)
        assertEquals(2, results.first().purchaseCount)
    }

    @Test
    fun activeItems_boostAndProvideCategory() {
        val active = listOf(
            item(name = "חלב 3%", category = ItemCategory.DAIRY.name)
        )
        val index = HouseholdHistoryIndex.from(active, emptyList(), emptyList())
        val match = index.search("חל", limit = 5).first()
        assertEquals(ItemCategory.DAIRY, match.category)
        assertEquals(ItemNameAutocompleteSource.HOUSEHOLD_HISTORY, match.source)
    }

    @Test
    fun recurringItems_mergeIntoIndex() {
        val recurring = listOf(
            com.salino.sali.data.model.RecurringItem(
                name = "ביצים",
                normalizedName = "ביצים",
                category = ItemCategory.DAIRY.name
            )
        )
        val results = HouseholdHistoryIndex.from(emptyList(), emptyList(), recurring).search("ביצ", 5)
        assertEquals("ביצים", results.first().displayName)
    }

    private fun item(
        name: String,
        bought: Boolean = false,
        category: String = ItemCategory.OTHER.name
    ) = ShoppingItem(
        name = name,
        normalizedName = name.lowercase(),
        category = category,
        status = if (bought) ItemStatus.BOUGHT.name else ItemStatus.ACTIVE.name
    )
}
