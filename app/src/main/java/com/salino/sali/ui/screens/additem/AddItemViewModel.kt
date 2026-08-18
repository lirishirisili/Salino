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

import com.salino.sali.data.service.CategoryDetectionCoordinator

import com.salino.sali.data.service.ItemNameAutocompleteStore

import com.salino.sali.domain.model.ItemNameAutocompleteSource

import com.salino.sali.domain.model.ItemNameAutocompleteSuggestion

import com.salino.sali.domain.service.DuplicateDetector

import com.salino.sali.domain.service.DuplicateMatch

import com.salino.sali.domain.service.DuplicateReason

import com.salino.sali.domain.service.ItemNameAutocompleteEngine

import com.salino.sali.domain.service.VoiceInputParser

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



data class AddItemState(

    val name: String = "",

    val quantity: String = "1",

    val unit: ItemUnit? = null,

    val category: ItemCategory = ItemCategory.OTHER,

    val note: String = "",

    val duplicateMatch: DuplicateMatch? = null,

    val duplicateConfirmDialog: DuplicateMatch? = null,

    val suggestions: List<SuggestionItem> = emptyList(),

    val isRecurring: Boolean = false,

    val recurrenceDays: String = "7",

    val isUrgent: Boolean = false,

    val isCategoryAutoDetected: Boolean = false,

    val isLoading: Boolean = false,

    val errorMessage: String? = null,

    val isSaved: Boolean = false,

    val nameAutocompleteSuggestions: List<ItemNameAutocompleteSuggestion> = emptyList(),

    val isNameAutocompleteVisible: Boolean = false,

    val isNameAutocompleteFocused: Boolean = false

)



@HiltViewModel

