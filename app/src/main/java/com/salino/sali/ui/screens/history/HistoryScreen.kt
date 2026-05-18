package com.salino.sali.ui.screens.history

import androidx.compose.animation.AnimatedVisibility
import androidx.compose.animation.expandVertically
import androidx.compose.animation.shrinkVertically
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.KeyboardArrowDown
import androidx.compose.material.icons.filled.KeyboardArrowUp
import androidx.compose.material.icons.filled.Receipt
import androidx.compose.material3.*
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.salino.sali.R
import com.salino.sali.data.model.ItemCategory
import com.salino.sali.data.model.ItemUnit
import com.salino.sali.ui.components.BottomBannerAd
import com.salino.sali.ui.components.CategoryChip
import com.salino.sali.ui.components.EmptyState
import com.salino.sali.ui.components.LoadingIndicator
import com.salino.sali.ui.components.SalinoGradientBackground
import com.salino.sali.ui.components.SalinoSectionTitle
import com.salino.sali.ui.components.SalinoSurfaceCard
import com.salino.sali.ui.components.SalinoWebInnerTopBar
import com.salino.sali.ui.components.SalinoWebTokens
import com.salino.sali.ui.components.salinoWebMaxWidth
import com.salino.sali.util.formatQuantity
import com.salino.sali.util.formatTimestamp

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun HistoryScreen(
    onNavigateBack: () -> Unit,
    viewModel: HistoryViewModel = hiltViewModel()
) {
    val uiState by viewModel.uiState.collectAsStateWithLifecycle()

    SalinoGradientBackground {
        Scaffold(
            containerColor = androidx.compose.ui.graphics.Color.Transparent,
            topBar = {
                SalinoWebInnerTopBar(
                    title = stringResource(R.string.history_title),
                    onBack = onNavigateBack,
                    backContentDescription = stringResource(R.string.cancel)
                )
            },
            bottomBar = { BottomBannerAd() },
        ) { padding ->
            if (uiState.isLoading) {
                LoadingIndicator(modifier = Modifier.padding(padding))
                return@Scaffold
            }

            if (uiState.items.isEmpty()) {
                EmptyState(
                    icon = Icons.Default.Receipt,
                    title = stringResource(R.string.history_empty_title),
                    subtitle = stringResource(R.string.history_empty_subtitle),
                    modifier = Modifier.padding(padding)
                )
                return@Scaffold
            }

            LazyColumn(
                modifier = Modifier
                    .padding(padding)
                    .consumeWindowInsets(padding)
                    .navigationBarsPadding()
                    .salinoWebMaxWidth()
                    .padding(horizontal = SalinoWebTokens.HorizontalPadding),
                contentPadding = PaddingValues(vertical = 8.dp),
                verticalArrangement = Arrangement.spacedBy(10.dp)
            ) {
                uiState.dayGroups.forEach { dayGroup ->
                    val isExpanded = uiState.expandedDays.contains(dayGroup.dateLabel)

                    item(key = "header_${dayGroup.dateLabel}") {
                        Row(
                            modifier = Modifier
                                .fillMaxWidth()
                                .clickable { viewModel.toggleDay(dayGroup.dateLabel) },
                            horizontalArrangement = Arrangement.SpaceBetween,
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            SalinoSectionTitle(
                                text = dayGroup.dateLabel,
                                modifier = Modifier.weight(1f)
                            )
                            Icon(
                                imageVector = if (isExpanded) Icons.Default.KeyboardArrowUp
                                    else Icons.Default.KeyboardArrowDown,
                                contentDescription = null,
                                tint = MaterialTheme.colorScheme.onSurfaceVariant,
                                modifier = Modifier.padding(end = 4.dp)
                            )
                        }
                    }

                    if (isExpanded) {
                        items(
                            items = dayGroup.items,
                            key = { it.id }
                        ) { item ->
                            val category = ItemCategory.fromString(item.category)
                            val unit = ItemUnit.fromString(item.unit)

                            SalinoSurfaceCard(modifier = Modifier.fillMaxWidth()) {
                                Row(
                                    modifier = Modifier
                                        .fillMaxWidth()
                                        .padding(0.dp)
                                ) {
                                    Column(modifier = Modifier.weight(1f)) {
                                        Text(
                                            text = item.name,
                                            style = MaterialTheme.typography.titleMedium
                                        )

                                        if (item.quantity > 0) {
                                            val unitLabel = unit?.labelResId?.let { stringResource(it) } ?: ""
                                            Text(
                                                text = "${formatQuantity(item.quantity)} $unitLabel".trim(),
                                                style = MaterialTheme.typography.bodySmall,
                                                color = MaterialTheme.colorScheme.onSurfaceVariant
                                            )
                                        }

                                        if (item.boughtByName != null) {
                                            Text(
                                                text = stringResource(R.string.shopping_list_bought_by, item.boughtByName),
                                                style = MaterialTheme.typography.labelSmall,
                                                color = MaterialTheme.colorScheme.onSurfaceVariant.copy(alpha = 0.7f)
                                            )
                                        }

                                        val timestamp = item.updatedAt?.toDate()
                                        if (timestamp != null) {
                                            Text(
                                                text = formatTimestamp(timestamp),
                                                style = MaterialTheme.typography.labelSmall,
                                                color = MaterialTheme.colorScheme.onSurfaceVariant.copy(alpha = 0.5f)
                                            )
                                        }
                                    }

                                    Column {
                                        if (category != ItemCategory.OTHER) {
                                            CategoryChip(category = category)
                                        }
                                        Spacer(modifier = Modifier.height(8.dp))
                                        TextButton(onClick = { viewModel.returnToList(item.id) }) {
                                            Text(text = stringResource(R.string.shopping_list_undo_bought), style = MaterialTheme.typography.labelSmall)
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }
    }
}
