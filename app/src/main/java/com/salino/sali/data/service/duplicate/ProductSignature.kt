package com.salino.sali.data.service.duplicate

/**
 * Structured representation of a shopping item for duplicate comparison.
 */
data class ProductSignature(
    val normalizedText: String,
    val baseProduct: String?,
    val matchedPhraseId: String?,
    val strongQualifiers: Set<String>,
    val weakQualifiers: Set<String>,
    val percentageQualifier: String?,
    val category: String?,
    val remainingTokens: List<String>
)
