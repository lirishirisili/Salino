package com.salino.sali.ui.screens.supermarket

import androidx.compose.animation.AnimatedVisibility
import androidx.compose.animation.animateColorAsState
import androidx.compose.animation.core.animateFloatAsState
import androidx.compose.animation.expandVertically
import androidx.compose.animation.shrinkVertically
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.WindowInsets
import androidx.compose.foundation.layout.consumeWindowInsets
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.navigationBars
import androidx.compose.foundation.layout.navigationBarsPadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.layout.windowInsetsPadding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.filled.Add
import androidx.compose.material.icons.filled.Celebration
import androidx.compose.material.icons.filled.Check
import androidx.compose.material.icons.filled.CheckCircle
import androidx.compose.material.icons.filled.Close
import androidx.compose.material.icons.filled.KeyboardArrowDown
import androidx.compose.material.icons.filled.KeyboardArrowUp
import androidx.compose.material.icons.filled.PriorityHigh
import androidx.compose.material.icons.filled.SearchOff
import androidx.compose.material.icons.filled.ShoppingCartCheckout
import androidx.compose.material.icons.filled.Storefront
import androidx.compose.material.icons.filled.VisibilityOff
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.FilterChip
import androidx.compose.material3.FilterChipDefaults
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.LinearProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Scaffold
import androidx.compose.material3.SnackbarDuration
import androidx.compose.material3.SnackbarHost
import androidx.compose.material3.SnackbarHostState
import androidx.compose.material3.SnackbarResult
import androidx.compose.material3.Surface
import androidx.compose.material3.SwipeToDismissBox
import androidx.compose.material3.SwipeToDismissBoxValue
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.rememberSwipeToDismissBoxState
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextDecoration
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.salino.sali.R
import com.salino.sali.data.model.ItemCategory
import com.salino.sali.data.model.ShoppingItem
import com.salino.sali.ui.components.EmptyState
import com.salino.sali.ui.components.LoadingIndicator
import com.salino.sali.util.formatQuantity

