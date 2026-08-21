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
import com.salino.sali.data.service.ItemNameAutocompleteStore
import com.salino.sali.data.service.CategoryDetectionCoordinator
import com.salino.sali.domain.model.ItemNameAutocompleteSuggestion
import com.salino.sali.domain.repository.ShoppingRepository
import com.salino.sali.domain.repository.SuggestionsRepository
import com.salino.sali.domain.service.DuplicateDetector
import com.salino.sali.domain.service.DuplicateMatch
import com.salino.sali.domain.service.DuplicateReason
import com.salino.sali.domain.service.ItemNameAutocompleteEngine
import com.salino.sali.util.normalizeItemName
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.delay
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
    val currentUserName: String = "",
    val quickAddName: String = "",
    val quickAddSuggestions: List<ItemNameAutocompleteSuggestion> = emptyList(),
    val isQuickAddAutocompleteVisible: Boolean = false,
    val isQuickAddFocused: Boolean = false,
    val isQuickAdding: Boolean = false,
    val quickAddErrorMessage: String? = null,
    val quickAddDuplicateDialog: QuickAddDuplicateDialog? = null,
)

data class QuickAddDuplicateDialog(
    val duplicateMatch: DuplicateMatch,
    val addQuantity: Double,
    val itemName: String,
    val itemCategory: ItemCategory,
    val itemUnit: String?,
)

