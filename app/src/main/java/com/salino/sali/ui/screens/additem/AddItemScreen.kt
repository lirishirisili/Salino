package com.salino.sali.ui.screens.additem

import android.Manifest
import android.app.Activity
import android.content.Intent
import android.content.pm.PackageManager
import android.speech.RecognizerIntent
import android.widget.Toast
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ExperimentalLayoutApi
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.WindowInsets
import androidx.compose.foundation.layout.consumeWindowInsets
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.imePadding
import androidx.compose.foundation.layout.isImeVisible
import androidx.compose.foundation.layout.navigationBarsPadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.text.KeyboardActions
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.AddShoppingCart
import androidx.compose.material.icons.filled.Mic
import androidx.compose.material.icons.filled.PriorityHigh
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.ExposedDropdownMenuBox
import androidx.compose.material3.ExposedDropdownMenuDefaults
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.material3.FilterChip
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Switch
import androidx.compose.material3.SwitchDefaults
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.focus.FocusRequester
import androidx.compose.ui.focus.focusRequester
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.unit.dp
import androidx.core.content.ContextCompat
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.salino.sali.R
import com.salino.sali.data.model.ItemCategory
import com.salino.sali.data.model.ItemUnit
import com.salino.sali.ui.components.DuplicateWarningCard
import com.salino.sali.ui.components.ItemNameAutocompleteField
import com.salino.sali.ui.components.SalinoGradientBackground
import com.salino.sali.ui.components.SalinoPrimaryButton
import com.salino.sali.ui.components.SalinoSurfaceCard
import com.salino.sali.ui.components.SalinoWebInnerTopBar
import com.salino.sali.ui.components.SalinoWebTokens
import com.salino.sali.ui.components.salinoWebMaxWidth
import com.salino.sali.ui.components.salinoWebOutlinedFieldColors
import com.salino.sali.ui.components.SuggestionSection
import com.salino.sali.domain.service.DuplicateReason
import com.salino.sali.util.formatQuantity
import java.util.Locale

private fun getAppLocale(): Locale {
    val appLocales = androidx.appcompat.app.AppCompatDelegate.getApplicationLocales()
    return if (!appLocales.isEmpty) {
        appLocales.get(0) ?: Locale.getDefault()
    } else {
        Locale.getDefault()
    }
}

