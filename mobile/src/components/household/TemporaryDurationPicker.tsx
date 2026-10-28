import React, { useMemo, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Text } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { I18nManager } from 'react-native';
import { Typography, useThemeColors } from '../../theme';
import {
  TEMP_DURATION_PRESETS,
  clampTempEndDate,
  endOfDayInDays,
  formatEndDate,
  maxTempEndDate,
} from '../../utils/householdExpiry';

type Selection = { kind: 'preset'; days: number } | { kind: 'date' };

interface TemporaryDurationPickerProps {
  /** Chosen end moment (end of the chosen local day). */
  value: Date;
  onChange: (date: Date) => void;
  /** Preset that `value` was initialised from; omit to start on the calendar. */
  initialPresetDays?: number;
}

/**
 * Quick lengths (3 days … a month) plus an inline calendar for a custom end date.
 * Every choice is clamped to today … MAX_TEMP_DAYS ahead.
 */
export function TemporaryDurationPicker({ value, onChange, initialPresetDays }: TemporaryDurationPickerProps) {
  const { t, i18n } = useTranslation();
  const colors = useThemeColors();
  const [selection, setSelection] = useState<Selection>(
    initialPresetDays != null ? { kind: 'preset', days: initialPresetDays } : { kind: 'date' }
  );

  return (
    <View>
      <View style={styles.chipRow}>
        {TEMP_DURATION_PRESETS.map((p) => (
          <DurationChip
            key={p.days}
            label={t(p.labelKey)}
            selected={selection.kind === 'preset' && selection.days === p.days}
            onPress={() => {
              setSelection({ kind: 'preset', days: p.days });
              onChange(endOfDayInDays(p.days));
            }}
          />
        ))}
        <DurationChip
          label={t('household_temp_pick_date')}
          icon="calendar-month"
          selected={selection.kind === 'date'}
          onPress={() => setSelection({ kind: 'date' })}
        />
      </View>

      {selection.kind === 'date' && (
        <MiniCalendar value={value} onChange={(d) => onChange(clampTempEndDate(d))} />
      )}

      <View style={[styles.endRow, { backgroundColor: colors.surfaceSoft }]}>
        <MaterialCommunityIcons name="flag-checkered" size={18} color={colors.primary} />
        <Text style={[Typography.bodyMedium, { color: colors.onSurface, flex: 1 } as any]}>
          {t('household_temp_ends_on', { date: formatEndDate(value, i18n.language) })}
        </Text>
      </View>
    </View>
  );
}

function DurationChip({
  label,
  selected,
  onPress,
  icon,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
  icon?: keyof typeof MaterialCommunityIcons.glyphMap;
}) {
  const colors = useThemeColors();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected }}
      style={({ pressed }) => [
        styles.chip,
        {
          backgroundColor: selected ? colors.primary : colors.surface,
          borderColor: selected ? colors.primary : colors.outlineVariant,
          opacity: pressed ? 0.85 : 1,
        },
      ]}
    >
      {icon && (
        <MaterialCommunityIcons name={icon} size={16} color={selected ? colors.onPrimary : colors.onSurface} />
      )}
      <Text
        style={[
          Typography.labelLarge,
          { color: selected ? colors.onPrimary : colors.onSurface, fontWeight: '600' } as any,
        ]}
      >
        {label}
      </Text>
    </Pressable>
  );
}

function sameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

