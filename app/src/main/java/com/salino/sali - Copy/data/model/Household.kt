package com.salino.sali.data.model

import com.google.firebase.Timestamp

/**
 * Firestore document: households/{householdId}
 */
data class Household(
    val id: String = "",
    val name: String = "",
    val createdBy: String = "",
    val createdAt: Timestamp? = null,
    val inviteCode: String = ""
) {
    constructor() : this("", "", "", null, "")
}
