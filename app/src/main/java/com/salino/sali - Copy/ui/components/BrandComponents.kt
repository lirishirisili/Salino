package com.salino.sali.ui.components

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.BoxScope
import androidx.compose.foundation.layout.ColumnScope
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.drawWithCache
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import androidx.compose.foundation.Image
import com.salino.sali.R
import com.salino.sali.ui.theme.*

@Composable
fun SalinoGradientBackground(
    modifier: Modifier = Modifier,
    content: @Composable BoxScope.() -> Unit
) {
    val isDark = isSystemInDarkTheme()
    val bg = MaterialTheme.colorScheme.background
    val soft = if (isDark) SurfaceSoftDark else SurfaceSoft
    val mintGlow = if (isDark) GlowMintDark else GlowMint
    val peachGlow = if (isDark) GlowPeachDark else GlowPeach

    // Pre-compute gradient brush — avoids re-creating on each recomposition
    val gradientBrush = remember(bg, soft) {
        Brush.verticalGradient(colors = listOf(bg, soft, bg, soft, bg))
    }

    Box(
        modifier = modifier
            .fillMaxSize()
            .background(gradientBrush)
            .drawWithCache {
                val w = size.width
                val h = size.height
                onDrawBehind {
                    // Solid colored circles — cached, only redrawn on size change
                    drawCircle(color = mintGlow, radius = w * 0.38f, center = Offset(-w * 0.1f, -h * 0.02f))
                    drawCircle(color = peachGlow, radius = w * 0.36f, center = Offset(w * 1.1f, h * 0.04f))
                    drawCircle(color = peachGlow, radius = w * 0.30f, center = Offset(-w * 0.08f, h * 0.55f))
                    drawCircle(color = mintGlow, radius = w * 0.32f, center = Offset(w * 1.08f, h * 0.42f))
                    drawCircle(color = mintGlow, radius = w * 0.28f, center = Offset(w * 0.5f, h * 1.02f))
                }
            }
    ) {
        content()
    }
}

@Composable
fun BrandLogo(
    modifier: Modifier = Modifier,
    iconSize: Dp = 64.dp,
    showWordmark: Boolean = false,
    showTagline: Boolean = false,
    center: Boolean = false
) {
    val horizontalAlignment = if (center) Alignment.CenterHorizontally else Alignment.Start
    Column(
        modifier = modifier,
        horizontalAlignment = horizontalAlignment,
        verticalArrangement = Arrangement.Center
    ) {
        Surface(
            shape = CircleShape,
            color = MaterialTheme.colorScheme.surface,
            shadowElevation = 4.dp,
            tonalElevation = 2.dp
        ) {
            Image(
                painter = painterResource(R.drawable.ic_salino_launcher),
                contentDescription = stringResource(R.string.app_name),
                modifier = Modifier
                    .size(iconSize)
                    .padding((iconSize.value * 0.12f).dp)
            )
        }
        if (showWordmark) {
            Spacer(modifier = Modifier.height(14.dp))
            Text(
                text = stringResource(R.string.app_name),
                style = MaterialTheme.typography.headlineMedium,
                color = MaterialTheme.colorScheme.onBackground
            )
        }
        if (showTagline) {
            Spacer(modifier = Modifier.height(6.dp))
            Text(
                text = stringResource(R.string.brand_tagline),
                style = MaterialTheme.typography.bodyMedium,
                color = MaterialTheme.colorScheme.onSurfaceVariant
            )
        }
    }
}

@Composable
fun SalinoSurfaceCard(
    modifier: Modifier = Modifier,
    content: @Composable ColumnScope.() -> Unit
) {
    val isDark = isSystemInDarkTheme()
    val cardColor = if (isDark) SurfaceBrightDark else SurfaceBright
    val cardBorder = if (isDark) {
        BorderStroke(1.dp, MaterialTheme.colorScheme.outlineVariant.copy(alpha = 0.4f))
    } else null

    Card(
        modifier = modifier,
        shape = MaterialTheme.shapes.large,
        colors = CardDefaults.cardColors(
            containerColor = cardColor,
            contentColor = MaterialTheme.colorScheme.onSurface
        ),
        border = cardBorder,
        elevation = CardDefaults.cardElevation(
            defaultElevation = if (isDark) 1.dp else 4.dp
        )
    ) {
        Column(modifier = Modifier.padding(18.dp), content = content)
    }
}

@Composable
fun SalinoPrimaryButton(
    text: String,
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
    enabled: Boolean = true,
    loading: Boolean = false,
    leading: (@Composable () -> Unit)? = null
) {
    Button(
        onClick = onClick,
        modifier = modifier.height(54.dp),
        enabled = enabled,
        shape = MaterialTheme.shapes.medium,
        colors = ButtonDefaults.buttonColors(
            containerColor = MaterialTheme.colorScheme.primary,
            contentColor = MaterialTheme.colorScheme.onPrimary,
            disabledContainerColor = MaterialTheme.colorScheme.primary.copy(alpha = 0.45f)
        )
    ) {
        if (leading != null && !loading) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                leading()
                Spacer(modifier = Modifier.size(8.dp))
            }
        }
        Text(text = text, style = MaterialTheme.typography.labelLarge)
    }
}

@Composable
fun SalinoStatBadge(
    text: String,
    modifier: Modifier = Modifier
) {
    Surface(
        modifier = modifier,
        color = MaterialTheme.colorScheme.primaryContainer.copy(alpha = 0.7f),
        contentColor = MaterialTheme.colorScheme.primary,
        shape = CircleShape,
        tonalElevation = 0.dp
    ) {
        Text(
            text = text,
            modifier = Modifier.padding(horizontal = 14.dp, vertical = 7.dp),
            style = MaterialTheme.typography.labelMedium
        )
    }
}