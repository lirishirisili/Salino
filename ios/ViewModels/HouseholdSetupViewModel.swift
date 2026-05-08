import Foundation
import Combine

struct HouseholdSetupState {
    var isLoading = false
    var errorMessage: String?
    var isComplete = false
    var inviteCode: String?
}

@MainActor
final class HouseholdSetupViewModel: ObservableObject {
    @Published var state = HouseholdSetupState()
    private let householdRepository: HouseholdRepository

    init(householdRepository: HouseholdRepository) {
        self.householdRepository = householdRepository
    }

    func createHousehold(name: String) {
        guard !name.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty else {
            state.errorMessage = "empty_name"
            return
        }
        Task {
            state = HouseholdSetupState(isLoading: true)
            do {
                let household = try await householdRepository.createHousehold(name: name)
                state = HouseholdSetupState(isComplete: true, inviteCode: household.inviteCode)
            } catch {
                state = HouseholdSetupState(errorMessage: "generic")
            }
        }
    }

    func joinHousehold(inviteCode: String) {
        guard !inviteCode.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty else {
            state.errorMessage = "empty_code"
            return
        }
        Task {
            state = HouseholdSetupState(isLoading: true)
            do {
                _ = try await householdRepository.joinHousehold(inviteCode: inviteCode)
                state = HouseholdSetupState(isComplete: true)
            } catch FirebaseConfigurationError.invalidInviteCode {
                state = HouseholdSetupState(errorMessage: "invalid_code")
            } catch {
                state = HouseholdSetupState(errorMessage: "generic")
            }
        }
    }
}
