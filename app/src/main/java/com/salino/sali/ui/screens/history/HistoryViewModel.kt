package com.salino.sali.ui.screens.history

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.salino.sali.data.model.ShoppingItem
import com.salino.sali.domain.repository.AuthRepository
import com.salino.sali.domain.repository.ShoppingRepository
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.collectLatest
import kotlinx.coroutines.flow.filterNotNull
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.launch
import java.text.SimpleDateFormat
import java.util.Locale
import javax.inject.Inject

data class DayGroup(
    val dateLabel: String,
    val items: List<ShoppingItem>
)

data class HistoryState(
    val dayGroups: List<DayGroup> = emptyList(),
    val expandedDays: Set<String> = emptySet(),
    val items: List<ShoppingItem> = emptyList(),
    val isLoading: Boolean = true
)

@HiltViewModel
class HistoryViewModel @Inject constructor(
    private val shoppingRepository: ShoppingRepository,
    private val authRepository: AuthRepository
) : ViewModel() {

    private val _uiState = MutableStateFlow(HistoryState())
    val uiState: StateFlow<HistoryState> = _uiState

    private val dateFormatter = SimpleDateFormat("dd/MM/yyyy", Locale.getDefault())

    init {
        observeBoughtItems()
    }

    @OptIn(ExperimentalCoroutinesApi::class)
    private fun observeBoughtItems() {
        viewModelScope.launch {
            authRepository.observeCurrentUser()
                .filterNotNull()
                .collectLatest { user ->
                    val householdId = user.activeHouseholdId ?: return@collectLatest
                    shoppingRepository.observeBoughtItems(householdId).collect { items ->
                        val groups = items
                            .sortedByDescending { it.updatedAt?.toDate()?.time ?: 0L }
                            .groupBy { item ->
                                val date = item.updatedAt?.toDate()
                                if (date != null) dateFormatter.format(date) else ""
                            }
                            .map { (dateLabel, groupItems) -> DayGroup(dateLabel, groupItems) }

                        val expandedDays = _uiState.value.expandedDays

                        _uiState.value = HistoryState(
                            dayGroups = groups,
                            expandedDays = expandedDays,
                            items = items,
                            isLoading = false
                        )
                    }
                }
        }
    }

    fun toggleDay(dateLabel: String) {
        val current = _uiState.value.expandedDays
        _uiState.value = _uiState.value.copy(
            expandedDays = if (current.contains(dateLabel)) current - dateLabel else current + dateLabel
        )
    }

    fun returnToList(itemId: String) {
        viewModelScope.launch {
            val user = authRepository.observeCurrentUser().filterNotNull().first()
            val householdId = user.activeHouseholdId ?: return@launch
            shoppingRepository.markAsActive(householdId, itemId)
        }
    }
}
