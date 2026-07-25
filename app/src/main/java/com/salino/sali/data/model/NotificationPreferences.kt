package com.salino.sali.data.model

/**
 * Per-user push notification preferences. Stored as a nested map on the
 * Firestore document users/{userId}. All types default to enabled.
 */
data class NotificationPreferences(
    val itemAdded: Boolean = true,
    val urgentItem: Boolean = true,
    val shoppingComplete: Boolean = true,
    val memberJoined: Boolean = true
) {
    // No-arg constructor for Firestore deserialization
    constructor() : this(true, true, true, true)
}
