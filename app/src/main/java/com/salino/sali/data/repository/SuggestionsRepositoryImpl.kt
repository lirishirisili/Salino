package com.salino.sali.data.repository

import com.salino.sali.data.local.source.RecurringLocalDataSource
import com.salino.sali.data.local.source.ShoppingLocalDataSource
import com.salino.sali.data.model.SuggestionItem
import com.salino.sali.domain.repository.SuggestionsRepository
import com.salino.sali.domain.service.SuggestionEngine
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.combine
import javax.inject.Inject
import javax.inject.Singleton

@Singleton
class SuggestionsRepositoryImpl @Inject constructor(
    private val shoppingLocalDataSource: ShoppingLocalDataSource,
    private val recurringLocalDataSource: RecurringLocalDataSource,
    private val suggestionEngine: SuggestionEngine
) : SuggestionsRepository {

    override fun observeSuggestions(householdId: String): Flow<List<SuggestionItem>> = combine(
        shoppingLocalDataSource.observeActiveItems(householdId),
        shoppingLocalDataSource.observeBoughtItems(householdId),
        recurringLocalDataSource.observeRecurringItems(householdId)
    ) { activeItems, boughtItems, recurringItems ->
        suggestionEngine.buildSuggestions(
            activeItems = activeItems,
            boughtItems = boughtItems,
            recurringItems = recurringItems
        )
    }
}
