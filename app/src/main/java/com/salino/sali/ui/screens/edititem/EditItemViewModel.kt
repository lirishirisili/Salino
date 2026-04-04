package com.salino.sali.ui.screens.edititem

import androidx.lifecycle.SavedStateHandle
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.google.firebase.Timestamp
import com.salino.sali.data.model.ItemCategory
import com.salino.sali.data.model.ItemUnit
import com.salino.sali.data.model.RecurringItem
import com.salino.sali.data.model.ShoppingItem
import com.salino.sali.domain.repository.AuthRepository
import com.salino.sali.domain.repository.RecurringRepository
import com.salino.sali.domain.repository.ShoppingRepository
import com.salino.sali.domain.service.CategoryAutoDetector
import com.salino.sali.domain.service.DuplicateDetector
import com.salino.sali.domain.service.DuplicateMatch
import com.salino.sali.util.Constants
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

data class EditItemState(
    val name: String = "",
    val quantity: String = "1",
    val unit: ItemUnit? = null,
    val category: ItemCategory = ItemCategory.OTHER,
    val note: String = "",
    val duplicateMatch: DuplicateMatch? = null,
    val isRecurring: Boolean = false,
    val recurrenceDays: String = "7",
    val isCategoryAutoDetected: Boolean = false,
    val isLoading: Boolean = true,
    val isSaving: Boolean = false,
    val errorMessage: String? = null,
    val isSaved: Boolean = false,
    val isDeleted: Boolean = false
)

@HiltViewModel
class EditItemViewModel @Inject constructor(
    savedStateHandle: SavedStateHandle,
    private val shoppingRepository: ShoppingRepository,
    private val authRepository: AuthRepository,
    private val recurringRepository: RecurringRepository,
    private val categoryAutoDetector: CategoryAutoDetector,
    private val duplicateDetector: DuplicateDetector
) : ViewModel() {

    private val itemId: String = savedStateHandle[Constants.ARG_ITEM_ID] ?: ""
    private var householdId: String = ""
    private var originalItem: ShoppingItem? = null
    private var recurringItemId: String? = null
    private var activeItems: List<ShoppingItem> = emptyList()
    private var categoryManuallyChanged: Boolean = false

    private val _uiState = MutableStateFlow(EditItemState())
    val uiState: StateFlow<EditItemState> = _uiState

    init {
        loadItem()
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

    fun mergeWithDuplicate() {
        val state = _uiState.value
        val duplicate = state.duplicateMatch ?: return
        val current = originalItem ?: return

        viewModelScope.launch {
            runCatching {
                shoppingRepository.updateItem(
                    householdId,
                    duplicate.item.copy(quantity = duplicate.item.quantity + (parseQuantity(state.quantity) ?: 1.0))
                )
                shoppingRepository.deleteItem(householdId, current.id)
                saveRecurringPreference(current.name)
            }
            _uiState.update { it.copy(isDeleted = true) }
        }
    }

    fun saveItem() {
        val state = _uiState.value
        if (state.name.isBlank()) {
            _uiState.value = state.copy(errorMessage = "empty_name")
            return
        }

        viewModelScope.launch {
            _uiState.value = state.copy(isSaving = true, errorMessage = null)

            val updatedItem = originalItem?.copy(
                name = state.name.trim(),
                normalizedName = normalizeItemName(state.name),
                quantity = parseQuantity(state.quantity) ?: 1.0,
                unit = state.unit?.name,
                category = state.category.name,
                note = state.note.trim()
            ) ?: return@launch

            shoppingRepository.updateItem(householdId, updatedItem)
                .onSuccess {
                    saveRecurringPreference(updatedItem.name)
                    _uiState.value = state.copy(isSaving = false, isSaved = true)
                }
                .onFailure {
                    _uiState.value = state.copy(isSaving = false, errorMessage = "generic")
                }
        }
    }

    fun deleteItem() {
        viewModelScope.launch {
            shoppingRepository.deleteItem(householdId, itemId)
                .onSuccess {
                    _uiState.value = _uiState.value.copy(isDeleted = true)
                }
        }
    }

    private fun loadItem() {
        viewModelScope.launch {
            val user = authRepository.observeCurrentUser().first()
            if (user == null || user.activeHouseholdId.isNullOrBlank()) {
                _uiState.value = EditItemState(isLoading = false, errorMessage = "generic")
                return@launch
            }
            householdId = user.activeHouseholdId

            launch {
                shoppingRepository.observeActiveItems(householdId).collect { items ->
                    activeItems = items
                    recomputeDuplicate()
                }
            }

            shoppingRepository.getItem(householdId, itemId)
                .onSuccess { item ->
                    originalItem = item
                    viewModelScope.launch {
                        val recurring = recurringRepository.findByNormalizedName(householdId, item.normalizedName).getOrNull()
                        recurringItemId = recurring?.id
                        _uiState.value = EditItemState(
                            name = item.name,
                            quantity = if (item.quantity == item.quantity.toLong().toDouble()) {
                                item.quantity.toLong().toString()
                            } else {
                                item.quantity.toString()
                            },
                            unit = ItemUnit.fromString(item.unit),
                            category = ItemCategory.fromString(item.category),
                            note = item.note,
                            isRecurring = recurring != null,
                            recurrenceDays = recurring?.intervalDays?.toString() ?: "7",
                            isCategoryAutoDetected = false,
                            isLoading = false
                        )
                        recomputeDuplicate()
                    }
                }
                .onFailure {
                    _uiState.value = EditItemState(isLoading = false, errorMessage = "generic")
                }
        }
    }

    private fun recomputeDuplicate() {
        val duplicate = duplicateDetector.findDuplicate(
            draftName = _uiState.value.name,
            existingItems = activeItems,
            excludeItemId = itemId
        )
        _uiState.update { it.copy(duplicateMatch = duplicate) }
    }

    private fun saveRecurringPreference(name: String) {
        val state = _uiState.value
        viewModelScope.launch {
            if (state.isRecurring) {
                val intervalDays = state.recurrenceDays.toIntOrNull()?.coerceAtLeast(1) ?: 7
                recurringRepository.upsertRecurringItem(
                    householdId = householdId,
                    recurringItem = RecurringItem(
                        id = recurringItemId.orEmpty(),
                        householdId = householdId,
                        name = name.trim(),
                        normalizedName = normalizeItemName(name),
                        quantity = parseQuantity(state.quantity) ?: 1.0,
                        unit = state.unit?.name,
                        category = state.category.name,
                        note = state.note.trim(),
                        intervalDays = intervalDays,
                        nextDueAt = Timestamp(Date(System.currentTimeMillis() + intervalDays * DAY_MS))
                    )
                ).onSuccess { recurringItemId = it }
            } else {
                recurringItemId?.let { recurringRepository.deleteRecurringItem(householdId, it) }
            }
        }
    }

    companion object {
        private const val DAY_MS = 24 * 60 * 60 * 1000L
    }
}
