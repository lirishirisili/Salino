package com.salino.sali.domain.service

import com.salino.sali.data.model.RecurringItem
import com.salino.sali.data.model.ShoppingItem
import com.salino.sali.data.model.SuggestionItem

interface SuggestionEngine {
    fun buildSuggestions(
        activeItems: List<ShoppingItem>,
        boughtItems: List<ShoppingItem>,
        recurringItems: List<RecurringItem>,
        nowMillis: Long = System.currentTimeMillis()
    ): List<SuggestionItem>
}
