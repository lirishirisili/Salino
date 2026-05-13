import React from 'react';
import { StyleSheet, View } from 'react-native';
import { Text } from 'react-native-paper';
import { useTranslation } from 'react-i18next';
import { ItemCategory } from '../../models';
import { CategoryColors, BorderRadius, Typography, useIsDark } from '../../theme';

interface CategoryChipProps {
  category: ItemCategory;
}

export function CategoryChip({ category }: CategoryChipProps) {
  const { t } = useTranslation();
  const isDark = useIsDark();
  const color = CategoryColors[category];
  const bgAlpha = isDark ? '33' : '1f'; // 0.2 / 0.12

  return (
    <View
      style={[
        styles.chip,
        {
          backgroundColor: `${color}${bgAlpha}`,
          borderRadius: BorderRadius.small,
        },
      ]}
    >
      <View style={[styles.dot, { backgroundColor: color }]} />
      <Text style={[Typography.labelSmall, { color }]}>
        {t(`category_${category.toLowerCase()}`)}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 6,
    gap: 5,
    alignSelf: 'flex-start',
  },
  dot: {
    width: 7,
    height: 7,
    borderRadius: 4,
  },
});
