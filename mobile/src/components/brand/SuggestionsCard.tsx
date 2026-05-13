import React from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { Text } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { SuggestionItem } from '../../models';
import { useIsDark, useThemeColors, Typography, BorderRadius } from '../../theme';
import { SalinoSurfaceCard } from './SurfaceCard';

interface HeroSuggestionsCardProps {
  title: string;
  subtitle: string;
  suggestions: SuggestionItem[];
  onSuggestionPress: (s: SuggestionItem) => void;
}

/** Matches Android HeroSuggestionsCard on shopping list. */
export function HeroSuggestionsCard({
  title,
  subtitle,
  suggestions,
  onSuggestionPress,
}: HeroSuggestionsCardProps) {
  const colors = useThemeColors();
  const isDark = useIsDark();

  return (
    <SalinoSurfaceCard padding={16} style={{ borderRadius: 30 }}>
      <View style={styles.headerRow}>
        <View
          style={[
            styles.iconBox,
            { backgroundColor: `${colors.tertiary}26`, borderRadius: 12 },
          ]}
        >
          <MaterialCommunityIcons name="creation" size={24} color={colors.tertiary} />
        </View>
        <View style={{ flex: 1, gap: 4 }}>
          <Text
            style={[
              Typography.titleMedium,
              { color: colors.onSurface, fontWeight: '700' } as any,
            ]}
          >
            {title}
          </Text>
          <Text style={[Typography.bodySmall, { color: colors.onSurfaceVariant, lineHeight: 16 }]}>
            {subtitle}
          </Text>
        </View>
      </View>
      {suggestions.length > 0 && (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.chipsRow}
          style={{ marginTop: 16, flexGrow: 0 }}
        >
          {suggestions.map((s) => (
            <Pressable
              key={s.id}
              onPress={() => onSuggestionPress(s)}
              style={({ pressed }) => [
                styles.chip,
                {
                  backgroundColor: `${colors.primaryContainer}${isDark ? '59' : '99'}`,
                  borderRadius: 50,
                  opacity: pressed ? 0.7 : 1,
                },
              ]}
            >
              <MaterialCommunityIcons name="plus" size={16} color={colors.primary} />
              <Text
                style={[
                  Typography.labelMedium,
                  { color: colors.primary, fontWeight: '600' } as any,
                ]}
              >
                {s.name}
              </Text>
            </Pressable>
          ))}
        </ScrollView>
      )}
    </SalinoSurfaceCard>
  );
}

const styles = StyleSheet.create({
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  iconBox: {
    width: 48,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chipsRow: {
    flexDirection: 'row',
    gap: 8,
    paddingRight: 8,
    alignItems: 'center',
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
});
