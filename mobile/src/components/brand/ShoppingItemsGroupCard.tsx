import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Text } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { ShoppingItem, ItemCategory, ItemUnit } from '../../models';
import { useIsDark, useThemeColors, Typography, BorderRadius } from '../../theme';
import { CategoryChip } from './CategoryChip';

interface ShoppingItemsGroupCardProps {
  items: ShoppingItem[];
  onToggleBought: (item: ShoppingItem) => void;
  onItemPress: (item: ShoppingItem) => void;
  onDelete?: (item: ShoppingItem) => void;
}

/** Matches Android ShoppingItemsGroupCard — all items in one large rounded surface. */
function ShoppingItemsGroupCardComponent({
  items,
  onToggleBought,
  onItemPress,
  onDelete,
}: ShoppingItemsGroupCardProps) {
  const isDark = useIsDark();
  const colors = useThemeColors();
  if (items.length === 0) return null;

  return (
    <View
      style={[
        styles.shadowWrap,
        {
          borderRadius: 28,
          // Same ambient+spot pair as Android SalinoSurfaceCard.
          boxShadow: isDark
            ? '0px 1px 3px rgba(0,0,0,0.24), 0px 6px 12px rgba(0,0,0,0.16)'
            : '0px 1px 2px rgba(0,0,0,0.10), 0px 4px 8px rgba(0,0,0,0.06)',
        },
      ]}
    >
      <View
        style={[
          styles.card,
          {
            backgroundColor: isDark ? colors.surfaceBright : colors.surface,
            borderRadius: 28,
            borderWidth: 1,
            borderColor: isDark ? `${colors.outlineVariant}59` : `${colors.outlineVariant}66`,
          },
        ]}
      >
        {items.map((item, index) => (
          <View key={item.id}>
            {/* Pass the item + stable group-level handlers so memoized rows only
                re-render when their own item changes, not on every parent render. */}
            <ShoppingItemRow
              item={item}
              onToggleBought={onToggleBought}
              onPress={onItemPress}
              onDelete={onDelete}
              showDivider={index !== items.length - 1}
            />
          </View>
        ))}
      </View>
    </View>
  );
}

export const ShoppingItemsGroupCard = React.memo(ShoppingItemsGroupCardComponent);

const ShoppingItemRow = React.memo(function ShoppingItemRow({
  item,
  onToggleBought,
  onPress,
  onDelete,
  showDivider,
}: {
  item: ShoppingItem;
  onToggleBought: (item: ShoppingItem) => void;
  onPress: (item: ShoppingItem) => void;
  onDelete?: (item: ShoppingItem) => void;
  showDivider: boolean;
}) {
  const { t } = useTranslation();
  const colors = useThemeColors();
  const isDark = useIsDark();
  const isBought = item.status === 'BOUGHT';

  const handleToggle = () => onToggleBought(item);
  const handlePress = () => onPress(item);
  const handleDelete = onDelete ? () => onDelete(item) : undefined;

  const unitLabel = item.unit ? t(`unit_${(item.unit as string).toLowerCase()}`) : '';
  const qtyText = item.quantity > 0 ? formatQty(item.quantity) : '';

  return (
    <>
    <View style={styles.row}>
      {/* Left circular checkbox */}
      <Pressable onPress={handleToggle} hitSlop={8} style={styles.checkboxHit}>
        <View
          style={[
            styles.checkbox,
            {
              borderColor: `${colors.primary}F2`,
              backgroundColor: isBought
                ? isDark
                  ? `${colors.primary}33`
                  : `${colors.primary}24`
                : colors.surface,
            },
          ]}
        >
          {isBought && (
            <MaterialCommunityIcons name="check" size={18} color={colors.primary} />
          )}
        </View>
      </Pressable>

      {/* Middle content */}
      <Pressable onPress={handlePress} style={styles.middle}>
        <Text
          style={[
            Typography.titleMedium,
            {
              fontWeight: isBought ? '400' : '600',
              textDecorationLine: isBought ? 'line-through' : 'none',
              color: isBought ? `${colors.onSurface}73` : colors.onSurface,
            } as any,
          ]}
          numberOfLines={2}
        >
          {item.name}
        </Text>
        <View style={styles.metaRow}>
          {qtyText !== '' && (
            <Text style={[Typography.bodySmall, { color: colors.onSurfaceVariant }]}>
              {unitLabel ? `${qtyText} ${unitLabel}` : qtyText}
            </Text>
          )}
          {!isBought ? (
            <CategoryChip category={item.category as ItemCategory} />
          ) : item.boughtByName ? (
            <Text style={[Typography.bodySmall, { color: `${colors.onSurfaceVariant}d9` }]}>
              {t('shopping_list_bought_by', { name: item.boughtByName })}
            </Text>
          ) : null}
        </View>
      </Pressable>

      {/* Right delete */}
      {handleDelete && !isBought ? (
        <Pressable onPress={handleDelete} hitSlop={8} style={styles.deleteHit}>
          <Text style={{ fontSize: 19, color: `${colors.onSurfaceVariant}e6` }}>{'🗑️'}</Text>
        </Pressable>
      ) : (
        <View style={styles.deleteHit} />
      )}
    </View>
    {showDivider && (
      <View
        style={[
          styles.divider,
          { backgroundColor: isDark ? `${colors.outlineVariant}59` : `${colors.outlineVariant}99` },
        ]}
      />
    )}
    </>
  );
});

function formatQty(qty: number) {
  if (!isFinite(qty)) return '';
  if (qty === Math.floor(qty)) return String(Math.floor(qty));
  return String(Math.round(qty * 100) / 100);
}

const styles = StyleSheet.create({
  // Outer wrapper carries the boxShadow; inner card handles its own clipping.
  // Splitting them avoids the shadow being clipped by overflow:hidden on Android.
  shadowWrap: {
    width: '100%',
  },
  card: {
    width: '100%',
    overflow: 'hidden',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 76,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  checkboxHit: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkbox: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  middle: {
    flex: 1,
    paddingHorizontal: 8,
    justifyContent: 'center',
    minHeight: 56,
    gap: 5,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'wrap',
  },
  deleteHit: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  divider: {
    height: 1,
    marginHorizontal: 20,
  },
});
