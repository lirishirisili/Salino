package com.salino.sali.ui.screens.additem

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.google.firebase.Timestamp
import com.salino.sali.data.model.ItemCategory
import com.salino.sali.data.model.ItemUnit
import com.salino.sali.data.model.RecurringItem
import com.salino.sali.data.model.ShoppingItem
import com.salino.sali.data.model.SuggestionItem
import com.salino.sali.domain.repository.AuthRepository
import com.salino.sali.domain.repository.RecurringRepository
import com.salino.sali.domain.repository.ShoppingRepository
import com.salino.sali.domain.repository.SuggestionsRepository
import com.salino.sali.domain.service.CategoryAutoDetector
import com.salino.sali.domain.service.DuplicateDetector
import com.salino.sali.domain.service.DuplicateMatch
import com.salino.sali.util.normalizeItemName
import com.salino.sali.util.parseQuantity
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import java.util.Date
import javax.inject.Inject

data class AddItemState(
    val name: String = "",
    val quantity: String = "1",
    val unit: ItemUnit? = null,
    val category: ItemCategory = ItemCategory.OTHER,
    val note: String = "",
    val duplicateMatch: DuplicateMatch? = null,
    val suggestions: List<SuggestionItem> = emptyList(),
    val isRecurring: Boolean = false,
    val recurrenceDays: String = "7",
    val isCategoryAutoDetected: Boolean = false,
    val isLoading: Boolean = false,
    val errorMessage: String? = null,
    val isSaved: Boolean = false
)

