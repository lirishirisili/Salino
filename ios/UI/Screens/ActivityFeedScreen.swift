import SwiftUI

struct ActivityFeedScreen: View {
    @StateObject private var viewModel: ActivityFeedViewModel

    init(container: AppContainer) {
        _viewModel = StateObject(wrappedValue: ActivityFeedViewModel(
            authRepository: container.authRepository,
            activityRepository: container.activityRepository
        ))
    }

    var body: some View {
        List {
            if viewModel.state.isLoading {
                ProgressView()
            } else if viewModel.state.entries.isEmpty {
                EmptyStateView(systemImage: "clock.arrow.circlepath", titleKey: "activity_feed_empty_title", subtitleKey: "activity_feed_empty_subtitle")
                    .listRowBackground(Color.clear)
            } else {
                ForEach(viewModel.state.entries) { entry in
                    VStack(alignment: .leading, spacing: 4) {
                        Text(LocalizedStringKey(entry.type.localizedKey))
                            .font(.headline)
                        if !entry.itemName.isEmpty {
                            Text(entry.itemName)
                                .font(.subheadline)
                        }
                        Text([entry.actorDisplayName, formatShortDate(entry.createdAt)].filter { !$0.isEmpty }.joined(separator: " - "))
                            .font(.caption)
                            .foregroundStyle(SalinoColors.secondaryText)
                    }
                    .padding(.vertical, 6)
                }
            }
        }
        .scrollContentBackground(.hidden)
        .salinoBackground()
        .navigationTitle(LocalizedStringKey("activity_feed_title"))
    }
}