@HiltViewModel
class ShoppingListViewModel @Inject constructor(
    private val shoppingRepository: ShoppingRepository,
    private val authRepository: AuthRepository,
    private val suggestionsRepository: SuggestionsRepository,
    private val activityRepository: ActivityRepository,
    private val autocompleteStore: ItemNameAutocompleteStore,
    private val autocompleteEngine: ItemNameAutocompleteEngine,
    private val categoryDetection: CategoryDetectionCoordinator,
    private val duplicateDetector: DuplicateDetector
) : ViewModel() {

    private val _uiState = MutableStateFlow(ShoppingListState())
    val uiState: StateFlow<ShoppingListState> = _uiState.asStateFlow()

    private var householdId: String = ""
    private var quickAddAutocompleteJob: Job? = null
    private var quickAddSelectedCategory: ItemCategory? = null

    init {
        autocompleteStore.ensureStarted()
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
            val user = authRepository.observeCurrentUser().first() ?: return@launch
            if (user.activeHouseholdId.isNullOrBlank()) {
                _uiState.value = _uiState.value.copy(isLoading = false)
                return@launch
            }

            householdId = user.activeHouseholdId
            _uiState.value = _uiState.value.copy(
                currentUserId = user.id,
                currentUserName = user.displayName,
            )

            launch {
                shoppingRepository.observeActiveItems(householdId).collect { items ->
                    _uiState.update { it.copy(activeItems = items, isLoading = false) }
                }
            }

            launch {
                shoppingRepository.observeBoughtItems(householdId).collect { items ->
                    _uiState.update {
                        it.copy(
                            boughtItems = items.sortedByDescending { item ->
                                item.updatedAt?.toDate()?.time
                                    ?: item.createdAt?.toDate()?.time
                                    ?: 0L
                            }
                        )
                    }
                }
            }

            launch {
                suggestionsRepository.observeSuggestions(householdId).collect { suggestions ->
                    _uiState.update { it.copy(suggestions = suggestions) }
                }
            }

            shoppingRepository.forceRefreshSync(householdId)
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

    fun onQuickAddNameChange(name: String) {
        quickAddSelectedCategory = null
        _uiState.update { it.copy(quickAddName = name, quickAddErrorMessage = null) }
        refreshQuickAddAutocomplete(name)
    }

    fun onQuickAddFocusChanged(focused: Boolean) {
        _uiState.update { it.copy(isQuickAddFocused = focused) }
        if (focused) {
            refreshQuickAddAutocomplete(_uiState.value.quickAddName)
        }
    }

    fun onQuickAddSuggestionSelected(suggestion: ItemNameAutocompleteSuggestion) {
        quickAddAutocompleteJob?.cancel()
        _uiState.update {
            it.copy(
                quickAddSuggestions = emptyList(),
                isQuickAddAutocompleteVisible = false,
                quickAddErrorMessage = null
            )
        }

        val state = _uiState.value
        val name = suggestion.displayName.trim()
        if (name.isBlank() || state.isQuickAdding || householdId.isBlank()) return

        val category = suggestion.category
            ?: categoryDetection.detectWithKeywords(name)
            ?: ItemCategory.OTHER
        val quantity = suggestion.quantity ?: 1.0
        val unit = suggestion.unit?.name

        val dup = duplicateDetector.findDuplicate(name, state.activeItems)
        if (dup != null && dup.reason == DuplicateReason.EXACT_DUPLICATE) {
            _uiState.update {
                it.copy(
                    quickAddDuplicateDialog = QuickAddDuplicateDialog(
                        duplicateMatch = dup,
                        addQuantity = quantity,
                        itemName = name,
                        itemCategory = category,
                        itemUnit = unit
                    )
                )
            }
            return
        }

        performQuickAdd(name, quantity, unit, category)
    }

    fun addQuickItem() {
        val state = _uiState.value
        val name = state.quickAddName.trim()
        if (name.isBlank()) {
            _uiState.update { it.copy(quickAddErrorMessage = "empty_name") }
            return
        }
        if (state.isQuickAdding) return
        if (householdId.isBlank()) {
            _uiState.update { it.copy(quickAddErrorMessage = "generic") }
            return
        }

        val category = quickAddSelectedCategory
            ?: categoryDetection.detectWithKeywords(name)
            ?: ItemCategory.OTHER

        _uiState.update {
            it.copy(
                quickAddSuggestions = emptyList(),
                isQuickAddAutocompleteVisible = false
            )
        }

        val dup = duplicateDetector.findDuplicate(name, state.activeItems)
        if (dup != null && dup.reason == DuplicateReason.EXACT_DUPLICATE) {
            _uiState.update {
                it.copy(
                    quickAddDuplicateDialog = QuickAddDuplicateDialog(
                        duplicateMatch = dup,
                        addQuantity = 1.0,
                        itemName = name,
                        itemCategory = category,
                        itemUnit = null
                    )
                )
            }
            return
        }

        performQuickAdd(name, 1.0, null, category)
    }

    fun dismissQuickAddDuplicateDialog() {
        _uiState.update { it.copy(quickAddDuplicateDialog = null) }
    }

    fun confirmMergeQuickAddDuplicate() {
        val dialog = _uiState.value.quickAddDuplicateDialog ?: return
        _uiState.update { it.copy(quickAddDuplicateDialog = null) }
        val existing = dialog.duplicateMatch.item
        val state = _uiState.value

        viewModelScope.launch {
            _uiState.update { it.copy(isQuickAdding = true, quickAddErrorMessage = null) }
            shoppingRepository.updateItem(
                householdId = householdId,
                item = existing.copy(quantity = existing.quantity + dialog.addQuantity)
            ).onSuccess {
                quickAddSelectedCategory = null
                _uiState.update { it.copy(quickAddName = "", isQuickAdding = false) }
            }.onFailure {
                _uiState.update { it.copy(isQuickAdding = false, quickAddErrorMessage = "generic") }
            }
        }
    }

    fun confirmAddDespiteQuickAddDuplicate() {
        val dialog = _uiState.value.quickAddDuplicateDialog ?: return
        _uiState.update { it.copy(quickAddDuplicateDialog = null) }
        performQuickAdd(dialog.itemName, dialog.addQuantity, dialog.itemUnit, dialog.itemCategory)
    }

    private fun performQuickAdd(name: String, quantity: Double, unit: String?, category: ItemCategory) {
        val state = _uiState.value
        viewModelScope.launch {
            _uiState.update {
                it.copy(
                    isQuickAdding = true,
                    quickAddErrorMessage = null,
                    quickAddName = ""
                )
            }

            shoppingRepository.addItem(
                householdId = householdId,
                item = ShoppingItem(
                    name = name,
                    normalizedName = normalizeItemName(name),
                    quantity = quantity,
                    unit = unit,
                    category = category.name,
                    note = "",
                    addedBy = state.currentUserId,
                    addedByName = state.currentUserName
                )
            ).onSuccess {
                quickAddSelectedCategory = null
                _uiState.update {
                    it.copy(
                        quickAddName = "",
                        isQuickAdding = false,
                        quickAddErrorMessage = null
                    )
                }
            }.onFailure {
                _uiState.update {
                    it.copy(isQuickAdding = false, quickAddErrorMessage = "generic")
                }
            }
        }
    }

    private fun refreshQuickAddAutocomplete(query: String) {
        quickAddAutocompleteJob?.cancel()
        val trimmed = query.trim()
        if (!_uiState.value.isQuickAddFocused || trimmed.isEmpty()) {
            _uiState.update {
                it.copy(
                    quickAddSuggestions = emptyList(),
                    isQuickAddAutocompleteVisible = false
                )
            }
            return
        }

        quickAddAutocompleteJob = viewModelScope.launch(Dispatchers.Default) {
            delay(QUICK_ADD_AUTOCOMPLETE_DEBOUNCE_MS)
            val suggestions = autocompleteEngine.suggest(
                query = trimmed,
                historyIndex = autocompleteStore.historyIndex.value
            )
            if (!_uiState.value.isQuickAddFocused ||
                _uiState.value.quickAddName.trim() != trimmed
            ) {
                return@launch
            }

            val normalizedQuery = normalizeItemName(trimmed)
            val visible = suggestions.isNotEmpty() &&
                !(suggestions.size == 1 &&
                    normalizeItemName(suggestions.first().displayName) == normalizedQuery)
            _uiState.update {
                it.copy(
                    quickAddSuggestions = suggestions,
                    isQuickAddAutocompleteVisible = visible
                )
            }
        }
    }

    fun markAsBought(itemId: String) {
        viewModelScope.launch {
            val state = _uiState.value
            runCatching {
                shoppingRepository.markAsBought(
                    householdId = householdId,
                    itemId = itemId,
                    userId = state.currentUserId,
                    userName = state.currentUserName
                )
            }
        }
    }

    fun markAsActive(itemId: String) {
        viewModelScope.launch {
            runCatching { shoppingRepository.markAsActive(householdId, itemId) }
        }
    }

    fun deleteItem(itemId: String) {
        viewModelScope.launch {
            runCatching { shoppingRepository.deleteItem(householdId, itemId) }
        }
    }

    fun toggleFavorite(itemId: String, isFavorite: Boolean) {
        viewModelScope.launch {
            runCatching { shoppingRepository.toggleFavorite(householdId, itemId, isFavorite) }
        }
    }

    fun addSuggestion(suggestion: SuggestionItem) {
        val state = _uiState.value
        viewModelScope.launch {
            runCatching {
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
    }

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
        filtered.sortedByDescending { it.isFavorite }
    }.distinctUntilChanged()

    private companion object {
        const val QUICK_ADD_AUTOCOMPLETE_DEBOUNCE_MS = 80L
    }
}
