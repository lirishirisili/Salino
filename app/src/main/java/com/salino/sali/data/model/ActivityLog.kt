package com.salino.sali.data.model

import com.google.firebase.Timestamp

/**
 * Optional abstraction for activity logging (Phase 2).
 * Firestore document: households/{householdId}/activity/{logId}
 */
data class ActivityLog(
    val id: String = "",
    val householdId: String = "",
    val type: String = ActivityType.ITEM_ADDED.name,
    val itemId: String? = null,
    val itemName: String = "",
    val actorUserId: String = "",
    val actorDisplayName: String = "",
    val message: String = "",
    val createdAt: Timestamp? = null
) {
    constructor() : this("", "", ActivityType.ITEM_ADDED.name, null, "", "", "", "", null)
}
