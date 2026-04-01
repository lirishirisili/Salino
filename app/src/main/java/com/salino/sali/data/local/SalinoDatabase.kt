package com.salino.sali.data.local

import androidx.room.Database
import androidx.room.RoomDatabase
import com.salino.sali.data.local.dao.ActivityLogDao
import com.salino.sali.data.local.dao.HouseholdDao
import com.salino.sali.data.local.dao.HouseholdMemberDao
import com.salino.sali.data.local.dao.PendingSyncOperationDao
import com.salino.sali.data.local.dao.RecurringItemDao
import com.salino.sali.data.local.dao.ShoppingItemDao
import com.salino.sali.data.local.entity.ActivityLogEntity
import com.salino.sali.data.local.entity.HouseholdEntity
import com.salino.sali.data.local.entity.HouseholdMemberEntity
import com.salino.sali.data.local.entity.PendingSyncOperationEntity
import com.salino.sali.data.local.entity.RecurringItemEntity
import com.salino.sali.data.local.entity.ShoppingItemEntity

@Database(
    entities = [
        HouseholdEntity::class,
        HouseholdMemberEntity::class,
        ShoppingItemEntity::class,
        ActivityLogEntity::class,
        RecurringItemEntity::class,
        PendingSyncOperationEntity::class
    ],
    version = 1,
    exportSchema = false
)
abstract class SalinoDatabase : RoomDatabase() {
    abstract fun householdDao(): HouseholdDao
    abstract fun householdMemberDao(): HouseholdMemberDao
    abstract fun shoppingItemDao(): ShoppingItemDao
    abstract fun activityLogDao(): ActivityLogDao
    abstract fun recurringItemDao(): RecurringItemDao
    abstract fun pendingSyncOperationDao(): PendingSyncOperationDao
}
