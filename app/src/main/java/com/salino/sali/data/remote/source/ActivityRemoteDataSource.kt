package com.salino.sali.data.remote.source

import com.google.firebase.firestore.FirebaseFirestore
import com.google.firebase.firestore.ListenerRegistration
import com.google.firebase.firestore.Query
import com.salino.sali.data.model.ActivityLog
import kotlinx.coroutines.tasks.await
import javax.inject.Inject

class ActivityRemoteDataSource @Inject constructor(
    private val firestore: FirebaseFirestore
) {
    private fun activityCollection(householdId: String) = firestore.collection("households")
        .document(householdId)
        .collection("activity")

    fun listenToActivity(householdId: String, onActivity: (List<ActivityLog>) -> Unit): ListenerRegistration {
        return activityCollection(householdId)
            .orderBy("createdAt", Query.Direction.DESCENDING)
            .addSnapshotListener { snapshot, _ ->
                val logs = snapshot?.documents?.mapNotNull { doc ->
                    doc.toObject(ActivityLog::class.java)?.copy(id = doc.id)
                } ?: emptyList()
                onActivity(logs)
            }
    }

    suspend fun upsertActivity(householdId: String, activityLog: ActivityLog) {
        activityCollection(householdId).document(activityLog.id).set(activityLog).await()
    }
}
