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
    val currentUserName: String = ""
)

@HiltViewModel
class SupermarketModeViewModel @Inject constructor(
    private val shoppingRepository: ShoppingRepository,
    private val authRepository: AuthRepository
) : ViewModel() {

    private val _uiState = MutableStateFlow(SupermarketModeState())
    val uiState: StateFlow<SupermarketModeState> = _uiState

    private var householdId: String = ""

    init {
        viewModelScope.launch {
            val user = authRepository.observeCurrentUser().first() ?: return@launch
            val activeHouseholdId = user.activeHouseholdId ?: return@launch
            householdId = activeHouseholdId
            _uiState.update { it.copy(currentUserId = user.id, currentUserName = user.displayName) }
            shoppingRepository.observeActiveItems(activeHouseholdId).collect { items ->
                _uiState.value = SupermarketModeState(
                    groupedItems = items.groupBy { ItemCategory.fromString(it.category) }
                        .toSortedMap(compareBy { it.ordinal }),
                    remainingCount = items.size,
                    isLoading = false,
                    currentUserId = user.id,
                    currentUserName = user.displayName
                )
            }
        }
    }

    fun markAsBought(itemId: String) {
        viewModelScope.launch {
            shoppingRepository.markAsBought(
                householdId = householdId,
                itemId = itemId,
                userId = _uiState.value.currentUserId,
                userName = _uiState.value.currentUserName
            )
        }
    }
}
