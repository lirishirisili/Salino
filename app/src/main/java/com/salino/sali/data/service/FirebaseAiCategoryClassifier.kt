package com.salino.sali.data.service

import com.google.firebase.functions.FirebaseFunctions
import com.salino.sali.data.model.ItemCategory
import com.salino.sali.domain.service.AiCategoryClassifier
import kotlinx.coroutines.tasks.await
import javax.inject.Inject
import javax.inject.Singleton

@Singleton
class FirebaseAiCategoryClassifier @Inject constructor(
    private val functions: FirebaseFunctions
) : AiCategoryClassifier {

    override suspend fun classify(itemName: String): ItemCategory? {
        val trimmed = itemName.trim()
        if (trimmed.length < 2) return null

        return runCatching {
            val result = functions
                .getHttpsCallable(FUNCTION_NAME)
                .call(mapOf("itemName" to trimmed))
                .await()

            val data = result.data as? Map<*, *> ?: return null
            val categoryName = data["category"] as? String ?: return null
            ItemCategory.entries.find { it.name.equals(categoryName, ignoreCase = true) }
        }.getOrNull()
    }

    companion object {
        private const val FUNCTION_NAME = "classifyItemCategory"
    }
}
