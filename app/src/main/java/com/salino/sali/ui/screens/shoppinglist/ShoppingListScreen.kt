package com.salino.sali.ui.screens.shoppinglist

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.drawWithCache
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.Path
import androidx.compose.ui.platform.LocalConfiguration
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.salino.sali.R
import com.salino.sali.data.model.ItemCategory
import com.salino.sali.data.model.SuggestionItem
import com.salino.sali.ui.components.BrandLogo
import com.salino.sali.ui.components.EmptyState
import com.salino.sali.ui.components.LoadingIndicator
import com.salino.sali.ui.components.SalinoGradientBackground
import com.salino.sali.ui.components.ShoppingItemCard
import com.salino.sali.ui.theme.*

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun ShoppingListScreen(
    onNavigateToAddItem: () -> Unit,
    onNavigateToEditItem: (String) -> Unit,
    onNavigateToHistory: () -> Unit,
    onNavigateToActivityFeed: () -> Unit,
    onNavigateToSupermarketMode: () -> Unit,
    onNavigateToSettings: () -> Unit,
    viewModel: ShoppingListViewModel = hiltViewModel()
) {
    val uiState by viewModel.uiState.collectAsStateWithLifecycle()
    val filteredActive by viewModel.filteredActiveItems.collectAsStateWithLifecycle(emptyList())
    var isBoughtSectionExpanded by remember { mutableStateOf(false) }
    val configuration = LocalConfiguration.current
    val isCompactWidth = configuration.screenWidthDp < 400
    val isDark = isSystemInDarkTheme()

    SalinoGradientBackground {
        Scaffold(
            containerColor = Color.Transparent,
            floatingActionButtonPosition = FabPosition.Center,
            topBar = {
                // התאמת צבע הרקע לדארק מוד
                val topBarBackgroundColor = if (isDark) Color(0xFF181B22) else Color(0xFFFCFBF2)
                TopAppBar(
                    modifier = Modifier.drawWithCache {
                        onDrawBehind {
                            // רדיוס ענק כדי שהקשת תהיה עוד פחות עגולה (כמעט שטוחה)
                            val curveRadius = size.width * 4.0f
                            drawCircle(
                                color = topBarBackgroundColor,
                                radius = curveRadius,
                                center = Offset(size.width / 2f, size.height - curveRadius + 4.dp.toPx()) // ממוקם קצת יותר למעלה
                            )
                        }
                    },
                    colors = TopAppBarDefaults.topAppBarColors(
                        containerColor = Color.Transparent,
                        actionIconContentColor = if (isDark) Color.White else MaterialTheme.colorScheme.onSurfaceVariant
                    ),
                    title = {
                        Row(
                            horizontalArrangement = Arrangement.spacedBy(10.dp),
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            BrandLogo(iconSize = 38.dp)
                            Column(modifier = Modifier.weight(1f)) {
                                Text(
                                    stringResource(R.string.shopping_list_title),
                                    style = MaterialTheme.typography.titleLarge.copy(
                                        fontWeight = FontWeight.Bold,
                                        fontSize = if (isCompactWidth) 18.sp else 22.sp,
                                        lineHeight = if (isCompactWidth) 22.sp else 28.sp
                                    ),
                                    color = if (isDark) Color.White else MaterialTheme.colorScheme.primary,
                                    maxLines = 1,
                                    overflow = TextOverflow.Ellipsis
                                )
                                Text(
                                    text = stringResource(R.string.shopping_list_live_badge),
                                    style = MaterialTheme.typography.labelSmall,
                                    color = if (isDark) Color.White.copy(alpha = 0.75f) else MaterialTheme.colorScheme.primary.copy(alpha = 0.75f),
                                    maxLines = 1,
                                    overflow = TextOverflow.Ellipsis
                                )
                            }
                        }
                    },
                    actions = {
                        IconButton(onClick = onNavigateToSettings) {
                            Icon(
                                Icons.Default.Settings,
                                contentDescription = stringResource(R.string.settings_title),
                                tint = if (isDark) Color.White else Color(0xFF67B656)
                            )
                        }
                        IconButton(onClick = onNavigateToActivityFeed) {
                            Icon(
                                Icons.Default.Timeline,
                                contentDescription = stringResource(R.string.activity_feed_title),
                                tint = if (isDark) Color.White else Color(0xFFF18E6A)
                            )
                        }
                        IconButton(onClick = onNavigateToHistory) {
                            Icon(
                                Icons.Default.History,
                                contentDescription = stringResource(R.string.history_title),
                                tint = if (isDark) Color.White else Color(0xFF67B656)
                            )
                        }
                    }
                )
            },
            floatingActionButton = {
                Row(
                    horizontalArrangement = Arrangement.spacedBy(12.dp),
                    modifier = Modifier.navigationBarsPadding()
                ) {
                    // Supermarket FAB (green/primary)
                    ExtendedFloatingActionButton(
                        onClick = onNavigateToSupermarketMode,
                        icon = { Icon(Icons.Default.Storefront, contentDescription = null) },
                        text = {
                            Text(
                                stringResource(
                                    if (isCompactWidth) R.string.supermarket_mode_short
                                    else R.string.supermarket_mode_title
                                ),
                                style = MaterialTheme.typography.labelLarge
                            )
                        },
                        shape = RoundedCornerShape(50),
                        containerColor = Color(0xFF67B656),
                        contentColor = Color.White
                    )
                    // Add FAB
                    ExtendedFloatingActionButton(
                        onClick = onNavigateToAddItem,
                        icon = { Icon(Icons.Default.Add, contentDescription = null) },
                        text = {
                            Text(
                                stringResource(R.string.item_add),
                                style = MaterialTheme.typography.labelLarge
                            )
                        },
                        shape = RoundedCornerShape(50),
                        containerColor = Color(0xFFF18E6A),
                        contentColor = Color.White
                    )
                }
            }
        ) { padding ->
            if (uiState.isLoading) {
                LoadingIndicator(modifier = Modifier.padding(padding))
                return@Scaffold
            }

            val isEmpty = filteredActive.isEmpty() && uiState.boughtItems.isEmpty()

            if (isEmpty && uiState.suggestions.isEmpty()) {
                Column(
                    modifier = Modifier
                        .fillMaxSize()
                        .padding(padding)
                ) {
                    EmptyState(
                        icon = Icons.Default.ShoppingCart,
                        title = stringResource(R.string.shopping_list_empty_title),
                        subtitle = stringResource(R.string.shopping_list_empty_subtitle),
                        actionLabel = stringResource(R.string.item_add),
                        onAction = onNavigateToAddItem
                    )
                }
            } else {
                LazyColumn(
                    modifier = Modifier
                        .fillMaxSize()
                        .padding(padding),
                    contentPadding = PaddingValues(bottom = if (isCompactWidth) 120.dp else 100.dp)
                ) {
                    // ── Hero Card: gradient badge + suggestions ──
                    item(key = "__hero") {
                        HeroSuggestionsCard(
                            suggestionsTitle = stringResource(R.string.suggestions_title),
                            suggestionsSubtitle = stringResource(R.string.suggestions_subtitle_home),
                            suggestions = uiState.suggestions,
                            onSuggestionClick = viewModel::addSuggestion,
                            modifier = Modifier.padding(horizontal = 16.dp, vertical = 8.dp)
                        )
                    }

                    // ── Category filter chips ──
                    item(key = "__filters") {
                        LazyRow(
                            contentPadding = PaddingValues(horizontal = 16.dp, vertical = 6.dp),
                            horizontalArrangement = Arrangement.spacedBy(8.dp)
                        ) {
                            item {
                                FilterChip(
                                    selected = uiState.selectedCategory == null,
                                    onClick = { viewModel.onCategorySelected(null) },
                                    label = {
                                        Text(
                                            stringResource(R.string.category_all),
                                            style = MaterialTheme.typography.labelMedium
                                        )
                                    },
                                    shape = RoundedCornerShape(50)
                                )
                            }
                            items(ItemCategory.entries) { category ->
                                FilterChip(
                                    selected = uiState.selectedCategory == category,
                                    onClick = { viewModel.onCategorySelected(category) },
                                    label = {
                                        Text(
                                            stringResource(category.labelResId),
                                            style = MaterialTheme.typography.labelMedium
                                        )
                                    },
                                    shape = RoundedCornerShape(50)
                                )
                            }
                        }
                    }

                    // ── Active items ──
                    items(filteredActive, key = { it.id }) { item ->
                        ShoppingItemCard(
                            item = item,
                            onToggleBought = { viewModel.markAsBought(item.id) },
                            onClick = { onNavigateToEditItem(item.id) },
                            modifier = Modifier.padding(horizontal = 16.dp, vertical = 5.dp)
                        )
                    }

                    // ── Bought items (collapsible) ──
                    if (uiState.boughtItems.isNotEmpty()) {
                        item(key = "__bought_header") {
                            TextButton(
                                onClick = { isBoughtSectionExpanded = !isBoughtSectionExpanded },
                                modifier = Modifier.padding(horizontal = 12.dp, vertical = 2.dp)
                            ) {
                                Icon(
                                    imageVector = if (isBoughtSectionExpanded)
                                        Icons.Default.KeyboardArrowUp
                                    else Icons.Default.KeyboardArrowDown,
                                    contentDescription = null,
                                    tint = MaterialTheme.colorScheme.onSurfaceVariant
                                )
                                Spacer(modifier = Modifier.width(4.dp))
                                Text(
                                    text = stringResource(R.string.shopping_list_bought_section),
                                    style = MaterialTheme.typography.labelLarge,
                                    color = MaterialTheme.colorScheme.onSurfaceVariant
                                )
                            }
                        }
                        if (isBoughtSectionExpanded) {
                            items(uiState.boughtItems, key = { it.id }) { item ->
                                ShoppingItemCard(
                                    item = item,
                                    onToggleBought = { viewModel.markAsActive(item.id) },
                                    onClick = { onNavigateToEditItem(item.id) },
                                    modifier = Modifier.padding(horizontal = 16.dp, vertical = 4.dp)
                                )
                            }
                        }
                    }
                }
            }
        }
    }
}