// ═══════════════════════════════════════════════════════════════
// SupermarketModeScreen — execution-focused in-store shopping
// ═══════════════════════════════════════════════════════════════

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun SupermarketModeScreen(
    onNavigateBack: () -> Unit,
    onNavigateToAddItem: () -> Unit,
    viewModel: SupermarketModeViewModel = hiltViewModel()
) {
    val uiState by viewModel.uiState.collectAsStateWithLifecycle()
    val snackbarHostState = remember { SnackbarHostState() }
    val undoLabel = stringResource(R.string.supermarket_mode_undo)
    val boughtLabel = stringResource(R.string.supermarket_mode_item_bought)
    val notFoundLabel = stringResource(R.string.supermarket_mode_item_not_found)
    var showFinishDialog by remember { mutableStateOf(false) }

    // Undo snackbar for bought items
    LaunchedEffect(uiState.lastBoughtItem) {
        val lastBought = uiState.lastBoughtItem ?: return@LaunchedEffect
        val result = snackbarHostState.showSnackbar(
            message = "${lastBought.name} $boughtLabel",
            actionLabel = undoLabel,
            duration = SnackbarDuration.Short
        )
        if (result == SnackbarResult.ActionPerformed) {
            viewModel.undoLastBought()
        } else {
            viewModel.clearLastBought()
        }
    }

    // Finish shopping confirmation dialog
    if (showFinishDialog) {
        AlertDialog(
            onDismissRequest = { showFinishDialog = false },
            title = { Text(stringResource(R.string.supermarket_mode_finish_title)) },
            text = {
                if (uiState.remainingCount > 0) {
                    Text(stringResource(R.string.supermarket_mode_finish_message, uiState.remainingCount))
                }
            },
            confirmButton = {
                TextButton(onClick = {
                    showFinishDialog = false
                    onNavigateBack()
                }) {
                    Text(stringResource(R.string.supermarket_mode_finish_confirm))
                }
            },
            dismissButton = {
                TextButton(onClick = { showFinishDialog = false }) {
                    Text(stringResource(R.string.cancel))
                }
            }
        )
    }

    Scaffold(
        containerColor = MaterialTheme.colorScheme.background,
        snackbarHost = {
            SnackbarHost(
                hostState = snackbarHostState,
                modifier = Modifier.padding(bottom = 72.dp)
            )
        },
        bottomBar = {
            SupermarketBottomBar(
                onAddItem = onNavigateToAddItem,
                onFinish = {
                    if (uiState.remainingCount == 0 || uiState.allDone) {
                        onNavigateBack()
                    } else {
                        showFinishDialog = true
                    }
                }
            )
        }
    ) { padding ->
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(padding)
                .consumeWindowInsets(padding)
        ) {
            // Compact header
            SupermarketHeader(
                remaining = uiState.remainingCount,
                total = uiState.totalCount,
                bought = uiState.boughtInSessionCount,
                notFoundCount = uiState.notFoundCount,
                onBack = onNavigateBack
            )

            // Filter chips
            SupermarketFilterRow(
                activeFilter = uiState.activeFilter,
                onFilterSelected = { viewModel.setFilter(it) },
                notFoundCount = uiState.notFoundCount
            )

            when {
                uiState.isLoading -> LoadingIndicator()
                uiState.allDone -> AllDoneBanner()
                uiState.groupedItems.isEmpty() -> EmptyState(
                    icon = Icons.Default.Storefront,
                    title = stringResource(R.string.supermarket_mode_empty_title),
                    subtitle = stringResource(R.string.supermarket_mode_empty_subtitle)
                )
                else -> {
                    LazyColumn(
                        modifier = Modifier.fillMaxSize(),
                        contentPadding = PaddingValues(horizontal = 12.dp, vertical = 4.dp),
                        verticalArrangement = Arrangement.spacedBy(2.dp)
                    ) {
                        // Bought items toggle
                        if (uiState.boughtItems.isNotEmpty()) {
                            item {
                                BoughtToggleRow(
                                    hideBought = uiState.hideBought,
                                    boughtCount = uiState.boughtItems.size,
                                    onToggle = { viewModel.toggleHideBought() }
                                )
                            }
                        }

                        // Bought items (expandable)
                        if (!uiState.hideBought && uiState.boughtItems.isNotEmpty()) {
                            items(uiState.boughtItems, key = { "bought_${it.id}" }) { item ->
                                BoughtItemRow(item = item)
                            }
                            item { Spacer(modifier = Modifier.height(8.dp)) }
                        }

                        // Grouped active items
                        uiState.groupedItems.forEach { (category, itemsForCategory) ->
                            val isCollapsed = category in uiState.collapsedCategories
                            item(key = "header_${category.name}") {
                                CompactCategoryHeader(
                                    category = category,
                                    itemCount = itemsForCategory.size,
                                    isCollapsed = isCollapsed,
                                    onToggle = { viewModel.toggleCategoryCollapse(category) }
                                )
                            }
                            if (!isCollapsed) {
                                items(itemsForCategory, key = { it.id }) { item ->
                                    SwipeableItemRow(
                                        item = item,
                                        isNotFound = item.id in uiState.notFoundItems,
                                        onBought = { viewModel.markAsBought(item) },
                                        onNotFound = { viewModel.markNotFound(item) },
                                        onUndoNotFound = { viewModel.undoNotFound(item) }
                                    )
                                }
                            }
                        }

                        // Bottom spacer for scroll clearance
                        item { Spacer(modifier = Modifier.height(8.dp)) }
                    }
                }
            }
        }
    }
}

// ═══════════════════════════════════════════════════════════════
// Compact Header
// ═══════════════════════════════════════════════════════════════

