package com.salino.sali.data.service

import com.salino.sali.data.model.ItemCategory
import com.salino.sali.data.model.ItemUnit
import com.salino.sali.data.model.RecurringItem
import com.salino.sali.data.model.ShoppingItem
import com.salino.sali.domain.model.ItemNameAutocompleteSource
import com.salino.sali.domain.model.ItemNameAutocompleteSuggestion
import com.salino.sali.util.normalizeItemName
import com.salino.sali.util.toEpochMillis

class HouseholdHistoryIndex private constructor(
    private val records: Map<String, HouseholdHistoryRecord>,
    private val byFirstChar: Map<Char, List<HouseholdHistoryRecord>>
) {

    fun search(query: String, limit: Int): List<ItemNameAutocompleteSuggestion> {
        if (limit <= 0) return emptyList()

        val normalizedQuery = normalizeItemName(query)
        if (normalizedQuery.isEmpty()) return emptyList()

        val candidates = byFirstChar[normalizedQuery.first()] ?: return emptyList()

        return candidates
            .mapNotNull { record ->
                val score = ItemNameAutocompleteMatcher.prefixMatchScore(record.displayName, query)
                if (score <= 0) return@mapNotNull null
                val rankScore = score +
                    record.purchaseCount * 10 +
                    record.activeBoost * 50 +
                    record.recurringBoost * 30 +
                    (record.lastUsedAtMillis / 1_000_000_000.0).toInt()
                record to rankScore
            }
            .sortedByDescending { it.second }
            .take(limit)
            .map { (record, _) ->
                ItemNameAutocompleteSuggestion(
                    displayName = record.displayName,
                    source = ItemNameAutocompleteSource.HOUSEHOLD_HISTORY,
                    category = record.category,
                    unit = record.unit,
                    quantity = record.quantity,
                    purchaseCount = record.purchaseCount,
                    lastUsedAtMillis = record.lastUsedAtMillis
                )
            }
    }

    fun normalizedNames(): Set<String> = records.keys

    companion object {
        val EMPTY = HouseholdHistoryIndex(emptyMap(), emptyMap())

        fun from(
            activeItems: List<ShoppingItem>,
            boughtItems: List<ShoppingItem>,
            recurringItems: List<RecurringItem>
        ): HouseholdHistoryIndex {
            val map = linkedMapOf<String, HouseholdHistoryRecord>()

            fun keyFor(item: ShoppingItem): String =
                item.normalizedName.ifBlank { normalizeItemName(item.name) }

            fun keyFor(item: RecurringItem): String =
                item.normalizedName.ifBlank { normalizeItemName(item.name) }

            fun ShoppingItem.epochMillis(): Long =
                updatedAt.toEpochMillis() ?: createdAt.toEpochMillis() ?: 0L

            boughtItems.forEach { item ->
                val key = keyFor(item)
                if (key.isBlank() || item.name.isBlank()) return@forEach
                val record = map.getOrPut(key) {
                    HouseholdHistoryRecord(normalizedName = key, displayName = item.name.trim())
                }
                record.purchaseCount++
                record.mergeFromItem(item, item.epochMillis())
            }

            activeItems.forEach { item ->
                val key = keyFor(item)
                if (key.isBlank() || item.name.isBlank()) return@forEach
                val record = map.getOrPut(key) {
                    HouseholdHistoryRecord(normalizedName = key, displayName = item.name.trim())
                }
                record.activeBoost = 1
                record.mergeFromItem(item, item.epochMillis())
            }

            recurringItems.forEach { item ->
                val key = keyFor(item)
                if (key.isBlank() || item.name.isBlank()) return@forEach
                val millis = item.updatedAt.toEpochMillis()
                    ?: item.lastCompletedAt.toEpochMillis()
                    ?: item.createdAt.toEpochMillis()
                    ?: 0L
                val record = map.getOrPut(key) {
                    HouseholdHistoryRecord(normalizedName = key, displayName = item.name.trim())
                }
                record.recurringBoost = 1
                record.mergeFromRecurring(item, millis)
            }

            val byFirstChar = map.values.groupBy { record ->
                normalizeItemName(record.displayName).firstOrNull() ?: '\u0000'
            }
            return HouseholdHistoryIndex(map, byFirstChar)
        }
    }
}

private data class HouseholdHistoryRecord(
    val normalizedName: String,
    var displayName: String,
    var category: ItemCategory? = null,
    var unit: ItemUnit? = null,
    var quantity: Double = 1.0,
    var purchaseCount: Int = 0,
    var activeBoost: Int = 0,
    var recurringBoost: Int = 0,
    var lastUsedAtMillis: Long = 0L
) {
    fun mergeFromItem(item: ShoppingItem, millis: Long) {
        displayName = item.name.trim()
        category = ItemCategory.fromString(item.category)
        unit = ItemUnit.fromString(item.unit)
        quantity = item.quantity
        if (millis >= lastUsedAtMillis) {
            lastUsedAtMillis = millis
        }
    }

    fun mergeFromRecurring(item: RecurringItem, millis: Long) {
        if (displayName.isBlank()) displayName = item.name.trim()
        if (category == null) category = ItemCategory.fromString(item.category)
        if (unit == null) unit = ItemUnit.fromString(item.unit)
        quantity = item.quantity
        if (millis >= lastUsedAtMillis) {
            lastUsedAtMillis = millis
        }
    }
}
