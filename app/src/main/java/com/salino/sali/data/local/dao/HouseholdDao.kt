package com.salino.sali.data.local.dao

import androidx.room.Dao
import androidx.room.Insert
import androidx.room.OnConflictStrategy
import androidx.room.Query
import com.salino.sali.data.local.entity.HouseholdEntity
import kotlinx.coroutines.flow.Flow

@Dao
interface HouseholdDao {
    @Query("SELECT * FROM households WHERE id = :householdId LIMIT 1")
    fun observeHousehold(householdId: String): Flow<HouseholdEntity?>

    @Query("SELECT * FROM households WHERE id = :householdId LIMIT 1")
    suspend fun getHousehold(householdId: String): HouseholdEntity?

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun upsertHousehold(household: HouseholdEntity)

    @Query("UPDATE households SET isCurrent = 0")
    suspend fun clearCurrentFlag()

    @Query("UPDATE households SET isCurrent = 1 WHERE id = :householdId")
    suspend fun markCurrent(householdId: String)
}
