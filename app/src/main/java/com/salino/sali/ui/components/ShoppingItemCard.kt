package com.salino.sali.ui.components

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.CheckCircle
import androidx.compose.material.icons.filled.ChevronRight
import androidx.compose.material.icons.outlined.Circle
import androidx.compose.material3.*
import androidx.compose.runtime.Composable
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextDecoration
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import com.salino.sali.R
import com.salino.sali.data.model.ItemCategory
import com.salino.sali.data.model.ItemUnit
import com.salino.sali.data.model.ShoppingItem
import com.salino.sali.ui.theme.SurfaceBrightDark
import com.salino.sali.util.formatQuantity

@Composable
fun ShoppingItemCard(
    item: ShoppingItem,
    onToggleBought: () -> Unit,
    onClick: () -> Unit,
    modifier: Modifier = Modifier
) {
    val isBought = item.isBought
    val isDark = isSystemInDarkTheme()

    // Cache computed values to avoid recalculation on recomposition
    val category = remember(item.category) { ItemCategory.fromString(item.category) }
    val unit = remember(item.unit) { ItemUnit.fromString(item.unit) }

    val containerColor = when {
        isBought && isDark -> MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.35f)
        isBought -> MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.5f)
        isDark -> SurfaceBrightDark
        else -> MaterialTheme.colorScheme.surface
    }

    val cardBorder = when {
        isBought -> null
        isDark -> BorderStroke(1.dp, MaterialTheme.colorScheme.outlineVariant.copy(alpha = 0.35f))
        else -> BorderStroke(1.dp, MaterialTheme.colorScheme.outlineVariant.copy(alpha = 0.4f))
    }

    Card(
        onClick = onClick,
        modifier = modifier.fillMaxWidth(),
        shape = MaterialTheme.shapes.medium,
        colors = CardDefaults.cardColors(
            containerColor = containerColor,
            contentColor = MaterialTheme.colorScheme.onSurface
        ),
        border = cardBorder,
        elevation = CardDefaults.cardElevation(
            defaultElevation = if (isBought) 0.dp else if (isDark) 1.dp else 2.dp
        )
    ) {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(horizontal = 16.dp, vertical = 14.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            // Toggle circle
            Surface(
                modifier = Modifier.size(44.dp),
                onClick = onToggleBought,
                shape = CircleShape,
                color = if (isBought) {
                    MaterialTheme.colorScheme.primary.copy(alpha = 0.15f)
                } else {
                    MaterialTheme.colorScheme.primaryContainer.copy(alpha = if (isDark) 0.3f else 0.55f)
                }
            ) {
                Box(contentAlignment = Alignment.Center) {
                    Icon(
                        imageVector = if (isBought) Icons.Filled.CheckCircle else Icons.Outlined.Circle,
                        contentDescription = if (isBought) {
                            stringResource(R.string.shopping_list_undo_bought)
                        } else {
                            stringResource(R.string.shopping_list_mark_bought)
                        },
                        tint = if (isBought) MaterialTheme.colorScheme.primary
                               else MaterialTheme.colorScheme.primary.copy(alpha = 0.7f),
                        modifier = Modifier.size(24.dp)
                    )
                }
            }

            Spacer(modifier = Modifier.width(14.dp))

            // Content
            Column(modifier = Modifier.weight(1f)) {
                Text(
                    text = item.name,
                    style = MaterialTheme.typography.titleMedium.copy(
                        fontWeight = if (isBought) FontWeight.Normal else FontWeight.SemiBold
                    ),
                    maxLines = 2,
                    overflow = TextOverflow.Ellipsis,
                    textDecoration = if (isBought) TextDecoration.LineThrough else null,
                    color = if (isBought) {
                        MaterialTheme.colorScheme.onSurface.copy(alpha = 0.45f)
                    } else {
                        MaterialTheme.colorScheme.onSurface
                    }
                )

                val secondaryParts = buildList {
                    if (item.quantity > 0) {
                        val qtyText = formatQuantity(item.quantity)
                        val unitText = unit?.let { stringResource(it.labelResId) }
                        add(if (unitText != null) "$qtyText $unitText" else qtyText)
                    }
                    if (item.note.isNotBlank()) {
                        add(item.note)
                    }
                }
                if (secondaryParts.isNotEmpty()) {
                    Spacer(modifier = Modifier.height(3.dp))
                    Text(
                        text = secondaryParts.joinToString(" · "),
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant.copy(alpha = 0.85f),
                        maxLines = 2,
                        overflow = TextOverflow.Ellipsis
                    )
                }

                val attribution = if (isBought && item.boughtByName != null) {
                    stringResource(R.string.shopping_list_bought_by, item.boughtByName)
                } else if (item.addedByName.isNotBlank()) {
                    stringResource(R.string.shopping_list_added_by, item.addedByName)
                } else null

                if (attribution != null) {
                    Spacer(modifier = Modifier.height(5.dp))
                    Text(
                        text = attribution,
                        style = MaterialTheme.typography.labelSmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant.copy(alpha = 0.65f)
                    )
                }
            }

            Spacer(modifier = Modifier.width(8.dp))

            // Category + chevron
            Column(
                horizontalAlignment = Alignment.End,
                verticalArrangement = Arrangement.spacedBy(8.dp)
            ) {
                CategoryChip(category = category)
                Icon(
                    imageVector = Icons.Default.ChevronRight,
                    contentDescription = null,
                    tint = MaterialTheme.colorScheme.onSurfaceVariant.copy(alpha = 0.4f),
                    modifier = Modifier.size(20.dp)
                )
            }
        }
    }
}
