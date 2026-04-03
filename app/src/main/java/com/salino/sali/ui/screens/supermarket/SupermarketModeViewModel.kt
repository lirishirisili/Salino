package com.salino.sali.ui.screens.supermarket

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.salino.sali.data.model.ItemCategory
import com.salino.sali.data.model.ShoppingItem
import com.salino.sali.domain.repository.AuthRepository
import com.salino.sali.domain.repository.ShoppingRepository
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import javax.inject.Inject

data class SupermarketModeState(
    val groupedItems: Map<ItemCategory, List<ShoppingItem>> = emptyMap(),
    val remainingCount: Int = 0,
    val isLoading: Boolean = true,
    val currentUserId: String = "",
    val currentUserName: String = "",
    val showOnlyPharm: Boolean = false
)

@HiltViewModel
class SupermarketModeViewModel @Inject constructor(
    private val shoppingRepository: ShoppingRepository,
    private val authRepository: AuthRepository
) : ViewModel() {

    private val _uiState = MutableStateFlow(SupermarketModeState())
    val uiState: StateFlow<SupermarketModeState> = _uiState

    private var householdId: String = ""

    private var allActiveItems: List<ShoppingItem> = emptyList()

    init {
        viewModelScope.launch {
            val user = authRepository.observeCurrentUser().first() ?: return@launch
            val activeHouseholdId = user.activeHouseholdId ?: return@launch
            householdId = activeHouseholdId
            _uiState.update { it.copy(currentUserId = user.id, currentUserName = user.displayName) }
            shoppingRepository.observeActiveItems(activeHouseholdId).collect { items ->
                allActiveItems = items
                updateGroupedItems()
            }
        }
    }

    fun togglePharmFilter() {
        _uiState.update { it.copy(showOnlyPharm = !it.showOnlyPharm) }
        updateGroupedItems()
    }

    private fun updateGroupedItems() {
        val state = _uiState.value
        val itemsToDisplay = if (state.showOnlyPharm) {
            allActiveItems.filter { ItemCategory.fromString(it.category) == ItemCategory.PHARMACY }
        } else {
            allActiveItems
        }

        _uiState.value = state.copy(
            groupedItems = itemsToDisplay.groupBy { ItemCategory.fromString(it.category) }
                .toSortedMap(compareBy { it.ordinal }),
            remainingCount = itemsToDisplay.size,
            isLoading = false
        )
    }

    fun markAsBought(itemId: String) {
        viewModelScope.launch {
            runCatching {
                shoppingRepository.markAsBought(
                    householdId = householdId,
                    itemId = itemId,
                    userId = _uiState.value.currentUserId,
                    userName = _uiState.value.currentUserName
                )
            }
        }
    }
}
