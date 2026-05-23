package com.salino.sali.ui.components.onboarding

import android.content.ClipData
import android.content.ClipboardManager
import android.content.Context
import android.content.Intent
import android.widget.Toast
import androidx.compose.animation.AnimatedContent
import androidx.compose.animation.animateContentSize
import androidx.compose.animation.core.spring
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.animation.scaleIn
import androidx.compose.animation.slideInVertically
import androidx.compose.animation.togetherWith
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.ContentCopy
import androidx.compose.material.icons.filled.Share
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.window.Dialog
import androidx.compose.ui.window.DialogProperties
import com.salino.sali.R
import com.salino.sali.ui.components.BrandLogo
import com.salino.sali.ui.components.SalinoPrimaryButton
import com.salino.sali.ui.components.SalinoSurfaceCard

data class OnboardingGuideStep(
    val icon: ImageVector,
    val title: String,
    val body: String
)

@Composable
fun OnboardingGuideDialog(
    steps: List<OnboardingGuideStep>,
    currentStepIndex: Int,
    onNext: () -> Unit,
    onSkip: (() -> Unit)? = null,
    inviteCode: String? = null,
    modifier: Modifier = Modifier
) {
    val step = steps[currentStepIndex]
    val isLastStep = currentStepIndex == steps.lastIndex
    val context = LocalContext.current
    val showInviteBlock = inviteCode != null && currentStepIndex == 1 && steps.size >= 2

    Dialog(
        onDismissRequest = { if (onSkip != null) onSkip() },
        properties = DialogProperties(usePlatformDefaultWidth = false)
    ) {
        Surface(
            modifier = modifier
                .fillMaxWidth(0.94f)
                .padding(vertical = 24.dp),
            shape = MaterialTheme.shapes.extraLarge,
            color = MaterialTheme.colorScheme.surface,
            tonalElevation = 6.dp
        ) {
            Column(
                modifier = Modifier
                    .verticalScroll(rememberScrollState())
                    .padding(horizontal = 22.dp, vertical = 24.dp),
                horizontalAlignment = Alignment.CenterHorizontally
            ) {
                BrandLogo(iconSize = 56.dp, showWordmark = false, showGlow = false)

                Spacer(modifier = Modifier.height(16.dp))

                OnboardingStepIndicator(
                    stepCount = steps.size,
                    currentIndex = currentStepIndex
                )

                Spacer(modifier = Modifier.height(20.dp))

                AnimatedContent(
                    targetState = currentStepIndex,
                    transitionSpec = {
                        (fadeIn() + scaleIn(initialScale = 0.8f))
                            .togetherWith(fadeOut())
                    },
                    label = "iconAnim"
                ) { stepIdx ->
                    val animStep = steps[stepIdx]
                    Box(
                        modifier = Modifier
                            .size(64.dp)
                            .clip(CircleShape)
                            .background(MaterialTheme.colorScheme.primaryContainer),
                        contentAlignment = Alignment.Center
                    ) {
                        Icon(
                            imageVector = animStep.icon,
                            contentDescription = null,
                            modifier = Modifier.size(32.dp),
                            tint = MaterialTheme.colorScheme.primary
                        )
                    }
                }

                Spacer(modifier = Modifier.height(16.dp))

                AnimatedContent(
                    targetState = currentStepIndex,
                    transitionSpec = {
                        (fadeIn() + slideInVertically { it / 4 })
                            .togetherWith(fadeOut())
                    },
                    label = "textAnim"
                ) { stepIdx ->
                    val animStep = steps[stepIdx]
                    Column(horizontalAlignment = Alignment.CenterHorizontally) {
                        Text(
                            text = animStep.title,
                            style = MaterialTheme.typography.headlineSmall.copy(
                                fontWeight = FontWeight.Bold,
                                textAlign = TextAlign.Center
                            ),
                            textAlign = TextAlign.Center,
                            modifier = Modifier.fillMaxWidth()
                        )

                        Spacer(modifier = Modifier.height(10.dp))

                        Text(
                            text = animStep.body,
                            style = MaterialTheme.typography.bodyLarge,
                            color = MaterialTheme.colorScheme.onSurfaceVariant,
                            textAlign = TextAlign.Center,
                            modifier = Modifier.fillMaxWidth()
                        )
                    }
                }

                if (showInviteBlock && inviteCode != null) {
                    Spacer(modifier = Modifier.height(20.dp))
                    InviteCodeCard(
                        inviteCode = inviteCode,
                        onCopy = {
                            val clipboard = context.getSystemService(Context.CLIPBOARD_SERVICE) as ClipboardManager
                            clipboard.setPrimaryClip(ClipData.newPlainText("invite_code", inviteCode))
                            Toast.makeText(
                                context,
                                context.getString(R.string.household_invite_code_copied),
                                Toast.LENGTH_SHORT
                            ).show()
                        },
                        onShare = {
                            val shareIntent = Intent(Intent.ACTION_SEND).apply {
                                type = "text/plain"
                                putExtra(
                                    Intent.EXTRA_TEXT,
                                    context.getString(R.string.settings_share_invite_message, inviteCode)
                                )
                            }
                            context.startActivity(
                                Intent.createChooser(shareIntent, context.getString(R.string.share))
                            )
                        }
                    )
                }

                Spacer(modifier = Modifier.height(24.dp))

                SalinoPrimaryButton(
                    text = if (isLastStep) {
                        stringResource(R.string.onboarding_get_started)
                    } else {
                        stringResource(R.string.onboarding_next)
                    },
                    onClick = onNext,
                    modifier = Modifier.fillMaxWidth()
                )

                if (onSkip != null && !isLastStep) {
                    TextButton(onClick = onSkip, modifier = Modifier.padding(top = 4.dp)) {
                        Text(stringResource(R.string.onboarding_skip))
                    }
                }

                Text(
                    text = stringResource(
                        R.string.onboarding_step_counter,
                        currentStepIndex + 1,
                        steps.size
                    ),
                    style = MaterialTheme.typography.labelMedium,
                    color = MaterialTheme.colorScheme.outline,
                    modifier = Modifier.padding(top = 8.dp)
                )
            }
        }
    }
}