@Composable
private fun SupermarketHeader(
    remaining: Int,
    total: Int,
    bought: Int,
    notFoundCount: Int,
    onBack: () -> Unit
) {
    val progress by animateFloatAsState(
        targetValue = if (total > 0) bought.toFloat() / total.toFloat() else 0f,
        label = "progress"
    )

    Surface(
        color = MaterialTheme.colorScheme.primaryContainer.copy(alpha = 0.3f),
        tonalElevation = 2.dp
    ) {
        Column(modifier = Modifier.fillMaxWidth()) {
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(start = 4.dp, end = 16.dp, top = 8.dp, bottom = 4.dp),
                verticalAlignment = Alignment.CenterVertically
            ) {
                IconButton(onClick = onBack) {
                    Icon(
                        Icons.AutoMirrored.Filled.ArrowBack,
                        contentDescription = stringResource(R.string.cancel)
                    )
                }
                Icon(
                    Icons.Filled.Storefront,
                    contentDescription = null,
                    tint = MaterialTheme.colorScheme.primary,
                    modifier = Modifier.size(22.dp)
                )
                Spacer(modifier = Modifier.width(6.dp))
                Text(
                    text = stringResource(R.string.supermarket_mode_title),
                    style = MaterialTheme.typography.titleMedium,
                    fontWeight = FontWeight.Bold
                )
                Spacer(modifier = Modifier.weight(1f))
                Surface(
                    shape = RoundedCornerShape(16.dp),
                    color = MaterialTheme.colorScheme.primary.copy(alpha = 0.12f)
                ) {
                    Text(
                        text = stringResource(R.string.supermarket_mode_progress, bought, total),
                        style = MaterialTheme.typography.labelMedium,
                        color = MaterialTheme.colorScheme.primary,
                        fontWeight = FontWeight.SemiBold,
                        modifier = Modifier.padding(horizontal = 10.dp, vertical = 4.dp)
                    )
                }
            }

            // Progress bar
            if (total > 0) {
                LinearProgressIndicator(
                    progress = { progress },
                    modifier = Modifier
                        .fillMaxWidth()
                        .height(4.dp),
                    color = MaterialTheme.colorScheme.primary,
                    trackColor = MaterialTheme.colorScheme.surfaceVariant
                )
            }
        }
    }
}

// ═══════════════════════════════════════════════════════════════
// Filter Chips Row
// ═══════════════════════════════════════════════════════════════

@Composable
private fun SupermarketFilterRow(
    activeFilter: SupermarketFilter,
    onFilterSelected: (SupermarketFilter) -> Unit,
    notFoundCount: Int
) {
    data class FilterDef(
        val filter: SupermarketFilter,
        val labelResId: Int,
        val icon: ImageVector? = null,
        val badge: String? = null
    )

    val filters = listOf(
        FilterDef(SupermarketFilter.ALL, R.string.supermarket_mode_filter_all_label),
        FilterDef(SupermarketFilter.URGENT, R.string.supermarket_mode_filter_urgent, Icons.Default.PriorityHigh),
        FilterDef(SupermarketFilter.MINE, R.string.supermarket_mode_filter_mine),
        FilterDef(SupermarketFilter.PHARMACY, R.string.supermarket_mode_filter_pharmacy_label),
        FilterDef(
            SupermarketFilter.NOT_FOUND,
            R.string.supermarket_mode_filter_not_found,
            Icons.Default.SearchOff,
            badge = if (notFoundCount > 0) notFoundCount.toString() else null
        )
    )

    LazyRow(
        modifier = Modifier.fillMaxWidth(),
        contentPadding = PaddingValues(horizontal = 12.dp, vertical = 6.dp),
        horizontalArrangement = Arrangement.spacedBy(8.dp)
    ) {
        items(filters, key = { it.filter.name }) { def ->
            FilterChip(
                selected = activeFilter == def.filter,
                onClick = { onFilterSelected(def.filter) },
                label = {
                    Text(
                        text = stringResource(def.labelResId) + (def.badge?.let { " ($it)" } ?: ""),
                        style = MaterialTheme.typography.labelMedium
                    )
                },
                leadingIcon = def.icon?.let {
                    {
                        Icon(
                            it,
                            contentDescription = null,
                            modifier = Modifier.size(16.dp)
                        )
                    }
                },
                colors = FilterChipDefaults.filterChipColors(
                    selectedContainerColor = MaterialTheme.colorScheme.primaryContainer,
                    selectedLabelColor = MaterialTheme.colorScheme.onPrimaryContainer
                )
            )
        }
    }
}

// ═══════════════════════════════════════════════════════════════
// Compact Category Header
// ═══════════════════════════════════════════════════════════════

