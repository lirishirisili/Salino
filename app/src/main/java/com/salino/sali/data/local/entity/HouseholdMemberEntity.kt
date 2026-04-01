package com.salino.sali.data.local.entity

import androidx.room.Entity

@Entity(
    tableName = "household_members",
    primaryKeys = ["householdId", "userId"]
)
data class HouseholdMemberEntity(
    val householdId: String,
    val userId: String,
    val displayName: String,
    val role: String,
    val joinedAtMillis: Long?
)
