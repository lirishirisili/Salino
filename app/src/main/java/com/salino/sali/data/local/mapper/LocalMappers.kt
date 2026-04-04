package com.salino.sali.data.local.mapper

import com.salino.sali.data.local.entity.ActivityLogEntity
import com.salino.sali.data.local.entity.HouseholdEntity
import com.salino.sali.data.local.entity.HouseholdMemberEntity
import com.salino.sali.data.local.entity.RecurringItemEntity
import com.salino.sali.data.local.entity.ShoppingItemEntity
import com.salino.sali.data.model.ActivityLog
import com.salino.sali.data.model.Household
import com.salino.sali.data.model.HouseholdMember
import com.salino.sali.data.model.RecurringItem
import com.salino.sali.data.model.ShoppingItem
import com.salino.sali.util.toEpochMillis
import com.salino.sali.util.toTimestamp

fun HouseholdEntity.toModel(): Household = Household(
    id = id,
    name = name,
    createdBy = createdBy,
    createdAt = createdAtMillis.toTimestamp(),
    inviteCode = inviteCode
)

fun Household.toEntity(isCurrent: Boolean = false): HouseholdEntity = HouseholdEntity(
    id = id,
    name = name,
    createdBy = createdBy,
    createdAtMillis = createdAt.toEpochMillis(),
    inviteCode = inviteCode,
    isCurrent = isCurrent
)

fun HouseholdMemberEntity.toModel(): HouseholdMember = HouseholdMember(
    userId = userId,
    displayName = displayName,
    role = role,
    joinedAt = joinedAtMillis.toTimestamp()
)

fun HouseholdMember.toEntity(householdId: String): HouseholdMemberEntity = HouseholdMemberEntity(
    householdId = householdId,
    userId = userId,
    displayName = displayName,
    role = role,
    joinedAtMillis = joinedAt.toEpochMillis()
)

fun ShoppingItemEntity.toModel(): ShoppingItem = ShoppingItem(
    id = id,
    name = name,
    normalizedName = normalizedName,
    quantity = quantity,
    unit = unit,
    category = category,
    note = note,
    status = status,
    addedBy = addedBy,
    addedByName = addedByName,
    boughtBy = boughtBy,
    boughtByName = boughtByName,
    isFavorite = isFavorite,
    createdAt = createdAtMillis.toTimestamp(),
    updatedAt = updatedAtMillis.toTimestamp()
)

fun ShoppingItem.toEntity(householdId: String): ShoppingItemEntity = ShoppingItemEntity(
    id = id,
    householdId = householdId,
    name = name,
    normalizedName = normalizedName,
    quantity = quantity,
    unit = unit,
    category = category,
    note = note,
    status = status,
    addedBy = addedBy,
    addedByName = addedByName,
    boughtBy = boughtBy,
    boughtByName = boughtByName,
    isFavorite = isFavorite,
    createdAtMillis = createdAt.toEpochMillis(),
    updatedAtMillis = updatedAt.toEpochMillis()
)

fun ActivityLogEntity.toModel(): ActivityLog = ActivityLog(
    id = id,
    householdId = householdId,
    type = type,
    itemId = itemId,
    itemName = itemName,
    actorUserId = actorUserId,
    actorDisplayName = actorDisplayName,
    message = message,
    createdAt = createdAtMillis.toTimestamp()
)

fun ActivityLog.toEntity(): ActivityLogEntity = ActivityLogEntity(
    id = id,
    householdId = householdId,
    type = type,
    itemId = itemId,
    itemName = itemName,
    actorUserId = actorUserId,
    actorDisplayName = actorDisplayName,
    message = message,
    createdAtMillis = createdAt.toEpochMillis()
)

fun RecurringItemEntity.toModel(): RecurringItem = RecurringItem(
    id = id,
    householdId = householdId,
    name = name,
    normalizedName = normalizedName,
    quantity = quantity,
    unit = unit,
    category = category,
    note = note,
    intervalDays = intervalDays,
    enabled = enabled,
    nextDueAt = nextDueAtMillis.toTimestamp(),
    lastCompletedAt = lastCompletedAtMillis.toTimestamp(),
    createdAt = createdAtMillis.toTimestamp(),
    updatedAt = updatedAtMillis.toTimestamp()
)

fun RecurringItem.toEntity(): RecurringItemEntity = RecurringItemEntity(
    id = id,
    householdId = householdId,
    name = name,
    normalizedName = normalizedName,
    quantity = quantity,
    unit = unit,
    category = category,
    note = note,
    intervalDays = intervalDays,
    enabled = enabled,
    nextDueAtMillis = nextDueAt.toEpochMillis(),
    lastCompletedAtMillis = lastCompletedAt.toEpochMillis(),
    createdAtMillis = createdAt.toEpochMillis(),
    updatedAtMillis = updatedAt.toEpochMillis()
)
