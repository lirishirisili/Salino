import Foundation
import FirebaseFirestore

final class RecurringRemoteDataSource {
    private let firestore: Firestore?

    init(firestore: Firestore? = configuredFirestore()) {
        self.firestore = firestore
    }

    private func recurringCollection(_ householdId: String) throws -> CollectionReference {
        guard let firestore else { throw FirebaseConfigurationError.missingGoogleServiceInfo }
        return firestore.collection(FirestoreCollections.households)
            .document(householdId)
            .collection(FirestoreCollections.recurringItems)
    }

    func listenToRecurringItems(householdId: String, onItems: @escaping ([RecurringItem]) -> Void) -> ListenerRegistration {
        guard let collection = try? recurringCollection(householdId) else {
            onItems([])
            return NoopListenerRegistration()
        }
        return collection
            .order(by: "updatedAt", descending: true)
            .addSnapshotListener { snapshot, _ in
                let items = snapshot?.documents.map { RecurringItem(documentId: $0.documentID, data: $0.data()) } ?? []
                onItems(items)
            }
    }

    func upsertRecurringItem(householdId: String, item: RecurringItem) async throws {
        try await recurringCollection(householdId).document(item.id).setDataAsync(item.firestoreData)
    }

    func deleteRecurringItem(householdId: String, recurringItemId: String) async throws {
        try await recurringCollection(householdId).document(recurringItemId).deleteAsync()
    }
}