@Composable
private fun CompactCategoryHeader(
    category: ItemCategory,
    itemCount: Int,
    isCollapsed: Boolean,
    onToggle: () -> Unit
) {
    Surface(
        modifier = Modifier.fillMaxWidth(),
        shape = RoundedCornerShape(8.dp),
        color = MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.5f)
    ) {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .clickable(onClick = onToggle)
                .padding(horizontal = 10.dp, vertical = 8.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            Icon(
                imageVector = if (isCollapsed) Icons.Default.KeyboardArrowDown else Icons.Default.KeyboardArrowUp,
                contentDescription = null,
                tint = MaterialTheme.colorScheme.onSurfaceVariant,
                modifier = Modifier.size(18.dp)
            )
            Spacer(modifier = Modifier.width(6.dp))
            Text(
                text = stringResource(category.labelResId),
                style = MaterialTheme.typography.labelLarge,
                fontWeight = FontWeight.SemiBold,
                color = MaterialTheme.colorScheme.onSurfaceVariant
            )
            Spacer(modifier = Modifier.width(4.dp))
            Surface(
                shape = CircleShape,
                color = MaterialTheme.colorScheme.primary.copy(alpha = 0.12f),
                modifier = Modifier.padding(start = 4.dp)
            ) {
                Text(
                    text = "$itemCount",
                    style = MaterialTheme.typography.labelSmall,
                    color = MaterialTheme.colorScheme.primary,
                    fontWeight = FontWeight.Bold,
                    modifier = Modifier.padding(horizontal = 6.dp, vertical = 2.dp)
                )
            }
        }
    }
}

// ═══════════════════════════════════════════════════════════════
// Swipeable Item Row — tap check = bought, swipe left = not found
// ═══════════════════════════════════════════════════════════════

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun SwipeableItemRow(
    item: ShoppingItem,
    isNotFound: Boolean,
    onBought: () -> Unit,
    onNotFound: () -> Unit,
    onUndoNotFound: () -> Unit
) {
    val dismissState = rememberSwipeToDismissBoxState(
        confirmValueChange = { value ->
            if (value == SwipeToDismissBoxValue.EndToStart) {
                onNotFound()
                true
            } else {
                false
            }
        }
    )

    if (isNotFound) {
        // Not-found state: show inline with undo
        NotFoundItemRow(item = item, onUndo = onUndoNotFound)
    } else {
        SwipeToDismissBox(
            state = dismissState,
            backgroundContent = {
                // Swipe background — "not found"
                val color by animateColorAsState(
                    targetValue = when (dismissState.targetValue) {
                        SwipeToDismissBoxValue.EndToStart -> MaterialTheme.colorScheme.errorContainer
                        else -> MaterialTheme.colorScheme.surface
                    },
                    label = "swipeBg"
                )
                Box(
                    modifier = Modifier
                        .fillMaxSize()
                        .background(color, RoundedCornerShape(12.dp))
                        .padding(horizontal = 20.dp),
                    contentAlignment = Alignment.CenterEnd
                ) {
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Text(
                            text = stringResource(R.string.supermarket_mode_swipe_not_found),
                            style = MaterialTheme.typography.labelMedium,
                            color = MaterialTheme.colorScheme.onErrorContainer
                        )
                        Spacer(modifier = Modifier.width(4.dp))
                        Icon(
                            Icons.Default.SearchOff,
                            contentDescription = null,
                            tint = MaterialTheme.colorScheme.onErrorContainer,
                            modifier = Modifier.size(18.dp)
                        )
                    }
                }
            },
            enableDismissFromStartToEnd = false
        ) {
            ActiveItemRow(item = item, onBought = onBought, onNotFound = onNotFound)
        }
    }
}

