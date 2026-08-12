package com.salino.sali.util

import android.net.Uri

object AppLinks {
    const val APP_LINK_HOST = "hsr.lirshir.com"
    const val APP_SCHEME = "haserli"

    fun buildInviteUrl(code: String): String =
        "https://$APP_LINK_HOST/join/${code.trim().uppercase()}"

    fun extractInviteCode(uri: Uri?): String? {
        if (uri == null) return null

        val host = uri.host?.lowercase()
        val isHttpsInvite = uri.scheme == "https" &&
            host == APP_LINK_HOST &&
            uri.pathSegments.firstOrNull() == "join" &&
            uri.pathSegments.size >= 2
        val isSchemeInvite = uri.scheme == APP_SCHEME &&
            uri.host == "join" &&
            !uri.path.isNullOrBlank()

        return when {
            isHttpsInvite -> uri.pathSegments[1]
            isSchemeInvite -> uri.path?.trim('/')?.substringBefore('/')
            else -> null
        }?.trim()?.uppercase()?.takeIf { it.isNotBlank() }
    }
}

object InviteDeepLinkHolder {
    @Volatile
    var pendingCode: String? = null
        private set

    fun set(code: String) {
        pendingCode = code.trim().uppercase()
    }

    fun consume(): String? {
        val code = pendingCode
        pendingCode = null
        return code
    }
}
