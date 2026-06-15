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
import com.salino.sali.data.service.CategoryDetectionCoordinator
import com.salino.sali.data.service.ItemNameAutocompleteStore
import com.salino.sali.domain.model.ItemNameAutocompleteSource
import com.salino.sali.domain.model.ItemNameAutocompleteSuggestion
import com.salino.sali.domain.service.DuplicateDetector
import com.salino.sali.domain.service.DuplicateMatch
import com.salino.sali.domain.service.ItemNameAutocompleteEngine
import com.salino.sali.domain.service.VoiceInputParser
import com.salino.sali.util.Constants
import com.salino.sali.util.normalizeItemName
import com.salino.sali.util.parseQuantity
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.Job
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
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
    val isUrgent: Boolean = false,
    val isCategoryAutoDetected: Boolean = false,
    val isLoading: Boolean = true,
    val isSaving: Boolean = false,
    val errorMessage: String? = null,
    val isSaved: Boolean = false,
    val isDeleted: Boolean = false,
    val nameAutocompleteSuggestions: List<ItemNameAutocompleteSuggestion> = emptyList(),
    val isNameAutocompleteVisible: Boolean = false,
    val isNameAutocompleteFocused: Boolean = false
)

@HiltViewModel
class EditItemViewModel @Inject constructor(
    savedStateHandle: SavedStateHandle,
    private val shoppingRepository: ShoppingRepository,
    private val authRepository: AuthRepository,
    private val recurringRepository: RecurringRepository,
    private val categoryDetection: CategoryDetectionCoordinator,
    private val duplicateDetector: DuplicateDetector,
    private val voiceInputParser: VoiceInputParser,
    private val autocompleteEngine: ItemNameAutocompleteEngine,
    private val autocompleteStore: ItemNameAutocompleteStore
) : ViewModel() {

    private val itemId: String = savedStateHandle[Constants.ARG_ITEM_ID] ?: ""
    private var householdId: String = ""
    private var originalItem: ShoppingItem? = null
    private var recurringItemId: String? = null
    private var activeItems: List<ShoppingItem> = emptyList()
    private var categoryManuallyChanged: Boolean = false
    private var categoryAiJob: Job? = null
    private var nameDerivativesJob: Job? = null
    private var autocompleteRefreshJob: Job? = null

    private val _uiState = MutableStateFlow(EditItemState())
    val uiState: StateFlow<EditItemState> = _uiState

    init {
        autocompleteStore.ensureStarted()
        loadItem()
    }

    fun onNameChange(value: String) {
        categoryAiJob?.cancel()
        _uiState.update { it.copy(name = value, errorMessage = null) }

        if (_uiState.value.isNameAutocompleteFocused) {
            refreshNameAutocomplete(value)
        }

        scheduleNameDerivatives(value)
    }

    fun onNameAutocompleteFocusChanged(focused: Boolean) {
        _uiState.update { it.copy(isNameAutocompleteFocused = focused) }
        if (focused) {
            refreshNameAutocomplete(_uiState.value.name)
        }
    }

    fun onNameAutocompleteDismissRequest() {
        dismissNameAutocomplete()
    }

    fun onAutocompleteSuggestionSelected(suggestion: ItemNameAutocompleteSuggestion) {
        dismissNameAutocomplete()
        when (suggestion.source) {
            ItemNameAutocompleteSource.HOUSEHOLD_HISTORY -> {
                categoryManuallyChanged = true
                categoryAiJob?.cancel()
                _uiState.update {
                    it.copy(
                        name = suggestion.displayName,
                        quantity = if (suggestion.quantity == suggestion.quantity.toLong().toDouble()) {
                            suggestion.quantity.toLong().toString()
                        } else {
                            suggestion.quantity.toString()
                        },
                        unit = suggestion.unit ?: it.unit,
                        category = suggestion.category ?: it.category,
                        isCategoryAutoDetected = false,
                        errorMessage = null
                    )
                }
                recomputeDuplicate()
            }
            ItemNameAutocompleteSource.CATEGORY_CATALOG -> {
                categoryManuallyChanged = false
                onNameChange(suggestion.displayName)
            }
        }
    }

    fun dismissNameAutocomplete() {
        autocompleteRefreshJob?.cancel()
        _uiState.update {
            it.copy(
                nameAutocompleteSuggestions = emptyList(),
                isNameAutocompleteVisible = false
            )
        }
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

    fun onUrgentToggle(enabled: Boolean) {
        _uiState.update { it.copy(isUrgent = enabled) }
    }

    fun onVoiceResult(spokenText: String) {
        val parsed = voiceInputParser.parse(spokenText)
        categoryManuallyChanged = false
        categoryAiJob?.cancel()
        val keywordCategory = categoryDetection.detectWithKeywords(parsed.name)
        _uiState.update {
            it.copy(
                name = parsed.name,
                quantity = if (parsed.quantity == parsed.quantity.toLong().toDouble()) {
                    parsed.quantity.toLong().toString()
                } else {
                    parsed.quantity.toString()
                },
                unit = parsed.unit ?: it.unit,
                category = keywordCategory ?: it.category,
                isCategoryAutoDetected = keywordCategory != null &&
                    categoryDetection.isAutoDetectable(keywordCategory),
                errorMessage = null
            )
        }
        if (keywordCategory == null) {
            scheduleAiCategoryDetection(parsed.name)
        }
        dismissNameAutocomplete()
        recomputeDuplicate()
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
                note = state.note.trim(),
                isUrgent = state.isUrgent
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
                            isUrgent = item.isUrgent,
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

    private fun scheduleNameDerivatives(name: String) {
        nameDerivativesJob?.cancel()
        nameDerivativesJob = viewModelScope.launch {
            delay(NAME_DERIVATIVES_DEBOUNCE_MS)
            if (_uiState.value.name != name) return@launch
            recomputeDuplicate()
            if (!categoryManuallyChanged) {
                applyKeywordCategory(name)
            }
        }
    }

    private fun applyKeywordCategory(name: String) {
        val keywordCategory = categoryDetection.detectWithKeywords(name)
        if (keywordCategory != null) {
            _uiState.update {
                it.copy(
                    category = keywordCategory,
                    isCategoryAutoDetected = categoryDetection.isAutoDetectable(keywordCategory)
                )
            }
        } else {
            _uiState.update { it.copy(isCategoryAutoDetected = false) }
            scheduleAiCategoryDetection(name)
        }
    }

    private fun recomputeDuplicate() {
        val duplicate = duplicateDetector.findDuplicate(
            draftName = _uiState.value.name,
            existingItems = activeItems,
            excludeItemId = itemId
        )
        val current = _uiState.value.duplicateMatch
        if (current?.item?.id == duplicate?.item?.id && current?.reason == duplicate?.reason) return
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

    private fun refreshNameAutocomplete(query: String) {
        val trimmed = query.trim()
        if (!_uiState.value.isNameAutocompleteFocused || trimmed.isEmpty()) {
            _uiState.update {
                it.copy(
                    nameAutocompleteSuggestions = emptyList(),
                    isNameAutocompleteVisible = false
                )
            }
            return
        }

        autocompleteRefreshJob?.cancel()
        autocompleteRefreshJob = viewModelScope.launch(Dispatchers.Default) {
            val index = autocompleteStore.historyIndex.value
            val suggestions = autocompleteEngine.suggest(trimmed, index)

            withContext(Dispatchers.Main.immediate) {
                if (!_uiState.value.isNameAutocompleteFocused || _uiState.value.name.trim() != trimmed) {
                    return@withContext
                }

                val normalizedQuery = normalizeItemName(trimmed)
                val visible = when {
                    suggestions.isEmpty() -> false
                    suggestions.size == 1 &&
                        normalizeItemName(suggestions.first().displayName) == normalizedQuery -> false
                    else -> true
                }

                _uiState.update {
                    it.copy(
                        nameAutocompleteSuggestions = suggestions,
                        isNameAutocompleteVisible = visible
                    )
                }
            }
        }
    }

    private fun scheduleAiCategoryDetection(name: String) {
        if (name.trim().length < MIN_AI_NAME_LENGTH) return
        val snapshotName = name
        categoryAiJob = viewModelScope.launch {
            delay(AI_DEBOUNCE_MS)
            if (categoryManuallyChanged || _uiState.value.name != snapshotName) return@launch
            val aiCategory = categoryDetection.detectWithAi(snapshotName) ?: return@launch
            if (categoryManuallyChanged || _uiState.value.name != snapshotName) return@launch
            _uiState.update {
                it.copy(
                    category = aiCategory,
                    isCategoryAutoDetected = categoryDetection.isAutoDetectable(aiCategory)
                )
            }
        }
    }

    companion object {
        private const val DAY_MS = 24 * 60 * 60 * 1000L
        private const val AI_DEBOUNCE_MS = 400L
        private const val NAME_DERIVATIVES_DEBOUNCE_MS = 280L
        private const val MIN_AI_NAME_LENGTH = 2
    }
}
