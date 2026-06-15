package com.salino.sali.data.local

import com.salino.sali.data.model.ItemCategory

interface CategoryClassificationStore {
    suspend fun get(normalizedName: String): ItemCategory?
    suspend fun put(normalizedName: String, category: ItemCategory)
}
