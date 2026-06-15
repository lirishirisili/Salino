package com.salino.sali.data.local

import android.content.Context
import androidx.datastore.core.DataStore
import androidx.datastore.preferences.core.Preferences
import androidx.datastore.preferences.core.edit
import androidx.datastore.preferences.core.stringPreferencesKey
import androidx.datastore.preferences.preferencesDataStore
import com.salino.sali.data.model.ItemCategory
import dagger.hilt.android.qualifiers.ApplicationContext
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.withLock
import javax.inject.Inject
import javax.inject.Singleton

private val Context.categoryCacheDataStore: DataStore<Preferences> by preferencesDataStore(
    name = "category_classification_cache"
)

private const val MAX_ENTRIES = 200
private const val ENTRY_TTL_MS = 90L * 24 * 60 * 60 * 1000

@Singleton
class CategoryClassificationCache @Inject constructor(
    @ApplicationContext context: Context
) : CategoryClassificationStore {
    private val dataStore = context.categoryCacheDataStore
    private val entriesKey = stringPreferencesKey("entries")
    private val mutex = Mutex()

    override suspend fun get(normalizedName: String): ItemCategory? = mutex.withLock {
        val now = System.currentTimeMillis()
        val entries = loadEntries().toMutableMap()
        pruneExpired(entries, now)
        val entry = entries[normalizedName] ?: return@withLock null
        if (now - entry.cachedAtMillis > ENTRY_TTL_MS) {
            entries.remove(normalizedName)
            persist(entries)
            return@withLock null
        }
        ItemCategory.entries.find { it.name == entry.categoryName }
    }

    override suspend fun put(normalizedName: String, category: ItemCategory) = mutex.withLock {
        val now = System.currentTimeMillis()
        val entries = loadEntries().toMutableMap()
        pruneExpired(entries, now)
        entries[normalizedName] = CacheEntry(category.name, now)
        while (entries.size > MAX_ENTRIES) {
            val oldest = entries.entries.minByOrNull { it.value.cachedAtMillis }?.key ?: break
            entries.remove(oldest)
        }
        persist(entries)
    }

    private suspend fun loadEntries(): Map<String, CacheEntry> {
        val raw = dataStore.data.first()[entriesKey] ?: return emptyMap()
        return raw.split("\n")
            .mapNotNull { line ->
                val parts = line.split("|", limit = 3)
                if (parts.size != 3) return@mapNotNull null
                val cachedAt = parts[2].toLongOrNull() ?: return@mapNotNull null
                parts[0] to CacheEntry(parts[1], cachedAt)
            }
            .toMap()
    }

    private suspend fun persist(entries: Map<String, CacheEntry>) {
        val serialized = entries.entries.joinToString("\n") { (key, value) ->
            "$key|${value.categoryName}|${value.cachedAtMillis}"
        }
        dataStore.edit { prefs ->
            if (serialized.isEmpty()) {
                prefs.remove(entriesKey)
            } else {
                prefs[entriesKey] = serialized
            }
        }
    }

    private fun pruneExpired(entries: MutableMap<String, CacheEntry>, now: Long) {
        val iterator = entries.entries.iterator()
        while (iterator.hasNext()) {
            val entry = iterator.next()
            if (now - entry.value.cachedAtMillis > ENTRY_TTL_MS) {
                iterator.remove()
            }
        }
    }

    private data class CacheEntry(val categoryName: String, val cachedAtMillis: Long)
}
