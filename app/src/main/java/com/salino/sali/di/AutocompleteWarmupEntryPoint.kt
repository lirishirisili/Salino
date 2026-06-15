package com.salino.sali.di

import com.salino.sali.data.service.ItemNameAutocompleteStore
import dagger.hilt.EntryPoint
import dagger.hilt.InstallIn
import dagger.hilt.components.SingletonComponent

@EntryPoint
@InstallIn(SingletonComponent::class)
interface AutocompleteWarmupEntryPoint {
    fun itemNameAutocompleteStore(): ItemNameAutocompleteStore
}
