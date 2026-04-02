package com.salino.sali.domain.repository

import com.salino.sali.data.model.Household
import com.salino.sali.data.model.HouseholdMember
import kotlinx.coroutines.flow.Flow

interface HouseholdRepository {
    suspend fun createHousehold(name: String): Result<Household>
    suspend fun joinHousehold(inviteCode: String): Result<Household>
    suspend fun getHousehold(householdId: String): Result<Household>
    fun observeHousehold(householdId: String): Flow<Household?>
    fun observeHouseholdMembers(householdId: String): Flow<List<HouseholdMember>>
    suspend fun getInviteCode(householdId: String): Result<String>
    suspend fun updateHouseholdName(householdId: String, newName: String): Result<Unit>
    suspend fun leaveHousehold(householdId: String): Result<Unit>
}