@Composable
private fun OnboardingStepIndicator(
    stepCount: Int,
    currentIndex: Int,
    modifier: Modifier = Modifier
) {
    Row(
        modifier = modifier.fillMaxWidth(),
        horizontalArrangement = Arrangement.Center,
        verticalAlignment = Alignment.CenterVertically
    ) {
        repeat(stepCount) { index ->
            val active = index == currentIndex
            val done = index < currentIndex
            Box(
                modifier = Modifier
                    .padding(horizontal = 3.dp)
                    .height(8.dp)
                    .width(if (active) 22.dp else 8.dp)
                    .clip(RoundedCornerShape(4.dp))
                    .background(
                        when {
                            active -> MaterialTheme.colorScheme.primary
                            done -> MaterialTheme.colorScheme.primary.copy(alpha = 0.45f)
                            else -> MaterialTheme.colorScheme.outlineVariant
                        }
                    )
                    .animateContentSize(animationSpec = spring(dampingRatio = 0.7f))
            )
        }
    }
}

@Composable
private fun InviteCodeCard(
    inviteCode: String,
    onCopy: () -> Unit,
    onShare: () -> Unit,
    modifier: Modifier = Modifier
) {
    SalinoSurfaceCard(modifier = modifier.fillMaxWidth()) {
        Text(
            text = stringResource(R.string.household_invite_code_title),
            style = MaterialTheme.typography.titleMedium.copy(fontWeight = FontWeight.SemiBold),
            color = MaterialTheme.colorScheme.primary
        )
        Spacer(modifier = Modifier.height(8.dp))
        Text(
            text = stringResource(R.string.household_invite_code_share),
            style = MaterialTheme.typography.bodyMedium,
            color = MaterialTheme.colorScheme.onSurfaceVariant
        )
        Spacer(modifier = Modifier.height(12.dp))
        Row(
            modifier = Modifier.fillMaxWidth(),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.SpaceBetween
        ) {
            Text(
                text = inviteCode,
                style = MaterialTheme.typography.headlineMedium.copy(
                    fontWeight = FontWeight.Bold,
                    letterSpacing = 3.sp
                ),
                modifier = Modifier.weight(1f),
                textAlign = TextAlign.Center
            )
            IconButton(onClick = onCopy) {
                Icon(Icons.Default.ContentCopy, contentDescription = stringResource(R.string.copy))
            }
            IconButton(onClick = onShare) {
                Icon(Icons.Default.Share, contentDescription = stringResource(R.string.share))
            }
        }
    }
}

@Composable
fun OnboardingFullScreenOverlay(
    modifier: Modifier = Modifier,
    content: @Composable () -> Unit
) {
    Box(
        modifier = modifier
            .fillMaxSize()
            .background(MaterialTheme.colorScheme.scrim.copy(alpha = 0.55f)),
        contentAlignment = Alignment.Center
    ) {
        content()
    }
}
