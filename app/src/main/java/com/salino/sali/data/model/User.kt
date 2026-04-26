package com.salino.sali.data.model

/**
 * Firestore document: users/{userId}
 */
data class User(
    val id: String = "",
    val displayName: String = "",
    val email: String = "",
    val activeHouseholdId: String? = null,
    val notificationPrefs: NotificationPrefs = NotificationPrefs()
) {
    // No-arg constructor for Firestore deserialization
    constructor() : this("", "", "", null, NotificationPrefs())
}

enum class NotificationMode {
    IMMEDIATE_IMPORTANT,
    DAILY_DIGEST,
    WEEKLY_DIGEST,
    SILENT
}

enum class ImportantEvent {
    ITEM_ADDED,
    ITEM_BOUGHT,
    ITEM_UPDATED,
    ITEM_DELETED
}

data class NotificationPrefs(
    val mode: NotificationMode = NotificationMode.IMMEDIATE_IMPORTANT,
    val importantEvents: List<ImportantEvent> = listOf(ImportantEvent.ITEM_ADDED),
    val maxImmediatePerHour: Int = 3
)
