package com.salino.sali.ui.components

import android.os.Build
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.border
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
import androidx.compose.foundation.layout.wrapContentSize
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
import androidx.compose.ui.draw.blur
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.drawBehind
import androidx.compose.ui.draw.drawWithCache
import androidx.compose.ui.draw.shadow
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.TileMode
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import androidx.compose.foundation.Image
import androidx.compose.ui.layout.ContentScale
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

    val blurGlowLayer = Build.VERSION.SDK_INT >= Build.VERSION_CODES.S

    Box(modifier = modifier.fillMaxSize()) {
        // Base vertical gradient (sharp)
        Box(
            Modifier
                .fillMaxSize()
                .background(gradientBrush)
        )
        // Soft radial glow blobs + optional blur (matches web layered radial-gradient feel)
        Box(
            Modifier
                .fillMaxSize()
                .then(if (blurGlowLayer) Modifier.blur(20.dp) else Modifier)
                .drawWithCache {
                    val w = size.width
                    val h = size.height
                    onDrawBehind {
                        fun glow(center: Offset, radius: Float, core: Color) {
                            drawCircle(
                                brush = Brush.radialGradient(
                                    colors = listOf(core, Color.Transparent),
                                    center = center,
                                    radius = radius,
                                    tileMode = TileMode.Clamp
                                ),
                                radius = radius,
                                center = center
                            )
                        }
                        glow(Offset(-w * 0.1f, -h * 0.02f), w * 0.42f, mintGlow)
                        glow(Offset(w * 1.1f, h * 0.04f), w * 0.40f, peachGlow)
                        glow(Offset(-w * 0.08f, h * 0.55f), w * 0.34f, peachGlow)
                        glow(Offset(w * 1.08f, h * 0.42f), w * 0.36f, mintGlow)
                        glow(Offset(w * 0.5f, h * 1.02f), w * 0.32f, mintGlow)
                    }
                }
        )
        Box(Modifier.fillMaxSize()) {
            content()
        }
    }
}

@Composable
fun BrandLogo(
    modifier: Modifier = Modifier,
    iconSize: Dp = 64.dp,
    showWordmark: Boolean = false,
    showTagline: Boolean = false,
    center: Boolean = false,
    /** Soft radial halo behind the circle (matches web brand-logo glow). */
    showGlow: Boolean = true,
    surfaceShadowElevation: Dp = 4.dp
) {
    val horizontalAlignment = if (center) Alignment.CenterHorizontally else Alignment.Start
    val textModifier = if (center) Modifier.fillMaxWidth() else Modifier
    val textAlign = if (center) TextAlign.Center else TextAlign.Start
    val primary = MaterialTheme.colorScheme.primary
    val tertiary = MaterialTheme.colorScheme.tertiary
    val rimColor = Color.White.copy(alpha = 0.33f)

    Column(
        modifier = modifier,
        horizontalAlignment = horizontalAlignment,
        verticalArrangement = Arrangement.Center
    ) {
        Box(
            modifier = Modifier.wrapContentSize(),
            contentAlignment = Alignment.Center
        ) {
            if (showGlow) {
                val halo = iconSize * 1.72f
                Box(
                    Modifier
                        .size(halo)
                        .drawBehind {
                            val glowCenter = Offset(size.width / 2f, size.height / 2f)
                            val r = size.minDimension / 2f
                            drawCircle(
                                brush = Brush.radialGradient(
                                    0f to primary.copy(alpha = 0.38f),
                                    0.38f to tertiary.copy(alpha = 0.22f),
                                    0.62f to tertiary.copy(alpha = 0.08f),
                                    1f to Color.Transparent,
                                    center = glowCenter,
                                    radius = r,
                                    tileMode = TileMode.Clamp
                                ),
                                radius = r,
                                center = glowCenter
                            )
                        }
                )
            }
            // Full-bleed vector inside circle (no white Surface): Crop fills disc; launcher art already has teal gradient.
            Box(
                modifier = Modifier
                    .size(iconSize)
                    .shadow(
                        elevation = surfaceShadowElevation,
                        shape = CircleShape,
                        ambientColor = primary.copy(alpha = 0.14f),
                        spotColor = primary.copy(alpha = 0.30f),
                        clip = false
                    )
                    .clip(CircleShape)
                    .border(BorderStroke(1.dp, rimColor), CircleShape)
            ) {
                Image(
                    painter = painterResource(R.drawable.ic_salino_launcher),
                    contentDescription = stringResource(R.string.app_name),
                    modifier = Modifier.fillMaxSize(),
                    contentScale = ContentScale.Crop
                )
            }
        }
        if (showWordmark) {
            Spacer(modifier = Modifier.height(14.dp))
            Text(
                text = stringResource(R.string.app_name),
                style = MaterialTheme.typography.headlineMedium,
                color = MaterialTheme.colorScheme.onBackground,
                textAlign = textAlign,
                modifier = textModifier
            )
        }
        if (showTagline) {
            Spacer(modifier = Modifier.height(6.dp))
            Text(
                text = stringResource(R.string.brand_tagline),
                style = MaterialTheme.typography.bodyMedium,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
                textAlign = textAlign,
                modifier = textModifier
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
    val cardShape = MaterialTheme.shapes.large
    val shadowColor = if (isDark) Color.Black.copy(alpha = 0.24f) else Color.Black.copy(alpha = 0.1f)
    val cardBorder = if (isDark) {
        BorderStroke(1.dp, MaterialTheme.colorScheme.outlineVariant.copy(alpha = 0.4f))
    } else null

    Card(
        modifier = modifier.shadow(
            elevation = if (isDark) 6.dp else 8.dp,
            shape = cardShape,
            ambientColor = shadowColor,
            spotColor = shadowColor
        ),
        shape = cardShape,
        colors = CardDefaults.cardColors(
            containerColor = cardColor,
            contentColor = MaterialTheme.colorScheme.onSurface
        ),
        border = cardBorder,
        elevation = CardDefaults.cardElevation(defaultElevation = 0.dp)
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