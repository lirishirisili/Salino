import Foundation
import Combine

struct SettingsState {
    var user: UserProfile?
    var household: Household?
    var members: [HouseholdMember] = []
    var inviteCode = ""
    var isLoading = true
    var isSignedOut = false
    var hasLeftHousehold = false
    var showEditNameDialog = false
    var showLeaveDialog = false
}

@MainActor
final class SettingsViewModel: ObservableObject {
    @Published var state = SettingsState()
    private let authRepository: AuthRepository
    private let householdRepository: HouseholdRepository
    private let shoppingRepository: ShoppingRepository
    private let recurringRepository: RecurringRepository
    private let activityRepository: ActivityRepository
    private var tasks: [Task<Void, Never>] = []

    init(container: AppContainer) {
        self.authRepository = container.authRepository
        self.householdRepository = container.householdRepository
        self.shoppingRepository = container.shoppingRepository
        self.recurringRepository = container.recurringRepository
        self.activityRepository = container.activityRepository
        Task { await loadSettings() }
    }

    deinit { tasks.forEach { $0.cancel() } }

    func signOut() {
        Task {
            shoppingRepository.clearListeners()
            recurringRepository.clearListeners()
            activityRepository.clearListeners()
            householdRepository.clearListeners()
            await authRepository.signOut()
            state.isSignedOut = true
        }
    }

    func updateHouseholdName(_ newName: String) {
        guard let householdId = state.household?.id else { return }
        Task {
            try? await householdRepository.updateHouseholdName(householdId: householdId, newName: newName)
            state.showEditNameDialog = false
        }
    }

    func leaveHousehold() {
        guard let householdId = state.household?.id else { return }
        Task {
            do {
                try await householdRepository.leaveHousehold(householdId: householdId)
                state.showLeaveDialog = false
                state.hasLeftHousehold = true
            } catch {
                state.showLeaveDialog = false
            }
        }
    }

    private func loadSettings() async {
        guard let user = await firstCurrentUser(from: authRepository) else {
            state.isLoading = false
            return
        }
        state.user = user
        guard let householdId = user.activeHouseholdId else {
            state.isLoading = false
            return
        }

        tasks.append(Task { @MainActor in
            for await household in householdRepository.observeHousehold(householdId: householdId) {
                state.household = household
                state.inviteCode = household?.inviteCode ?? ""
                state.isLoading = false
            }
        })
        tasks.append(Task { @MainActor in
            for await members in householdRepository.observeHouseholdMembers(householdId: householdId) {
                state.members = members
            }
        })
    }
}
