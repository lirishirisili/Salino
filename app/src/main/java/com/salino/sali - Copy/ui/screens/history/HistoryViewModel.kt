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
import javax.inject.Inject

data class HistoryState(
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
                        _uiState.value = HistoryState(items = items, isLoading = false)
                    }
                }
        }
    }

    fun returnToList(itemId: String) {
        viewModelScope.launch {
            val user = authRepository.observeCurrentUser().filterNotNull().first()
            val householdId = user.activeHouseholdId ?: return@launch
            shoppingRepository.markAsActive(householdId, itemId)
        }
    }
}
