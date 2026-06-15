package com.salino.sali.data.service

import com.salino.sali.di.IoDispatcher
import com.salino.sali.domain.repository.AuthRepository
import com.salino.sali.domain.repository.RecurringRepository
import com.salino.sali.domain.repository.ShoppingRepository
import kotlinx.coroutines.CoroutineDispatcher
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.collectLatest
import kotlinx.coroutines.flow.distinctUntilChanged
import kotlinx.coroutines.flow.mapNotNull
import kotlinx.coroutines.flow.combine
import kotlinx.coroutines.launch
import javax.inject.Inject
import javax.inject.Singleton

/**
 * Keeps household history and the keyword catalog warm so add/edit autocomplete is instant.
 */
@Singleton
class ItemNameAutocompleteStore @Inject constructor(
    private val authRepository: AuthRepository,
    private val shoppingRepository: ShoppingRepository,
    private val recurringRepository: RecurringRepository,
    private val catalog: CategoryKeywordCatalog,
    @IoDispatcher private val ioDispatcher: CoroutineDispatcher
) {
    private val scope = CoroutineScope(SupervisorJob() + ioDispatcher)

    private val _historyIndex = MutableStateFlow(HouseholdHistoryIndex.EMPTY)
    val historyIndex: StateFlow<HouseholdHistoryIndex> = _historyIndex.asStateFlow()

    @Volatile
    private var started = false

    fun ensureStarted() {
        if (started) return
        synchronized(this) {
            if (started) return
            started = true
        }

        scope.launch { catalog.warmUp() }

        scope.launch {
            authRepository.observeCurrentUser()
                .mapNotNull { user -> user?.activeHouseholdId?.takeIf { it.isNotBlank() } }
                .distinctUntilChanged()
                .collectLatest { householdId ->
                    combine(
                        shoppingRepository.observeActiveItems(householdId),
                        shoppingRepository.observeBoughtItems(householdId),
                        recurringRepository.observeRecurringItems(householdId)
                    ) { active, bought, recurring ->
                        HouseholdHistoryIndex.from(active, bought, recurring)
                    }.collect { index ->
                        _historyIndex.value = index
                    }
                }
        }
    }
}
