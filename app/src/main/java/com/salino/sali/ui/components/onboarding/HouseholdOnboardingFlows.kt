package com.salino.sali.ui.components.onboarding

import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.GroupAdd
import androidx.compose.material.icons.filled.Home
import androidx.compose.material.icons.filled.People
import androidx.compose.material.icons.filled.WavingHand
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.res.stringResource
import com.salino.sali.R

@Composable
fun HouseholdCreatedOnboardingFlow(
    inviteCode: String,
    onComplete: () -> Unit,
    modifier: Modifier = Modifier
) {
    val steps = listOf(
        OnboardingGuideStep(
            icon = Icons.Default.Home,
            title = stringResource(R.string.onboarding_created_title),
            body = stringResource(R.string.onboarding_created_body)
        ),
        OnboardingGuideStep(
            icon = Icons.Default.GroupAdd,
            title = stringResource(R.string.onboarding_invite_step_title),
            body = stringResource(R.string.onboarding_invite_step_body)
        ),
        OnboardingGuideStep(
            icon = Icons.Default.People,
            title = stringResource(R.string.onboarding_share_step_title),
            body = stringResource(R.string.onboarding_share_step_body)
        )
    )

    var stepIndex by remember { mutableIntStateOf(0) }

    OnboardingFullScreenOverlay(modifier = modifier) {
        Box(Modifier.fillMaxSize()) {
            OnboardingGuideDialog(
                steps = steps,
                currentStepIndex = stepIndex,
                inviteCode = inviteCode,
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

@Composable
fun HouseholdJoinedOnboardingFlow(
    onComplete: () -> Unit,
    modifier: Modifier = Modifier
) {
    val steps = listOf(
        OnboardingGuideStep(
            icon = Icons.Default.WavingHand,
            title = stringResource(R.string.onboarding_join_title),
            body = stringResource(R.string.onboarding_join_body)
        )
    )

    OnboardingFullScreenOverlay(modifier = modifier) {
        Box(Modifier.fillMaxSize()) {
            OnboardingGuideDialog(
                steps = steps,
                currentStepIndex = 0,
                inviteCode = null,
                onNext = onComplete,
                onSkip = null
            )
        }
    }
}
