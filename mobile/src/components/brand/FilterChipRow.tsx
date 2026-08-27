import React from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { Text } from 'react-native-paper';
import { useTranslation } from 'react-i18next';
import { ItemCategory } from '../../models';
import { useThemeColors, Typography } from '../../theme';

interface CategoryFilterRowProps {
  selectedCategory: ItemCategory | null;
  onSelect: (category: ItemCategory | null) => void;
}

const CATEGORIES = Object.values(ItemCategory);

export function CategoryFilterRow({ selectedCategory, onSelect }: CategoryFilterRowProps) {
  const { t } = useTranslation();
  const colors = useThemeColors();

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      style={styles.scroll}
      contentContainerStyle={styles.row}
    >
      <Chip
        selected={selectedCategory === null}
        label={t('category_all')}
        onPress={() => onSelect(null)}
        colors={colors}
      />
      {CATEGORIES.map((cat) => (
        <Chip
          key={cat}
          selected={selectedCategory === cat}
          label={t(`category_${cat.toLowerCase()}`)}
          onPress={() => onSelect(cat)}
          colors={colors}
        />
      ))}
    </ScrollView>
  );
}

function Chip({
  selected,
  label,
  onPress,
  colors,
}: {
  selected: boolean;
  label: string;
  onPress: () => void;
  colors: any;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.chip,
        {
          backgroundColor: selected ? colors.primary : colors.surface,
          borderColor: colors.outlineVariant,
          opacity: pressed ? 0.85 : 1,
        },
      ]}
    >
      <Text
        style={[
          Typography.labelMedium,
          {
            color: selected ? colors.onPrimary : colors.onSurface,
            fontWeight: '600',
          } as any,
        ]}
      >
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  // Prevent horizontal ScrollView from expanding vertically inside a flex parent,
  // which would otherwise stretch chips into tall pills via default cross-axis alignment.
  scroll: {
    flexGrow: 0,
    flexShrink: 0,
  },
  row: {
    paddingVertical: 6,
    paddingHorizontal: 2,
    gap: 8,
    alignItems: 'center',
  },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 50,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
