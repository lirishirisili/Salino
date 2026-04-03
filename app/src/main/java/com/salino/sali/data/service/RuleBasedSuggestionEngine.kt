package com.salino.sali.data.service

import com.salino.sali.data.model.ItemCategory
import com.salino.sali.data.model.RecurringItem
import com.salino.sali.data.model.ShoppingItem
import com.salino.sali.data.model.SuggestionItem
import com.salino.sali.data.model.SuggestionSource
import com.salino.sali.domain.service.SuggestionEngine
import com.salino.sali.util.normalizeItemName
import javax.inject.Inject

class RuleBasedSuggestionEngine @Inject constructor() : SuggestionEngine {
    override fun buildSuggestions(
        activeItems: List<ShoppingItem>,
        boughtItems: List<ShoppingItem>,
        recurringItems: List<RecurringItem>,
        nowMillis: Long
    ): List<SuggestionItem> {
        val activeNames = activeItems.map { it.normalizedName.ifBlank { normalizeItemName(it.name) } }.toSet()
        val suggestions = linkedMapOf<String, SuggestionItem>()

        recurringItems
            .filter { it.enabled && (it.nextDueAt == null || it.nextDueAt.toDate().time <= nowMillis) }
            .forEach { recurring ->
                val normalizedName = recurring.normalizedName.ifBlank { normalizeItemName(recurring.name) }
                if (normalizedName !in activeNames) {
                    suggestions.putIfAbsent(
                        normalizedName,
                        SuggestionItem(
                            id = "recurring_${recurring.id}",
                            name = recurring.name,
                            normalizedName = normalizedName,
                            quantity = recurring.quantity,
                            unit = recurring.unit,
                            category = recurring.category,
                            note = recurring.note,
                            reason = "due",
                            source = SuggestionSource.RECURRING,
                            recurringItemId = recurring.id
                        )
                    )
                }
            }

        boughtItems
            .groupBy { it.normalizedName.ifBlank { normalizeItemName(it.name) } }
            .entries
            .sortedByDescending { it.value.size }
            .take(4)
            .forEach { entry ->
                val first = entry.value.first()
                if (entry.key !in activeNames) {
                    suggestions.putIfAbsent(
                        entry.key,
                        SuggestionItem(
                            id = "frequent_${entry.key}",
                            name = first.name,
                            normalizedName = entry.key,
                            quantity = 1.0,
                            unit = first.unit,
                            category = first.category.ifBlank { ItemCategory.OTHER.name },
                            note = first.note,
                            reason = "frequent",
                            source = SuggestionSource.FREQUENT
                        )
                    )
                }
            }

        boughtItems
            .sortedByDescending { it.updatedAt?.toDate()?.time ?: 0L }
            .take(4)
            .forEach { item ->
                val normalizedName = item.normalizedName.ifBlank { normalizeItemName(item.name) }
                if (normalizedName !in activeNames) {
                    suggestions.putIfAbsent(
                        normalizedName,
                        SuggestionItem(
                            id = "recent_${item.id}",
                            name = item.name,
                            normalizedName = normalizedName,
                            quantity = 1.0,
                            unit = item.unit,
                            category = item.category,
                            note = item.note,
                            reason = "recent",
                            source = SuggestionSource.RECENT
                        )
                    )
                }
            }

        return suggestions.values.take(6)
    }
}