class AddItemViewModel @Inject constructor(

    private val shoppingRepository: ShoppingRepository,

    private val authRepository: AuthRepository,

    private val suggestionsRepository: SuggestionsRepository,

    private val recurringRepository: RecurringRepository,

    private val categoryDetection: CategoryDetectionCoordinator,

    private val duplicateDetector: DuplicateDetector,

    private val voiceInputParser: VoiceInputParser,

    private val autocompleteEngine: ItemNameAutocompleteEngine,

    private val autocompleteStore: ItemNameAutocompleteStore

) : ViewModel() {



    private val _uiState = MutableStateFlow(AddItemState())

    val uiState: StateFlow<AddItemState> = _uiState



    private var householdId: String = ""

    private var currentUserId: String = ""

    private var currentUserName: String = ""

    private var activeItems: List<ShoppingItem> = emptyList()

    private var categoryManuallyChanged: Boolean = false

    private var categoryAiJob: Job? = null

    private var nameDerivativesJob: Job? = null

    private var autocompleteRefreshJob: Job? = null



    init {

        autocompleteStore.ensureStarted()

        observeContext()

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

        categoryAiJob?.cancel()

        nameDerivativesJob?.cancel()

        val fields = resolveAutocompleteFields(suggestion)

        val exactDuplicate = findExactDuplicate(fields.name)

        if (exactDuplicate != null) {

            _uiState.update {

                it.copy(

                    name = fields.name,

                    quantity = formatQuantityString(fields.quantity),

                    unit = fields.unit,

                    category = fields.category,

                    duplicateConfirmDialog = exactDuplicate

                )

            }

            return

        }

        addItemDirect(

            name = fields.name,

            quantity = fields.quantity,

            unit = fields.unit,

            category = fields.category

        )

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

        nameDerivativesJob?.cancel()

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



    fun applySuggestion(suggestion: SuggestionItem) {

        dismissNameAutocomplete()

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



    fun dismissDuplicateConfirmDialog() {

        _uiState.update { it.copy(duplicateConfirmDialog = null) }

    }



    fun confirmAddDespiteDuplicate() {

        val state = _uiState.value

        _uiState.update { it.copy(duplicateConfirmDialog = null) }

        addItemDirect(

            name = state.name,

            quantity = parseQuantity(state.quantity) ?: 1.0,

            unit = state.unit,

            category = state.category

        )

    }



    fun confirmMergeDuplicate() {

        val dialogMatch = _uiState.value.duplicateConfirmDialog ?: return

        _uiState.update {

            it.copy(

                duplicateMatch = dialogMatch,

                duplicateConfirmDialog = null

            )

        }

        mergeWithDuplicate()

    }



    fun addItem() {

        val state = _uiState.value

        if (state.name.isBlank()) {

            _uiState.value = state.copy(errorMessage = "empty_name")

            return

        }



        val exactDuplicate = findExactDuplicate(state.name)

        if (exactDuplicate != null) {

            _uiState.update { it.copy(duplicateConfirmDialog = exactDuplicate) }

            return

        }



        addItemDirect(

            name = state.name,

            quantity = parseQuantity(state.quantity) ?: 1.0,

            unit = state.unit,

            category = state.category

        )

    }



    private data class AutocompleteResolvedFields(

        val name: String,

        val quantity: Double,

        val unit: ItemUnit?,

        val category: ItemCategory

    )



    private fun resolveAutocompleteFields(

        suggestion: ItemNameAutocompleteSuggestion

    ): AutocompleteResolvedFields {

        val state = _uiState.value

        return when (suggestion.source) {

            ItemNameAutocompleteSource.HOUSEHOLD_HISTORY -> AutocompleteResolvedFields(

                name = suggestion.displayName,

                quantity = suggestion.quantity,

                unit = suggestion.unit ?: state.unit,

                category = suggestion.category ?: state.category

            )

            ItemNameAutocompleteSource.CATEGORY_CATALOG -> {

                val keywordCategory = categoryDetection.detectWithKeywords(suggestion.displayName)

                AutocompleteResolvedFields(

                    name = suggestion.displayName,

                    quantity = parseQuantity(state.quantity) ?: 1.0,

                    unit = state.unit,

                    category = keywordCategory ?: ItemCategory.OTHER

                )

            }

        }

    }



    private fun addItemDirect(

        name: String,

        quantity: Double,

        unit: ItemUnit?,

        category: ItemCategory

    ) {

        val trimmedName = name.trim()

        if (trimmedName.isBlank()) {

            _uiState.update { it.copy(errorMessage = "empty_name") }

            return

        }



        val state = _uiState.value

        if (state.isLoading) return

        viewModelScope.launch {

            _uiState.update { it.copy(isLoading = true, errorMessage = null) }



            if (householdId.isBlank()) {

                _uiState.update { it.copy(isLoading = false, errorMessage = "generic") }

                return@launch

            }



            val item = ShoppingItem(

                name = trimmedName,

                normalizedName = normalizeItemName(trimmedName),

                quantity = quantity,

                unit = unit?.name,

                category = category.name,

                note = state.note.trim(),

                addedBy = currentUserId,

                addedByName = currentUserName,

                isUrgent = state.isUrgent

            )



            shoppingRepository.addItem(householdId, item)

                .onSuccess {

                    val persistedState = state.copy(

                        name = trimmedName,

                        quantity = formatQuantityString(quantity),

                        unit = unit,

                        category = category

                    )

                    saveRecurringTemplateIfNeeded(persistedState, item)

                    _uiState.update { it.copy(isLoading = false, isSaved = true) }

                }

                .onFailure {

                    _uiState.update { it.copy(isLoading = false, errorMessage = "generic") }

                }

        }

    }



    private fun formatQuantityString(quantity: Double): String =

        if (quantity == quantity.toLong().toDouble()) {

            quantity.toLong().toString()

        } else {

            quantity.toString()

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



    private fun findExactDuplicate(name: String): DuplicateMatch? {

        val match = duplicateDetector.findDuplicate(

            draftName = name,

            existingItems = activeItems

        )

        return match?.takeIf { it.reason == DuplicateReason.EXACT_DUPLICATE }

    }



    private fun recomputeDuplicate() {

        val duplicate = duplicateDetector.findDuplicate(

            draftName = _uiState.value.name,

            existingItems = activeItems

        )

        val current = _uiState.value.duplicateMatch

        if (current?.item?.id == duplicate?.item?.id && current?.reason == duplicate?.reason) return

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