@Composable
private fun ActiveItemRow(item: ShoppingItem, onBought: () -> Unit, onNotFound: () -> Unit) {
    Surface(
        modifier = Modifier.fillMaxWidth(),
        shape = RoundedCornerShape(12.dp),
        color = MaterialTheme.colorScheme.surface,
        tonalElevation = 1.dp,
        shadowElevation = 0.5.dp
    ) {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .clickable(onClick = onBought)
                .padding(start = 12.dp, end = 4.dp, top = 10.dp, bottom = 10.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            // Large circular checkbox
            Surface(
                modifier = Modifier.size(36.dp),
                shape = CircleShape,
                color = MaterialTheme.colorScheme.primaryContainer.copy(alpha = 0.5f),
                onClick = onBought
            ) {
                Box(contentAlignment = Alignment.Center) {
                    Icon(
                        Icons.Default.Check,
                        contentDescription = stringResource(R.string.shopping_list_mark_bought),
                        tint = MaterialTheme.colorScheme.primary,
                        modifier = Modifier.size(20.dp)
                    )
                }
            }

            Spacer(modifier = Modifier.width(12.dp))

            // Item details
            Column(modifier = Modifier.weight(1f)) {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Text(
                        text = if (item.isUrgent) "${item.name} ❗" else item.name,
                        style = MaterialTheme.typography.bodyLarge,
                        fontWeight = FontWeight.Medium,
                        maxLines = 1,
                        overflow = TextOverflow.Ellipsis
                    )
                }
                if (item.quantity != 1.0 || !item.unit.isNullOrBlank() || item.note.isNotBlank()) {
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        if (item.quantity != 1.0 || !item.unit.isNullOrBlank()) {
                            Text(
                                text = formatQuantity(item.quantity) + (item.unit?.let { " $it" } ?: ""),
                                style = MaterialTheme.typography.bodySmall,
                                color = MaterialTheme.colorScheme.onSurfaceVariant
                            )
                        }
                        if (item.note.isNotBlank()) {
                            if (item.quantity != 1.0 || !item.unit.isNullOrBlank()) {
                                Text(
                                    " · ",
                                    style = MaterialTheme.typography.bodySmall,
                                    color = MaterialTheme.colorScheme.outline
                                )
                            }
                            Text(
                                text = item.note,
                                style = MaterialTheme.typography.bodySmall,
                                color = MaterialTheme.colorScheme.onSurfaceVariant.copy(alpha = 0.7f),
                                maxLines = 1,
                                overflow = TextOverflow.Ellipsis
                            )
                        }
                    }
                }
            }

            // Not-found button
            IconButton(onClick = onNotFound) {
                Icon(
                    Icons.Default.SearchOff,
                    contentDescription = stringResource(R.string.supermarket_mode_not_found),
                    tint = MaterialTheme.colorScheme.outline,
                    modifier = Modifier.size(20.dp)
                )
            }
        }
    }
}

// ═══════════════════════════════════════════════════════════════
// Not Found Item Row
// ═══════════════════════════════════════════════════════════════

@Composable
private fun NotFoundItemRow(item: ShoppingItem, onUndo: () -> Unit) {
    Surface(
        modifier = Modifier.fillMaxWidth(),
        shape = RoundedCornerShape(12.dp),
        color = MaterialTheme.colorScheme.errorContainer.copy(alpha = 0.3f)
    ) {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(horizontal = 12.dp, vertical = 10.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            Icon(
                Icons.Default.SearchOff,
                contentDescription = null,
                tint = MaterialTheme.colorScheme.error.copy(alpha = 0.7f),
                modifier = Modifier.size(20.dp)
            )
            Spacer(modifier = Modifier.width(10.dp))
            Text(
                text = item.name,
                style = MaterialTheme.typography.bodyMedium,
                color = MaterialTheme.colorScheme.onSurface.copy(alpha = 0.5f),
                textDecoration = TextDecoration.LineThrough,
                modifier = Modifier.weight(1f),
                maxLines = 1,
                overflow = TextOverflow.Ellipsis
            )
            TextButton(onClick = onUndo) {
                Text(
                    stringResource(R.string.supermarket_mode_undo),
                    style = MaterialTheme.typography.labelSmall
                )
            }
        }
    }
}

// ═══════════════════════════════════════════════════════════════
// Bought Item Row (compact, strikethrough)
// ═══════════════════════════════════════════════════════════════

@Composable
private fun BoughtItemRow(item: ShoppingItem) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .padding(horizontal = 12.dp, vertical = 6.dp),
        verticalAlignment = Alignment.CenterVertically
    ) {
        Icon(
            Icons.Filled.CheckCircle,
            contentDescription = null,
            tint = MaterialTheme.colorScheme.primary.copy(alpha = 0.4f),
            modifier = Modifier.size(20.dp)
        )
        Spacer(modifier = Modifier.width(10.dp))
        Text(
            text = item.name,
            style = MaterialTheme.typography.bodyMedium,
            color = MaterialTheme.colorScheme.onSurface.copy(alpha = 0.38f),
            textDecoration = TextDecoration.LineThrough,
            maxLines = 1,
            overflow = TextOverflow.Ellipsis
        )
    }
}

// ═══════════════════════════════════════════════════════════════
// Bought toggle row
// ═══════════════════════════════════════════════════════════════

