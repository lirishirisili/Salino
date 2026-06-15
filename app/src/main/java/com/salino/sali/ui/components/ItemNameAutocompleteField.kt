package com.salino.sali.ui.components

import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.History
import androidx.compose.material.icons.filled.Search
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.OutlinedTextFieldDefaults
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.focus.onFocusChanged
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import com.salino.sali.R
import com.salino.sali.data.model.ItemCategory
import com.salino.sali.domain.model.ItemNameAutocompleteSource
import com.salino.sali.domain.model.ItemNameAutocompleteSuggestion

@Composable
fun ItemNameAutocompleteField(
    value: String,
    onValueChange: (String) -> Unit,
    suggestions: List<ItemNameAutocompleteSuggestion>,
    isAutocompleteVisible: Boolean,
    onFocusChanged: (Boolean) -> Unit,
    onSuggestionSelected: (ItemNameAutocompleteSuggestion) -> Unit,
    modifier: Modifier = Modifier,
    label: @Composable () -> Unit,
    placeholder: @Composable (() -> Unit)? = null,
    isError: Boolean = false,
    trailingIcon: @Composable (() -> Unit)? = null,
    keyboardOptions: androidx.compose.foundation.text.KeyboardOptions = androidx.compose.foundation.text.KeyboardOptions.Default,
    keyboardActions: androidx.compose.foundation.text.KeyboardActions = androidx.compose.foundation.text.KeyboardActions.Default,
    suggestionsMaxHeight: Dp = 280.dp
) {
    var isFocused by remember { mutableStateOf(false) }
    val expanded = isAutocompleteVisible && suggestions.isNotEmpty()
    val borderColor = when {
        isError -> MaterialTheme.colorScheme.error
        isFocused || expanded -> MaterialTheme.colorScheme.primary
        else -> MaterialTheme.colorScheme.outlineVariant
    }
    val containerShape = SalinoWebTokens.InputCorner
    val fieldColors = if (expanded) {
        autocompleteExpandedFieldColors(isError = isError)
    } else {
        salinoWebOutlinedFieldColors()
    }

    Column(
        modifier = modifier
            .fillMaxWidth()
            .then(
                if (expanded) {
                    Modifier
                        .border(width = 1.dp, color = borderColor, shape = containerShape)
                        .clip(containerShape)
                } else {
                    Modifier
                }
            )
    ) {
        OutlinedTextField(
            value = value,
            onValueChange = onValueChange,
            shape = containerShape,
            colors = fieldColors,
            label = label,
            placeholder = placeholder,
            modifier = Modifier
                .fillMaxWidth()
                .onFocusChanged {
                    isFocused = it.isFocused
                    onFocusChanged(it.isFocused)
                },
            singleLine = true,
            isError = isError,
            keyboardOptions = keyboardOptions,
            keyboardActions = keyboardActions,
            trailingIcon = trailingIcon
        )

        if (expanded) {
            HorizontalDivider(color = borderColor, thickness = 1.dp)
            ItemNameAutocompleteDropdown(
                suggestions = suggestions,
                onSuggestionSelected = onSuggestionSelected,
                maxHeight = suggestionsMaxHeight
            )
        }
    }
}

@Composable
private fun autocompleteExpandedFieldColors(isError: Boolean) = OutlinedTextFieldDefaults.colors(
    focusedBorderColor = Color.Transparent,
    unfocusedBorderColor = Color.Transparent,
    disabledBorderColor = Color.Transparent,
    errorBorderColor = Color.Transparent,
    focusedContainerColor = MaterialTheme.colorScheme.surface,
    unfocusedContainerColor = MaterialTheme.colorScheme.surface,
    disabledContainerColor = MaterialTheme.colorScheme.surface,
    errorContainerColor = MaterialTheme.colorScheme.surface,
    cursorColor = MaterialTheme.colorScheme.primary,
    focusedLabelColor = if (isError) MaterialTheme.colorScheme.error else MaterialTheme.colorScheme.primary,
    unfocusedLabelColor = MaterialTheme.colorScheme.onSurfaceVariant,
    errorLabelColor = MaterialTheme.colorScheme.error,
    focusedPlaceholderColor = MaterialTheme.colorScheme.outline,
    unfocusedPlaceholderColor = MaterialTheme.colorScheme.outline
)

@Composable
private fun ItemNameAutocompleteDropdown(
    suggestions: List<ItemNameAutocompleteSuggestion>,
    onSuggestionSelected: (ItemNameAutocompleteSuggestion) -> Unit,
    maxHeight: Dp
) {
    val household = suggestions.filter { it.source == ItemNameAutocompleteSource.HOUSEHOLD_HISTORY }
    val catalog = suggestions.filter { it.source == ItemNameAutocompleteSource.CATEGORY_CATALOG }

    LazyColumn(
        modifier = Modifier
            .fillMaxWidth()
            .heightIn(max = maxHeight)
    ) {
        if (household.isNotEmpty()) {
            item(key = "header_household") {
                AutocompleteSectionHeader(
                    title = stringResource(R.string.autocomplete_section_household),
                    icon = Icons.Default.History
                )
            }
            items(
                items = household,
                key = { "${it.source.name}:${it.displayName}" }
            ) { suggestion ->
                AutocompleteSuggestionRow(
                    suggestion = suggestion,
                    onClick = { onSuggestionSelected(suggestion) }
                )
            }
        }

        if (household.isNotEmpty() && catalog.isNotEmpty()) {
            item(key = "divider_sections") {
                HorizontalDivider(
                    modifier = Modifier.padding(horizontal = 12.dp, vertical = 4.dp),
                    color = MaterialTheme.colorScheme.outlineVariant.copy(alpha = 0.6f)
                )
            }
        }

        if (catalog.isNotEmpty()) {
            item(key = "header_catalog") {
                AutocompleteSectionHeader(
                    title = stringResource(R.string.autocomplete_section_catalog),
                    icon = Icons.Default.Search
                )
            }
            items(
                items = catalog,
                key = { "${it.source.name}:${it.displayName}" }
            ) { suggestion ->
                AutocompleteSuggestionRow(
                    suggestion = suggestion,
                    onClick = { onSuggestionSelected(suggestion) }
                )
            }
        }
    }
}

@Composable
private fun AutocompleteSectionHeader(
    title: String,
    icon: androidx.compose.ui.graphics.vector.ImageVector
) {
    Row(
        modifier = Modifier.padding(horizontal = 16.dp, vertical = 8.dp),
        verticalAlignment = Alignment.CenterVertically
    ) {
        Icon(
            imageVector = icon,
            contentDescription = null,
            modifier = Modifier.size(16.dp),
            tint = MaterialTheme.colorScheme.primary
        )
        androidx.compose.foundation.layout.Spacer(modifier = Modifier.size(8.dp))
        Text(
            text = title,
            style = MaterialTheme.typography.labelLarge,
            color = MaterialTheme.colorScheme.onSurfaceVariant
        )
    }
}

@Composable
private fun AutocompleteSuggestionRow(
    suggestion: ItemNameAutocompleteSuggestion,
    onClick: () -> Unit
) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .clickable(onClick = onClick)
            .padding(horizontal = 16.dp, vertical = 12.dp),
        verticalAlignment = Alignment.CenterVertically
    ) {
        Text(
            text = suggestion.displayName,
            style = MaterialTheme.typography.bodyLarge,
            modifier = Modifier.weight(1f)
        )
        suggestion.category?.let { category ->
            Text(
                text = stringResource(category.labelResId),
                style = MaterialTheme.typography.bodySmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant
            )
        }
    }
}
