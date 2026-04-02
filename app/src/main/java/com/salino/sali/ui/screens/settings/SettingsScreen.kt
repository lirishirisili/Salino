package com.salino.sali.ui.screens.settings

import android.content.ClipData
import android.content.ClipboardManager
import android.content.Context
import android.content.Intent
import android.widget.Toast
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.automirrored.filled.ExitToApp
import androidx.compose.material.icons.filled.ContentCopy
import androidx.compose.material.icons.filled.Edit
import androidx.compose.material.icons.filled.Home
import androidx.compose.material.icons.filled.Share
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.salino.sali.R
import com.salino.sali.ui.components.BrandLogo
import com.salino.sali.ui.components.LoadingIndicator
import com.salino.sali.ui.components.SalinoGradientBackground
import com.salino.sali.ui.components.SalinoSurfaceCard

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun SettingsScreen(
    onNavigateBack: () -> Unit,
    onSignedOut: () -> Unit,
    onHouseholdLeft: () -> Unit,
    viewModel: SettingsViewModel = hiltViewModel()
) {
    val uiState by viewModel.uiState.collectAsStateWithLifecycle()
    val context = LocalContext.current
    var showSignOutDialog by remember { mutableStateOf(false) }

    LaunchedEffect(uiState.isSignedOut) {
        if (uiState.isSignedOut) onSignedOut()
    }

    LaunchedEffect(uiState.hasLeftHousehold) {
        if (uiState.hasLeftHousehold) onHouseholdLeft()
    }

    if (showSignOutDialog) {
        AlertDialog(
            onDismissRequest = { showSignOutDialog = false },
            title = { Text(stringResource(R.string.settings_sign_out)) },
            text = { Text(stringResource(R.string.settings_sign_out_confirm)) },
            confirmButton = {
                TextButton(onClick = {
                    showSignOutDialog = false
                    viewModel.signOut()
                }) {
                    Text(stringResource(R.string.yes))
                }
            },
            dismissButton = {
                TextButton(onClick = { showSignOutDialog = false }) {
                    Text(stringResource(R.string.no))
                }
            }
        )
    }

    if (uiState.showEditNameDialog) {
        var newName by remember { mutableStateOf(uiState.household?.name.orEmpty()) }
        AlertDialog(
            onDismissRequest = { viewModel.dismissEditNameDialog() },
            title = { Text(stringResource(R.string.settings_edit_household_name)) },
            text = {
                OutlinedTextField(
                    value = newName,
                    onValueChange = { newName = it },
                    label = { Text(stringResource(R.string.settings_household_name)) },
                    singleLine = true
                )
            },
            confirmButton = {
                TextButton(
                    onClick = { viewModel.updateHouseholdName(newName) },
                    enabled = newName.isNotBlank()
                ) {
                    Text(stringResource(R.string.ok))
                }
            },
            dismissButton = {
                TextButton(onClick = { viewModel.dismissEditNameDialog() }) {
                    Text(stringResource(R.string.cancel))
                }
            }
        )
    }

    if (uiState.showLeaveDialog) {
        AlertDialog(
            onDismissRequest = { viewModel.dismissLeaveDialog() },
            title = { Text(stringResource(R.string.settings_leave_household)) },
            text = { Text(stringResource(R.string.settings_leave_household_confirm)) },
            confirmButton = {
                TextButton(
                    onClick = { viewModel.leaveHousehold() },
                    colors = ButtonDefaults.textButtonColors(contentColor = MaterialTheme.colorScheme.error)
                ) {
                    Text(stringResource(R.string.yes))
                }
            },
            dismissButton = {
                TextButton(onClick = { viewModel.dismissLeaveDialog() }) {
                    Text(stringResource(R.string.no))
                }
            }
        )
    }

    SalinoGradientBackground {
        Scaffold(
            containerColor = androidx.compose.ui.graphics.Color.Transparent,
            topBar = {
                TopAppBar(
                    colors = TopAppBarDefaults.topAppBarColors(containerColor = androidx.compose.ui.graphics.Color.Transparent),
                    title = { Text(stringResource(R.string.settings_title)) },
                    navigationIcon = {
                        IconButton(onClick = onNavigateBack) {
                            Icon(
                                Icons.AutoMirrored.Filled.ArrowBack,
                                contentDescription = stringResource(R.string.cancel)
                            )
                        }
                    }
                )
            }
        ) { padding ->
            if (uiState.isLoading) {
                LoadingIndicator(modifier = Modifier.padding(padding))
                return@Scaffold
            }

            Column(
                modifier = Modifier
                    .fillMaxSize()
                    .padding(padding)
                    .consumeWindowInsets(padding)
                    .padding(16.dp)
                    .navigationBarsPadding()
                    .verticalScroll(rememberScrollState()),
                verticalArrangement = Arrangement.spacedBy(14.dp)
            ) {
                SalinoSurfaceCard(modifier = Modifier.fillMaxWidth()) {
                    Row(horizontalArrangement = Arrangement.spacedBy(14.dp), verticalAlignment = Alignment.CenterVertically) {
                        BrandLogo(iconSize = 58.dp)
                        Column {
                            Text(stringResource(R.string.settings_title), style = MaterialTheme.typography.headlineMedium)
                            Text(
                                text = stringResource(R.string.settings_profile_badge),
                                style = MaterialTheme.typography.bodyMedium,
                                color = MaterialTheme.colorScheme.onSurfaceVariant
                            )
                        }
                    }
                }

                uiState.household?.let { household ->
                    SalinoSurfaceCard(modifier = Modifier.fillMaxWidth()) {
                        Text(
                            text = stringResource(R.string.settings_household_section),
                            style = MaterialTheme.typography.titleLarge,
                            color = MaterialTheme.colorScheme.primary
                        )
                        Spacer(modifier = Modifier.height(14.dp))
                        ListItem(
                            headlineContent = { Text(stringResource(R.string.settings_household_name)) },
                            supportingContent = { Text(household.name) },
                            leadingContent = { Icon(Icons.Default.Home, contentDescription = null) },
                            trailingContent = {
                                IconButton(onClick = { viewModel.showEditNameDialog() }) {
                                    Icon(Icons.Default.Edit, contentDescription = stringResource(R.string.settings_edit_household_name))
                                }
                            }
                        )
                        HorizontalDivider()
                        ListItem(
                            headlineContent = { Text(stringResource(R.string.settings_invite_code)) },
                            supportingContent = { Text(uiState.inviteCode, style = MaterialTheme.typography.titleMedium) },
                            trailingContent = {
                                Row {
                                    IconButton(onClick = {
                                        val clipboard = context.getSystemService(Context.CLIPBOARD_SERVICE) as ClipboardManager
                                        clipboard.setPrimaryClip(ClipData.newPlainText("invite_code", uiState.inviteCode))
                                        Toast.makeText(context, context.getString(R.string.household_invite_code_copied), Toast.LENGTH_SHORT).show()
                                    }) {
                                        Icon(Icons.Default.ContentCopy, contentDescription = stringResource(R.string.copy))
                                    }
                                    IconButton(onClick = {
                                        val shareIntent = Intent(Intent.ACTION_SEND).apply {
                                            type = "text/plain"
                                            putExtra(Intent.EXTRA_TEXT, context.getString(R.string.settings_share_invite_message, uiState.inviteCode))
                                        }
                                        context.startActivity(Intent.createChooser(shareIntent, context.getString(R.string.share)))
                                    }) {
                                        Icon(Icons.Default.Share, contentDescription = stringResource(R.string.share))
                                    }
                                }
                            }
                        )
                        HorizontalDivider()
                        ListItem(
                            headlineContent = { Text(stringResource(R.string.settings_members)) },
                            supportingContent = {
                                Column {
                                    uiState.members.forEach { member ->
                                        Text(
                                            text = member.displayName.ifBlank { member.userId },
                                            style = MaterialTheme.typography.bodyMedium,
                                            modifier = Modifier.padding(vertical = 2.dp)
                                        )
                                    }
                                }
                            }
                        )
                        HorizontalDivider()
                        TextButton(
                            onClick = { viewModel.showLeaveDialog() },
                            modifier = Modifier.fillMaxWidth(),
                            colors = ButtonDefaults.textButtonColors(contentColor = MaterialTheme.colorScheme.error)
                        ) {
                            Icon(
                                Icons.AutoMirrored.Filled.ExitToApp,
                                contentDescription = null,
                                modifier = Modifier.size(18.dp)
                            )
                            Spacer(modifier = Modifier.width(8.dp))
                            Text(stringResource(R.string.settings_leave_household))
                        }
                    }
                }

                SalinoSurfaceCard(modifier = Modifier.fillMaxWidth()) {
                    Text(
                        text = stringResource(R.string.settings_account_section),
                        style = MaterialTheme.typography.titleLarge,
                        color = MaterialTheme.colorScheme.primary
                    )
                    Spacer(modifier = Modifier.height(14.dp))
                    uiState.user?.let { user ->
                        ListItem(
                            headlineContent = { Text(user.displayName) },
                            supportingContent = { Text(user.email) }
                        )
                    }
                    HorizontalDivider()
                    TextButton(
                        onClick = { showSignOutDialog = true },
                        modifier = Modifier.fillMaxWidth(),
                        colors = ButtonDefaults.textButtonColors(contentColor = MaterialTheme.colorScheme.error)
                    ) {
                        Text(stringResource(R.string.settings_sign_out))
                    }
                }

                Text(
                    text = stringResource(R.string.settings_version, "1.0.0"),
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant.copy(alpha = 0.6f),
                    modifier = Modifier.align(Alignment.CenterHorizontally)
                )
            }
        }
    }
}
