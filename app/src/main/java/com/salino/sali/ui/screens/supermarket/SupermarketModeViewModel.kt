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
    val totalCount: Int = 0,
    val boughtInSessionCount: Int = 0,
    val isLoading: Boolean = true,
    val currentUserId: String = "",
    val currentUserName: String = "",
    val showOnlyPharm: Boolean = false,
    val lastBoughtItem: ShoppingItem? = null,
    val allDone: Boolean = false,
    val collapsedCategories: Set<ItemCategory> = emptySet()
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
    private var sessionStartItemCount: Int = 0
    private var sessionStarted: Boolean = false

    init {
        viewModelScope.launch {
            val user = authRepository.observeCurrentUser().first() ?: return@launch
            val activeHouseholdId = user.activeHouseholdId ?: return@launch
            householdId = activeHouseholdId
            _uiState.update { it.copy(currentUserId = user.id, currentUserName = user.displayName) }
            shoppingRepository.observeActiveItems(activeHouseholdId).collect { items ->
                allActiveItems = items
                if (!sessionStarted) {
                    sessionStartItemCount = items.size
                    sessionStarted = true
                }
                updateGroupedItems()
            }
        }
    }

    fun togglePharmFilter() {
        _uiState.update { it.copy(showOnlyPharm = !it.showOnlyPharm) }
        updateGroupedItems()
    }

    fun toggleCategoryCollapse(category: ItemCategory) {
        _uiState.update { state ->
            val newCollapsed = if (category in state.collapsedCategories) {
                state.collapsedCategories - category
            } else {
                state.collapsedCategories + category
            }
            state.copy(collapsedCategories = newCollapsed)
        }
    }

    private fun updateGroupedItems() {
        val state = _uiState.value
        val itemsToDisplay = if (state.showOnlyPharm) {
            allActiveItems.filter { ItemCategory.fromString(it.category) == ItemCategory.PHARMACY }
        } else {
            allActiveItems
        }

        val boughtInSession = (sessionStartItemCount - allActiveItems.size).coerceAtLeast(0)
        val allDone = sessionStarted && allActiveItems.isEmpty() && sessionStartItemCount > 0

        _uiState.value = state.copy(
            groupedItems = itemsToDisplay
                .sortedByDescending { it.isFavorite }
                .groupBy { ItemCategory.fromString(it.category) }
                .toSortedMap(compareBy { it.ordinal }),
            remainingCount = itemsToDisplay.size,
            totalCount = sessionStartItemCount,
            boughtInSessionCount = boughtInSession,
            isLoading = false,
            allDone = allDone
        )
    }

    fun markAsBought(item: ShoppingItem) {
        _uiState.update { it.copy(lastBoughtItem = item) }
        viewModelScope.launch {
            runCatching {
                shoppingRepository.markAsBought(
                    householdId = householdId,
                    itemId = item.id,
                    userId = _uiState.value.currentUserId,
                    userName = _uiState.value.currentUserName
                )
            }
        }
    }

    fun undoLastBought() {
        val lastBought = _uiState.value.lastBoughtItem ?: return
        _uiState.update { it.copy(lastBoughtItem = null) }
        viewModelScope.launch {
            runCatching {
                shoppingRepository.markAsActive(householdId, lastBought.id)
            }
        }
    }

    fun clearLastBought() {
        _uiState.update { it.copy(lastBoughtItem = null) }
    }
}
