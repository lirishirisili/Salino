import Foundation
import FirebaseAuth
import FirebaseCore
import FirebaseFirestore
import GoogleSignIn
import UIKit

@MainActor
final class FirebaseAuthRepository: AuthRepository {
    private let localStore: LocalStore
    private var firestore: Firestore? { configuredFirestore() }

    init(localStore: LocalStore) {
        self.localStore = localStore
    }

    var currentUserId: String? {
        guard FirebaseApp.app() != nil else { return nil }
        return Auth.auth().currentUser?.uid
    }

    var isSignedIn: Bool {
        currentUserId != nil
    }

    func observeCurrentUser() -> AsyncStream<UserProfile?> {
        let currentUserId = currentUserId
        let firestore = firestore
        return AsyncStream { continuation in
            guard let userId = currentUserId, let firestore else {
                continuation.yield(nil)
                continuation.finish()
                return
            }

            let registration = firestore.collection(FirestoreCollections.users)
                .document(userId)
                .addSnapshotListener { snapshot, _ in
                    guard let snapshot, snapshot.exists else {
                        continuation.yield(nil)
                        return
                    }
                    continuation.yield(UserProfile(documentId: snapshot.documentID, data: snapshot.dataOrEmpty))
                }

            continuation.onTermination = { _ in registration.remove() }
        }
    }

    func signInWithGoogle(presenting viewController: UIViewController) async throws -> UserProfile {
        guard FirebaseApp.app() != nil else { throw FirebaseConfigurationError.missingGoogleServiceInfo }
        let result = try await GIDSignIn.sharedInstance.signIn(withPresenting: viewController)
        guard let idToken = result.user.idToken?.tokenString else {
            throw FirebaseConfigurationError.missingCurrentUser
        }
        let credential = GoogleAuthProvider.credential(
            withIDToken: idToken,
            accessToken: result.user.accessToken.tokenString
        )
        try await signIn(with: credential)
        return try await getOrCreateUserProfile()
    }

    func signInWithEmail(email: String, password: String) async throws -> UserProfile {
        guard FirebaseApp.app() != nil else { throw FirebaseConfigurationError.missingGoogleServiceInfo }
        try await withCheckedThrowingContinuation { (continuation: CheckedContinuation<Void, Error>) in
            Auth.auth().signIn(withEmail: email, password: password) { _, error in
                if let error { continuation.resume(throwing: error) }
                else { continuation.resume() }
            }
        }
        return try await getOrCreateUserProfile()
    }

    func registerWithEmail(email: String, password: String) async throws -> UserProfile {
        guard FirebaseApp.app() != nil else { throw FirebaseConfigurationError.missingGoogleServiceInfo }
        try await withCheckedThrowingContinuation { (continuation: CheckedContinuation<Void, Error>) in
            Auth.auth().createUser(withEmail: email, password: password) { _, error in
                if let error { continuation.resume(throwing: error) }
                else { continuation.resume() }
            }
        }
        return try await getOrCreateUserProfile()
    }

    func getOrCreateUserProfile() async throws -> UserProfile {
        guard FirebaseApp.app() != nil, let firestore else { throw FirebaseConfigurationError.missingGoogleServiceInfo }
        guard let firebaseUser = Auth.auth().currentUser else { throw FirebaseConfigurationError.missingCurrentUser }

        let userRef = firestore.collection(FirestoreCollections.users).document(firebaseUser.uid)
        let snapshot = try await userRef.getDocumentAsync()
        if snapshot.exists {
            return UserProfile(documentId: snapshot.documentID, data: snapshot.dataOrEmpty)
        }

        let user = UserProfile(
            id: firebaseUser.uid,
            displayName: firebaseUser.displayName ?? firebaseUser.email ?? "",
            email: firebaseUser.email ?? "",
            activeHouseholdId: nil
        )
        try await userRef.setDataAsync(user.firestoreData)
        return user
    }

    func signOut() async {
        localStore.clearAll()
        guard FirebaseApp.app() != nil else { return }
        GIDSignIn.sharedInstance.signOut()
        try? Auth.auth().signOut()
    }

    private func signIn(with credential: AuthCredential) async throws {
        try await withCheckedThrowingContinuation { (continuation: CheckedContinuation<Void, Error>) in
            Auth.auth().signIn(with: credential) { _, error in
                if let error { continuation.resume(throwing: error) }
                else { continuation.resume() }
            }
        }
    }
}
