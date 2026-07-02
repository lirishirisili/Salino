package com.salino.sali.feature.tour

import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.WindowInsets
import androidx.compose.foundation.layout.asPaddingValues
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.systemBars
import androidx.compose.runtime.Composable
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.remember
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalConfiguration
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.unit.IntSize
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.navigation.NavHostController
import androidx.navigation.compose.currentBackStackEntryAsState
import com.salino.sali.domain.repository.AuthRepository
import com.salino.sali.navigation.Screen
import dagger.hilt.android.EntryPointAccessors
import kotlinx.coroutines.delay

@Composable
fun TourHost(
    navController: NavHostController,
    authRepository: AuthRepository = rememberAuthRepository(),
    tourViewModel: TourViewModel = hiltViewModel(),
    content: @Composable () -> Unit,
) {
    val uiState by tourViewModel.uiState.collectAsStateWithLifecycle()
    val navBackStackEntry by navController.currentBackStackEntryAsState()
    val currentRoute = navBackStackEntry?.destination?.route
    val context = LocalContext.current
    val configuration = LocalConfiguration.current
    val density = LocalDensity.current
    val systemBars = WindowInsets.systemBars.asPaddingValues()
    val safeTop = systemBars.calculateTopPadding()
    val safeBottom = systemBars.calculateBottomPadding()

    LaunchedEffect(uiState.shoppingListReady, currentRoute) {
        tourViewModel.setCurrentRoute(currentRoute)
        tourViewModel.setUid(authRepository.currentUserId)
        tourViewModel.tryAutoStart(currentRoute = currentRoute)
    }

    LaunchedEffect(uiState.replayRequested, uiState.shoppingListReady) {
        if (!uiState.replayRequested || !uiState.shoppingListReady) return@LaunchedEffect
        if (currentRoute != Screen.ShoppingList.route) {
            navController.navigate(Screen.ShoppingList.route) {
                launchSingleTop = true
            }
            delay(TOUR_ROUTE_SWITCH_MS)
        }
        tourViewModel.clearReplayRequest()
        tourViewModel.start()
    }

    LaunchedEffect(
        uiState.active,
        uiState.stepIndex,
        uiState.shoppingListReady,
        currentRoute,
    ) {
        val canRun = TOUR_ENABLED &&
            uiState.active &&
            uiState.shoppingListReady &&
            uiState.stepIndex < tourViewModel.steps.size

        if (!canRun) {
            tourViewModel.hideOverlay()
            tourViewModel.setActiveAnchor(null)
            return@LaunchedEffect
        }

        val step = tourViewModel.steps[uiState.stepIndex]

        if (step.route != currentRoute) {
            when (step.route) {
                Screen.ShoppingList.route -> {
                    val popped = navController.popBackStack(Screen.ShoppingList.route, inclusive = false)
                    if (!popped) {
                        navController.navigate(Screen.ShoppingList.route) {
                            launchSingleTop = true
                        }
                    }
                }
                Screen.Settings.route -> {
                    navController.navigate(Screen.Settings.route) {
                        launchSingleTop = true
                    }
                }
                Screen.History.route -> {
                    navController.navigate(Screen.History.route) {
                        launchSingleTop = true
                    }
                }
            }
            delay(TOUR_ROUTE_SWITCH_MS)
        }

        if (step.scrollIntoView && step.anchorId != null) {
            tourViewModel.anchorRegistry.scrollAnchorIntoView(step.anchorId)
            delay(TOUR_SCROLL_SETTLE_MS)
        }

        repeat(TOUR_LAYOUT_FRAMES) {
            delay(16)
        }

        tourViewModel.setActiveAnchor(step.anchorId)
        delay(60)

        val screenSize = IntSize(
            with(density) { configuration.screenWidthDp.dp.roundToPx() },
            with(density) { configuration.screenHeightDp.dp.roundToPx() },
        )
        val safeTopPx = with(density) { safeTop.toPx() }
        val safeBottomPx = with(density) { safeBottom.toPx() }

        val placement = resolveSheetPlacement(
            registry = tourViewModel.anchorRegistry,
            anchorId = step.anchorId,
            screenSize = screenSize,
            safeTopPx = safeTopPx,
            safeBottomPx = safeBottomPx,
        )

        val stepLabel = context.getString(
            com.salino.sali.R.string.tour_step_of,
            uiState.stepIndex + 1,
            tourViewModel.steps.size,
        )

        tourViewModel.showOverlay(
            TourOverlayState(
                title = context.getString(step.titleRes),
                body = context.getString(step.bodyRes),
                stepLabel = stepLabel,
                isLast = uiState.stepIndex >= tourViewModel.steps.lastIndex,
                sheetPlacement = placement,
            )
        )
    }

    CompositionLocalProvider(LocalTourViewModel provides tourViewModel) {
        Box(modifier = Modifier.fillMaxSize()) {
            content()
            if (uiState.overlay != null) {
                TourOverlay(
                    tourViewModel = tourViewModel,
                    safeTopPadding = safeTop,
                    safeBottomPadding = safeBottom,
                )
            }
        }
    }
}

@Composable
private fun rememberAuthRepository(): AuthRepository {
    val context = LocalContext.current
    return remember {
        EntryPointAccessors.fromApplication(
            context.applicationContext,
            TourAuthEntryPoint::class.java,
        ).authRepository()
    }
}

@dagger.hilt.EntryPoint
@dagger.hilt.InstallIn(dagger.hilt.components.SingletonComponent::class)
interface TourAuthEntryPoint {
    fun authRepository(): AuthRepository
}
