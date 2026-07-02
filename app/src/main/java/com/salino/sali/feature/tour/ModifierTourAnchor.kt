package com.salino.sali.feature.tour

import androidx.compose.foundation.border
import androidx.compose.material3.MaterialTheme
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.composed
import androidx.compose.ui.layout.boundsInWindow
import androidx.compose.ui.layout.onGloballyPositioned
import androidx.compose.ui.unit.dp
import androidx.compose.ui.zIndex
import androidx.lifecycle.compose.collectAsStateWithLifecycle

@Composable
fun Modifier.tourAnchor(id: TourAnchorId): Modifier = composed {
    val tourViewModel = LocalTourViewModel.current
    val uiState by tourViewModel.uiState.collectAsStateWithLifecycle()
    val registry = tourViewModel.anchorRegistry
    val highlighted = uiState.activeAnchorId == id
    val primary = MaterialTheme.colorScheme.primary

    this
        .onGloballyPositioned { coordinates ->
            registry.updateBounds(id, coordinates.boundsInWindow())
        }
        .then(
            if (highlighted) {
                Modifier
                    .zIndex(10f)
                    .border(width = 2.5.dp, color = primary)
            } else {
                Modifier
            }
        )
}
