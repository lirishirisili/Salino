import Foundation
import FirebaseFirestore

final class ActivityRemoteDataSource {
    private let firestore: Firestore?

    init(firestore: Firestore? = configuredFirestore()) {
        self.firestore = firestore
    }

    private func activityCollection(_ householdId: String) throws -> CollectionReference {
        guard let firestore else { throw FirebaseConfigurationError.missingGoogleServiceInfo }
        return firestore.collection(FirestoreCollections.households)
            .document(householdId)
            .collection(FirestoreCollections.activity)
    }

    func listenToActivity(householdId: String, onActivity: @escaping ([ActivityLog]) -> Void) -> ListenerRegistration {
        guard let collection = try? activityCollection(householdId) else {
            onActivity([])
            return NoopListenerRegistration()
        }
        return collection
            .order(by: "createdAt", descending: true)
            .addSnapshotListener { snapshot, _ in
                let logs = snapshot?.documents.map { ActivityLog(documentId: $0.documentID, data: $0.data()) } ?? []
                onActivity(logs)
            }
    }

    func upsertActivity(householdId: String, activityLog: ActivityLog) async throws {
        try await activityCollection(householdId).document(activityLog.id).setDataAsync(activityLog.firestoreData)
    }
}
