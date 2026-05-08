import SwiftUI

struct SupermarketModeScreen: View {
    @StateObject private var viewModel: SupermarketModeViewModel
    let onNavigateToAddItem: () -> Void

    init(container: AppContainer, onNavigateToAddItem: @escaping () -> Void) {
        _viewModel = StateObject(wrappedValue: SupermarketModeViewModel(
            shoppingRepository: container.shoppingRepository,
            authRepository: container.authRepository
        ))
        self.onNavigateToAddItem = onNavigateToAddItem
    }

    var body: some View {
        List {
            Section {
                VStack(alignment: .leading, spacing: 12) {
                    Text(String(format: localized("supermarket_mode_remaining"), viewModel.state.remainingCount))
                        .font(.headline)
                    ProgressView(value: Double(viewModel.state.boughtInSessionCount), total: Double(max(viewModel.state.totalCount, 1)))
                        .tint(SalinoColors.primary)
                    filterBar
                }
                .padding(.vertical, 8)
            }

            if viewModel.state.allDone {
                EmptyStateView(systemImage: "checkmark.circle.fill", titleKey: "supermarket_mode_all_done", subtitleKey: "supermarket_mode_all_done_subtitle")
                    .listRowBackground(Color.clear)
            } else {
                ForEach(ItemCategory.allCases.filter { viewModel.state.groupedItems[$0]?.isEmpty == false }) { category in
                    Section {
                        if !viewModel.state.collapsedCategories.contains(category) {
                            ForEach(viewModel.state.groupedItems[category] ?? []) { item in
                                ShoppingItemRow(
                                    item: item,
                                    onToggleBought: { viewModel.markAsBought(item) },
                                    onEdit: {},
                                    onDelete: { viewModel.markNotFound(item) },
                                    onFavorite: nil
                                )
                            }
                        }
                    } header: {
                        Button {
                            viewModel.toggleCategoryCollapse(category)
                        } label: {
                            HStack {
                                Text(LocalizedStringKey(category.localizedKey))
                                Spacer()
                                Image(systemName: viewModel.state.collapsedCategories.contains(category) ? "chevron.down" : "chevron.up")
                            }
                        }
                    }
                }
            }
        }
        .scrollContentBackground(.hidden)
        .salinoBackground()
        .navigationTitle(LocalizedStringKey("supermarket_mode_title"))
        .toolbar {
            Button(action: onNavigateToAddItem) {
                Image(systemName: "plus")
            }
        }
        .safeAreaInset(edge: .bottom) {
            if viewModel.state.lastBoughtItem != nil {
                Button {
                    viewModel.undoLastBought()
                } label: {
                    Label(LocalizedStringKey("supermarket_mode_undo"), systemImage: "arrow.uturn.backward")
                        .frame(maxWidth: .infinity)
                }
                .buttonStyle(.borderedProminent)
                .tint(SalinoColors.primary)
                .padding()
                .background(.ultraThinMaterial)
            }
        }
    }

    private var filterBar: some View {
        ScrollView(.horizontal, showsIndicators: false) {
            HStack {
                ForEach(SupermarketFilter.allCases) { filter in
                    Button(localized(filter.localizedKey)) {
                        viewModel.setFilter(filter)
                    }
                    .font(.caption.weight(.semibold))
                    .padding(.horizontal, 12)
                    .padding(.vertical, 8)
                    .foregroundStyle(viewModel.state.activeFilter == filter ? .white : SalinoColors.primary)
                    .background(viewModel.state.activeFilter == filter ? SalinoColors.primary : SalinoColors.primarySoft, in: Capsule())
                }
            }
        }
    }
}
