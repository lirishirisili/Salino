import Foundation
import Combine

struct ActivityFeedState {
    var entries: [ActivityLog] = []
    var isLoading = true
}

@MainActor
final class ActivityFeedViewModel: ObservableObject {
    @Published var state = ActivityFeedState()
    private let authRepository: AuthRepository
    private let activityRepository: ActivityRepository
    private var task: Task<Void, Never>?

    init(authRepository: AuthRepository, activityRepository: ActivityRepository) {
        self.authRepository = authRepository
        self.activityRepository = activityRepository
        task = Task { await observeActivity() }
    }

    deinit { task?.cancel() }

    private func observeActivity() async {
        guard let user = await firstCurrentUser(from: authRepository), let householdId = user.activeHouseholdId else {
            state.isLoading = false
            return
        }
        for await entries in activityRepository.observeActivityFeed(householdId: householdId) {
            state = ActivityFeedState(entries: entries, isLoading: false)
        }
    }
}
