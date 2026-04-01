package com.salino.sali.data.remote.source

import com.google.firebase.firestore.FirebaseFirestore
import com.google.firebase.firestore.ListenerRegistration
import com.google.firebase.firestore.Query
import com.salino.sali.data.model.RecurringItem
import kotlinx.coroutines.tasks.await
import javax.inject.Inject

class RecurringRemoteDataSource @Inject constructor(
    private val firestore: FirebaseFirestore
) {
    private fun recurringCollection(householdId: String) = firestore.collection("households")
        .document(householdId)
        .collection("recurringItems")

    fun listenToRecurringItems(householdId: String, onItems: (List<RecurringItem>) -> Unit): ListenerRegistration {
        return recurringCollection(householdId)
            .orderBy("updatedAt", Query.Direction.DESCENDING)
            .addSnapshotListener { snapshot, _ ->
                val items = snapshot?.documents?.mapNotNull { doc ->
                    doc.toObject(RecurringItem::class.java)?.copy(id = doc.id)
                } ?: emptyList()
                onItems(items)
            }
    }

    suspend fun upsertRecurringItem(householdId: String, item: RecurringItem) {
        recurringCollection(householdId).document(item.id).set(item).await()
    }

    suspend fun deleteRecurringItem(householdId: String, recurringItemId: String) {
        recurringCollection(householdId).document(recurringItemId).delete().await()
    }
}