@Composable
private fun BoughtToggleRow(
    hideBought: Boolean,
    boughtCount: Int,
    onToggle: () -> Unit
) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .clickable(onClick = onToggle)
            .padding(horizontal = 12.dp, vertical = 8.dp),
        verticalAlignment = Alignment.CenterVertically
    ) {
        Icon(
            if (hideBought) Icons.Default.VisibilityOff else Icons.Default.CheckCircle,
            contentDescription = null,
            tint = MaterialTheme.colorScheme.outline,
            modifier = Modifier.size(16.dp)
        )
        Spacer(modifier = Modifier.width(8.dp))
        Text(
            text = if (hideBought) {
                stringResource(R.string.supermarket_mode_show_bought, boughtCount)
            } else {
                stringResource(R.string.supermarket_mode_hide_bought)
            },
            style = MaterialTheme.typography.labelMedium,
            color = MaterialTheme.colorScheme.outline
        )
    }
    HorizontalDivider(
        modifier = Modifier.padding(horizontal = 12.dp),
        color = MaterialTheme.colorScheme.outlineVariant.copy(alpha = 0.3f)
    )
}

// ═══════════════════════════════════════════════════════════════
// All Done Banner
// ═══════════════════════════════════════════════════════════════

@Composable
private fun AllDoneBanner() {
    Column(
        modifier = Modifier
            .fillMaxSize()
            .padding(32.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.Center
    ) {
        Surface(
            shape = CircleShape,
            color = MaterialTheme.colorScheme.primaryContainer,
            modifier = Modifier.size(80.dp)
        ) {
            Box(contentAlignment = Alignment.Center) {
                Icon(
                    Icons.Default.Celebration,
                    contentDescription = null,
                    tint = MaterialTheme.colorScheme.primary,
                    modifier = Modifier.size(40.dp)
                )
            }
        }
        Spacer(modifier = Modifier.height(20.dp))
        Text(
            text = stringResource(R.string.supermarket_mode_all_done),
            style = MaterialTheme.typography.headlineSmall,
            fontWeight = FontWeight.Bold,
            color = MaterialTheme.colorScheme.primary
        )
        Spacer(modifier = Modifier.height(8.dp))
        Text(
            text = stringResource(R.string.supermarket_mode_all_done_subtitle),
            style = MaterialTheme.typography.bodyMedium,
            color = MaterialTheme.colorScheme.onSurfaceVariant
        )
    }
}

// ═══════════════════════════════════════════════════════════════
// Sticky Bottom Action Bar
// ═══════════════════════════════════════════════════════════════

@Composable
private fun SupermarketBottomBar(
    onAddItem: () -> Unit,
    onFinish: () -> Unit
) {
    Surface(
        tonalElevation = 4.dp,
        shadowElevation = 12.dp,
        color = MaterialTheme.colorScheme.surface
    ) {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .windowInsetsPadding(WindowInsets.navigationBars)
                .padding(horizontal = 16.dp, vertical = 10.dp),
            horizontalArrangement = Arrangement.spacedBy(12.dp)
        ) {
            // Add item button
            Surface(
                modifier = Modifier
                    .weight(1f)
                    .height(48.dp),
                onClick = onAddItem,
                shape = RoundedCornerShape(12.dp),
                color = MaterialTheme.colorScheme.secondaryContainer
            ) {
                Row(
                    modifier = Modifier.fillMaxSize(),
                    horizontalArrangement = Arrangement.Center,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Icon(
                        Icons.Default.Add,
                        contentDescription = null,
                        tint = MaterialTheme.colorScheme.onSecondaryContainer,
                        modifier = Modifier.size(20.dp)
                    )
                    Spacer(modifier = Modifier.width(6.dp))
                    Text(
                        text = stringResource(R.string.supermarket_mode_add_item),
                        style = MaterialTheme.typography.labelLarge,
                        color = MaterialTheme.colorScheme.onSecondaryContainer
                    )
                }
            }

            // Finish shopping button
            Surface(
                modifier = Modifier
                    .weight(1f)
                    .height(48.dp),
                onClick = onFinish,
                shape = RoundedCornerShape(12.dp),
                color = MaterialTheme.colorScheme.primary
            ) {
                Row(
                    modifier = Modifier.fillMaxSize(),
                    horizontalArrangement = Arrangement.Center,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Icon(
                        Icons.Default.ShoppingCartCheckout,
                        contentDescription = null,
                        tint = MaterialTheme.colorScheme.onPrimary,
                        modifier = Modifier.size(20.dp)
                    )
                    Spacer(modifier = Modifier.width(6.dp))
                    Text(
                        text = stringResource(R.string.supermarket_mode_finish),
                        style = MaterialTheme.typography.labelLarge,
                        color = MaterialTheme.colorScheme.onPrimary
                    )
                }
            }
        }
    }
}
