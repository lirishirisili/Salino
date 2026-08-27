import React, { useEffect } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { Text } from 'react-native-paper';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { router } from 'expo-router';
import { useActivityStore, useHouseholdStore } from '../../src/hooks';
import {
  EmptyState,
  LoadingIndicator,
  SalinoGradientBackground,
  SalinoSurfaceCard,
  SalinoWebInnerTopBar,
} from '../../src/components';
import { Layout, Typography, useThemeColors } from '../../src/theme';
import { formatRelativeTime } from '../../src/utils';
import { ActivityLog } from '../../src/models';

export default function ActivityScreen() {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const colors = useThemeColors();
  const { logs, isLoading } = useActivityStore();
  const activeHouseholdId = useHouseholdStore((s) => s.activeHouseholdId);
  const subscribeActivity = useActivityStore((s) => s.subscribe);

  // Activity is only streamed while this screen is open (kept off cold start).
  useEffect(() => {
    if (!activeHouseholdId) return;
    const unsub = subscribeActivity(activeHouseholdId);
    return () => unsub();
  }, [activeHouseholdId, subscribeActivity]);

  return (
    <SalinoGradientBackground plain>
      <SalinoWebInnerTopBar title={t('activity_feed_title')} onBack={() => router.back()} />
      {isLoading ? (
        <LoadingIndicator />
      ) : logs.length === 0 ? (
        <View
          style={{
            flex: 1,
            alignSelf: 'center',
            width: '100%',
            maxWidth: Layout.maxContentWidth,
            paddingHorizontal: Layout.horizontalPadding,
          }}
        >
          <EmptyState
            icon="timeline-clock-outline"
            title={t('activity_feed_empty_title')}
            subtitle={t('activity_feed_empty_subtitle')}
          />
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={[
            styles.scroll,
            { paddingBottom: insets.bottom + 24 },
          ]}
        >
          <View style={styles.inner}>
            {logs.map((entry) => (
              <View key={entry.id} style={{ marginBottom: 10 }}>
                <ActivityCard entry={entry} />
              </View>
            ))}
          </View>
        </ScrollView>
      )}
    </SalinoGradientBackground>
  );
}

function ActivityCard({ entry }: { entry: ActivityLog }) {
  const { t } = useTranslation();
  const colors = useThemeColors();
  return (
    <SalinoSurfaceCard>
      <Text
        style={[
          Typography.titleMedium,
          { color: colors.onSurface } as any,
        ]}
      >
        {t(`activity_type_${entry.type.toLowerCase()}` as any, t('activity_feed_title'))}
      </Text>
      {entry.actorDisplayName ? (
        <Text
          style={[
            Typography.bodyMedium,
            { color: colors.onSurfaceVariant, marginTop: 4 } as any,
          ]}
        >
          {entry.actorDisplayName}
        </Text>
      ) : null}
      {entry.itemName ? (
        <Text
          style={[
            Typography.bodyLarge,
            { color: colors.primary, marginTop: 4 } as any,
          ]}
        >
          {entry.itemName}
        </Text>
      ) : null}
      <Text
        style={[
          Typography.bodySmall,
          { color: colors.onSurfaceVariant, marginTop: 8 } as any,
        ]}
      >
        {entry.createdAt ? formatRelativeTime(entry.createdAt.toMillis()) : ''}
      </Text>
    </SalinoSurfaceCard>
  );
}

const styles = StyleSheet.create({
  scroll: {
    flexGrow: 1,
    alignItems: 'center',
    paddingTop: 8,
  },
  inner: {
    width: '100%',
    maxWidth: Layout.maxContentWidth,
    paddingHorizontal: Layout.horizontalPadding,
  },
});
