package com.salino.sali.ui.components.onboarding

import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
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
import androidx.compose.ui.res.stringResource
import com.salino.sali.R

@Composable
fun ShoppingListOnboardingFlow(
    onComplete: () -> Unit,
    modifier: Modifier = Modifier
) {
    val steps = listOf(
        OnboardingGuideStep(
            icon = Icons.Default.Add,
            title = stringResource(R.string.onboarding_list_add_title),
            body = stringResource(R.string.onboarding_list_add_body)
        ),
        OnboardingGuideStep(
            icon = Icons.Default.Sync,
            title = stringResource(R.string.onboarding_list_sync_title),
            body = stringResource(R.string.onboarding_list_sync_body)
        ),
        OnboardingGuideStep(
            icon = Icons.Default.Settings,
            title = stringResource(R.string.onboarding_list_settings_title),
            body = stringResource(R.string.onboarding_list_settings_body)
        ),
        OnboardingGuideStep(
            icon = Icons.Default.Storefront,
            title = stringResource(R.string.onboarding_list_extras_title),
            body = stringResource(R.string.onboarding_list_extras_body)
        )
    )

    var stepIndex by remember { mutableIntStateOf(0) }

    OnboardingFullScreenOverlay(modifier = modifier) {
        Box(Modifier.fillMaxSize()) {
            OnboardingGuideDialog(
                steps = steps,
                currentStepIndex = stepIndex,
                inviteCode = null,
                onNext = {
                    if (stepIndex < steps.lastIndex) {
                        stepIndex++
                    } else {
                        onComplete()
                    }
                },
                onSkip = onComplete
            )
        }
    }
}
