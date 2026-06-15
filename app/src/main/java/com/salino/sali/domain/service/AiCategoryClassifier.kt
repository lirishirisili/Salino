package com.salino.sali.domain.service

import com.salino.sali.data.model.ItemCategory

interface AiCategoryClassifier {
    suspend fun classify(itemName: String): ItemCategory?
}
