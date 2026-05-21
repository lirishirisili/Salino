package com.salino.sali.ui.screens.household

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.text.KeyboardActions
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.text.input.KeyboardCapitalization
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.salino.sali.R
import com.salino.sali.ui.components.BrandLogo
import com.salino.sali.ui.components.SalinoGradientBackground
import com.salino.sali.ui.components.SalinoPrimaryButton
import com.salino.sali.ui.components.SalinoWebSegmentedTabs
import com.salino.sali.ui.components.SalinoWebTokens
import com.salino.sali.ui.components.onboarding.HouseholdCreatedOnboardingFlow
import com.salino.sali.ui.components.onboarding.HouseholdJoinedOnboardingFlow
import com.salino.sali.ui.components.salinoWebOutlinedFieldColors

@OptIn(androidx.compose.material3.ExperimentalMaterial3Api::class)
@Composable
fun HouseholdSetupScreen(
    onHouseholdReady: () -> Unit,
    viewModel: HouseholdSetupViewModel = hiltViewModel()
) {
    val uiState by viewModel.uiState.collectAsStateWithLifecycle()
    var selectedTab by remember { mutableIntStateOf(0) }
    var householdName by remember { mutableStateOf("") }
    var inviteCode by remember { mutableStateOf("") }

    LaunchedEffect(uiState.isComplete) {
        if (uiState.isComplete) {
            onHouseholdReady()
        }
    }

    when (uiState.activeGuide) {
        HouseholdSetupGuide.CREATED -> {
            val code = uiState.inviteCode
            if (code != null) {
                HouseholdCreatedOnboardingFlow(
                    inviteCode = code,
                    onComplete = { viewModel.completeCreatedGuide() }
                )
                return
            }
        }
        HouseholdSetupGuide.JOINED -> {
            HouseholdJoinedOnboardingFlow(
                onComplete = { viewModel.completeJoinedGuide() }
            )
            return
        }
        HouseholdSetupGuide.NONE -> Unit
    }

    val errorText = when (uiState.errorMessage) {
        "empty_name" -> stringResource(R.string.household_error_empty_name)
        "empty_code" -> stringResource(R.string.household_error_empty_code)
        "invalid_code" -> stringResource(R.string.household_error_invalid_code)
        "generic" -> stringResource(R.string.household_error_generic)
        null -> null
        else -> stringResource(R.string.household_error_generic)
    }

    val tabLabels = listOf(
        stringResource(R.string.household_create),
        stringResource(R.string.household_join)
    )

    SalinoGradientBackground {
        Box(
            modifier = Modifier.fillMaxSize(),
            contentAlignment = Alignment.Center
        ) {
            Column(
                modifier = Modifier
                    .fillMaxSize()
                    .verticalScroll(rememberScrollState())
                    .padding(horizontal = SalinoWebTokens.HorizontalPadding)
                    .widthIn(max = SalinoWebTokens.MaxContentWidth),
                horizontalAlignment = Alignment.CenterHorizontally,
                verticalArrangement = Arrangement.Center
            ) {
            Spacer(modifier = Modifier.height(24.dp))

            BrandLogo(iconSize = 96.dp, showWordmark = false)

            Spacer(modifier = Modifier.height(16.dp))

            Text(
                text = stringResource(R.string.household_setup_title),
                style = MaterialTheme.typography.headlineMedium.copy(
                    fontSize = 28.sp,
                    fontWeight = FontWeight.Bold
                ),
                textAlign = TextAlign.Center,
                modifier = Modifier.fillMaxWidth()
            )

            Spacer(modifier = Modifier.height(8.dp))

            Text(
                text = stringResource(R.string.household_setup_subtitle),
                style = MaterialTheme.typography.bodyMedium,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
                textAlign = TextAlign.Center,
                modifier = Modifier
                    .widthIn(max = 320.dp)
                    .padding(top = 4.dp)
            )

            Spacer(modifier = Modifier.height(24.dp))

            SalinoWebSegmentedTabs(
                labels = tabLabels,
                selectedIndex = selectedTab,
                onSelect = { index ->
                    selectedTab = index
                    viewModel.clearError()
                }
            )

            Spacer(modifier = Modifier.height(20.dp))

            if (errorText != null) {
                Text(
                    text = errorText,
                    style = MaterialTheme.typography.bodyMedium,
                    color = MaterialTheme.colorScheme.error,
                    textAlign = TextAlign.Center,
                    modifier = Modifier.fillMaxWidth()
                )
                Spacer(modifier = Modifier.height(16.dp))
            }

            when (selectedTab) {
                0 -> CreateHouseholdTab(
                    name = householdName,
                    onNameChange = { householdName = it },
                    isLoading = uiState.isLoading,
                    hint = stringResource(R.string.household_create_hint),
                    onSubmit = { viewModel.createHousehold(householdName) }
                )
                else -> JoinHouseholdTab(
                    code = inviteCode,
                    onCodeChange = { raw ->
                        inviteCode = raw.uppercase().filter { it.isLetterOrDigit() }.take(8)
                    },
                    isLoading = uiState.isLoading,
                    hint = stringResource(R.string.household_join_hint),
                    onSubmit = { viewModel.joinHousehold(inviteCode) }
                )
            }

            Spacer(modifier = Modifier.height(32.dp))
            }
        }
    }
}

