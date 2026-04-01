package com.salino.sali.ui.screens.activityfeed

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.consumeWindowInsets
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.navigationBarsPadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.filled.Timeline
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.material3.TopAppBar
import androidx.compose.material3.TopAppBarDefaults
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.salino.sali.R
import com.salino.sali.data.model.ActivityLog
import com.salino.sali.data.model.ActivityType
import com.salino.sali.ui.components.EmptyState
import com.salino.sali.ui.components.LoadingIndicator
import com.salino.sali.ui.components.SalinoGradientBackground
import com.salino.sali.ui.components.SalinoSurfaceCard
import com.salino.sali.util.formatTimestamp

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun ActivityFeedScreen(
    onNavigateBack: () -> Unit,
    viewModel: ActivityFeedViewModel = hiltViewModel()
) {
    val uiState by viewModel.uiState.collectAsStateWithLifecycle()

    SalinoGradientBackground {
        Scaffold(
            containerColor = androidx.compose.ui.graphics.Color.Transparent,
            topBar = {
                TopAppBar(
                    colors = TopAppBarDefaults.topAppBarColors(containerColor = androidx.compose.ui.graphics.Color.Transparent),
                    title = { Text(stringResource(R.string.activity_feed_title)) },
                    navigationIcon = {
                        IconButton(onClick = onNavigateBack) {
                            Icon(Icons.AutoMirrored.Filled.ArrowBack, contentDescription = stringResource(R.string.cancel))
                        }
                    }
                )
            }
        ) { padding ->
            when {
                uiState.isLoading -> LoadingIndicator(modifier = Modifier.padding(padding))
                uiState.entries.isEmpty() -> EmptyState(
                    icon = Icons.Default.Timeline,
                    title = stringResource(R.string.activity_feed_empty_title),
                    subtitle = stringResource(R.string.activity_feed_empty_subtitle),
                    modifier = Modifier.padding(padding)
                )
                else -> LazyColumn(
                    modifier = Modifier
                        .fillMaxSize()
                        .padding(padding)
                        .consumeWindowInsets(padding)
                        .navigationBarsPadding(),
                    contentPadding = PaddingValues(16.dp),
                    verticalArrangement = Arrangement.spacedBy(10.dp)
                ) {
                    items(uiState.entries, key = { it.id }) { entry ->
                        ActivityEntryCard(entry = entry)
                    }
                }
            }
        }
    }
}

@Composable
private fun ActivityEntryCard(entry: ActivityLog) {
    SalinoSurfaceCard(modifier = Modifier.fillMaxWidth()) {
        Text(
            text = activityTitle(entry),
            style = MaterialTheme.typography.titleMedium
        )
        Spacer(modifier = Modifier.height(4.dp))
        if (entry.actorDisplayName.isNotBlank()) {
            Text(
                text = entry.actorDisplayName,
                style = MaterialTheme.typography.bodyMedium,
                color = MaterialTheme.colorScheme.onSurfaceVariant
            )
        }
        if (entry.itemName.isNotBlank()) {
            Spacer(modifier = Modifier.height(4.dp))
            Text(
                text = entry.itemName,
                style = MaterialTheme.typography.bodyLarge,
                color = MaterialTheme.colorScheme.primary
            )
        }
        Spacer(modifier = Modifier.height(8.dp))
        Text(
            text = formatTimestamp(entry.createdAt?.toDate()),
            style = MaterialTheme.typography.bodySmall,
            color = MaterialTheme.colorScheme.onSurfaceVariant
        )
    }
}

@Composable
private fun activityTitle(entry: ActivityLog): String {
    return when (entry.type) {
        ActivityType.ITEM_ADDED.name -> stringResource(R.string.activity_type_item_added)
        ActivityType.ITEM_UPDATED.name -> stringResource(R.string.activity_type_item_updated)
        ActivityType.ITEM_BOUGHT.name -> stringResource(R.string.activity_type_item_bought)
        ActivityType.ITEM_RESTORED.name -> stringResource(R.string.activity_type_item_restored)
        ActivityType.ITEM_DELETED.name -> stringResource(R.string.activity_type_item_deleted)
        ActivityType.RECURRING_CREATED.name -> stringResource(R.string.activity_type_recurring_created)
        ActivityType.RECURRING_UPDATED.name -> stringResource(R.string.activity_type_recurring_updated)
        ActivityType.SUGGESTION_ACCEPTED.name -> stringResource(R.string.activity_type_suggestion_accepted)
        else -> stringResource(R.string.activity_feed_title)
    }
}
