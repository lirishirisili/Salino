package com.salino.sali.ui.screens.shoppinglist

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
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
import androidx.compose.ui.draw.shadow
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalConfiguration
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.LocalLayoutDirection
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.LayoutDirection
import androidx.compose.foundation.layout.statusBarsPadding
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.salino.sali.R
import com.salino.sali.data.model.ItemCategory
import com.salino.sali.data.model.ShoppingItem
import com.salino.sali.data.model.SuggestionItem
import com.salino.sali.ui.components.BottomBannerAd
import com.salino.sali.ui.components.BrandLogo
import com.salino.sali.ui.components.EmptyState
import com.salino.sali.ui.components.LoadingIndicator
import com.salino.sali.ui.components.SalinoGradientBackground
import com.salino.sali.ui.components.SalinoSectionTitle
import com.salino.sali.ui.components.SalinoWebAppBarTitle
import com.salino.sali.ui.components.SalinoWebTokens
import com.salino.sali.ui.components.ShoppingItemsGroupCard
import com.salino.sali.ui.components.salinoWebMaxWidth
import androidx.compose.foundation.lazy.rememberLazyListState
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.LaunchedEffect
import com.salino.sali.feature.tour.LocalTourViewModel
import com.salino.sali.feature.tour.TourAnchorId
import com.salino.sali.feature.tour.TourPreview
import com.salino.sali.feature.tour.tourAnchor
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
    var boughtVisibleCount by remember { mutableIntStateOf(BOUGHT_ITEMS_PAGE_SIZE) }
    val visibleBoughtItems = remember(uiState.boughtItems, boughtVisibleCount) {
        uiState.boughtItems.take(boughtVisibleCount)
    }
    val hasMoreBoughtItems = uiState.boughtItems.size > boughtVisibleCount
    var pendingDeleteItem by remember { mutableStateOf<ShoppingItem?>(null) }
    val configuration = LocalConfiguration.current
    val isCompactWidth = configuration.screenWidthDp < 400
    val tintSettingsLight = Color(0xFF67B656)
    val tintActivityLight = Color(0xFFF18E6A)
    val isDark = isSystemInDarkTheme()
    val isHebrew = configuration.locales[0]?.language in setOf("he", "iw")
    val tourViewModel = LocalTourViewModel.current
    val tourState by tourViewModel.uiState.collectAsStateWithLifecycle()
    val listState = rememberLazyListState()
    val resources = LocalContext.current.resources

    val isListEmptyForTour = filteredActive.isEmpty() &&
        uiState.boughtItems.isEmpty() &&
        uiState.suggestions.isEmpty()
    val showTourPreview = tourState.active && isListEmptyForTour
    val previewItems = remember(resources) { TourPreview.items(resources) }
    val listSuggestions = if (showTourPreview) {
        TourPreview.suggestions(resources)
    } else {
        uiState.suggestions
    }
    val listActiveItems = if (showTourPreview) {
        val selected = uiState.selectedCategory
        if (selected == null) {
            previewItems
        } else {
            previewItems.filter { ItemCategory.fromString(it.category) == selected }
        }
    } else {
        filteredActive
    }
    val noopSuggestion: (SuggestionItem) -> Unit = {}
    val noopItem: (ShoppingItem) -> Unit = {}

    LaunchedEffect(uiState.isLoading) {
        if (!uiState.isLoading) {
            tourViewModel.setShoppingListReady(true)
        }
    }

    DisposableEffect(listState, tourViewModel) {
        val registry = tourViewModel.anchorRegistry
        registry.registerScrollHandler(TourAnchorId.ListHero) {
            listState.animateScrollToItem(0)
        }
        registry.registerScrollHandler(TourAnchorId.ListFilters) {
            listState.animateScrollToItem(1)
        }
        onDispose {
            registry.unregisterScrollHandler(TourAnchorId.ListHero)
            registry.unregisterScrollHandler(TourAnchorId.ListFilters)
        }
    }

    SalinoGradientBackground {
        Scaffold(
            containerColor = Color.Transparent,
            floatingActionButtonPosition = FabPosition.Center,
            bottomBar = { BottomBannerAd() },
            topBar = {
                val topBarCurveColor = if (isDark) Color(0xFF181B22) else Color(0xFFFCFBF2)
                Column(
                    modifier = Modifier
                        .fillMaxWidth()
                        .drawWithCache {
                            onDrawBehind {
                                val curveRadius = size.width * 4.0f
                                drawCircle(
                                    color = topBarCurveColor,
                                    radius = curveRadius,
                                    center = Offset(
                                        size.width / 2f,
                                        size.height - curveRadius + 4.dp.toPx()
                                    )
                                )
                            }
                        }
                        .statusBarsPadding()
                ) {
                    Row(
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(start = 0.dp, top = 14.dp, end = 4.dp, bottom = 10.dp),
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        if (isHebrew) {
                            val logoRes = if (isDark) R.drawable.logo_header_dark else R.drawable.logo_header
                            CompositionLocalProvider(LocalLayoutDirection provides LayoutDirection.Ltr) {
                                Box(
                                    modifier = Modifier
                                        .weight(1f)
                                        .height(88.dp),
                                    contentAlignment = Alignment.CenterEnd
                                ) {
                                    Image(
                                        painter = painterResource(logoRes),
                                        contentDescription = stringResource(R.string.shopping_list_title),
                                        modifier = Modifier.fillMaxHeight(),
                                        contentScale = ContentScale.Fit
                                    )
                                }
                            }
                        } else {
                            BrandLogo(iconSize = 38.dp, showWordmark = false, showGlow = true)
                            Column(
                                modifier = Modifier
                                    .weight(1f)
                                    .padding(start = 10.dp, end = 8.dp)
                            ) {
                                SalinoWebAppBarTitle(
                                    text = stringResource(R.string.shopping_list_title),
                                    color = if (isDark) Color.White else null
                                )
                                Text(
                                    text = stringResource(R.string.shopping_list_live_badge),
                                    style = MaterialTheme.typography.labelMedium.copy(
                                        fontSize = 11.sp,
                                        fontWeight = FontWeight.Medium,
                                        letterSpacing = 0.2.sp
                                    ),
                                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                                    maxLines = 2,
                                    overflow = TextOverflow.Ellipsis,
                                    textAlign = TextAlign.Start,
                                    modifier = Modifier
                                        .fillMaxWidth()
                                        .padding(top = 2.dp)
                                )
                            }
                        }
                        Row {
                            IconButton(
                                onClick = onNavigateToSettings,
                                modifier = Modifier
                                    .size(42.dp)
                                    .tourAnchor(TourAnchorId.ListSettings),
                            ) {
                                Icon(
                                    Icons.Default.Settings,
                                    contentDescription = stringResource(R.string.settings_title),
                                    tint = if (isDark) Color.White else tintSettingsLight
                                )
                            }
                            IconButton(
                                onClick = onNavigateToActivityFeed,
                                modifier = Modifier
                                    .size(42.dp)
                                    .tourAnchor(TourAnchorId.ListActivity),
                            ) {
                                Icon(
                                    Icons.Default.Timeline,
                                    contentDescription = stringResource(R.string.activity_feed_title),
                                    tint = if (isDark) Color.White else tintActivityLight
                                )
                            }
                            IconButton(
                                onClick = onNavigateToHistory,
                                modifier = Modifier.size(42.dp)
                            ) {
                                Icon(
                                    Icons.Default.History,
                                    contentDescription = stringResource(R.string.history_title),
                                    tint = if (isDark) Color.White else tintSettingsLight
                                )
                            }
                        }
                    }
                }
            },
            floatingActionButton = {
                Row(
                    horizontalArrangement = Arrangement.spacedBy(12.dp),
                    modifier = Modifier.navigationBarsPadding()
                ) {
                    // Supermarket FAB (green/primary)
                    ExtendedFloatingActionButton(
                        onClick = onNavigateToSupermarketMode,
                        modifier = Modifier.tourAnchor(TourAnchorId.ListSupermarketFab),
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
                        modifier = Modifier.tourAnchor(TourAnchorId.ListAddFab),
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

            if (isEmpty && uiState.suggestions.isEmpty() && !tourState.active) {
                Column(
                    modifier = Modifier
                        .fillMaxSize()
                        .padding(padding)
                        .salinoWebMaxWidth()
                        .padding(horizontal = SalinoWebTokens.HorizontalPadding)
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
                    state = listState,
                    modifier = Modifier
                        .fillMaxSize()
                        .padding(padding)
                        .salinoWebMaxWidth()
                        .padding(horizontal = SalinoWebTokens.HorizontalPadding),
                    contentPadding = PaddingValues(bottom = if (isCompactWidth) 120.dp else 100.dp)
                ) {
                    // ── Hero Card: gradient badge + suggestions ──
                    item(key = "__hero") {
                        HeroSuggestionsCard(
                            suggestionsTitle = stringResource(R.string.suggestions_title),
                            suggestionsSubtitle = stringResource(R.string.suggestions_subtitle_home),
                            suggestions = listSuggestions,
                            onSuggestionClick = if (showTourPreview) noopSuggestion else viewModel::addSuggestion,
                            modifier = Modifier
                                .padding(vertical = 8.dp)
                                .tourAnchor(TourAnchorId.ListHero),
                        )
                    }

                    // ── Category filter chips ──
                    item(key = "__filters") {
                        LazyRow(
                            modifier = Modifier.tourAnchor(TourAnchorId.ListFilters),
                            contentPadding = PaddingValues(vertical = 6.dp),
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
                                    shape = RoundedCornerShape(50),
                                    colors = FilterChipDefaults.filterChipColors(
                                        selectedContainerColor = MaterialTheme.colorScheme.primary,
                                        selectedLabelColor = MaterialTheme.colorScheme.onPrimary,
                                        containerColor = MaterialTheme.colorScheme.surface,
                                        labelColor = MaterialTheme.colorScheme.onSurface
                                    ),
                                    border = FilterChipDefaults.filterChipBorder(
                                        enabled = true,
                                        selected = uiState.selectedCategory == null,
                                        borderColor = MaterialTheme.colorScheme.outlineVariant
                                    )
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
                                    shape = RoundedCornerShape(50),
                                    colors = FilterChipDefaults.filterChipColors(
                                        selectedContainerColor = MaterialTheme.colorScheme.primary,
                                        selectedLabelColor = MaterialTheme.colorScheme.onPrimary,
                                        containerColor = MaterialTheme.colorScheme.surface,
                                        labelColor = MaterialTheme.colorScheme.onSurface
                                    ),
                                    border = FilterChipDefaults.filterChipBorder(
                                        enabled = true,
                                        selected = uiState.selectedCategory == category,
                                        borderColor = MaterialTheme.colorScheme.outlineVariant
                                    )
                                )
                            }
                        }
                    }

                    item(key = "__section_active") {
                        SalinoSectionTitle(
                            text = if (showTourPreview) {
                                "${stringResource(R.string.shopping_list_active_section)} (${listActiveItems.size}) · ${stringResource(R.string.tour_preview_label)}"
                            } else {
                                "${stringResource(R.string.shopping_list_active_section)} (${filteredActive.size})"
                            }
                        )
                    }

                    item(key = "__active_group") {
                        ShoppingItemsGroupCard(
                            items = listActiveItems,
                            onToggleBought = if (showTourPreview) {
                                { _ -> }
                            } else {
                                { item -> viewModel.markAsBought(item.id) }
                            },
                            onItemClick = if (showTourPreview) {
                                noopItem
                            } else {
                                { item -> onNavigateToEditItem(item.id) }
                            },
                            onDeleteItem = if (showTourPreview) {
                                null
                            } else {
                                { item -> pendingDeleteItem = item }
                            },
                            modifier = Modifier.padding(vertical = 6.dp)
                        )
                    }

                    // ── Bought items (collapsible) ──
                    if (uiState.boughtItems.isNotEmpty()) {
                        item(key = "__bought_header") {
                            Row(
                                modifier = Modifier
                                    .fillMaxWidth()
                                    .clickable {
                                        if (!isBoughtSectionExpanded) {
                                            boughtVisibleCount = BOUGHT_ITEMS_PAGE_SIZE
                                        }
                                        isBoughtSectionExpanded = !isBoughtSectionExpanded
                                    },
                                horizontalArrangement = Arrangement.SpaceBetween,
                                verticalAlignment = Alignment.CenterVertically
                            ) {
                                SalinoSectionTitle(
                                    text = stringResource(R.string.shopping_list_bought_section),
                                    modifier = Modifier.weight(1f)
                                )
                                Icon(
                                    imageVector = if (isBoughtSectionExpanded) {
                                        Icons.Default.KeyboardArrowUp
                                    } else {
                                        Icons.Default.KeyboardArrowDown
                                    },
                                    contentDescription = null,
                                    tint = MaterialTheme.colorScheme.onSurfaceVariant,
                                    modifier = Modifier.padding(end = 4.dp)
                                )
                            }
                        }
                        if (isBoughtSectionExpanded) {
                            item(key = "__bought_group") {
                                ShoppingItemsGroupCard(
                                    items = visibleBoughtItems,
                                    onToggleBought = { item -> viewModel.markAsActive(item.id) },
                                    onItemClick = { item -> onNavigateToEditItem(item.id) },
                                    modifier = Modifier.padding(vertical = 4.dp)
                                )
                            }
                            if (hasMoreBoughtItems) {
                                item(key = "__bought_show_more") {
                                    TextButton(
                                        onClick = {
                                            boughtVisibleCount += BOUGHT_ITEMS_PAGE_SIZE
                                        },
                                        modifier = Modifier
                                            .fillMaxWidth()
                                            .padding(bottom = 4.dp)
                                    ) {
                                        Text(stringResource(R.string.shopping_list_bought_show_more))
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }

        pendingDeleteItem?.let { itemToDelete ->
            AlertDialog(
                onDismissRequest = { pendingDeleteItem = null },
                text = { Text(text = stringResource(R.string.shopping_list_delete_confirm)) },
                confirmButton = {
                    TextButton(
                        onClick = {
                            viewModel.deleteItem(itemToDelete.id)
                            pendingDeleteItem = null
                        }
                    ) {
                        Text(stringResource(R.string.shopping_list_delete))
                    }
                },
                dismissButton = {
                    TextButton(onClick = { pendingDeleteItem = null }) {
                        Text(text = stringResource(android.R.string.cancel))
                    }
                }
            )
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
    val cardShape = RoundedCornerShape(30.dp)
    val shadowColor = if (isDark) Color.Black.copy(alpha = 0.24f) else Color.Black.copy(alpha = 0.1f)
    val onSurfaceColor = MaterialTheme.colorScheme.onSurface
    val onSurfaceVariantColor = MaterialTheme.colorScheme.onSurfaceVariant
    val tertiaryColor = MaterialTheme.colorScheme.tertiary
    val primaryColor = MaterialTheme.colorScheme.primary
    val primaryContainerColor = MaterialTheme.colorScheme.primaryContainer

    Card(
        modifier = modifier
            .fillMaxWidth()
            .shadow(
                elevation = if (isDark) 6.dp else 8.dp,
                shape = cardShape,
                ambientColor = shadowColor,
                spotColor = shadowColor
            ),
        shape = cardShape,
        colors = CardDefaults.cardColors(
            containerColor = cardColor,
            contentColor = onSurfaceColor
        ),
        border = cardBorder,
        elevation = CardDefaults.cardElevation(defaultElevation = 0.dp)
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

private const val BOUGHT_ITEMS_PAGE_SIZE = 10

