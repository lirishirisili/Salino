package com.salino.sali.data.model



/**

 * Firestore document: users/{userId}

 */

data class User(

    val id: String = "",

    val displayName: String = "",

    val email: String = "",

    val activeHouseholdId: String? = null

) {

    // No-arg constructor for Firestore deserialization

    constructor() : this("", "", "", null)

}

