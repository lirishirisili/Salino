import Foundation
import FirebaseCore
import FirebaseFirestore

enum FirebaseConfigurationError: LocalizedError {
    case missingGoogleServiceInfo
    case missingCurrentUser
    case documentNotFound
    case invalidInviteCode

    var errorDescription: String? {
        switch self {
        case .missingGoogleServiceInfo:
            "Firebase is not configured. Add GoogleService-Info.plist before signing in."
        case .missingCurrentUser:
            "Not signed in."
        case .documentNotFound:
            "Document not found."
        case .invalidInviteCode:
            "Invalid invite code."
        }
    }
}

extension DocumentReference {
    func getDocumentAsync() async throws -> DocumentSnapshot {
        try await withCheckedThrowingContinuation { continuation in
            getDocument { snapshot, error in
                if let error {
                    continuation.resume(throwing: error)
                } else if let snapshot {
                    continuation.resume(returning: snapshot)
                } else {
                    continuation.resume(throwing: FirebaseConfigurationError.documentNotFound)
                }
            }
        }
    }

    func setDataAsync(_ data: [String: Any]) async throws {
        try await withCheckedThrowingContinuation { (continuation: CheckedContinuation<Void, Error>) in
            setData(data) { error in
                if let error { continuation.resume(throwing: error) }
                else { continuation.resume() }
            }
        }
    }

    func updateDataAsync(_ data: [AnyHashable: Any]) async throws {
        try await withCheckedThrowingContinuation { (continuation: CheckedContinuation<Void, Error>) in
            updateData(data) { error in
                if let error { continuation.resume(throwing: error) }
                else { continuation.resume() }
            }
        }
    }

    func deleteAsync() async throws {
        try await withCheckedThrowingContinuation { (continuation: CheckedContinuation<Void, Error>) in
            delete { error in
                if let error { continuation.resume(throwing: error) }
                else { continuation.resume() }
            }
        }
    }
}

extension Query {
    func getDocumentsAsync() async throws -> QuerySnapshot {
        try await withCheckedThrowingContinuation { continuation in
            getDocuments { snapshot, error in
                if let error {
                    continuation.resume(throwing: error)
                } else if let snapshot {
                    continuation.resume(returning: snapshot)
                } else {
                    continuation.resume(throwing: FirebaseConfigurationError.documentNotFound)
                }
            }
        }
    }
}

extension WriteBatch {
    func commitAsync() async throws {
        try await withCheckedThrowingContinuation { (continuation: CheckedContinuation<Void, Error>) in
            commit { error in
                if let error { continuation.resume(throwing: error) }
                else { continuation.resume() }
            }
        }
    }
}

final class NoopListenerRegistration: ListenerRegistration {
    func remove() {}
}

func configuredFirestore() -> Firestore? {
    FirebaseApp.app() == nil ? nil : Firestore.firestore()
}
