package com.salino.sali.util

enum class PasswordError {
    TOO_SHORT,
    NEEDS_LETTER,
    NEEDS_NUMBER
}

fun validatePassword(password: String): PasswordError? {
    if (password.length < 8) return PasswordError.TOO_SHORT
    if (!password.any { it.isLetter() }) return PasswordError.NEEDS_LETTER
    if (!password.any { it.isDigit() }) return PasswordError.NEEDS_NUMBER
    return null
}
