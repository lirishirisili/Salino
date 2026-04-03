package com.salino.sali.util

import com.google.firebase.Timestamp
import java.text.Normalizer
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale

/**
 * Normalize item name for duplicate detection and search.
 * Lowercases, trims whitespace, collapses repeated spaces, strips simple punctuation,
 * and removes Hebrew niqqud so duplicate detection is more forgiving.
 */
fun normalizeItemName(name: String): String {
    if (name.isBlank()) return ""

    val withoutNiqqud = Normalizer.normalize(name, Normalizer.Form.NFD)
        .replace(Regex("[\\p{Mn}]"), "")

    return withoutNiqqud
        .lowercase(Locale.getDefault())
        .replace(Regex("[׳'`\".,!?()\\[\\]{}:;_\\-]+"), " ")
        .replace(Regex("\\s+"), " ")
        .trim()
}

/**
 * Format a timestamp for display.
 */
fun formatTimestamp(date: Date?): String {
    if (date == null) return ""
    val formatter = SimpleDateFormat("dd/MM HH:mm", Locale.getDefault())
    return formatter.format(date)
}

fun Timestamp?.toEpochMillis(): Long? = this?.toDate()?.time

fun Long?.toTimestamp(): Timestamp? = this?.let { Timestamp(Date(it)) }

/**
 * Parse a quantity string that may use either comma or dot as decimal separator.
 */
fun parseQuantity(value: String): Double? {
    return value.replace(',', '.').toDoubleOrNull()
}

/**
 * Format quantity for display, removing unnecessary decimals.
 */
fun formatQuantity(quantity: Double): String {
    return if (quantity == quantity.toLong().toDouble()) {
        quantity.toLong().toString()
    } else {
        quantity.toString()
    }
}