@Composable
private fun CreateHouseholdTab(
    name: String,
    onNameChange: (String) -> Unit,
    isLoading: Boolean,
    hint: String,
    onSubmit: () -> Unit
) {
    Column(
        modifier = Modifier.fillMaxWidth(),
        verticalArrangement = Arrangement.spacedBy(16.dp),
        horizontalAlignment = Alignment.CenterHorizontally
    ) {
        Text(
            text = hint,
            style = MaterialTheme.typography.bodyMedium,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
            textAlign = TextAlign.Center,
            modifier = Modifier.fillMaxWidth()
        )

        Column(modifier = Modifier.fillMaxWidth()) {
            Text(
                text = stringResource(R.string.household_name_label),
                style = MaterialTheme.typography.labelMedium,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
                modifier = Modifier.padding(bottom = 6.dp)
            )
            OutlinedTextField(
                value = name,
                onValueChange = onNameChange,
                placeholder = { Text(stringResource(R.string.household_name_hint)) },
                modifier = Modifier.fillMaxWidth(),
                singleLine = true,
                enabled = !isLoading,
                shape = SalinoWebTokens.InputCorner,
                colors = salinoWebOutlinedFieldColors(),
                keyboardOptions = KeyboardOptions(
                    imeAction = ImeAction.Done,
                    capitalization = KeyboardCapitalization.Words
                ),
                keyboardActions = KeyboardActions(onDone = { onSubmit() })
            )
        }

        SalinoPrimaryButton(
            text = if (isLoading) stringResource(R.string.household_creating) else stringResource(R.string.household_create_button),
            onClick = onSubmit,
            modifier = Modifier.fillMaxWidth(),
            enabled = !isLoading && name.isNotBlank()
        )
    }
}

@Composable
private fun JoinHouseholdTab(
    code: String,
    onCodeChange: (String) -> Unit,
    isLoading: Boolean,
    hint: String,
    onSubmit: () -> Unit
) {
    Column(
        modifier = Modifier.fillMaxWidth(),
        verticalArrangement = Arrangement.spacedBy(16.dp),
        horizontalAlignment = Alignment.CenterHorizontally
    ) {
        Text(
            text = hint,
            style = MaterialTheme.typography.bodyMedium,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
            textAlign = TextAlign.Center,
            modifier = Modifier.fillMaxWidth()
        )

        Column(modifier = Modifier.fillMaxWidth()) {
            Text(
                text = stringResource(R.string.household_invite_code_label),
                style = MaterialTheme.typography.labelMedium,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
                modifier = Modifier.padding(bottom = 6.dp)
            )
            OutlinedTextField(
                value = code,
                onValueChange = onCodeChange,
                placeholder = { Text(stringResource(R.string.household_invite_code_hint)) },
                modifier = Modifier.fillMaxWidth(),
                singleLine = true,
                enabled = !isLoading,
                shape = SalinoWebTokens.InputCorner,
                colors = salinoWebOutlinedFieldColors(),
                textStyle = MaterialTheme.typography.headlineSmall.copy(
                    fontWeight = FontWeight.Bold,
                    letterSpacing = 4.sp,
                    textAlign = TextAlign.Center
                ),
                keyboardOptions = KeyboardOptions(
                    keyboardType = KeyboardType.Text,
                    imeAction = ImeAction.Done,
                    capitalization = KeyboardCapitalization.Characters
                ),
                keyboardActions = KeyboardActions(onDone = { onSubmit() })
            )
        }

        SalinoPrimaryButton(
            text = if (isLoading) stringResource(R.string.household_joining) else stringResource(R.string.household_join_button),
            onClick = onSubmit,
            modifier = Modifier.fillMaxWidth(),
            enabled = !isLoading && code.length >= 6
        )
    }
}
