package com.salino.sali.ui.components.onboarding

import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Add
import androidx.compose.material.icons.filled.Settings
import androidx.compose.material.icons.filled.Storefront
import androidx.compose.material.icons.filled.Sync
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.Rect
import androidx.compose.ui.platform.LocalConfiguration
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.platform.LocalLayoutDirection
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.unit.LayoutDirection
import androidx.compose.ui.unit.dp
import com.salino.sali.R

/**
 * Spotlight-based onboarding for the shopping list screen.
 * Highlights actual UI elements (FABs, settings icon, list area) one by one.
 *
 * @param targetLayouts Measured bounding boxes of key UI elements (optional — falls back
 *                      to calculated positions if not provided)
 */
@Composable
fun ShoppingListOnboardingFlow(
    onComplete: () -> Unit,
    modifier: Modifier = Modifier,
    targetLayouts: ShoppingListTargetLayouts? = null
) {
    val density = LocalDensity.current
    val configuration = LocalConfiguration.current
    val isRtl = LocalLayoutDirection.current == LayoutDirection.Rtl
    val screenWidthPx = with(density) { configuration.screenWidthDp.dp.toPx() }
    val screenHeightPx = with(density) { configuration.screenHeightDp.dp.toPx() }

    // Calculate spotlight positions based on layouts or smart defaults
    val fabY = targetLayouts?.addFab?.center?.y
        ?: (screenHeightPx - with(density) { 72.dp.toPx() })
    val addFabX = targetLayouts?.addFab?.center?.x
        ?: if (isRtl) screenWidthPx * 0.35f else screenWidthPx * 0.65f
    val superFabX = targetLayouts?.supermarketFab?.center?.x
        ?: if (isRtl) screenWidthPx * 0.65f else screenWidthPx * 0.35f
    val settingsX = targetLayouts?.settingsIcon?.center?.x
        ?: if (isRtl) (screenWidthPx - with(density) { 42.dp.toPx() })
        else with(density) { screenWidthPx - 42.dp.toPx() }
    val settingsY = targetLayouts?.settingsIcon?.center?.y
        ?: with(density) { 56.dp.toPx() }
    val spotlightRadius = with(density) { 38.dp.toPx() }
    val settingsRadius = with(density) { 26.dp.toPx() }
    val listRadius = minOf(screenWidthPx * 0.4f, with(density) { 160.dp.toPx() })

    val steps = listOf(
        SpotlightStep(
            target = SpotlightTarget(x = addFabX, y = fabY, radius = spotlightRadius),
            icon = Icons.Default.Add,
            title = stringResource(R.string.onboarding_list_add_title),
            body = stringResource(R.string.onboarding_list_add_body),
            tooltipPosition = TooltipPosition.ABOVE
        ),
        SpotlightStep(
            target = SpotlightTarget(x = screenWidthPx / 2f, y = screenHeightPx * 0.42f, radius = listRadius),
            icon = Icons.Default.Sync,
            title = stringResource(R.string.onboarding_list_sync_title),
            body = stringResource(R.string.onboarding_list_sync_body),
            tooltipPosition = TooltipPosition.ABOVE
        ),
        SpotlightStep(
            target = SpotlightTarget(x = settingsX, y = settingsY, radius = settingsRadius),
            icon = Icons.Default.Settings,
            title = stringResource(R.string.onboarding_list_settings_title),
            body = stringResource(R.string.onboarding_list_settings_body),
            tooltipPosition = TooltipPosition.BELOW
        ),
        SpotlightStep(
            target = SpotlightTarget(x = superFabX, y = fabY, radius = spotlightRadius),
            icon = Icons.Default.Storefront,
            title = stringResource(R.string.onboarding_list_extras_title),
            body = stringResource(R.string.onboarding_list_extras_body),
            tooltipPosition = TooltipPosition.ABOVE
        )
    )

    var stepIndex by remember { mutableIntStateOf(0) }

    SpotlightOverlay(
        steps = steps,
        currentStep = stepIndex,
        onNext = {
            if (stepIndex < steps.lastIndex) stepIndex++ else onComplete()
        },
        onSkip = onComplete,
        modifier = modifier
    )
}

/**
 * Measured layout data for spotlight targets. Pass from the ShoppingListScreen.
 */
data class ShoppingListTargetLayouts(
    val addFab: Rect? = null,
    val supermarketFab: Rect? = null,
    val settingsIcon: Rect? = null,
    val listArea: Rect? = null
)
