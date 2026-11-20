import React, { useMemo, useState } from 'react';
import { FlatList, Pressable, StyleSheet, View, useWindowDimensions } from 'react-native';
import { Button, Chip, Dialog, Portal, Text, TextInput } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { RADIUS_OPTIONS_KM } from '../../hooks/usePriceCompareStore';
import { Typography, useThemeColors } from '../../theme';

/** Where to compare: the shopper's location (with a radius) or a chosen city. */
export function PriceLocationDialog({
  visible,
  cities,
  city,
  radiusKm,
  usingLocation,
  onUseLocation,
  onChooseCity,
  onRadius,
  onDismiss,
}: {
  visible: boolean;
  cities: string[];
  city: string | null;
  radiusKm: number;
  usingLocation: boolean;
  onUseLocation: () => void;
  onChooseCity: (city: string) => void;
  onRadius: (km: number) => void;
  onDismiss: () => void;
}) {
  const { t } = useTranslation();
  const colors = useThemeColors();
  const { height } = useWindowDimensions();
  const [query, setQuery] = useState('');

  const filtered = useMemo(() => {
    const q = query.trim();
    const list = q ? cities.filter((c) => c.includes(q)) : cities;
    return list.slice(0, 80);
  }, [cities, query]);

  return (
    <Portal>
      <Dialog visible={visible} onDismiss={onDismiss} style={{ maxHeight: height * 0.85 }}>
        <Dialog.Title style={Typography.titleMedium}>{t('prices_where_title')}</Dialog.Title>
        <Dialog.Content style={{ gap: 12, paddingBottom: 8 }}>
          <Button
            mode={usingLocation ? 'contained-tonal' : 'contained'}
            icon="crosshairs-gps"
            onPress={onUseLocation}
          >
            {t('prices_use_location')}
          </Button>
          {usingLocation && (
            <View>
              <Text style={[Typography.labelMedium, { color: colors.onSurfaceVariant, marginBottom: 6 } as any]}>
                {t('prices_radius')}
              </Text>
              <View style={styles.chips}>
                {RADIUS_OPTIONS_KM.map((km) => (
                  <Chip key={km} selected={km === radiusKm} showSelectedCheck={false} onPress={() => onRadius(km)}>
                    {t('prices_radius_km', { km })}
                  </Chip>
                ))}
              </View>
            </View>
          )}
          <Text style={[Typography.labelMedium, { color: colors.onSurfaceVariant } as any]}>{t('prices_or_city')}</Text>
          <TextInput
            mode="outlined"
            dense
            value={query}
            onChangeText={setQuery}
            placeholder={t('prices_city_search')}
            left={<TextInput.Icon icon="magnify" />}
          />
        </Dialog.Content>
        <Dialog.ScrollArea style={{ maxHeight: height * 0.35, paddingHorizontal: 0 }}>
          <FlatList
            data={filtered}
            keyExtractor={(c) => c}
            keyboardShouldPersistTaps="handled"
            renderItem={({ item }) => (
              <Pressable
                onPress={() => onChooseCity(item)}
                style={({ pressed }) => [styles.cityRow, pressed && { opacity: 0.6 }]}
              >
                <MaterialCommunityIcons
                  name={item === city ? 'map-marker-check' : 'map-marker-outline'}
                  size={20}
                  color={item === city ? colors.primary : colors.onSurfaceVariant}
                />
                <Text style={[Typography.bodyLarge, { color: colors.onSurface } as any]}>{item}</Text>
              </Pressable>
            )}
          />
        </Dialog.ScrollArea>
        <Dialog.Actions>
          <Button onPress={onDismiss}>{t('prices_close')}</Button>
        </Dialog.Actions>
      </Dialog>
    </Portal>
  );
}

const styles = StyleSheet.create({
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  cityRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 24, paddingVertical: 10 },
});
