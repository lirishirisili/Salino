import Foundation
import FirebaseFirestore

final class HouseholdRemoteDataSource {
    private let firestore: Firestore?

    init(firestore: Firestore? = configuredFirestore()) {
        self.firestore = firestore
    }

    func createHousehold(userId: String, displayName: String, name: String) async throws -> Household {
        guard let firestore else { throw FirebaseConfigurationError.missingGoogleServiceInfo }
        let householdRef = firestore.collection(FirestoreCollections.households).document()
        let now = Date()
        let household = Household(
            id: householdRef.documentID,
            name: name.trimmingCharacters(in: .whitespacesAndNewlines),
            createdBy: userId,
            createdAt: now,
            inviteCode: generateInviteCode()
        )
        let member = HouseholdMember(userId: userId, displayName: displayName, role: .owner, joinedAt: now)
        let batch = firestore.batch()
        batch.setData(household.firestoreData, forDocument: householdRef)
        batch.setData(member.firestoreData, forDocument: householdRef.collection(FirestoreCollections.members).document(userId))
        batch.updateData(["activeHouseholdId": household.id], forDocument: firestore.collection(FirestoreCollections.users).document(userId))
        try await batch.commitAsync()
        return household
    }

    func joinHousehold(userId: String, displayName: String, inviteCode: String) async throws -> Household {
        guard let firestore else { throw FirebaseConfigurationError.missingGoogleServiceInfo }
        let query = firestore.collection(FirestoreCollections.households)
            .whereField("inviteCode", isEqualTo: inviteCode.trimmingCharacters(in: .whitespacesAndNewlines).uppercased())
        let snapshot = try await query.getDocumentsAsync()
        guard let householdDoc = snapshot.documents.first else { throw FirebaseConfigurationError.invalidInviteCode }
        let household = Household(documentId: householdDoc.documentID, data: householdDoc.data())
        let member = HouseholdMember(userId: userId, displayName: displayName, role: .member, joinedAt: Date())
        let batch = firestore.batch()
        batch.setData(member.firestoreData, forDocument: householdDoc.reference.collection(FirestoreCollections.members).document(userId))
        batch.updateData(["activeHouseholdId": household.id], forDocument: firestore.collection(FirestoreCollections.users).document(userId))
        try await batch.commitAsync()
        return household
    }

    func getHousehold(householdId: String) async throws -> Household {
        guard let firestore else { throw FirebaseConfigurationError.missingGoogleServiceInfo }
        let snapshot = try await firestore.collection(FirestoreCollections.households).document(householdId).getDocumentAsync()
        guard snapshot.exists else { throw FirebaseConfigurationError.documentNotFound }
        return Household(documentId: snapshot.documentID, data: snapshot.dataOrEmpty)
    }

    func listenToHousehold(householdId: String, onHousehold: @escaping (Household) -> Void) -> ListenerRegistration {
        guard let firestore else { return NoopListenerRegistration() }
        return firestore.collection(FirestoreCollections.households).document(householdId)
            .addSnapshotListener { snapshot, _ in
                guard let snapshot, snapshot.exists else { return }
                onHousehold(Household(documentId: snapshot.documentID, data: snapshot.dataOrEmpty))
            }
    }

    func listenToMembers(householdId: String, onMembers: @escaping ([HouseholdMember]) -> Void) -> ListenerRegistration {
        guard let firestore else {
            onMembers([])
            return NoopListenerRegistration()
        }
        return firestore.collection(FirestoreCollections.households).document(householdId).collection(FirestoreCollections.members)
            .addSnapshotListener { snapshot, _ in
                let members = snapshot?.documents.map { HouseholdMember(data: $0.data()) } ?? []
                onMembers(members)
            }
    }

    func updateHouseholdName(householdId: String, newName: String) async throws {
        guard let firestore else { throw FirebaseConfigurationError.missingGoogleServiceInfo }
        try await firestore.collection(FirestoreCollections.households)
            .document(householdId)
            .updateDataAsync(["name": newName.trimmingCharacters(in: .whitespacesAndNewlines)])
    }

    func leaveHousehold(householdId: String, userId: String) async throws {
        guard let firestore else { throw FirebaseConfigurationError.missingGoogleServiceInfo }
        let batch = firestore.batch()
        let householdRef = firestore.collection(FirestoreCollections.households).document(householdId)
        batch.deleteDocument(householdRef.collection(FirestoreCollections.members).document(userId))
        batch.updateData(["activeHouseholdId": NSNull()], forDocument: firestore.collection(FirestoreCollections.users).document(userId))
        try await batch.commitAsync()
    }

    private func generateInviteCode() -> String {
        String(UUID().uuidString.replacingOccurrences(of: "-", with: "").prefix(8)).uppercased()
    }
}