// ── Hero card: orange gradient accent badge + suggestions content ──
@Composable
private fun HeroSuggestionsCard(
    suggestionsTitle: String,
    suggestionsSubtitle: String,
    suggestions: List<SuggestionItem>,
    onSuggestionClick: (SuggestionItem) -> Unit,
    modifier: Modifier = Modifier
) {
    val isDark = isSystemInDarkTheme()
    val cardColor = if (isDark) SurfaceBrightDark else SurfaceBright
    val cardBorder = if (isDark) {
        BorderStroke(1.dp, OutlineVariantDark.copy(alpha = 0.5f))
    } else null
    val onSurfaceColor = MaterialTheme.colorScheme.onSurface
    val onSurfaceVariantColor = MaterialTheme.colorScheme.onSurfaceVariant
    val tertiaryColor = MaterialTheme.colorScheme.tertiary
    val primaryColor = MaterialTheme.colorScheme.primary
    val primaryContainerColor = MaterialTheme.colorScheme.primaryContainer

    Card(
        modifier = modifier.fillMaxWidth(),
        shape = RoundedCornerShape(20.dp),
        colors = CardDefaults.cardColors(
            containerColor = cardColor,
            contentColor = onSurfaceColor
        ),
        border = cardBorder,
        elevation = CardDefaults.cardElevation(defaultElevation = if (isDark) 2.dp else 4.dp)
    ) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .padding(16.dp),
            verticalArrangement = Arrangement.spacedBy(16.dp)
        ) {
            // Header Row: Subtle Icon + Texts
            Row(
                modifier = Modifier.fillMaxWidth(),
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(14.dp)
            ) {
                // A responsive, simple subtle icon to replace the heavy orange box
                Box(
                    modifier = Modifier
                        .size(48.dp)
                        .clip(RoundedCornerShape(12.dp))
                        .background(tertiaryColor.copy(alpha = 0.15f)),
                    contentAlignment = Alignment.Center
                ) {
                    Icon(
                        Icons.Default.AutoAwesome,
                        contentDescription = null,
                        tint = tertiaryColor,
                        modifier = Modifier.size(24.dp)
                    )
                }

                Column(
                    verticalArrangement = Arrangement.spacedBy(4.dp),
                    modifier = Modifier.weight(1f)
                ) {
                    Text(
                        text = suggestionsTitle,
                        style = MaterialTheme.typography.titleMedium.copy(
                            fontWeight = FontWeight.Bold
                        ),
                        color = onSurfaceColor
                    )
                    Text(
                        text = suggestionsSubtitle,
                        style = MaterialTheme.typography.bodySmall,
                        color = onSurfaceVariantColor,
                        lineHeight = 16.sp
                    )
                }
            }

            // ── Suggestion chips below ──
            if (suggestions.isNotEmpty()) {
                Row(
                    modifier = Modifier.horizontalScroll(rememberScrollState()),
                    horizontalArrangement = Arrangement.spacedBy(8.dp)
                ) {
                    suggestions.forEach { suggestion ->
                        AssistChip(
                            onClick = { onSuggestionClick(suggestion) },
                            label = {
                                Text(
                                    suggestion.name,
                                    style = MaterialTheme.typography.labelMedium
                                )
                            },
                            leadingIcon = {
                                Icon(
                                    Icons.Default.Add,
                                    contentDescription = null,
                                    modifier = Modifier.size(16.dp)
                                )
                            },
                            shape = RoundedCornerShape(50),
                            colors = AssistChipDefaults.assistChipColors(
                                containerColor = primaryContainerColor
                                    .copy(alpha = if (isDark) 0.35f else 0.6f),
                                labelColor = primaryColor,
                                leadingIconContentColor = primaryColor
                            )
                        )
                    }
                }
            }
        } // end Column
    }
}


