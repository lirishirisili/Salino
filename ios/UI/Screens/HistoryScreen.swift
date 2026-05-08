import SwiftUI

struct HistoryScreen: View {
    @StateObject private var viewModel: HistoryViewModel

    init(container: AppContainer) {
        _viewModel = StateObject(wrappedValue: HistoryViewModel(
            shoppingRepository: container.shoppingRepository,
            authRepository: container.authRepository
        ))
    }

    var body: some View {
        List {
            if viewModel.state.isLoading {
                ProgressView()
            } else if viewModel.state.dayGroups.isEmpty {
                EmptyStateView(systemImage: "bag", titleKey: "history_empty_title", subtitleKey: "history_empty_subtitle")
                    .listRowBackground(Color.clear)
            } else {
                ForEach(viewModel.state.dayGroups) { group in
                    Section {
                        if viewModel.state.expandedDays.contains(group.dateLabel) {
                            ForEach(group.items) { item in
                                ShoppingItemRow(
                                    item: item,
                                    bought: true,
                                    onToggleBought: { viewModel.returnToList(itemId: item.id) },
                                    onEdit: {},
                                    onDelete: nil,
                                    onFavorite: nil
                                )
                            }
                        }
                    } header: {
                        Button {
                            viewModel.toggleDay(group.dateLabel)
                        } label: {
                            HStack {
                                Text(group.dateLabel)
                                Spacer()
                                Text(String(format: localized("history_items_count"), group.items.count))
                            }
                        }
                    }
                }
            }
        }
        .scrollContentBackground(.hidden)
        .salinoBackground()
        .navigationTitle(LocalizedStringKey("history_title"))
    }
}
