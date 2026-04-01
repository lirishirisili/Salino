package com.salino.sali.data.local.entity

import androidx.room.Entity
import androidx.room.PrimaryKey

@Entity(tableName = "households")
data class HouseholdEntity(
    @PrimaryKey val id: String,
    val name: String,
    val createdBy: String,
    val createdAtMillis: Long?,
    val inviteCode: String,
    val isCurrent: Boolean = false
)
