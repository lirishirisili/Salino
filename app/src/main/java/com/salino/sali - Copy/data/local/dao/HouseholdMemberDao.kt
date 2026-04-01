package com.salino.sali.data.local.dao

import androidx.room.Dao
import androidx.room.Insert
import androidx.room.OnConflictStrategy
import androidx.room.Query
import com.salino.sali.data.local.entity.HouseholdMemberEntity
import kotlinx.coroutines.flow.Flow

@Dao
interface HouseholdMemberDao {
    @Query("SELECT * FROM household_members WHERE householdId = :householdId ORDER BY displayName COLLATE NOCASE ASC")
    fun observeMembers(householdId: String): Flow<List<HouseholdMemberEntity>>

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun upsertMembers(members: List<HouseholdMemberEntity>)

    @Query("DELETE FROM household_members WHERE householdId = :householdId")
    suspend fun deleteMembersForHousehold(householdId: String)
}
