package com.salino.sali.ui.screens.verifyemail

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.navigationBarsPadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.widthIn
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.outlined.Email
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.Lifecycle
import androidx.lifecycle.compose.LocalLifecycleOwner
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.repeatOnLifecycle
import com.salino.sali.R
import com.salino.sali.ui.components.SalinoGradientBackground
import com.salino.sali.ui.components.SalinoPrimaryButton
import com.salino.sali.ui.components.SalinoWebTokens

@Composable
fun VerifyEmailScreen(
    onVerified: (hasHousehold: Boolean) -> Unit,
    onSignOut: () -> Unit,
    viewModel: VerifyEmailViewModel = hiltViewModel()
) {
    val uiState by viewModel.uiState.collectAsStateWithLifecycle()
    val lifecycleOwner = LocalLifecycleOwner.current

    // Auto-check when app returns to foreground
    LaunchedEffect(lifecycleOwner) {
        lifecycleOwner.lifecycle.repeatOnLifecycle(Lifecycle.State.RESUMED) {
            viewModel.checkEmailVerified()
        }
    }

    LaunchedEffect(uiState.isVerified) {
        if (uiState.isVerified) {
            onVerified(uiState.hasHousehold)
        }
    }

    val contentWidth = Modifier
        .widthIn(max = SalinoWebTokens.MaxContentWidth)
        .fillMaxWidth()

    SalinoGradientBackground {
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(horizontal = SalinoWebTokens.HorizontalPadding, vertical = 32.dp)
                .navigationBarsPadding(),
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.Center
        ) {
            Icon(
                imageVector = Icons.Outlined.Email,
                contentDescription = null,
                modifier = Modifier.size(80.dp),
                tint = MaterialTheme.colorScheme.primary
            )

            Spacer(modifier = Modifier.height(24.dp))

            Text(
                text = stringResource(R.string.verify_email_title),
                style = MaterialTheme.typography.headlineSmall,
                fontWeight = FontWeight.Bold,
                color = MaterialTheme.colorScheme.onBackground,
                textAlign = TextAlign.Center,
                modifier = contentWidth
            )

            Spacer(modifier = Modifier.height(12.dp))

            Text(
                text = stringResource(R.string.verify_email_description, uiState.email),
                style = MaterialTheme.typography.bodyLarge,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
                textAlign = TextAlign.Center,
                modifier = contentWidth
            )

            Spacer(modifier = Modifier.height(32.dp))

            SalinoPrimaryButton(
                text = stringResource(R.string.verify_email_check_button),
                onClick = { viewModel.checkEmailVerified() },
                enabled = !uiState.isChecking,
                modifier = contentWidth
            )

            Spacer(modifier = Modifier.height(16.dp))

            TextButton(
                onClick = { viewModel.resendVerificationEmail() },
                enabled = uiState.resendCooldown == 0
            ) {
                Text(
                    text = if (uiState.resendCooldown > 0) {
                        stringResource(R.string.verify_email_resend_cooldown, uiState.resendCooldown)
                    } else {
                        stringResource(R.string.verify_email_resend)
                    },
                    style = MaterialTheme.typography.bodyMedium
                )
            }

            Spacer(modifier = Modifier.height(24.dp))

            TextButton(
                onClick = {
                    viewModel.signOut()
                    onSignOut()
                }
            ) {
                Text(
                    text = stringResource(R.string.verify_email_sign_out),
                    style = MaterialTheme.typography.bodyMedium,
                    color = MaterialTheme.colorScheme.error
                )
            }
        }
    }
}
