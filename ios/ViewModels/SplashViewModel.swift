import Foundation
import Combine

enum SplashDestination {
    case auth
    case householdSetup
    case shoppingList
}

@MainActor
final class SplashViewModel: ObservableObject {
    @Published var destination: SplashDestination?
    private let authRepository: AuthRepository

    init(authRepository: AuthRepository) {
        self.authRepository = authRepository
        Task { await checkAuthState() }
    }

    func checkAuthState() async {
        guard authRepository.isSignedIn else {
            destination = .auth
            return
        }
        guard let user = await firstCurrentUser(from: authRepository) else {
            destination = .auth
            return
        }
        destination = user.activeHouseholdId?.isEmpty == false ? .shoppingList : .householdSetup
    }
}
