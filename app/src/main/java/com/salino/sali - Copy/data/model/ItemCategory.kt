package com.salino.sali.data.model

import com.salino.sali.R

enum class ItemCategory(val labelResId: Int) {
    DAIRY(R.string.category_dairy),
    VEGETABLES(R.string.category_vegetables),
    FRUITS(R.string.category_fruits),
    MEAT_FISH(R.string.category_meat_fish),
    BAKERY(R.string.category_bakery),
    CLEANING(R.string.category_cleaning),
    PANTRY(R.string.category_pantry),
    SNACKS(R.string.category_snacks),
    BEVERAGES(R.string.category_beverages),
    PHARMACY(R.string.category_pharmacy),
    OTHER(R.string.category_other);

    companion object {
        fun fromString(value: String?): ItemCategory =
            entries.find { it.name.equals(value, ignoreCase = true) } ?: OTHER
    }
}
