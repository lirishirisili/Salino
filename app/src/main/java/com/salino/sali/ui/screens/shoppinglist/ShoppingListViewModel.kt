package com.salino.sali.ui.screens.shoppinglist

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.google.firebase.Timestamp
import com.salino.sali.data.model.ActivityLog
import com.salino.sali.data.model.ActivityType
import com.salino.sali.data.model.ItemCategory
import com.salino.sali.data.model.ShoppingItem
import com.salino.sali.data.model.SuggestionItem
import com.salino.sali.domain.repository.ActivityRepository
import com.salino.sali.domain.repository.AuthRepository
import com.salino.sali.domain.repository.ShoppingRepository
import com.salino.sali.domain.repository.SuggestionsRepository
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.*
import kotlinx.coroutines.flow.combine
import kotlinx.coroutines.launch
import java.util.UUID
import javax.inject.Inject
import androidx.lifecycle.Lifecycle
import androidx.lifecycle.LifecycleEventObserver
import androidx.lifecycle.ProcessLifecycleOwner

data class ShoppingListState(
    val activeItems: List<ShoppingItem> = emptyList(),
    val boughtItems: List<ShoppingItem> = emptyList(),
    val suggestions: List<SuggestionItem> = emptyList(),
    val isLoading: Boolean = true,
    val errorMessage: String? = null,
    val searchQuery: String = "",
    val selectedCategory: ItemCategory? = null,
    val currentUserId: String = "",
    val currentUserName: String = ""
)

@HiltViewModel
class ShoppingListViewModel @Inject constructor(
    private val shoppingRepository: ShoppingRepository,
    private val authRepository: AuthRepository,
    private val suggestionsRepository: SuggestionsRepository,
    private val activityRepository: ActivityRepository
) : ViewModel() {

    private val _uiState = MutableStateFlow(ShoppingListState())
    val uiState: StateFlow<ShoppingListState> = _uiState.asStateFlow()

    private var householdId: String = ""

    init {
        loadData()
        observeAppForeground()
    }

    /** Re-register Firestore listeners every time the app comes back to foreground */
    private fun observeAppForeground() {
        val observer = LifecycleEventObserver { _, event ->
            if (event == Lifecycle.Event.ON_START && householdId.isNotBlank()) {
                shoppingRepository.forceRefreshSync(householdId)
            }
        }
        ProcessLifecycleOwner.get().lifecycle.addObserver(observer)
    }

    private fun loadData() {
        viewModelScope.launch {
            val user = authRepository.observeCurrentUser().first()
            if (user == null || user.activeHouseholdId.isNullOrBlank()) {
                _uiState.value = _uiState.value.copy(isLoading = false)
                return@launch
            }

            householdId = user.activeHouseholdId
            _uiState.value = _uiState.value.copy(
                currentUserId = user.id,
                currentUserName = user.displayName
            )

            // Observe active items
            launch {
                shoppingRepository.observeActiveItems(householdId).collect { items ->
                    _uiState.update { it.copy(activeItems = items, isLoading = false) }
                }
            }

            // Observe bought items (show recent on main list)
            launch {
                shoppingRepository.observeBoughtItems(householdId).collect { items ->
                    _uiState.update { it.copy(boughtItems = items.take(5)) }
                }
            }

            launch {
                suggestionsRepository.observeSuggestions(householdId).collect { suggestions ->
                    _uiState.update { it.copy(suggestions = suggestions) }
                }
            }
        }
    }

    fun onSearchQueryChange(query: String) {
        _uiState.update { it.copy(searchQuery = query) }
    }

    fun onCategorySelected(category: ItemCategory?) {
        _uiState.update {
            it.copy(selectedCategory = if (it.selectedCategory == category) null else category)
        }
    }

    fun markAsBought(itemId: String) {
        viewModelScope.launch {
            val state = _uiState.value
            shoppingRepository.markAsBought(
                householdId = householdId,
                itemId = itemId,
                userId = state.currentUserId,
                userName = state.currentUserName
            )
        }
    }

    fun markAsActive(itemId: String) {
        viewModelScope.launch {
            shoppingRepository.markAsActive(householdId, itemId)
        }
    }

    fun deleteItem(itemId: String) {
        viewModelScope.launch {
            shoppingRepository.deleteItem(householdId, itemId)
        }
    }

    fun addSuggestion(suggestion: SuggestionItem) {
        val state = _uiState.value
        viewModelScope.launch {
            shoppingRepository.addItem(
                householdId = householdId,
                item = ShoppingItem(
                    name = suggestion.name,
                    normalizedName = suggestion.normalizedName,
                    quantity = suggestion.quantity,
                    unit = suggestion.unit,
                    category = suggestion.category,
                    note = suggestion.note,
                    addedBy = state.currentUserId,
                    addedByName = state.currentUserName
                )
            )

            activityRepository.logActivity(
                ActivityLog(
                    id = UUID.randomUUID().toString(),
                    householdId = householdId,
                    type = ActivityType.SUGGESTION_ACCEPTED.name,
                    itemName = suggestion.name,
                    actorUserId = state.currentUserId,
                    actorDisplayName = state.currentUserName,
                    createdAt = Timestamp.now()
                )
            )
        }
    }

    /** Filtered active items — only re-emits when activeItems, searchQuery, or selectedCategory change */
    val filteredActiveItems: Flow<List<ShoppingItem>> = combine(
        _uiState.map { it.activeItems }.distinctUntilChanged(),
        _uiState.map { it.searchQuery }.distinctUntilChanged(),
        _uiState.map { it.selectedCategory }.distinctUntilChanged()
    ) { items, query, category ->
        var filtered = items
        if (query.isNotBlank()) {
            val lowerQuery = query.lowercase()
            filtered = filtered.filter { it.name.lowercase().contains(lowerQuery) }
        }
        if (category != null) {
            filtered = filtered.filter {
                ItemCategory.fromString(it.category) == category
            }
        }
        filtered
    }.distinctUntilChanged()
}
