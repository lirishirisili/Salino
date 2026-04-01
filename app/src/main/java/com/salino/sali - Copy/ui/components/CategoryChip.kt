package com.salino.sali.ui.components

import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.drawBehind
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.unit.dp
import com.salino.sali.data.model.ItemCategory
import com.salino.sali.ui.theme.*

@Composable
fun CategoryChip(
    category: ItemCategory,
    modifier: Modifier = Modifier
) {
    val chipColor = when (category) {
        ItemCategory.DAIRY -> CategoryDairy
        ItemCategory.VEGETABLES -> CategoryVegetables
        ItemCategory.FRUITS -> CategoryFruits
        ItemCategory.MEAT_FISH -> CategoryMeatFish
        ItemCategory.BAKERY -> CategoryBakery
        ItemCategory.CLEANING -> CategoryCleaning
        ItemCategory.PANTRY -> CategoryPantry
        ItemCategory.SNACKS -> CategorySnacks
        ItemCategory.BEVERAGES -> CategoryBeverages
        ItemCategory.PHARMACY -> CategoryPharmacy
        ItemCategory.OTHER -> CategoryOther
    }

    val isDark = isSystemInDarkTheme()
    val bgAlpha = if (isDark) 0.2f else 0.12f

    Surface(
        modifier = modifier,
        color = chipColor.copy(alpha = bgAlpha),
        contentColor = chipColor,
        shape = MaterialTheme.shapes.small
    ) {
        Row(
            modifier = Modifier.padding(horizontal = 10.dp, vertical = 6.dp),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(5.dp)
        ) {
            Box(
                modifier = Modifier
                    .size(7.dp)
                    .drawBehind { drawCircle(chipColor) }
            )
            Text(
                text = stringResource(category.labelResId),
                style = MaterialTheme.typography.labelSmall
            )
        }
    }
}
