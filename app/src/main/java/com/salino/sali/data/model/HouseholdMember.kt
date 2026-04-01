package com.salino.sali.data.model

import com.google.firebase.Timestamp

/**
 * Firestore document: households/{householdId}/members/{userId}
 */
data class HouseholdMember(
    val userId: String = "",
    val displayName: String = "",
    val role: String = MemberRole.MEMBER.name,
    val joinedAt: Timestamp? = null
) {
    constructor() : this("", "", MemberRole.MEMBER.name, null)
}
