package com.salino.sali.data.local.source

import androidx.room.withTransaction
import com.salino.sali.data.local.SalinoDatabase
import com.salino.sali.data.local.mapper.toEntity
import com.salino.sali.data.local.mapper.toModel
import com.salino.sali.data.model.Household
import com.salino.sali.data.model.HouseholdMember
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.map
import javax.inject.Inject

class HouseholdLocalDataSource @Inject constructor(
    private val database: SalinoDatabase
) {
    fun observeHousehold(householdId: String): Flow<Household?> =
        database.householdDao().observeHousehold(householdId).map { it?.toModel() }

    suspend fun getHousehold(householdId: String): Household? =
        database.householdDao().getHousehold(householdId)?.toModel()

    suspend fun cacheHousehold(household: Household, markCurrent: Boolean = true) {
        database.withTransaction {
            if (markCurrent) {
                database.householdDao().clearCurrentFlag()
            }
            database.householdDao().upsertHousehold(household.toEntity(isCurrent = markCurrent))
            if (markCurrent) {
                database.householdDao().markCurrent(household.id)
            }
        }
    }

    fun observeMembers(householdId: String): Flow<List<HouseholdMember>> =
        database.householdMemberDao().observeMembers(householdId).map { list -> list.map { it.toModel() } }

    suspend fun replaceMembers(householdId: String, members: List<HouseholdMember>) {
        database.withTransaction {
            database.householdMemberDao().deleteMembersForHousehold(householdId)
            database.householdMemberDao().upsertMembers(members.map { it.toEntity(householdId) })
        }
    }
}