@HiltViewModel
class AddItemViewModel @Inject constructor(
    private val shoppingRepository: ShoppingRepository,
    private val authRepository: AuthRepository,
    private val suggestionsRepository: SuggestionsRepository,
    private val recurringRepository: RecurringRepository,
    private val categoryAutoDetector: CategoryAutoDetector,
    private val duplicateDetector: DuplicateDetector
) : ViewModel() {

    private val _uiState = MutableStateFlow(AddItemState())
    val uiState: StateFlow<AddItemState> = _uiState

    private var householdId: String = ""
    private var currentUserId: String = ""
    private var currentUserName: String = ""
    private var activeItems: List<ShoppingItem> = emptyList()
    private var categoryManuallyChanged: Boolean = false

    init {
        observeContext()
    }

    fun onNameChange(value: String) {
        _uiState.update { current ->
            val detectedCategory = if (!categoryManuallyChanged) {
                categoryAutoDetector.detectCategory(value) ?: current.category
            } else {
                current.category
            }
            current.copy(
                name = value,
                errorMessage = null,
                category = detectedCategory,
                isCategoryAutoDetected = !categoryManuallyChanged && categoryAutoDetector.detectCategory(value) != null
            )
        }
        recomputeDuplicate()
    }

    fun onQuantityChange(value: String) {
        val filtered = value.filter { it.isDigit() || it == '.' || it == ',' }
        _uiState.update { it.copy(quantity = filtered) }
    }

    fun onUnitChange(value: ItemUnit?) {
        _uiState.update { it.copy(unit = value) }
    }

    fun onCategoryChange(value: ItemCategory) {
        categoryManuallyChanged = true
        _uiState.update { it.copy(category = value, isCategoryAutoDetected = false) }
    }

    fun onNoteChange(value: String) {
        _uiState.update { it.copy(note = value) }
    }

    fun onRecurringToggle(enabled: Boolean) {
        _uiState.update { it.copy(isRecurring = enabled) }
    }

    fun onRecurrenceDaysChange(value: String) {
        _uiState.update { it.copy(recurrenceDays = value.filter(Char::isDigit)) }
    }

    fun applySuggestion(suggestion: SuggestionItem) {
        _uiState.update {
            it.copy(
                name = suggestion.name,
                quantity = if (suggestion.quantity == suggestion.quantity.toLong().toDouble()) {
                    suggestion.quantity.toLong().toString()
                } else {
                    suggestion.quantity.toString()
                },
                unit = ItemUnit.fromString(suggestion.unit),
                category = ItemCategory.fromString(suggestion.category),
                note = suggestion.note,
                isCategoryAutoDetected = false
            )
        }
        categoryManuallyChanged = true
        recomputeDuplicate()
    }

    fun mergeWithDuplicate() {
        val state = _uiState.value
        val duplicate = state.duplicateMatch ?: return

        viewModelScope.launch {
            runCatching {
                val mergedItem = duplicate.item.copy(
                    quantity = duplicate.item.quantity + (parseQuantity(state.quantity) ?: 1.0),
                    note = duplicate.item.note.ifBlank { state.note.trim() }
                )
                shoppingRepository.updateItem(householdId, mergedItem)
                saveRecurringTemplateIfNeeded(state, mergedItem)
            }
            _uiState.update { it.copy(isSaved = true, isLoading = false) }
        }
    }

    fun addItem() {
        val state = _uiState.value
        if (state.name.isBlank()) {
            _uiState.value = state.copy(errorMessage = "empty_name")
            return
        }

        viewModelScope.launch {
            _uiState.value = state.copy(isLoading = true, errorMessage = null)

            if (householdId.isBlank()) {
                _uiState.value = state.copy(isLoading = false, errorMessage = "generic")
                return@launch
            }

            val item = ShoppingItem(
                name = state.name.trim(),
                normalizedName = normalizeItemName(state.name),
                quantity = parseQuantity(state.quantity) ?: 1.0,
                unit = state.unit?.name,
                category = state.category.name,
                note = state.note.trim(),
                addedBy = currentUserId,
                addedByName = currentUserName
            )

            shoppingRepository.addItem(householdId, item)
                .onSuccess {
                    saveRecurringTemplateIfNeeded(state, item)
                    _uiState.value = state.copy(isLoading = false, isSaved = true)
                }
                .onFailure {
                    _uiState.value = state.copy(isLoading = false, errorMessage = "generic")
                }
        }
    }

    private fun observeContext() {
        viewModelScope.launch {
            val user = authRepository.observeCurrentUser().first() ?: return@launch
            val currentHouseholdId = user.activeHouseholdId ?: return@launch
            householdId = currentHouseholdId
            currentUserId = user.id
            currentUserName = user.displayName

            launch {
                shoppingRepository.observeActiveItems(currentHouseholdId).collect { items ->
                    activeItems = items
                    recomputeDuplicate()
                }
            }

            launch {
                suggestionsRepository.observeSuggestions(currentHouseholdId).collect { suggestions ->
                    _uiState.update { it.copy(suggestions = suggestions) }
                }
            }
        }
    }

    private fun recomputeDuplicate() {
        val duplicate = duplicateDetector.findDuplicate(
            draftName = _uiState.value.name,
            existingItems = activeItems
        )
        _uiState.update { it.copy(duplicateMatch = duplicate) }
    }

    private fun saveRecurringTemplateIfNeeded(state: AddItemState, item: ShoppingItem) {
        if (!state.isRecurring || householdId.isBlank()) return

        viewModelScope.launch {
            val intervalDays = state.recurrenceDays.toIntOrNull()?.coerceAtLeast(1) ?: 7
            recurringRepository.upsertRecurringItem(
                householdId = householdId,
                recurringItem = RecurringItem(
                    householdId = householdId,
                    name = item.name,
                    normalizedName = item.normalizedName.ifBlank { normalizeItemName(item.name) },
                    quantity = item.quantity,
                    unit = item.unit,
                    category = item.category,
                    note = item.note,
                    intervalDays = intervalDays,
                    nextDueAt = Timestamp(Date(System.currentTimeMillis() + intervalDays * DAY_MS))
                )
            )
        }
    }

    companion object {
        private const val DAY_MS = 24 * 60 * 60 * 1000L
    }
}