/** Month grid limited to today … max end date (Sunday-first weeks). */
function MiniCalendar({ value, onChange }: { value: Date; onChange: (d: Date) => void }) {
  const { i18n } = useTranslation();
  const colors = useThemeColors();
  const today = useMemo(() => endOfDayInDays(0), []);
  const max = useMemo(() => maxTempEndDate(), []);
  const [month, setMonth] = useState(() => new Date(value.getFullYear(), value.getMonth(), 1));

  const canPrev =
    month.getFullYear() > today.getFullYear() ||
    (month.getFullYear() === today.getFullYear() && month.getMonth() > today.getMonth());
  const canNext =
    month.getFullYear() < max.getFullYear() ||
    (month.getFullYear() === max.getFullYear() && month.getMonth() < max.getMonth());

  const weekdayLabels = useMemo(() => {
    // 2023-01-01 was a Sunday.
    return Array.from({ length: 7 }, (_, i) => {
      try {
        return new Date(2023, 0, 1 + i).toLocaleDateString(i18n.language, { weekday: 'narrow' });
      } catch {
        return 'SMTWTFS'[i];
      }
    });
  }, [i18n.language]);

  const cells = useMemo(() => {
    const first = new Date(month.getFullYear(), month.getMonth(), 1);
    const daysInMonth = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
    const out: (Date | null)[] = Array.from({ length: first.getDay() }, () => null);
    for (let d = 1; d <= daysInMonth; d++) {
      out.push(new Date(month.getFullYear(), month.getMonth(), d, 23, 59));
    }
    while (out.length % 7 !== 0) out.push(null);
    return out;
  }, [month]);

  let monthLabel: string;
  try {
    monthLabel = month.toLocaleDateString(i18n.language, { month: 'long', year: 'numeric' });
  } catch {
    monthLabel = `${month.getMonth() + 1}/${month.getFullYear()}`;
  }

  // Chevrons point "back"/"forward" in reading direction.
  const prevIcon = I18nManager.isRTL ? 'chevron-right' : 'chevron-left';
  const nextIcon = I18nManager.isRTL ? 'chevron-left' : 'chevron-right';

  return (
    <View style={[styles.calendar, { borderColor: colors.outlineVariant }]}>
      <View style={styles.calendarHeader}>
        <Pressable
          disabled={!canPrev}
          onPress={() => setMonth(new Date(month.getFullYear(), month.getMonth() - 1, 1))}
          hitSlop={8}
          style={{ opacity: canPrev ? 1 : 0.3 }}
        >
          <MaterialCommunityIcons name={prevIcon} size={24} color={colors.onSurface} />
        </Pressable>
        <Text style={[Typography.titleSmall, { color: colors.onSurface } as any]}>{monthLabel}</Text>
        <Pressable
          disabled={!canNext}
          onPress={() => setMonth(new Date(month.getFullYear(), month.getMonth() + 1, 1))}
          hitSlop={8}
          style={{ opacity: canNext ? 1 : 0.3 }}
        >
          <MaterialCommunityIcons name={nextIcon} size={24} color={colors.onSurface} />
        </Pressable>
      </View>
      <View style={styles.weekRow}>
        {weekdayLabels.map((w, i) => (
          <Text key={i} style={[styles.cellText, Typography.labelSmall, { color: colors.onSurfaceVariant } as any]}>
            {w}
          </Text>
        ))}
      </View>
      <View style={styles.grid}>
        {cells.map((d, i) => {
          if (!d) return <View key={i} style={styles.cell} />;
          const disabled = d.getTime() < today.getTime() - 1 || d.getTime() > max.getTime();
          const selected = sameDay(d, value);
          const isToday = sameDay(d, today);
          return (
            <Pressable
              key={i}
              disabled={disabled}
              onPress={() => onChange(d)}
              style={styles.cell}
              accessibilityRole="button"
              accessibilityState={{ selected, disabled }}
            >
              <View
                style={[
                  styles.dayBubble,
                  selected && { backgroundColor: colors.primary },
                  !selected && isToday && { borderWidth: 1, borderColor: colors.primary },
                ]}
              >
                <Text
                  style={[
                    Typography.bodyMedium,
                    {
                      color: selected ? colors.onPrimary : colors.onSurface,
                      opacity: disabled ? 0.3 : 1,
                      fontWeight: selected ? '700' : '400',
                    } as any,
                  ]}
                >
                  {d.getDate()}
                </Text>
              </View>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 50,
    borderWidth: 1,
  },
  endRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 12,
  },
  calendar: {
    marginTop: 12,
    borderWidth: 1,
    borderRadius: 16,
    padding: 10,
  },
  calendarHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 4,
    paddingBottom: 8,
  },
  weekRow: {
    flexDirection: 'row',
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  cell: {
    width: `${100 / 7}%`,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 2,
  },
  cellText: {
    width: `${100 / 7}%`,
    textAlign: 'center',
    paddingVertical: 4,
  },
  dayBubble: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
