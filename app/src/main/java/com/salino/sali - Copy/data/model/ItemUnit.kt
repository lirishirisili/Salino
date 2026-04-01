package com.salino.sali.data.model

import com.salino.sali.R

enum class ItemUnit(val labelResId: Int) {
    PIECES(R.string.unit_pieces),
    KG(R.string.unit_kg),
    GRAMS(R.string.unit_grams),
    LITERS(R.string.unit_liters),
    PACKS(R.string.unit_packs),
    BOTTLES(R.string.unit_bottles),
    BAGS(R.string.unit_bags);

    companion object {
        fun fromString(value: String?): ItemUnit? =
            entries.find { it.name.equals(value, ignoreCase = true) }
    }
}
