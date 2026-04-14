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

enum class SupermarketFilter {
    ALL, URGENT, MINE, PHARMACY, NOT_FOUND
}

data class SupermarketModeState(
    val groupedItems: Map<ItemCategory, List<ShoppingItem>> = emptyMap(),
    val remainingCount: Int = 0,
    val totalCount: Int = 0,
    val boughtInSessionCount: Int = 0,
    val isLoading: Boolean = true,
    val currentUserId: String = "",
    val currentUserName: String = "",
    val activeFilter: SupermarketFilter = SupermarketFilter.ALL,
    val lastBoughtItem: ShoppingItem? = null,
    val allDone: Boolean = false,
    val collapsedCategories: Set<ItemCategory> = emptySet(),
    val notFoundItems: Set<String> = emptySet(),
    val hideBought: Boolean = true,
    val boughtItems: List<ShoppingItem> = emptyList(),
    val notFoundCount: Int = 0
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
    private var sessionBoughtItems: MutableList<ShoppingItem> = mutableListOf()
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

    fun setFilter(filter: SupermarketFilter) {
        _uiState.update { it.copy(activeFilter = filter) }
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

    fun toggleHideBought() {
        _uiState.update { it.copy(hideBought = !it.hideBought) }
    }

    private fun updateGroupedItems() {
        val state = _uiState.value
        val notFoundIds = state.notFoundItems

        val activeNonNotFound = allActiveItems.filter { it.id !in notFoundIds }
        val notFoundList = allActiveItems.filter { it.id in notFoundIds }

        val itemsToDisplay = when (state.activeFilter) {
            SupermarketFilter.ALL -> activeNonNotFound
            SupermarketFilter.URGENT -> activeNonNotFound.filter { it.isUrgent }
            SupermarketFilter.MINE -> activeNonNotFound.filter { it.addedBy == state.currentUserId }
            SupermarketFilter.PHARMACY -> activeNonNotFound.filter {
                ItemCategory.fromString(it.category) == ItemCategory.PHARMACY
            }
            SupermarketFilter.NOT_FOUND -> notFoundList
        }

        val boughtInSession = (sessionStartItemCount - allActiveItems.size).coerceAtLeast(0)
        val allDone = sessionStarted && activeNonNotFound.isEmpty() && sessionStartItemCount > 0

        _uiState.value = state.copy(
            groupedItems = itemsToDisplay
                .sortedByDescending { it.isUrgent }
                .groupBy { ItemCategory.fromString(it.category) }
                .toSortedMap(compareBy { it.ordinal }),
            remainingCount = activeNonNotFound.size,
            totalCount = sessionStartItemCount,
            boughtInSessionCount = boughtInSession,
            isLoading = false,
            allDone = allDone,
            boughtItems = sessionBoughtItems.toList(),
            notFoundCount = notFoundIds.size
        )
    }

    fun markAsBought(item: ShoppingItem) {
        sessionBoughtItems.add(item)
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

    fun markNotFound(item: ShoppingItem) {
        _uiState.update { it.copy(notFoundItems = it.notFoundItems + item.id) }
        updateGroupedItems()
    }

    fun undoNotFound(item: ShoppingItem) {
        _uiState.update { it.copy(notFoundItems = it.notFoundItems - item.id) }
        updateGroupedItems()
    }

    fun undoLastBought() {
        val lastBought = _uiState.value.lastBoughtItem ?: return
        sessionBoughtItems.removeAll { it.id == lastBought.id }
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
