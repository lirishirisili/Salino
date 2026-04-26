package com.salino.sali.data.repository

import com.google.firebase.auth.FirebaseAuth
import com.google.firebase.auth.GoogleAuthProvider
import com.google.firebase.firestore.FirebaseFirestore
import com.salino.sali.data.local.SalinoDatabase
import com.salino.sali.data.model.NotificationMode
import com.salino.sali.data.model.NotificationPrefs
import com.salino.sali.data.model.ImportantEvent
import com.salino.sali.data.model.User
import com.salino.sali.domain.repository.AuthRepository
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.channels.awaitClose
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.callbackFlow
import kotlinx.coroutines.tasks.await
import kotlinx.coroutines.withContext
import javax.inject.Inject
import javax.inject.Singleton

@Singleton
class AuthRepositoryImpl @Inject constructor(
    private val auth: FirebaseAuth,
    private val firestore: FirebaseFirestore,
    private val database: SalinoDatabase
) : AuthRepository {

    override val currentUserId: String?
        get() = auth.currentUser?.uid

    override val isSignedIn: Boolean
        get() = auth.currentUser != null

    override fun observeCurrentUser(): Flow<User?> = callbackFlow {
        val userId = auth.currentUser?.uid
        if (userId == null) {
            trySend(null)
            close()
            return@callbackFlow
        }

        val registration = firestore.collection("users")
            .document(userId)
            .addSnapshotListener { snapshot, error ->
                if (error != null) {
                    trySend(null)
                    return@addSnapshotListener
                }
                val parsedUser = snapshot?.toObject(User::class.java)
                val user = parsedUser?.copy(
                    id = userId,
                    notificationPrefs = normalizeNotificationPrefs(parsedUser.notificationPrefs)
                )
                trySend(user)
            }

        awaitClose { registration.remove() }
    }

    override suspend fun signInWithGoogle(idToken: String): Result<User> = runCatching {
        val credential = GoogleAuthProvider.getCredential(idToken, null)
        auth.signInWithCredential(credential).await()
        getOrCreateUserProfile().getOrThrow()
    }

    override suspend fun signInWithEmail(email: String, password: String): Result<User> = runCatching {
        auth.signInWithEmailAndPassword(email, password).await()
        getOrCreateUserProfile().getOrThrow()
    }

    override suspend fun registerWithEmail(email: String, password: String): Result<User> = runCatching {
        auth.createUserWithEmailAndPassword(email, password).await()
        getOrCreateUserProfile().getOrThrow()
    }

    override suspend fun getOrCreateUserProfile(): Result<User> = runCatching {
        val firebaseUser = auth.currentUser ?: throw IllegalStateException("Not signed in")
        val userId = firebaseUser.uid
        val userDoc = firestore.collection("users").document(userId)
        val snapshot = userDoc.get().await()

        if (snapshot.exists()) {
            val existingUser = snapshot.toObject(User::class.java)?.copy(id = userId)
                ?: throw IllegalStateException("Cannot deserialize user")
            val normalizedPrefs = normalizeNotificationPrefs(existingUser.notificationPrefs)
            if (existingUser.notificationPrefs != normalizedPrefs) {
                userDoc.update("notificationPrefs", normalizedPrefs).await()
            }
            existingUser.copy(notificationPrefs = normalizedPrefs)
        } else {
            val newUser = User(
                id = userId,
                displayName = firebaseUser.displayName ?: "",
                email = firebaseUser.email ?: "",
                activeHouseholdId = null,
                notificationPrefs = defaultNotificationPrefs()
            )
            userDoc.set(newUser).await()
            newUser
        }
    }

    override suspend fun updateNotificationPrefs(prefs: NotificationPrefs): Result<Unit> = runCatching {
        val userId = auth.currentUser?.uid ?: throw IllegalStateException("Not signed in")
        firestore.collection("users")
            .document(userId)
            .update("notificationPrefs", normalizeNotificationPrefs(prefs))
            .await()
    }

    override suspend fun signOut() {
        withContext(Dispatchers.IO) {
            database.clearAllTables()
        }
        auth.signOut()
    }

    private fun defaultNotificationPrefs(): NotificationPrefs = NotificationPrefs(
        mode = NotificationMode.IMMEDIATE_IMPORTANT,
        importantEvents = listOf(ImportantEvent.ITEM_ADDED),
        maxImmediatePerHour = 3
    )

    private fun normalizeNotificationPrefs(prefs: NotificationPrefs?): NotificationPrefs {
        val base = prefs ?: defaultNotificationPrefs()
        val importantEvents = if (base.importantEvents.isEmpty()) {
            listOf(ImportantEvent.ITEM_ADDED)
        } else {
            base.importantEvents.distinct()
        }
        return base.copy(
            mode = base.mode,
            importantEvents = importantEvents,
            maxImmediatePerHour = base.maxImmediatePerHour.coerceIn(1, 20)
        )
    }
}
