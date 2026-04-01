package com.salino.sali.data.remote.source

import com.google.firebase.firestore.FirebaseFirestore
import com.google.firebase.firestore.ListenerRegistration
import com.google.firebase.firestore.Query
import com.salino.sali.data.model.ShoppingItem
import kotlinx.coroutines.tasks.await
import javax.inject.Inject

class ShoppingRemoteDataSource @Inject constructor(
    private val firestore: FirebaseFirestore
) {
    private fun itemsCollection(householdId: String) = firestore.collection("households")
        .document(householdId)
        .collection("items")

    fun listenToItems(householdId: String, onItems: (List<ShoppingItem>) -> Unit): ListenerRegistration {
        return itemsCollection(householdId)
            .orderBy("updatedAt", Query.Direction.DESCENDING)
            .addSnapshotListener { snapshot, _ ->
                val items = snapshot?.documents?.mapNotNull { doc ->
                    doc.toObject(ShoppingItem::class.java)?.copy(id = doc.id)
                } ?: emptyList()
                onItems(items)
            }
    }

    suspend fun upsertItem(householdId: String, item: ShoppingItem) {
        itemsCollection(householdId).document(item.id).set(item).await()
    }

    suspend fun deleteItem(householdId: String, itemId: String) {
        itemsCollection(householdId).document(itemId).delete().await()
    }

    suspend fun getItem(householdId: String, itemId: String): ShoppingItem {
        val doc = itemsCollection(householdId).document(itemId).get().await()
        return doc.toObject(ShoppingItem::class.java)?.copy(id = doc.id)
            ?: throw IllegalStateException("Item not found")
    }
}
