package com.salino.sali.domain.service

import com.salino.sali.data.model.ItemUnit

data class ParsedVoiceItem(
    val name: String,
    val quantity: Double = 1.0,
    val unit: ItemUnit? = null
)

interface VoiceInputParser {
    fun parse(spokenText: String): ParsedVoiceItem
}
