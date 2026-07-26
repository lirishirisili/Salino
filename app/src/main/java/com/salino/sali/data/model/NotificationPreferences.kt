package com.salino.sali.data.model

/**
 * Per-user push notification preferences. Stored as a nested map on the
 * Firestore document users/{userId}. All types default to disabled (opt-in).
 */
data class NotificationPreferences(
    val itemAdded: Boolean = false,
    val urgentItem: Boolean = false,
    val shoppingComplete: Boolean = false,
    val memberJoined: Boolean = false
) {
    // No-arg constructor for Firestore deserialization
    constructor() : this(false, false, false, false)
}
