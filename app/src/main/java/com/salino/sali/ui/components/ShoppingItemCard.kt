package com.salino.sali.ui.components

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.clickable
import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.ui.draw.shadow
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Check
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.Divider
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextDecoration
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.sp
import androidx.compose.ui.unit.dp
import com.salino.sali.R
import com.salino.sali.data.model.ItemCategory
import com.salino.sali.data.model.ItemUnit
import com.salino.sali.data.model.ShoppingItem
import com.salino.sali.ui.theme.SurfaceBrightDark
import com.salino.sali.util.formatQuantity

@Composable
fun ShoppingItemsGroupCard(
    items: List<ShoppingItem>,
    onToggleBought: (ShoppingItem) -> Unit,
    onItemClick: (ShoppingItem) -> Unit,
    onDeleteItem: ((ShoppingItem) -> Unit)? = null,
    modifier: Modifier = Modifier
) {
    if (items.isEmpty()) return

    val isDark = isSystemInDarkTheme()
    val cardShape = RoundedCornerShape(28.dp)
    val shadowColor = if (isDark) Color.Black.copy(alpha = 0.24f) else Color.Black.copy(alpha = 0.12f)
    Card(
        modifier = modifier
            .fillMaxWidth()
            .shadow(
                elevation = if (isDark) 6.dp else 8.dp,
                shape = cardShape,
                ambientColor = shadowColor,
                spotColor = shadowColor
            ),
        shape = cardShape,
        colors = CardDefaults.cardColors(
            containerColor = if (isDark) SurfaceBrightDark else MaterialTheme.colorScheme.surface
        ),
        border = BorderStroke(1.dp, MaterialTheme.colorScheme.outlineVariant.copy(alpha = if (isDark) 0.35f else 0.5f)),
        elevation = CardDefaults.cardElevation(defaultElevation = 0.dp)
    ) {
        Column {
            items.forEachIndexed { index, item ->
                ShoppingItemRow(
                    item = item,
                    onToggleBought = { onToggleBought(item) },
                    onClick = { onItemClick(item) },
                    onDelete = onDeleteItem?.let { { it(item) } }
                )
                if (index != items.lastIndex) {
                    Divider(
                        modifier = Modifier.padding(horizontal = 20.dp),
                        color = MaterialTheme.colorScheme.outlineVariant.copy(alpha = if (isDark) 0.35f else 0.6f)
                    )
                }
            }
        }
    }
}

@Composable
private fun ShoppingItemRow(
    item: ShoppingItem,
    onToggleBought: () -> Unit,
    onClick: () -> Unit,
    onDelete: (() -> Unit)?,
    modifier: Modifier = Modifier
) {
    val isBought = item.isBought
    val isDark = isSystemInDarkTheme()
    val deleteDescription = stringResource(R.string.shopping_list_delete)
    val category = remember(item.category) { ItemCategory.fromString(item.category) }
    val unit = remember(item.unit) { ItemUnit.fromString(item.unit) }

    Box(
        modifier = modifier
            .fillMaxWidth()
            .heightIn(min = 76.dp)
            .padding(horizontal = 12.dp, vertical = 10.dp)
    ) {
        Column(
            modifier = Modifier
                .align(Alignment.Center)
                .fillMaxWidth()
                .clickable(onClick = onClick)
                .padding(start = 48.dp, end = 44.dp, top = 2.dp, bottom = 2.dp),
            verticalArrangement = Arrangement.spacedBy(5.dp)
        ) {
            Text(
                text = item.name,
                style = MaterialTheme.typography.titleMedium.copy(
                    fontWeight = if (isBought) FontWeight.Normal else FontWeight.SemiBold
                ),
                maxLines = 2,
                overflow = TextOverflow.Ellipsis,
                textDecoration = if (isBought) TextDecoration.LineThrough else null,
                color = if (isBought) MaterialTheme.colorScheme.onSurface.copy(alpha = 0.45f)
                else MaterialTheme.colorScheme.onSurface
            )

            Row(
                horizontalArrangement = Arrangement.spacedBy(8.dp),
                verticalAlignment = Alignment.CenterVertically
            ) {
                if (item.quantity > 0) {
                    val qtyText = formatQuantity(item.quantity)
                    val unitText = unit?.let { stringResource(it.labelResId) }
                    Text(
                        text = if (unitText != null) "$qtyText $unitText" else qtyText,
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant
                    )
                }
                if (!isBought) {
                    CategoryChip(category = category)
                } else {
                    val boughtBy = item.boughtByName?.takeIf { it.isNotBlank() }
                    if (boughtBy != null) {
                        Text(
                            text = stringResource(R.string.shopping_list_bought_by, boughtBy),
                            style = MaterialTheme.typography.bodySmall,
                            color = MaterialTheme.colorScheme.onSurfaceVariant.copy(alpha = 0.85f)
                        )
                    }
                }
            }
        }

        Box(
            modifier = Modifier
                .size(40.dp)
                .align(Alignment.CenterStart)
                .clickable(onClick = onToggleBought),
            contentAlignment = Alignment.Center
        ) {
            Surface(
                modifier = Modifier.size(32.dp),
                shape = CircleShape,
                color = if (isBought) {
                    MaterialTheme.colorScheme.primary.copy(alpha = if (isDark) 0.2f else 0.14f)
                } else {
                    MaterialTheme.colorScheme.surface
                },
                border = BorderStroke(
                    width = 2.dp,
                    color = MaterialTheme.colorScheme.primary.copy(alpha = 0.95f)
                )
            ) {}
            if (isBought) {
                Icon(
                    imageVector = Icons.Default.Check,
                    contentDescription = stringResource(R.string.shopping_list_undo_bought),
                    tint = MaterialTheme.colorScheme.primary,
                    modifier = Modifier.size(18.dp)
                )
            }
        }

        // Draw trash button last so the middle text layer never blocks taps.
        Box(
            modifier = Modifier
                .size(36.dp)
                .align(Alignment.CenterEnd),
            contentAlignment = Alignment.Center
        ) {
            if (onDelete != null && !isBought) {
                IconButton(onClick = onDelete, modifier = Modifier.size(32.dp)) {
                    Text(
                        text = "\uD83D\uDDD1\uFE0F",
                        style = MaterialTheme.typography.titleMedium.copy(fontSize = 19.sp),
                        color = MaterialTheme.colorScheme.onSurfaceVariant.copy(alpha = 0.9f),
                        modifier = Modifier.semantics {
                            contentDescription = deleteDescription
                        }
                    )
                }
            }
        }
    }
}
