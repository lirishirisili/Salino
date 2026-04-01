package com.salino.sali.domain.service

import com.salino.sali.data.model.ItemCategory

interface CategoryAutoDetector {
    fun detectCategory(itemName: String): ItemCategory?
}
