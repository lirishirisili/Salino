package com.salino.sali.feature.tour

import android.content.res.Resources
import com.salino.sali.R
import com.salino.sali.data.model.ItemCategory
import com.salino.sali.data.model.ItemStatus
import com.salino.sali.data.model.ItemUnit
import com.salino.sali.data.model.ShoppingItem
import com.salino.sali.data.model.SuggestionItem
import com.salino.sali.data.model.SuggestionSource

/** Demo list content shown only during the tour when the household list is empty. */
object TourPreview {
    fun isPreviewId(id: String): Boolean = id.startsWith("tour_demo_")

    fun suggestions(resources: Resources): List<SuggestionItem> = listOf(
        SuggestionItem(
            id = "tour_demo_s1",
            name = resources.getString(R.string.tour_preview_suggestion_milk),
            normalizedName = "tour_demo_milk",
            quantity = 1.0,
            unit = ItemUnit.LITERS.name,
            category = ItemCategory.DAIRY.name,
            reason = "frequent",
            source = SuggestionSource.FREQUENT,
        ),
        SuggestionItem(
            id = "tour_demo_s2",
            name = resources.getString(R.string.tour_preview_suggestion_bread),
            normalizedName = "tour_demo_bread",
            quantity = 1.0,
            unit = ItemUnit.PIECES.name,
            category = ItemCategory.BAKERY.name,
            reason = "frequent",
            source = SuggestionSource.FREQUENT,
        ),
        SuggestionItem(
            id = "tour_demo_s3",
            name = resources.getString(R.string.tour_preview_suggestion_tomatoes),
            normalizedName = "tour_demo_tomatoes",
            quantity = 1.0,
            unit = ItemUnit.KG.name,
            category = ItemCategory.VEGETABLES.name,
            reason = "recent",
            source = SuggestionSource.RECENT,
        ),
    )

    fun items(resources: Resources): List<ShoppingItem> = listOf(
        ShoppingItem(
            id = "tour_demo_i1",
            name = resources.getString(R.string.tour_preview_item_milk),
            normalizedName = "tour_demo_milk",
            quantity = 1.0,
            unit = ItemUnit.LITERS.name,
            category = ItemCategory.DAIRY.name,
            status = ItemStatus.ACTIVE.name,
            addedBy = "tour",
        ),
        ShoppingItem(
            id = "tour_demo_i2",
            name = resources.getString(R.string.tour_preview_item_bread),
            normalizedName = "tour_demo_bread",
            quantity = 1.0,
            unit = ItemUnit.PIECES.name,
            category = ItemCategory.BAKERY.name,
            status = ItemStatus.ACTIVE.name,
            addedBy = "tour",
        ),
        ShoppingItem(
            id = "tour_demo_i3",
            name = resources.getString(R.string.tour_preview_item_dish_soap),
            normalizedName = "tour_demo_dish_soap",
            quantity = 1.0,
            unit = ItemUnit.PIECES.name,
            category = ItemCategory.CLEANING.name,
            status = ItemStatus.ACTIVE.name,
            addedBy = "tour",
        ),
    )
}
