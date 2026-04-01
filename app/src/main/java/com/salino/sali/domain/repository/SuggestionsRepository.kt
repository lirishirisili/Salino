package com.salino.sali.domain.repository

import com.salino.sali.data.model.SuggestionItem
import kotlinx.coroutines.flow.Flow

interface SuggestionsRepository {
    fun observeSuggestions(householdId: String): Flow<List<SuggestionItem>>
}
