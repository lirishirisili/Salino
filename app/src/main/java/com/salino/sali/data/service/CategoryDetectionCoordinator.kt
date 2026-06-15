package com.salino.sali.data.service

import com.salino.sali.data.local.CategoryClassificationStore
import com.salino.sali.data.model.ItemCategory
import com.salino.sali.domain.service.AiCategoryClassifier
import com.salino.sali.domain.service.CategoryAutoDetector
import com.salino.sali.util.normalizeItemName
import javax.inject.Inject
import javax.inject.Singleton

/**
 * Two-stage classification: strict local keywords first, Gemini only when keywords abstain.
 * Local layer never uses fuzzy/substring guessing — null means "not sure, ask AI".
 */
@Singleton
class CategoryDetectionCoordinator @Inject constructor(
    private val keywordDetector: CategoryAutoDetector,
    private val aiClassifier: AiCategoryClassifier,
    private val cache: CategoryClassificationStore
) {
    fun detectWithKeywords(itemName: String): ItemCategory? =
        keywordDetector.detectCategory(itemName)

    suspend fun detectWithAi(itemName: String): ItemCategory? {
        val normalized = normalizeItemName(itemName)
        if (normalized.length < 2) return null

        cache.get(normalized)?.let { return it }

        val category = aiClassifier.classify(itemName) ?: return null
        cache.put(normalized, category)
        return category
    }

    fun isAutoDetectable(category: ItemCategory): Boolean =
        category != ItemCategory.OTHER
}
