import SwiftUI
import UIKit

struct ShoppingListScreen: View {
    @StateObject private var viewModel: ShoppingListViewModel
    @State private var showBought = false
    @State private var pendingDelete: ShoppingItem?
    let onNavigateToAddItem: () -> Void
    let onNavigateToEditItem: (String) -> Void
    let onNavigateToHistory: () -> Void
    let onNavigateToActivityFeed: () -> Void
    let onNavigateToSupermarketMode: () -> Void
    let onNavigateToSettings: () -> Void

    init(
        container: AppContainer,
        onNavigateToAddItem: @escaping () -> Void,
        onNavigateToEditItem: @escaping (String) -> Void,
        onNavigateToHistory: @escaping () -> Void,
        onNavigateToActivityFeed: @escaping () -> Void,
        onNavigateToSupermarketMode: @escaping () -> Void,
        onNavigateToSettings: @escaping () -> Void
    ) {
        _viewModel = StateObject(wrappedValue: ShoppingListViewModel(
            shoppingRepository: container.shoppingRepository,
            authRepository: container.authRepository,
            suggestionsRepository: container.suggestionsRepository,
            activityRepository: container.activityRepository
        ))
        self.onNavigateToAddItem = onNavigateToAddItem
        self.onNavigateToEditItem = onNavigateToEditItem
        self.onNavigateToHistory = onNavigateToHistory
        self.onNavigateToActivityFeed = onNavigateToActivityFeed
        self.onNavigateToSupermarketMode = onNavigateToSupermarketMode
        self.onNavigateToSettings = onNavigateToSettings
    }

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 16) {
                BrandHeader(subtitleKey: "shopping_list_live_badge_full")
                    .frame(maxWidth: .infinity)
                    .padding(.top, 8)

                SurfaceCard {
                    Label(String(format: localized("shopping_list_count"), viewModel.filteredActiveItems.count), systemImage: "cart.fill")
                        .foregroundStyle(SalinoColors.primary)
                        .font(.subheadline.weight(.semibold))

                    TextField(LocalizedStringKey("shopping_list_search_hint"), text: Binding(
                        get: { viewModel.state.searchQuery },
                        set: viewModel.onSearchQueryChange
                    ))
                    .padding(12)
                    .background(Color(.systemBackground), in: RoundedRectangle(cornerRadius: 12))

                    categoryFilters

                    if !viewModel.state.suggestions.isEmpty {
                        VStack(alignment: .leading, spacing: 8) {
                            Text(LocalizedStringKey("suggestions_title")).font(.headline)
                            Text(LocalizedStringKey("suggestions_subtitle_home"))
                                .font(.caption)
                                .foregroundStyle(SalinoColors.secondaryText)
                            SuggestionChips(suggestions: viewModel.state.suggestions, onTap: viewModel.addSuggestion)
                        }
                    }
                }

                if viewModel.state.isLoading {
                    ProgressView().frame(maxWidth: .infinity).padding()
                } else if viewModel.filteredActiveItems.isEmpty && viewModel.state.boughtItems.isEmpty {
                    EmptyStateView(systemImage: "cart", titleKey: "shopping_list_empty_title", subtitleKey: "shopping_list_empty_subtitle")
                } else {
                    itemSection(
                        title: "\(localized("shopping_list_active_section")) (\(viewModel.filteredActiveItems.count))",
                        items: viewModel.filteredActiveItems,
                        bought: false
                    )

                    if !viewModel.state.boughtItems.isEmpty {
                        Button {
                            withAnimation { showBought.toggle() }
                        } label: {
                            HStack {
                                Text("\(localized("shopping_list_bought_section")) (\(viewModel.state.boughtItems.count))")
                                    .font(.headline)
                                Spacer()
                                Image(systemName: showBought ? "chevron.up" : "chevron.down")
                            }
                        }
                        .buttonStyle(.plain)

                        if showBought {
                            itemSection(title: "", items: viewModel.state.boughtItems, bought: true)
                        }
                    }
                }
            }
            .padding(16)
            .padding(.bottom, 88)
        }
        .salinoBackground()
        .navigationBarTitleDisplayMode(.inline)
        .toolbar {
            ToolbarItemGroup(placement: .topBarTrailing) {
                Button(action: onNavigateToSettings) { Image(systemName: "gearshape") }
                Button(action: onNavigateToActivityFeed) { Image(systemName: "clock.arrow.circlepath") }
                Button(action: onNavigateToHistory) { Image(systemName: "bag") }
            }
        }
        .safeAreaInset(edge: .bottom) {
            HStack(spacing: 12) {
                Button(action: onNavigateToSupermarketMode) {
                    Label(LocalizedStringKey("supermarket_mode_short"), systemImage: "storefront")
                        .frame(maxWidth: .infinity)
                }
                .buttonStyle(.borderedProminent)
                .tint(SalinoColors.primary)

                Button(action: onNavigateToAddItem) {
                    Label(LocalizedStringKey("item_add"), systemImage: "plus")
                        .frame(maxWidth: .infinity)
                }
                .buttonStyle(.borderedProminent)
                .tint(SalinoColors.tertiary)
            }
            .padding()
            .background(.ultraThinMaterial)
        }
        .alert(LocalizedStringKey("shopping_list_delete_confirm"), isPresented: Binding(
            get: { pendingDelete != nil },
            set: { if !$0 { pendingDelete = nil } }
        )) {
            Button(LocalizedStringKey("shopping_list_delete"), role: .destructive) {
                if let item = pendingDelete {
                    viewModel.deleteItem(itemId: item.id)
                    pendingDelete = nil
                }
            }
            Button(LocalizedStringKey("cancel"), role: .cancel) { pendingDelete = nil }
        }
        .onReceive(NotificationCenter.default.publisher(for: UIApplication.willEnterForegroundNotification)) { _ in
            viewModel.forceRefresh()
        }
    }

    private var categoryFilters: some View {
        ScrollView(.horizontal, showsIndicators: false) {
            HStack(spacing: 8) {
                filterButton(title: localized("category_all"), selected: viewModel.state.selectedCategory == nil) {
                    viewModel.onCategorySelected(nil)
                }
                ForEach(ItemCategory.allCases) { category in
                    filterButton(title: localized(category.localizedKey), selected: viewModel.state.selectedCategory == category) {
                        viewModel.onCategorySelected(category)
                    }
                }
            }
        }
    }

    private func filterButton(title: String, selected: Bool, action: @escaping () -> Void) -> some View {
        Button(title, action: action)
            .font(.caption.weight(.semibold))
            .padding(.horizontal, 12)
            .padding(.vertical, 8)
            .foregroundStyle(selected ? .white : SalinoColors.primary)
            .background(selected ? SalinoColors.primary : SalinoColors.primarySoft, in: Capsule())
    }

    private func itemSection(title: String, items: [ShoppingItem], bought: Bool) -> some View {
        VStack(alignment: .leading, spacing: 8) {
            if !title.isEmpty {
                Text(title).font(.headline)
            }
            SurfaceCard {
                ForEach(items) { item in
                    ShoppingItemRow(
                        item: item,
                        bought: bought,
                        onToggleBought: { bought ? viewModel.markAsActive(itemId: item.id) : viewModel.markAsBought(itemId: item.id) },
                        onEdit: { onNavigateToEditItem(item.id) },
                        onDelete: bought ? nil : { pendingDelete = item },
                        onFavorite: bought ? nil : { viewModel.toggleFavorite(itemId: item.id, isFavorite: !item.isFavorite) }
                    )
                    if item.id != items.last?.id { Divider() }
                }
            }
        }
    }
}
