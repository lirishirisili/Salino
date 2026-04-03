package com.salino.sali.data.repository

import com.google.firebase.firestore.ListenerRegistration
import com.salino.sali.data.local.source.HouseholdLocalDataSource
import com.salino.sali.data.model.Household
import com.salino.sali.data.model.HouseholdMember
import com.salino.sali.data.remote.source.HouseholdRemoteDataSource
import com.salino.sali.di.IoDispatcher
import com.salino.sali.domain.repository.AuthRepository
import com.salino.sali.domain.repository.HouseholdRepository
import kotlinx.coroutines.CoroutineDispatcher
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.launch
import javax.inject.Inject
import javax.inject.Singleton

@Singleton
class HouseholdRepositoryImpl @Inject constructor(
    private val remoteDataSource: HouseholdRemoteDataSource,
    private val localDataSource: HouseholdLocalDataSource,
    private val authRepository: AuthRepository,
    @IoDispatcher ioDispatcher: CoroutineDispatcher
) : HouseholdRepository {

    private val scope = CoroutineScope(SupervisorJob() + ioDispatcher)
    private val householdListeners = mutableMapOf<String, ListenerRegistration>()
    private val memberListeners = mutableMapOf<String, ListenerRegistration>()

    override suspend fun createHousehold(name: String): Result<Household> = runCatching {
        val user = authRepository.observeCurrentUser().first()
            ?: throw IllegalStateException("Not signed in")
        val household = remoteDataSource.createHousehold(
            userId = user.id,
            displayName = user.displayName,
            name = name
        )
        localDataSource.cacheHousehold(household)
        household
    }

    override suspend fun joinHousehold(inviteCode: String): Result<Household> = runCatching {
        val user = authRepository.observeCurrentUser().first()
            ?: throw IllegalStateException("Not signed in")
        val household = remoteDataSource.joinHousehold(
            userId = user.id,
            displayName = user.displayName,
            inviteCode = inviteCode
        )
        localDataSource.cacheHousehold(household)
        household
    }

    override suspend fun getHousehold(householdId: String): Result<Household> = runCatching {
        val local = localDataSource.getHousehold(householdId)
        if (local != null) {
            refreshHousehold(householdId)
            return@runCatching local
        }

        val remote = remoteDataSource.getHousehold(householdId)
        localDataSource.cacheHousehold(remote)
        remote
    }

    override fun observeHousehold(householdId: String): Flow<Household?> {
        ensureHouseholdSync(householdId)
        return localDataSource.observeHousehold(householdId)
    }

    override fun observeHouseholdMembers(householdId: String): Flow<List<HouseholdMember>> {
        ensureMembersSync(householdId)
        return localDataSource.observeMembers(householdId)
    }

    override suspend fun getInviteCode(householdId: String): Result<String> = runCatching {
        getHousehold(householdId).getOrThrow().inviteCode
    }

    override suspend fun updateHouseholdName(householdId: String, newName: String): Result<Unit> = runCatching {
        remoteDataSource.updateHouseholdName(householdId, newName)
    }

    override suspend fun leaveHousehold(householdId: String): Result<Unit> = runCatching {
        val user = authRepository.observeCurrentUser().first()
            ?: throw IllegalStateException("Not signed in")
        householdListeners[householdId]?.remove()
        householdListeners.remove(householdId)
        memberListeners[householdId]?.remove()
        memberListeners.remove(householdId)
        remoteDataSource.leaveHousehold(householdId, user.id)
        localDataSource.clearHouseholdData(householdId)
    }

    override fun clearListeners() {
        householdListeners.values.forEach { it.remove() }
        householdListeners.clear()
        memberListeners.values.forEach { it.remove() }
        memberListeners.clear()
    }

    private fun ensureHouseholdSync(householdId: String) {
        if (householdListeners.containsKey(householdId)) return
        householdListeners[householdId] = remoteDataSource.listenToHousehold(householdId) { household ->
            scope.launch {
                localDataSource.cacheHousehold(household)
            }
        }
    }

    private fun ensureMembersSync(householdId: String) {
        if (memberListeners.containsKey(householdId)) return
        memberListeners[householdId] = remoteDataSource.listenToMembers(householdId) { members ->
            scope.launch {
                localDataSource.replaceMembers(householdId, members)
            }
        }
    }

    private fun refreshHousehold(householdId: String) {
        scope.launch {
            runCatching {
                val household = remoteDataSource.getHousehold(householdId)
                localDataSource.cacheHousehold(household)
            }
        }
    }
}
