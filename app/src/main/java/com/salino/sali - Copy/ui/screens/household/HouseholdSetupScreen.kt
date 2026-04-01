package com.salino.sali.ui.screens.household

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.*
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Groups
import androidx.compose.material.icons.filled.Key
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.salino.sali.R
import com.salino.sali.ui.components.BrandLogo
import com.salino.sali.ui.components.SalinoGradientBackground
import com.salino.sali.ui.components.SalinoPrimaryButton
import com.salino.sali.ui.components.SalinoSurfaceCard

@OptIn(ExperimentalMaterial3Api::class)
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

    val errorText = when (uiState.errorMessage) {
        "empty_name" -> stringResource(R.string.household_error_empty_name)
        "empty_code" -> stringResource(R.string.household_error_empty_code)
        "invalid_code" -> stringResource(R.string.household_error_invalid_code)
        "generic" -> stringResource(R.string.household_error_generic)
        null -> null
        else -> stringResource(R.string.household_error_generic)
    }

    SalinoGradientBackground {
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(24.dp),
            horizontalAlignment = Alignment.CenterHorizontally
        ) {
            Spacer(modifier = Modifier.height(28.dp))

            BrandLogo(iconSize = 72.dp, showWordmark = true, center = true)

            Spacer(modifier = Modifier.height(18.dp))

            Text(
                text = stringResource(R.string.household_setup_title),
                style = MaterialTheme.typography.headlineMedium,
                textAlign = TextAlign.Center
            )

            Spacer(modifier = Modifier.height(8.dp))

            Text(
                text = stringResource(R.string.household_setup_subtitle),
                style = MaterialTheme.typography.bodyMedium,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
                textAlign = TextAlign.Center
            )

            Spacer(modifier = Modifier.height(24.dp))

            SalinoSurfaceCard(modifier = Modifier.fillMaxWidth()) {
                TabRow(selectedTabIndex = selectedTab) {
                    Tab(
                        selected = selectedTab == 0,
                        onClick = {
                            selectedTab = 0
                            viewModel.clearError()
                        },
                        text = { Text(stringResource(R.string.household_create)) },
                        icon = { Icon(Icons.Default.Groups, contentDescription = null) }
                    )
                    Tab(
                        selected = selectedTab == 1,
                        onClick = {
                            selectedTab = 1
                            viewModel.clearError()
                        },
                        text = { Text(stringResource(R.string.household_join)) },
                        icon = { Icon(Icons.Default.Key, contentDescription = null) }
                    )
                }

                Spacer(modifier = Modifier.height(22.dp))

                when (selectedTab) {
                    0 -> CreateHouseholdTab(
                        name = householdName,
                        onNameChange = { householdName = it },
                        isLoading = uiState.isLoading,
                        error = errorText,
                        hint = stringResource(R.string.household_create_hint),
                        onSubmit = { viewModel.createHousehold(householdName) }
                    )
                    1 -> JoinHouseholdTab(
                        code = inviteCode,
                        onCodeChange = { inviteCode = it },
                        isLoading = uiState.isLoading,
                        error = errorText,
                        hint = stringResource(R.string.household_join_hint),
                        onSubmit = { viewModel.joinHousehold(inviteCode) }
                    )
                }
            }
        }
    }
}

@Composable
private fun CreateHouseholdTab(
    name: String,
    onNameChange: (String) -> Unit,
    isLoading: Boolean,
    error: String?,
    hint: String,
    onSubmit: () -> Unit
) {
    Column(
        modifier = Modifier.fillMaxWidth(),
        horizontalAlignment = Alignment.CenterHorizontally
    ) {
        Text(
            text = hint,
            style = MaterialTheme.typography.bodyMedium,
            color = MaterialTheme.colorScheme.onSurfaceVariant
        )

        Spacer(modifier = Modifier.height(16.dp))

        OutlinedTextField(
            value = name,
            onValueChange = onNameChange,
            label = { Text(stringResource(R.string.household_name_label)) },
            placeholder = { Text(stringResource(R.string.household_name_hint)) },
            modifier = Modifier.fillMaxWidth(),
            singleLine = true,
            enabled = !isLoading
        )

        if (error != null) {
            Spacer(modifier = Modifier.height(8.dp))
            Text(
                text = error,
                style = MaterialTheme.typography.bodySmall,
                color = MaterialTheme.colorScheme.error
            )
        }

        Spacer(modifier = Modifier.height(24.dp))

        SalinoPrimaryButton(
            text = if (isLoading) stringResource(R.string.household_creating) else stringResource(R.string.household_create_button),
            onClick = onSubmit,
            modifier = Modifier.fillMaxWidth(),
            enabled = !isLoading
        )
    }
}

@Composable
private fun JoinHouseholdTab(
    code: String,
    onCodeChange: (String) -> Unit,
    isLoading: Boolean,
    error: String?,
    hint: String,
    onSubmit: () -> Unit
) {
    Column(
        modifier = Modifier.fillMaxWidth(),
        horizontalAlignment = Alignment.CenterHorizontally
    ) {
        Text(
            text = hint,
            style = MaterialTheme.typography.bodyMedium,
            color = MaterialTheme.colorScheme.onSurfaceVariant
        )

        Spacer(modifier = Modifier.height(16.dp))

        OutlinedTextField(
            value = code,
            onValueChange = onCodeChange,
            label = { Text(stringResource(R.string.household_invite_code_label)) },
            placeholder = { Text(stringResource(R.string.household_invite_code_hint)) },
            modifier = Modifier.fillMaxWidth(),
            singleLine = true,
            enabled = !isLoading
        )

        if (error != null) {
            Spacer(modifier = Modifier.height(8.dp))
            Text(
                text = error,
                style = MaterialTheme.typography.bodySmall,
                color = MaterialTheme.colorScheme.error
            )
        }

        Spacer(modifier = Modifier.height(24.dp))

        SalinoPrimaryButton(
            text = if (isLoading) stringResource(R.string.household_joining) else stringResource(R.string.household_join_button),
            onClick = onSubmit,
            modifier = Modifier.fillMaxWidth(),
            enabled = !isLoading
        )
    }
}
