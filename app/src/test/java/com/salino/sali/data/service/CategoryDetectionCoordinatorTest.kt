package com.salino.sali.data.service

import com.salino.sali.data.local.CategoryClassificationStore
import com.salino.sali.data.model.ItemCategory
import com.salino.sali.domain.service.AiCategoryClassifier
import com.salino.sali.domain.service.CategoryAutoDetector
import kotlinx.coroutines.runBlocking
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Test

class CategoryDetectionCoordinatorTest {

    @Test
    fun detectWithKeywords_returnsKeywordMatch() {
        val coordinator = coordinator(keywords = ItemCategory.DAIRY, ai = null)
        assertEquals(ItemCategory.DAIRY, coordinator.detectWithKeywords("חלב"))
    }

    @Test
    fun detectWithAi_usesCacheBeforeNetwork() = runBlocking {
        val cache = InMemoryCategoryStore(mapOf("חלב" to ItemCategory.DAIRY))
        val coordinator = CategoryDetectionCoordinator(
            keywordDetector = object : CategoryAutoDetector {
                override fun detectCategory(itemName: String): ItemCategory? = null
            },
            aiClassifier = object : AiCategoryClassifier {
                override suspend fun classify(itemName: String): ItemCategory? {
                    throw AssertionError("AI should not be called when cache hits")
                }
            },
            cache = cache
        )
        assertEquals(ItemCategory.DAIRY, coordinator.detectWithAi("חלב"))
    }

    @Test
    fun detectWithAi_returnsNullWhenAiReturnsNull() = runBlocking {
        val coordinator = coordinator(keywords = null, ai = null)
        assertNull(coordinator.detectWithAi("משהו לא מוכר"))
    }

    @Test
    fun isAutoDetectable_otherIsFalse() {
        val coordinator = coordinator(keywords = null, ai = null)
        assertFalse(coordinator.isAutoDetectable(ItemCategory.OTHER))
        assertEquals(true, coordinator.isAutoDetectable(ItemCategory.DAIRY))
    }

    private fun coordinator(keywords: ItemCategory?, ai: ItemCategory?): CategoryDetectionCoordinator {
        return CategoryDetectionCoordinator(
            keywordDetector = object : CategoryAutoDetector {
                override fun detectCategory(itemName: String): ItemCategory? = keywords
            },
            aiClassifier = object : AiCategoryClassifier {
                override suspend fun classify(itemName: String): ItemCategory? = ai
            },
            cache = InMemoryCategoryStore()
        )
    }

    private class InMemoryCategoryStore(
        initial: Map<String, ItemCategory> = emptyMap()
    ) : CategoryClassificationStore {
        private val store = initial.toMutableMap()

        override suspend fun get(normalizedName: String): ItemCategory? = store[normalizedName]

        override suspend fun put(normalizedName: String, category: ItemCategory) {
            store[normalizedName] = category
        }
    }
}
