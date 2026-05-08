import Foundation

@MainActor
func firstCurrentUser(from authRepository: AuthRepository) async -> UserProfile? {
    for await user in authRepository.observeCurrentUser() {
        return user
    }
    return nil
}

@MainActor
func authErrorMessage(_ error: Error) -> String {
    let nsError = error as NSError
    switch nsError.code {
    case 17009, 17004:
        return localized("auth_error_invalid_credentials")
    case 17011:
        return localized("auth_error_user_not_found")
    case 17008:
        return localized("auth_error_invalid_email")
    case 17007:
        return localized("auth_error_email_in_use")
    case 17026:
        return localized("auth_error_weak_password")
    case 17010:
        return localized("auth_error_too_many_requests")
    default:
        return error.localizedDescription.isEmpty ? localized("auth_error_generic") : error.localizedDescription
    }
}
