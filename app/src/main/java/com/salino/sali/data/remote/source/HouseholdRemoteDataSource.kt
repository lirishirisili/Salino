package com.salino.sali.data.remote.source

import com.google.firebase.Timestamp
import com.google.firebase.firestore.FirebaseFirestore
import com.google.firebase.firestore.ListenerRegistration
import com.salino.sali.data.model.Household
import com.salino.sali.data.model.HouseholdMember
import com.salino.sali.data.model.MemberRole
import kotlinx.coroutines.tasks.await
import java.util.UUID
import javax.inject.Inject

class HouseholdRemoteDataSource @Inject constructor(
    private val firestore: FirebaseFirestore
) {
    suspend fun createHousehold(userId: String, displayName: String, name: String): Household {
        val householdRef = firestore.collection("households").document()
        val now = Timestamp.now()
        val household = Household(
            id = householdRef.id,
            name = name.trim(),
            createdBy = userId,
            createdAt = now,
            inviteCode = generateInviteCode()
        )
        val member = HouseholdMember(
            userId = userId,
            displayName = displayName,
            role = MemberRole.OWNER.name,
            joinedAt = now
        )
        firestore.runBatch { batch ->
            batch.set(householdRef, household)
            batch.set(householdRef.collection("members").document(userId), member)
            batch.update(firestore.collection("users").document(userId), "activeHouseholdId", household.id)
        }.await()
        return household
    }

    suspend fun joinHousehold(userId: String, displayName: String, inviteCode: String): Household {
        val querySnapshot = firestore.collection("households")
            .whereEqualTo("inviteCode", inviteCode.trim().uppercase())
            .get()
            .await()
        if (querySnapshot.isEmpty) throw IllegalArgumentException("Invalid invite code")

        val householdDoc = querySnapshot.documents.first()
        val household = householdDoc.toObject(Household::class.java)?.copy(id = householdDoc.id)
            ?: throw IllegalStateException("Household not found")
        val member = HouseholdMember(
            userId = userId,
            displayName = displayName,
            role = MemberRole.MEMBER.name,
            joinedAt = Timestamp.now()
        )
        firestore.runBatch { batch ->
            batch.set(householdDoc.reference.collection("members").document(userId), member)
            batch.update(firestore.collection("users").document(userId), "activeHouseholdId", household.id)
        }.await()
        return household
    }

    suspend fun getHousehold(householdId: String): Household {
        val snapshot = firestore.collection("households").document(householdId).get().await()
        return snapshot.toObject(Household::class.java)?.copy(id = snapshot.id)
            ?: throw IllegalStateException("Household not found")
    }

    fun listenToHousehold(householdId: String, onHousehold: (Household) -> Unit): ListenerRegistration {
        return firestore.collection("households").document(householdId)
            .addSnapshotListener { snapshot, _ ->
                val household = snapshot?.toObject(Household::class.java)?.copy(id = snapshot.id) ?: return@addSnapshotListener
                onHousehold(household)
            }
    }

    fun listenToMembers(householdId: String, onMembers: (List<HouseholdMember>) -> Unit): ListenerRegistration {
        return firestore.collection("households").document(householdId).collection("members")
            .addSnapshotListener { snapshot, _ ->
                val members = snapshot?.documents?.mapNotNull { it.toObject(HouseholdMember::class.java) } ?: emptyList()
                onMembers(members)
            }
    }

    private fun generateInviteCode(): String = UUID.randomUUID().toString().take(8).uppercase()

    suspend fun updateHouseholdName(householdId: String, newName: String) {
        firestore.collection("households").document(householdId)
            .update("name", newName.trim())
            .await()
    }

    suspend fun leaveHousehold(householdId: String, userId: String) {
        firestore.runBatch { batch ->
            batch.delete(
                firestore.collection("households").document(householdId)
                    .collection("members").document(userId)
            )
            batch.update(
                firestore.collection("users").document(userId),
                "activeHouseholdId", null
            )
        }.await()
    }
}
