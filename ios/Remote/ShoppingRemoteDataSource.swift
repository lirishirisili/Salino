import Foundation
import FirebaseFirestore

final class ShoppingRemoteDataSource {
    private let firestore: Firestore?

    init(firestore: Firestore? = configuredFirestore()) {
        self.firestore = firestore
    }

    private func itemsCollection(_ householdId: String) throws -> CollectionReference {
        guard let firestore else { throw FirebaseConfigurationError.missingGoogleServiceInfo }
        return firestore.collection(FirestoreCollections.households)
            .document(householdId)
            .collection(FirestoreCollections.items)
    }

    func listenToItems(householdId: String, onItems: @escaping ([ShoppingItem]) -> Void) -> ListenerRegistration {
        guard let collection = try? itemsCollection(householdId) else {
            onItems([])
            return NoopListenerRegistration()
        }
        return collection
            .order(by: "updatedAt", descending: true)
            .addSnapshotListener { snapshot, _ in
                let items = snapshot?.documents.map { ShoppingItem(documentId: $0.documentID, data: $0.data()) } ?? []
                onItems(items)
            }
    }

    func upsertItem(householdId: String, item: ShoppingItem) async throws {
        try await itemsCollection(householdId).document(item.id).setDataAsync(item.firestoreData)
    }

    func deleteItem(householdId: String, itemId: String) async throws {
        try await itemsCollection(householdId).document(itemId).deleteAsync()
    }

    func getItem(householdId: String, itemId: String) async throws -> ShoppingItem {
        let snapshot = try await itemsCollection(householdId).document(itemId).getDocumentAsync()
        guard snapshot.exists else { throw FirebaseConfigurationError.documentNotFound }
        return ShoppingItem(documentId: snapshot.documentID, data: snapshot.dataOrEmpty)
    }
}