@OptIn(ExperimentalMaterial3Api::class, ExperimentalLayoutApi::class)
@Composable
fun AddItemScreen(
    onNavigateBack: () -> Unit,
    viewModel: AddItemViewModel = hiltViewModel()
) {
    val uiState by viewModel.uiState.collectAsStateWithLifecycle()
    val focusRequester = remember { FocusRequester() }
    val context = LocalContext.current

    val speechLauncher = rememberLauncherForActivityResult(
        ActivityResultContracts.StartActivityForResult()
    ) { result ->
        if (result.resultCode == Activity.RESULT_OK) {
            val spoken = result.data
                ?.getStringArrayListExtra(RecognizerIntent.EXTRA_RESULTS)
                ?.firstOrNull()
            if (!spoken.isNullOrBlank()) {
                viewModel.onVoiceResult(spoken)
            }
        }
    }

    val permissionLauncher = rememberLauncherForActivityResult(
        ActivityResultContracts.RequestPermission()
    ) { granted ->
        if (granted) {
            launchSpeechRecognizer(context, speechLauncher)
        } else {
            Toast.makeText(context, context.getString(R.string.voice_input_permission_denied), Toast.LENGTH_SHORT).show()
        }
    }

    LaunchedEffect(uiState.isSaved) {
        if (uiState.isSaved) onNavigateBack()
    }

    LaunchedEffect(Unit) {
        try {
            focusRequester.requestFocus()
        } catch (_: IllegalStateException) {
            // FocusRequester not yet attached on some devices
        }
    }

    val errorText = when (uiState.errorMessage) {
        "empty_name" -> stringResource(R.string.item_error_empty_name)
        "generic" -> stringResource(R.string.error_generic)
        else -> null
    }

    val imeVisible = WindowInsets.isImeVisible
    val compactInputMode = imeVisible || uiState.isNameAutocompleteFocused
    val scrollState = rememberScrollState()

    var compactScrollApplied by remember { mutableStateOf(false) }
    LaunchedEffect(compactInputMode) {
        if (compactInputMode && !compactScrollApplied) {
            scrollState.scrollTo(0)
            compactScrollApplied = true
        }
        if (!compactInputMode) {
            compactScrollApplied = false
        }
    }

    LaunchedEffect(imeVisible) {
        if (!imeVisible) {
            viewModel.onNameAutocompleteDismissRequest()
        }
    }

    SalinoGradientBackground {
        Scaffold(
            containerColor = androidx.compose.ui.graphics.Color.Transparent,
            topBar = {
                SalinoWebInnerTopBar(
                    title = stringResource(R.string.add_item_title),
                    onBack = onNavigateBack,
                    backContentDescription = stringResource(R.string.cancel)
                )
            }
        ) { padding ->
            Column(
                modifier = Modifier
                    .fillMaxSize()
                    .padding(padding)
                    .consumeWindowInsets(padding)
                    .salinoWebMaxWidth()
                    .padding(horizontal = SalinoWebTokens.HorizontalPadding)
                    .imePadding()
                    .navigationBarsPadding()
                    .verticalScroll(
                        state = scrollState,
                        enabled = !uiState.isNameAutocompleteVisible
                    ),
                verticalArrangement = Arrangement.spacedBy(if (compactInputMode) 8.dp else 12.dp)
            ) {
                if (!compactInputMode) {
                    Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
                        SuggestionSection(
                            title = stringResource(R.string.suggestions_title),
                            subtitle = stringResource(R.string.suggestions_subtitle_add),
                            suggestions = uiState.suggestions,
                            onSuggestionClick = viewModel::applySuggestion
                        )

                        uiState.duplicateMatch?.let { duplicate ->
                            val dupTitle = when (duplicate.reason) {
                                DuplicateReason.EXACT_DUPLICATE -> stringResource(R.string.duplicate_warning_title)
                                DuplicateReason.POSSIBLE_DUPLICATE -> stringResource(R.string.duplicate_warning_fuzzy)
                                DuplicateReason.SIMILAR_ITEM -> stringResource(R.string.duplicate_warning_similar)
                            }
                            val isSimilarOnly = duplicate.reason == DuplicateReason.SIMILAR_ITEM
                            DuplicateWarningCard(
                                duplicateMatch = duplicate,
                                title = dupTitle,
                                actionLabel = if (isSimilarOnly) null else stringResource(R.string.duplicate_merge_action),
                                onMerge = if (isSimilarOnly) null else viewModel::mergeWithDuplicate
                            )
                        }
                    }
                }

                SalinoSurfaceCard(modifier = Modifier.fillMaxWidth()) {
                    if (!compactInputMode) {
                        Text(
                            text = stringResource(R.string.item_name_label),
                            style = MaterialTheme.typography.headlineMedium
                        )
                        Spacer(modifier = Modifier.height(6.dp))
                        Text(
                            text = stringResource(R.string.item_name_hint),
                            style = MaterialTheme.typography.bodyMedium,
                            color = MaterialTheme.colorScheme.onSurfaceVariant
                        )
                        Spacer(modifier = Modifier.height(20.dp))
                    }

                    ItemNameAutocompleteField(
                        value = uiState.name,
                        onValueChange = viewModel::onNameChange,
                        suggestions = uiState.nameAutocompleteSuggestions,
                        isAutocompleteVisible = uiState.isNameAutocompleteVisible,
                        onFocusChanged = viewModel::onNameAutocompleteFocusChanged,
                        onSuggestionSelected = viewModel::onAutocompleteSuggestionSelected,
                        modifier = Modifier.fillMaxWidth().focusRequester(focusRequester),
                        label = { Text(stringResource(R.string.item_name_label)) },
                        placeholder = { Text(stringResource(R.string.item_name_hint)) },
                        isError = uiState.errorMessage == "empty_name",
                        suggestionsMaxHeight = if (compactInputMode) 360.dp else 280.dp,
                        keyboardOptions = KeyboardOptions(imeAction = ImeAction.Done),
                        keyboardActions = KeyboardActions(onDone = { viewModel.addItem() }),
                        trailingIcon = {
                            IconButton(onClick = {
                                if (ContextCompat.checkSelfPermission(context, Manifest.permission.RECORD_AUDIO) == PackageManager.PERMISSION_GRANTED) {
                                    launchSpeechRecognizer(context, speechLauncher)
                                } else {
                                    permissionLauncher.launch(Manifest.permission.RECORD_AUDIO)
                                }
                            }) {
                                Icon(
                                    Icons.Default.Mic,
                                    contentDescription = stringResource(R.string.voice_input_action),
                                    tint = MaterialTheme.colorScheme.primary
                                )
                            }
                        }
                    )

                    if (errorText != null && uiState.errorMessage == "empty_name") {
                        Text(
                            text = errorText,
                            style = MaterialTheme.typography.bodySmall,
                            color = MaterialTheme.colorScheme.error,
                            modifier = Modifier.padding(start = 16.dp, top = 4.dp)
                        )
                    }

                    AddItemDetailsFields(
                        quantity = uiState.quantity,
                        unit = uiState.unit,
                        category = uiState.category,
                        note = uiState.note,
                        isRecurring = uiState.isRecurring,
                        recurrenceDays = uiState.recurrenceDays,
                        isUrgent = uiState.isUrgent,
                        isCategoryAutoDetected = uiState.isCategoryAutoDetected,
                        isLoading = uiState.isLoading,
                        errorMessage = uiState.errorMessage,
                        onQuantityChange = viewModel::onQuantityChange,
                        onUnitChange = viewModel::onUnitChange,
                        onCategoryChange = viewModel::onCategoryChange,
                        onNoteChange = viewModel::onNoteChange,
                        onRecurringToggle = viewModel::onRecurringToggle,
                        onRecurrenceDaysChange = viewModel::onRecurrenceDaysChange,
                        onUrgentToggle = viewModel::onUrgentToggle,
                        onAddItem = viewModel::addItem
                    )
                }
            }
        }

        uiState.duplicateConfirmDialog?.let { duplicate ->
            AlertDialog(
                onDismissRequest = viewModel::dismissDuplicateConfirmDialog,
                text = {
                    Column(
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(horizontal = 16.dp),
                    ) {
                        DuplicateWarningCard(
                            duplicateMatch = duplicate,
                            title = stringResource(R.string.duplicate_warning_title),
                            modifier = Modifier.fillMaxWidth()
                        )

                        Spacer(modifier = Modifier.height(14.dp))

                        // Matches RN layout: primary merge action first
                        SalinoPrimaryButton(
                            text = stringResource(R.string.duplicate_merge_action),
                            onClick = viewModel::confirmMergeDuplicate,
                            modifier = Modifier.fillMaxWidth()
                        )

                        Spacer(modifier = Modifier.height(10.dp))

                        // Matches RN: outlined full-width "Add anyway"
                        OutlinedButton(
                            onClick = viewModel::confirmAddDespiteDuplicate,
                            modifier = Modifier.fillMaxWidth()
                        ) {
                            Text(text = stringResource(R.string.duplicate_add_anyway))
                        }

                        Spacer(modifier = Modifier.height(2.dp))
                        TextButton(
                            onClick = viewModel::dismissDuplicateConfirmDialog,
                            modifier = Modifier.align(Alignment.End)
                        ) {
                            Text(text = stringResource(R.string.cancel))
                        }
                    }
                },
                confirmButton = {},
                dismissButton = {}
            )
        }
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun AddItemDetailsFields(
    quantity: String,
    unit: ItemUnit?,
    category: ItemCategory,
    note: String,
    isRecurring: Boolean,
    recurrenceDays: String,
    isUrgent: Boolean,
    isCategoryAutoDetected: Boolean,
    isLoading: Boolean,
    errorMessage: String?,
    onQuantityChange: (String) -> Unit,
    onUnitChange: (ItemUnit?) -> Unit,
    onCategoryChange: (ItemCategory) -> Unit,
    onNoteChange: (String) -> Unit,
    onRecurringToggle: (Boolean) -> Unit,
    onRecurrenceDaysChange: (String) -> Unit,
    onUrgentToggle: (Boolean) -> Unit,
    onAddItem: () -> Unit
) {
    val errorText = when (errorMessage) {
        "empty_name" -> stringResource(R.string.item_error_empty_name)
        "generic" -> stringResource(R.string.error_generic)
        else -> null
    }

    Spacer(modifier = Modifier.height(16.dp))

    Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(12.dp)) {
        OutlinedTextField(
            value = quantity,
            onValueChange = onQuantityChange,
            shape = SalinoWebTokens.InputCorner,
            colors = salinoWebOutlinedFieldColors(),
            label = { Text(stringResource(R.string.item_quantity_label)) },
            modifier = Modifier.weight(1f),
            singleLine = true,
            keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Decimal)
        )

        var unitExpanded by remember { mutableStateOf(false) }
        ExposedDropdownMenuBox(
            expanded = unitExpanded,
            onExpandedChange = { unitExpanded = it },
            modifier = Modifier.weight(1f)
        ) {
            OutlinedTextField(
                value = unit?.let { stringResource(it.labelResId) } ?: "",
                onValueChange = {},
                readOnly = true,
                shape = SalinoWebTokens.InputCorner,
                colors = salinoWebOutlinedFieldColors(),
                label = { Text(stringResource(R.string.item_unit_label)) },
                trailingIcon = { ExposedDropdownMenuDefaults.TrailingIcon(expanded = unitExpanded) },
                modifier = Modifier.menuAnchor().fillMaxWidth()
            )
            ExposedDropdownMenu(expanded = unitExpanded, onDismissRequest = { unitExpanded = false }) {
                ItemUnit.entries.forEach { unitOption ->
                    DropdownMenuItem(
                        text = { Text(stringResource(unitOption.labelResId)) },
                        onClick = {
                            onUnitChange(unitOption)
                            unitExpanded = false
                        }
                    )
                }
            }
        }
    }

    Spacer(modifier = Modifier.height(16.dp))
    Text(
        text = stringResource(R.string.item_category_label),
        style = MaterialTheme.typography.labelLarge,
        modifier = Modifier.padding(bottom = 8.dp)
    )
    LazyRow(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
        items(ItemCategory.entries) { categoryOption ->
            FilterChip(
                selected = category == categoryOption,
                onClick = { onCategoryChange(categoryOption) },
                label = { Text(stringResource(categoryOption.labelResId)) }
            )
        }
    }

    if (isCategoryAutoDetected) {
        Spacer(modifier = Modifier.height(8.dp))
        Text(
            text = stringResource(R.string.category_auto_detected, stringResource(category.labelResId)),
            style = MaterialTheme.typography.bodySmall,
            color = MaterialTheme.colorScheme.primary
        )
    }

    Spacer(modifier = Modifier.height(16.dp))
    OutlinedTextField(
        value = note,
        onValueChange = onNoteChange,
        shape = SalinoWebTokens.InputCorner,
        colors = salinoWebOutlinedFieldColors(),
        label = { Text(stringResource(R.string.item_note_label)) },
        placeholder = { Text(stringResource(R.string.item_note_hint)) },
        modifier = Modifier.fillMaxWidth(),
        maxLines = 3,
        minLines = 3
    )

    Spacer(modifier = Modifier.height(16.dp))
    Row(
        modifier = Modifier.fillMaxWidth(),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.SpaceBetween
    ) {
        Column(modifier = Modifier.weight(1f)) {
            Text(stringResource(R.string.recurring_toggle_title), style = MaterialTheme.typography.titleMedium)
            Text(
                text = stringResource(R.string.recurring_toggle_subtitle),
                style = MaterialTheme.typography.bodySmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant
            )
        }
        Switch(checked = isRecurring, onCheckedChange = onRecurringToggle)
    }

    if (isRecurring) {
        Spacer(modifier = Modifier.height(12.dp))
        OutlinedTextField(
            value = recurrenceDays,
            onValueChange = onRecurrenceDaysChange,
            shape = SalinoWebTokens.InputCorner,
            colors = salinoWebOutlinedFieldColors(),
            label = { Text(stringResource(R.string.recurring_every_days_label)) },
            placeholder = { Text("7") },
            modifier = Modifier.fillMaxWidth(),
            singleLine = true,
            keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number)
        )
    }

    Spacer(modifier = Modifier.height(16.dp))

    Row(
        modifier = Modifier.fillMaxWidth(),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.SpaceBetween
    ) {
        Row(
            verticalAlignment = Alignment.CenterVertically,
            modifier = Modifier.weight(1f)
        ) {
            Icon(
                Icons.Default.PriorityHigh,
                contentDescription = null,
                tint = if (isUrgent) MaterialTheme.colorScheme.error else MaterialTheme.colorScheme.onSurfaceVariant,
                modifier = Modifier.padding(end = 8.dp)
            )
            Column {
                Text(stringResource(R.string.urgent_toggle_title), style = MaterialTheme.typography.titleMedium)
                Text(
                    text = stringResource(R.string.urgent_toggle_subtitle),
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant
                )
            }
        }
        Switch(
            checked = isUrgent,
            onCheckedChange = onUrgentToggle,
            colors = SwitchDefaults.colors(
                checkedThumbColor = MaterialTheme.colorScheme.onError,
                checkedTrackColor = MaterialTheme.colorScheme.error
            )
        )
    }

    Spacer(modifier = Modifier.height(24.dp))

    if (errorText != null && errorMessage != "empty_name") {
        Text(
            text = errorText,
            style = MaterialTheme.typography.bodySmall,
            color = MaterialTheme.colorScheme.error,
            modifier = Modifier.padding(bottom = 8.dp)
        )
    }

    SalinoPrimaryButton(
        text = if (isLoading) stringResource(R.string.item_saving) else stringResource(R.string.item_add),
        onClick = onAddItem,
        modifier = Modifier.fillMaxWidth(),
        enabled = !isLoading,
        leading = { Icon(Icons.Default.AddShoppingCart, contentDescription = null) }
    )
}

private fun launchSpeechRecognizer(
    context: android.content.Context,
    launcher: androidx.activity.result.ActivityResultLauncher<Intent>
) {
    val intent = Intent(RecognizerIntent.ACTION_RECOGNIZE_SPEECH).apply {
        putExtra(RecognizerIntent.EXTRA_LANGUAGE_MODEL, RecognizerIntent.LANGUAGE_MODEL_FREE_FORM)
        putExtra(RecognizerIntent.EXTRA_LANGUAGE, getAppLocale().toLanguageTag())
        putExtra(RecognizerIntent.EXTRA_PROMPT, context.getString(R.string.voice_input_prompt))
    }
    if (intent.resolveActivity(context.packageManager) != null) {
        launcher.launch(intent)
    } else {
        Toast.makeText(context, context.getString(R.string.voice_input_unavailable), Toast.LENGTH_SHORT).show()
    }
}
