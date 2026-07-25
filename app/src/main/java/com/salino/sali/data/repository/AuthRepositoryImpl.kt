package com.salino.sali.data.repository

import com.google.firebase.auth.FirebaseAuth
import com.google.firebase.auth.GoogleAuthProvider
import com.google.firebase.firestore.DocumentReference
import com.google.firebase.firestore.DocumentSnapshot
import com.google.firebase.firestore.FirebaseFirestore
import com.google.firebase.firestore.SetOptions
import com.google.firebase.firestore.Source
import com.salino.sali.data.local.SalinoDatabase
import com.salino.sali.data.model.User
import com.salino.sali.domain.repository.AuthRepository
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.channels.awaitClose
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.callbackFlow
import kotlinx.coroutines.tasks.await
import kotlinx.coroutines.withContext
import java.util.Locale
import javax.inject.Inject
import javax.inject.Singleton

@Singleton
class AuthRepositoryImpl @Inject constructor(
    private val auth: FirebaseAuth,
    private val firestore: FirebaseFirestore,
    private val database: SalinoDatabase,
    private val notificationRepository: NotificationRepository
) : AuthRepository {

    override val isEmailVerified: Boolean
        get() = auth.currentUser?.isEmailVerified == true

    override val currentUserEmail: String?
        get() = auth.currentUser?.email

    override val isPasswordProvider: Boolean
        get() = auth.currentUser?.providerData?.any { it.providerId == "password" } == true

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
                    // Do not emit null on listener errors — callers treat null as
                    // "no household" and would wrongly open HouseholdSetup.
                    close(error)
                    return@addSnapshotListener
                }
                if (snapshot == null) return@addSnapshotListener

                // Fresh install / empty cache: the first event is often fromCache +
                // !exists before the server snapshot arrives. Emitting null here makes
                // .first() callers falsely conclude the user has no profile/household.
                if (snapshot.metadata.isFromCache && !snapshot.exists()) {
                    return@addSnapshotListener
                }

                val parsedUser = snapshot.toObject(User::class.java)

                // A local-only / pending view can be a partial document (e.g. FCM token
                // merge wrote only fcmTokens+language) that deserializes with
                // activeHouseholdId=null even though the server has a household.
                // Never trust "no household" from cache — wait for a server snapshot.
                if (
                    snapshot.metadata.isFromCache &&
                    parsedUser?.activeHouseholdId.isNullOrBlank()
                ) {
                    return@addSnapshotListener
                }

                trySend(parsedUser?.copy(id = userId))
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
        syncAuthLanguage()
        auth.currentUser?.sendEmailVerification()?.await()
        getOrCreateUserProfile().getOrThrow()
    }

    override suspend fun getOrCreateUserProfile(): Result<User> = runCatching {
        val firebaseUser = auth.currentUser ?: throw IllegalStateException("Not signed in")
        val userId = firebaseUser.uid
        val userDoc = firestore.collection("users").document(userId)

        // Read the authoritative copy from the server, with a few retries.
        //
        // This method always runs right after a successful auth operation, so the
        // device is online. We must NOT fall back to the local cache for this
        // decision: a concurrent FCM merge write to users/{uid} can create a
        // partial *pending* cached document that lacks activeHouseholdId. Reading
        // that phantom cache document would wrongly route an existing household
        // member to the household-setup screen.
        //
        // The first Firestore call on a cold SDK (fresh install) can transiently
        // fail before the backend channel / auth handshake is ready, so we retry
        // the server read instead of falling back to stale/partial cache data.
        val snapshot = fetchUserSnapshotFromServer(userDoc)

        val user = if (snapshot.exists()) {
            snapshot.toObject(User::class.java)?.copy(id = userId)
                ?: throw IllegalStateException("Cannot deserialize user")
        } else {
            val newUser = User(
                id = userId,
                displayName = firebaseUser.displayName ?: "",
                email = firebaseUser.email ?: "",
                activeHouseholdId = null
            )
            // Merge so a stale/empty read can never clobber existing server fields
            // (e.g. activeHouseholdId) for an account that actually exists.
            userDoc.set(newUser, SetOptions.merge()).await()
            // Confirm from the server in case another client/write already had a profile.
            val confirmed = fetchUserSnapshotFromServer(userDoc)
            confirmed.toObject(User::class.java)?.copy(id = userId) ?: newUser
        }

        // Register FCM only AFTER the authoritative profile read, so the merge write
        // cannot race ahead of household routing and poison the local cache.
        notificationRepository.registerCurrentToken()

        user
    }

    /**
     * Reads users/{uid} directly from the server, retrying a few times to absorb the
     * transient failure that the first Firestore call can hit on a cold SDK right
     * after sign-in (fresh install). A non-existent document is a valid server
     * response and is returned as-is; only real errors (network/handshake) trigger a
     * retry. We deliberately never read from the local cache here so a partial
     * pending write (e.g. FCM token registration) cannot mask activeHouseholdId.
     */
    private suspend fun fetchUserSnapshotFromServer(
        userDoc: DocumentReference
    ): DocumentSnapshot {
        var lastError: Exception? = null
        repeat(SERVER_READ_ATTEMPTS) { attempt ->
            try {
                return userDoc.get(Source.SERVER).await()
            } catch (e: Exception) {
                lastError = e
                if (attempt < SERVER_READ_ATTEMPTS - 1) {
                    delay(SERVER_READ_RETRY_DELAY_MS * (attempt + 1))
                }
            }
        }
        throw lastError ?: IllegalStateException("Unable to read user profile")
    }

    override suspend fun signOut() {
        withContext(Dispatchers.IO) {
            database.clearAllTables()
        }
        auth.signOut()
    }

    override suspend fun sendPasswordReset(email: String): Result<Unit> = runCatching {
        syncAuthLanguage()
        auth.sendPasswordResetEmail(email).await()
    }

    override suspend fun sendVerificationEmail(): Result<Unit> = runCatching {
        syncAuthLanguage()
        auth.currentUser?.sendEmailVerification()?.await()
            ?: throw IllegalStateException("No user signed in")
    }

    private fun syncAuthLanguage() {
        auth.setLanguageCode(Locale.getDefault().language)
    }

    override suspend fun reloadUser(): Boolean {
        auth.currentUser?.reload()?.await()
        return auth.currentUser?.isEmailVerified == true
    }

    private companion object {
        const val SERVER_READ_ATTEMPTS = 4
        const val SERVER_READ_RETRY_DELAY_MS = 250L
    }
}
