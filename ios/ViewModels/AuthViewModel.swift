import Foundation
import Combine
import UIKit

struct AuthUiState {
    var isLoading = false
    var errorMessage: String?
    var isAuthenticated = false
    var hasHousehold = false
}

@MainActor
final class AuthViewModel: ObservableObject {
    @Published var state = AuthUiState()
    private let authRepository: AuthRepository

    init(authRepository: AuthRepository) {
        self.authRepository = authRepository
    }

    func signInWithGoogle(presenting viewController: UIViewController) {
        Task {
            state = AuthUiState(isLoading: true)
            do {
                _ = try await authRepository.signInWithGoogle(presenting: viewController)
                let user = await firstCurrentUser(from: authRepository)
                state = AuthUiState(isAuthenticated: true, hasHousehold: user?.activeHouseholdId?.isEmpty == false)
            } catch {
                state = AuthUiState(errorMessage: authErrorMessage(error))
            }
        }
    }

    func signInWithEmail(email: String, password: String, register: Bool) {
        Task {
            state = AuthUiState(isLoading: true)
            do {
                if register {
                    _ = try await authRepository.registerWithEmail(email: email.trimmingCharacters(in: .whitespacesAndNewlines), password: password)
                } else {
                    _ = try await authRepository.signInWithEmail(email: email.trimmingCharacters(in: .whitespacesAndNewlines), password: password)
                }
                let user = await firstCurrentUser(from: authRepository)
                state = AuthUiState(isAuthenticated: true, hasHousehold: user?.activeHouseholdId?.isEmpty == false)
            } catch {
                state = AuthUiState(errorMessage: authErrorMessage(error))
            }
        }
    }
}
