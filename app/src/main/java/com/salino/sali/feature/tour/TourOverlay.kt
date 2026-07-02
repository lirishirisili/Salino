package com.salino.sali.feature.tour

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.zIndex
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.salino.sali.R
import com.salino.sali.ui.components.SalinoPrimaryButton
import com.salino.sali.ui.components.SalinoSurfaceCard

private const val FAB_CLEARANCE_DP = 88

@Composable
fun TourOverlay(
    tourViewModel: TourViewModel,
    safeTopPadding: androidx.compose.ui.unit.Dp,
    safeBottomPadding: androidx.compose.ui.unit.Dp,
    modifier: Modifier = Modifier,
) {
    val uiState by tourViewModel.uiState.collectAsStateWithLifecycle()
    val overlay = uiState.overlay ?: return

    val bottomOffset = safeBottomPadding + FAB_CLEARANCE_DP.dp
    val topOffset = safeTopPadding + 16.dp

    Box(
        modifier = modifier
            .fillMaxSize()
            .zIndex(9999f),
    ) {
        Box(
            modifier = Modifier
                .fillMaxSize()
                .background(Color.Black.copy(alpha = 0.45f)),
        )

        val sheetModifier = when (overlay.sheetPlacement) {
            TourSheetPlacement.Top -> Modifier.padding(top = topOffset)
            TourSheetPlacement.Bottom -> Modifier.padding(bottom = bottomOffset)
        }

        SalinoSurfaceCard(
            modifier = Modifier
                .fillMaxWidth()
                .padding(horizontal = 16.dp)
                .then(sheetModifier)
                .align(
                    when (overlay.sheetPlacement) {
                        TourSheetPlacement.Top -> androidx.compose.ui.Alignment.TopCenter
                        TourSheetPlacement.Bottom -> androidx.compose.ui.Alignment.BottomCenter
                    }
                ),
        ) {
            Column(modifier = Modifier.padding(16.dp)) {
                Text(
                    text = overlay.stepLabel,
                    style = MaterialTheme.typography.labelMedium,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
                Spacer(modifier = Modifier.height(6.dp))
                Text(
                    text = overlay.title,
                    style = MaterialTheme.typography.titleLarge.copy(fontWeight = FontWeight.Bold),
                )
                Spacer(modifier = Modifier.height(8.dp))
                Text(
                    text = overlay.body,
                    style = MaterialTheme.typography.bodyMedium,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
                Spacer(modifier = Modifier.height(16.dp))
                SalinoPrimaryButton(
                    text = if (overlay.isLast) {
                        stringResource(R.string.tour_finish)
                    } else {
                        stringResource(R.string.tour_next)
                    },
                    onClick = { tourViewModel.onNext() },
                    modifier = Modifier.fillMaxWidth(),
                )
                TextButton(
                    onClick = { tourViewModel.onSkip() },
                    modifier = Modifier.fillMaxWidth(),
                ) {
                    Text(stringResource(R.string.tour_skip))
                }
            }
        }
    }
}
