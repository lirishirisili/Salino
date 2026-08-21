import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  FlatList,
  Image,
  Keyboard,
  LayoutChangeEvent,
  Pressable,
  ScrollView,
  StyleSheet,
  useWindowDimensions,
  View,
} from 'react-native';
import { Button, Dialog, Portal, Text } from 'react-native-paper';
import { MaterialCommunityIcons, MaterialIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Circle } from 'react-native-svg';
import { useTranslation } from 'react-i18next';
import { router } from 'expo-router';
import { useShoppingStore, useHouseholdStore } from '../../src/hooks';
import { useTourAnchor, useTourScroller, useTourStore } from '../../src/features/tour';
import {
  buildTourPreviewItems,
  buildTourPreviewSuggestions,
} from '../../src/features/tour/tourPreview';
import {
  BrandLogo,
  EmptyState,
  HeroSuggestionsCard,
  LoadingIndicator,
  SalinoGradientBackground,
  SalinoPrimaryButton,
  SalinoSectionTitle,
  SalinoSurfaceCard,
  SalinoWebAppBarTitle,
  ShoppingItemsGroupCard,
  CategoryFilterRow,
  ItemNameAutocompleteField,
} from '../../src/components';
import { ShoppingItem, ItemCategory, ItemUnit } from '../../src/models';
import { DuplicateReason, type DuplicateMatch } from '../../src/models';
import { AccentColors, Layout, Typography, useThemeColors, useIsDark } from '../../src/theme';
import { detectCategory, findDuplicate } from '../../src/services';
import { suggestAutocomplete } from '../../src/services/itemNameAutocompleteEngine';
import { warmUpCatalog } from '../../src/services/categoryKeywordCatalog';
import {
  AutocompleteSuggestion,
  HouseholdHistoryIndex,
} from '../../src/services/householdHistoryIndex';
import { isRTL } from '../../src/i18n';

const BOUGHT_ITEMS_PAGE_SIZE = 10;

export default function ShoppingListScreen() {
  const { height: windowHeight } = useWindowDimensions();
  const { t, i18n } = useTranslation();
  const insets = useSafeAreaInsets();
  const colors = useThemeColors();
  const isDark = useIsDark();
  const activeHouseholdId = useHouseholdStore((s) => s.activeHouseholdId);
  const {
    activeItems,
    boughtItems,
    suggestions,
    selectedCategory,
    setSelectedCategory,
    markAsBought,
    markAsActive,
    deleteItem,
    addItem,
    updateItem,
    recurringItems,
    hasReceivedRemoteSnapshot,
  } = useShoppingStore();

  const tourActive = useTourStore((s) => s.active);
  const tourOverlay = useTourStore((s) => s.overlay);

  const [boughtExpanded, setBoughtExpanded] = useState(false);
  const [boughtVisibleCount, setBoughtVisibleCount] = useState(BOUGHT_ITEMS_PAGE_SIZE);
  const [quickAddName, setQuickAddName] = useState('');
  const [quickAddSuggestions, setQuickAddSuggestions] = useState<AutocompleteSuggestion[]>([]);
  const [isQuickAddAutocompleteVisible, setIsQuickAddAutocompleteVisible] = useState(false);
  const [quickAddCategory, setQuickAddCategory] = useState<ItemCategory | null>(null);
  const [isQuickAdding, setIsQuickAdding] = useState(false);
  const [quickAddError, setQuickAddError] = useState<'empty_name' | 'generic' | null>(null);
  const [quickAddDuplicateDialog, setQuickAddDuplicateDialog] = useState<{
    duplicateMatch: DuplicateMatch;
    addQuantity: number;
    itemName: string;
    itemCategory: ItemCategory;
    itemUnit: ItemUnit | null;
  } | null>(null);
  const quickAddAutocompleteTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isHebrew = i18n.language === 'he';
  const isRtl = isRTL(i18n.language);

  const listRef = useRef<FlatList<number>>(null);
  const listContentRef = useRef<View>(null);
  useTourScroller('shopping-list', listRef, listContentRef, 'flat');

  const heroAnchor = useTourAnchor('list.hero');
  const filtersAnchor = useTourAnchor('list.filters');
  const addFabAnchor = useTourAnchor('list.addFab');
  const supermarketFabAnchor = useTourAnchor('list.supermarketFab');

  const sortedBoughtItems = useMemo(
    () =>
      [...boughtItems].sort(
        (a, b) =>
          (b.updatedAt?.toMillis() ?? b.createdAt?.toMillis() ?? 0) -
          (a.updatedAt?.toMillis() ?? a.createdAt?.toMillis() ?? 0),
      ),
    [boughtItems],
  );

  const visibleBoughtItems = useMemo(
    () => sortedBoughtItems.slice(0, boughtVisibleCount),
    [sortedBoughtItems, boughtVisibleCount],
  );

  const hasMoreBoughtItems = sortedBoughtItems.length > boughtVisibleCount;

  const quickAddHistoryIndex = useMemo(
    () => HouseholdHistoryIndex.from(activeItems, boughtItems, recurringItems),
    [activeItems, boughtItems, recurringItems],
  );

  useEffect(() => {
    warmUpCatalog();
    return () => {
      if (quickAddAutocompleteTimerRef.current) {
        clearTimeout(quickAddAutocompleteTimerRef.current);
      }
    };
  }, []);

  const refreshQuickAddAutocomplete = useCallback(
    (text: string) => {
      if (quickAddAutocompleteTimerRef.current) {
        clearTimeout(quickAddAutocompleteTimerRef.current);
      }
      quickAddAutocompleteTimerRef.current = setTimeout(() => {
        const trimmed = text.trim();
        if (!trimmed) {
          setQuickAddSuggestions([]);
          setIsQuickAddAutocompleteVisible(false);
          return;
        }
        const results = suggestAutocomplete(trimmed, quickAddHistoryIndex);
        setQuickAddSuggestions(results);
        setIsQuickAddAutocompleteVisible(results.length > 0);
      }, 80);
    },
    [quickAddHistoryIndex],
  );

  const handleQuickAddNameChange = useCallback(
    (text: string) => {
      setQuickAddName(text);
      setQuickAddCategory(null);
      setQuickAddError(null);
      refreshQuickAddAutocomplete(text);
    },
    [refreshQuickAddAutocomplete],
  );

  const performQuickAdd = useCallback(
    async (itemName: string, quantity: number, unit: ItemUnit | null, category: ItemCategory) => {
      if (!activeHouseholdId || isQuickAdding) return;
      setIsQuickAdding(true);
      setQuickAddError(null);
      try {
        await addItem(activeHouseholdId, {
          name: itemName,
          quantity,
          unit,
          category,
          note: '',
          isUrgent: false,
          isFavorite: false,
          boughtBy: null,
          boughtByName: null,
        });
        setQuickAddName('');
        setQuickAddCategory(null);
      } catch {
        setQuickAddError('generic');
      } finally {
        setIsQuickAdding(false);
      }
    },
    [activeHouseholdId, addItem, isQuickAdding],
  );

  const mergeQuickAddWithExisting = useCallback(
    async (existing: ShoppingItem, addQuantity: number) => {
      if (!activeHouseholdId || isQuickAdding) return;
      setIsQuickAdding(true);
      setQuickAddError(null);
      try {
        await updateItem(activeHouseholdId, {
          ...existing,
          quantity: existing.quantity + addQuantity,
        });
        setQuickAddName('');
        setQuickAddCategory(null);
      } catch {
        setQuickAddError('generic');
      } finally {
        setIsQuickAdding(false);
      }
    },
    [activeHouseholdId, isQuickAdding, updateItem],
  );

  const handleQuickAddSuggestionSelected = useCallback(
    (suggestion: AutocompleteSuggestion) => {
      if (quickAddAutocompleteTimerRef.current) {
        clearTimeout(quickAddAutocompleteTimerRef.current);
      }
      setQuickAddSuggestions([]);
      setIsQuickAddAutocompleteVisible(false);
      setQuickAddError(null);

      const itemName = suggestion.displayName.trim();
      if (!itemName || !activeHouseholdId || isQuickAdding) return;

      const itemCategory = suggestion.category
        ?? detectCategory(suggestion.displayName)
        ?? ItemCategory.OTHER;
      const itemQuantity = suggestion.quantity ?? 1;
      const itemUnit = suggestion.unit ?? null;

      const dup = findDuplicate(itemName, activeItems);
      if (dup && dup.reason === DuplicateReason.EXACT_DUPLICATE) {
        Keyboard.dismiss();
        setQuickAddDuplicateDialog({
          duplicateMatch: dup,
          addQuantity: itemQuantity,
          itemName,
          itemCategory,
          itemUnit,
        });
        return;
      }

      void performQuickAdd(itemName, itemQuantity, itemUnit, itemCategory);
    },
    [activeHouseholdId, activeItems, isQuickAdding, performQuickAdd],
  );

  const handleQuickAdd = useCallback(() => {
    const name = quickAddName.trim();
    if (!name) {
      setQuickAddError('empty_name');
      return;
    }
    if (!activeHouseholdId || isQuickAdding) return;
    if (quickAddAutocompleteTimerRef.current) {
      clearTimeout(quickAddAutocompleteTimerRef.current);
    }

    setQuickAddSuggestions([]);
    setIsQuickAddAutocompleteVisible(false);

    const itemCategory = quickAddCategory ?? detectCategory(name) ?? ItemCategory.OTHER;

    const dup = findDuplicate(name, activeItems);
    if (dup && dup.reason === DuplicateReason.EXACT_DUPLICATE) {
      Keyboard.dismiss();
      setQuickAddDuplicateDialog({
        duplicateMatch: dup,
        addQuantity: 1,
        itemName: name,
        itemCategory,
        itemUnit: null,
      });
      return;
    }

    void performQuickAdd(name, 1, null, itemCategory);
  }, [
    activeHouseholdId,
    activeItems,
    isQuickAdding,
    performQuickAdd,
    quickAddCategory,
    quickAddName,
  ]);

  const handleBoughtSectionToggle = () => {
    setBoughtExpanded((expanded) => {
      if (!expanded) {
        setBoughtVisibleCount(BOUGHT_ITEMS_PAGE_SIZE);
      }
      return !expanded;
    });
  };

  const filteredActive = useMemo(() => {
    if (!selectedCategory) return activeItems;
    return activeItems.filter((i) => i.category === selectedCategory);
  }, [activeItems, selectedCategory]);

  const handleMarkBought = (item: ShoppingItem) => {
    if (activeHouseholdId) markAsBought(activeHouseholdId, item.id);
  };
  const handleMarkActive = (item: ShoppingItem) => {
    if (activeHouseholdId) markAsActive(activeHouseholdId, item.id);
  };
  const handleDelete = (item: ShoppingItem) => {
    Alert.alert('', t('shopping_list_delete_confirm'), [
      { text: t('cancel'), style: 'cancel' },
      {
        text: t('shopping_list_delete'),
        style: 'destructive',
        onPress: () => activeHouseholdId && deleteItem(activeHouseholdId, item.id, item.name),
      },
    ]);
  };

  const handleSuggestionPress = (s: any) => {
    router.push({
      pathname: '/(main)/add-item',
      params: {
        prefillName: s.name,
        prefillQuantity: String(s.quantity),
        prefillUnit: s.unit || '',
        prefillCategory: s.category,
        prefillNote: s.note || '',
      },
    });
  };

  const hasAnyItems = activeItems.length > 0 || sortedBoughtItems.length > 0;
  // Wait for the first remote snapshot on a cold cache — do not treat
  // preload isLoading=false as "ready to show an empty list".
  const showInitialLoading = !hasReceivedRemoteSnapshot && !hasAnyItems;
  const isListEmptyForTour =
    activeItems.length === 0 && sortedBoughtItems.length === 0 && suggestions.length === 0;
  const isEmpty =
    hasReceivedRemoteSnapshot && filteredActive.length === 0 && sortedBoughtItems.length === 0;
  // Only show demo content once the tour sheet is visible — avoids orphan "דוגמה"
  // UI while overlay prepare is still running (or blocked by a system dialog).
  const showTourPreview = tourActive && tourOverlay != null && isListEmptyForTour;

  const previewItems = useMemo(() => buildTourPreviewItems(t), [t]);
  const listSuggestions = showTourPreview ? buildTourPreviewSuggestions(t) : suggestions;
  const listActiveItems = showTourPreview
    ? selectedCategory
      ? previewItems.filter((i) => i.category === selectedCategory)
      : previewItems
    : filteredActive;

  const noop = () => {};

  const ListContent = () => (
    <View
      ref={listContentRef}
      style={{ paddingHorizontal: Layout.horizontalPadding, paddingBottom: 130 }}
    >
      <View ref={heroAnchor.ref} style={heroAnchor.highlightStyle} collapsable={false}>
        <View style={{ paddingVertical: 8 }}>
          <HeroSuggestionsCard
            title={t('suggestions_title')}
            subtitle={t('suggestions_subtitle_home')}
            suggestions={listSuggestions}
            onSuggestionPress={showTourPreview ? noop : handleSuggestionPress}
          />
        </View>
      </View>

      <QuickAddItemField
        value={quickAddName}
        onChangeText={handleQuickAddNameChange}
        suggestions={quickAddSuggestions}
        isAutocompleteVisible={isQuickAddAutocompleteVisible}
        onSuggestionSelected={handleQuickAddSuggestionSelected}
        onFocusChange={(focused) => {
          if (focused) refreshQuickAddAutocomplete(quickAddName);
        }}
        onAdd={() => void handleQuickAdd()}
        isAdding={isQuickAdding}
        error={quickAddError}
        isRtl={isRtl}
        placeholder={t('quick_add_placeholder')}
        addLabel={t('item_add')}
        emptyErrorText={t('item_error_empty_name')}
        genericErrorText={t('error_generic')}
      />

      <View ref={filtersAnchor.ref} style={filtersAnchor.highlightStyle} collapsable={false}>
        <CategoryFilterRow
          selectedCategory={selectedCategory as ItemCategory | null}
          onSelect={(c) => setSelectedCategory(c)}
        />
      </View>

      <SalinoSectionTitle
        text={
          showTourPreview
            ? `${t('shopping_list_active_section')} (${listActiveItems.length}) · ${t('tour.preview.label')}`
            : `${t('shopping_list_active_section')} (${filteredActive.length})`
        }
      />

      <View style={{ paddingVertical: 6 }}>
        <ShoppingItemsGroupCard
          items={listActiveItems}
          onToggleBought={showTourPreview ? noop : handleMarkBought}
          onItemPress={
            showTourPreview
              ? noop
              : (item) =>
                  router.push({ pathname: '/(main)/edit-item', params: { itemId: item.id } })
          }
          onDelete={showTourPreview ? undefined : handleDelete}
        />
      </View>

      {sortedBoughtItems.length > 0 && (
        <>
          <Pressable
            onPress={handleBoughtSectionToggle}
            style={styles.boughtToggleRow}
          >
            <SalinoSectionTitle text={t('shopping_list_bought_section')} />
            <MaterialCommunityIcons
              name={boughtExpanded ? 'chevron-up' : 'chevron-down'}
              size={22}
              color={colors.onSurfaceVariant}
            />
          </Pressable>
          {boughtExpanded && (
            <View style={{ paddingVertical: 4 }}>
              <ShoppingItemsGroupCard
                items={visibleBoughtItems}
                onToggleBought={handleMarkActive}
                onItemPress={(item) =>
                  router.push({ pathname: '/(main)/edit-item', params: { itemId: item.id } })
                }
              />
              {hasMoreBoughtItems && (
                <Pressable
                  onPress={() =>
                    setBoughtVisibleCount((count) => count + BOUGHT_ITEMS_PAGE_SIZE)
                  }
                  style={({ pressed }) => [
                    styles.showMoreButton,
                    pressed && { opacity: 0.7 },
                  ]}
                >
                  <Text
                    style={[
                      Typography.labelLarge,
                      { color: colors.primary, textAlign: 'center' } as any,
                    ]}
                  >
                    {t('shopping_list_bought_show_more')}
                  </Text>
                </Pressable>
              )}
            </View>
          )}
        </>
      )}
    </View>
  );

  return (
    <SalinoGradientBackground style={{ flex: 1 }}>
      <CurvedTopBar
        isHebrew={isHebrew}
        isDark={isDark}
        title={t('shopping_list_title')}
        badge={t('shopping_list_live_badge')}
      />
      {showInitialLoading ? (
        <View style={styles.loadingWrap}>
          <LoadingIndicator />
          <Text
            style={[
              Typography.bodyMedium,
              { color: colors.onSurfaceVariant, marginTop: 12, textAlign: 'center' } as any,
            ]}
          >
            {t('loading')}
          </Text>
        </View>
      ) : isEmpty && suggestions.length === 0 && !tourActive ? (
        <View
          style={{
            flex: 1,
            paddingHorizontal: Layout.horizontalPadding,
            alignSelf: 'center',
            width: '100%',
            maxWidth: Layout.maxContentWidth,
          }}
        >
          <QuickAddItemField
            value={quickAddName}
            onChangeText={handleQuickAddNameChange}
            suggestions={quickAddSuggestions}
            isAutocompleteVisible={isQuickAddAutocompleteVisible}
            onSuggestionSelected={handleQuickAddSuggestionSelected}
            onFocusChange={(focused) => {
              if (focused) refreshQuickAddAutocomplete(quickAddName);
            }}
            onAdd={() => void handleQuickAdd()}
            isAdding={isQuickAdding}
            error={quickAddError}
            isRtl={isRtl}
            placeholder={t('quick_add_placeholder')}
            addLabel={t('item_add')}
            emptyErrorText={t('item_error_empty_name')}
            genericErrorText={t('error_generic')}
          />
          <EmptyState
            icon="cart-outline"
            title={t('shopping_list_empty_title')}
            subtitle={t('shopping_list_empty_subtitle')}
            actionLabel={t('item_add')}
            onAction={() => router.push('/(main)/add-item')}
          />
        </View>
      ) : (
        <FlatList
          ref={listRef}
          data={[0]}
          keyExtractor={() => 'content'}
          renderItem={() => <ListContent />}
          contentContainerStyle={{
            alignItems: 'center',
            width: '100%',
          }}
          ListHeaderComponent={null}
          style={{ flex: 1, alignSelf: 'center', width: '100%', maxWidth: Layout.maxContentWidth }}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="always"
        />
      )}

      {!showInitialLoading && (
        <View
          style={[styles.fabRow, { paddingBottom: insets.bottom + 12 }]}
          pointerEvents="box-none"
        >
          <View
            ref={supermarketFabAnchor.ref}
            style={supermarketFabAnchor.highlightStyle}
            collapsable={false}
          >
            <FabButton
              icon="store"
              label={t('supermarket_mode_short')}
              color={AccentColors.fabSupermarketBg}
              onPress={() => router.push('/(main)/supermarket-mode')}
            />
          </View>
          <View ref={addFabAnchor.ref} style={addFabAnchor.highlightStyle} collapsable={false}>
            <FabButton
              icon="plus"
              label={t('item_add')}
              color={AccentColors.fabAddBg}
              onPress={() => router.push('/(main)/add-item')}
            />
          </View>
        </View>
      )}

      <Portal>
        <Dialog
          visible={quickAddDuplicateDialog != null}
          onDismiss={() => setQuickAddDuplicateDialog(null)}
          style={{ marginHorizontal: 16 }}
        >
          {quickAddDuplicateDialog != null && (
            <>
              <Dialog.Content style={{ paddingHorizontal: 0, maxHeight: Math.min(520, Math.max(240, windowHeight * 0.58)) }}>
                <ScrollView
                  bounces={false}
                  contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 8 }}
                >
                  <SalinoSurfaceCard padding={16}>
                    <View style={{ flexDirection: 'row', gap: 12, alignItems: 'flex-start' }}>
                      <MaterialCommunityIcons
                        name="alert-circle-outline"
                        size={26}
                        color={colors.error}
                      />
                      <View style={{ flex: 1 }}>
                        <Text
                          style={[
                            Typography.titleMedium,
                            { color: colors.onSurface } as any,
                          ]}
                        >
                          {t('duplicate_warning_title')}
                        </Text>
                        <Text
                          style={[
                            Typography.bodyMedium,
                            { color: colors.onSurfaceVariant, marginTop: 6 } as any,
                          ]}
                        >
                          {quickAddDuplicateDialog.duplicateMatch.item.name} ·{' '}
                          {formatQuantityForDisplay(quickAddDuplicateDialog.duplicateMatch.item.quantity)}
                        </Text>
                        <Text
                          style={[
                            Typography.bodySmall,
                            { color: colors.onSurfaceVariant, marginTop: 8 } as any,
                          ]}
                        >
                          {t('duplicate_confirm_message', {
                            name: quickAddDuplicateDialog.duplicateMatch.item.name,
                            quantity: formatQuantityForDisplay(
                              quickAddDuplicateDialog.duplicateMatch.item.quantity,
                            ),
                          })}
                        </Text>
                      </View>
                    </View>
                  </SalinoSurfaceCard>
                </ScrollView>
              </Dialog.Content>

              <Dialog.Actions style={{ paddingHorizontal: 16, paddingBottom: 6 }}>
                <View style={{ width: '100%', gap: 10 }}>
                  <SalinoPrimaryButton
                    text={t('duplicate_merge_action')}
                    onPress={() => {
                      const state = quickAddDuplicateDialog;
                      setQuickAddDuplicateDialog(null);
                      if (state) {
                        void mergeQuickAddWithExisting(
                          state.duplicateMatch.item,
                          state.addQuantity,
                        );
                      }
                    }}
                  />
                  <Button
                    mode="outlined"
                    onPress={() => {
                      const state = quickAddDuplicateDialog;
                      setQuickAddDuplicateDialog(null);
                      if (state) {
                        void performQuickAdd(
                          state.itemName,
                          state.addQuantity,
                          state.itemUnit,
                          state.itemCategory,
                        );
                      }
                    }}
                    style={{ width: '100%' }}
                  >
                    {t('duplicate_add_anyway')}
                  </Button>
                  <Button onPress={() => setQuickAddDuplicateDialog(null)} style={{ alignSelf: 'flex-end' }}>
                    {t('cancel')}
                  </Button>
                </View>
              </Dialog.Actions>
            </>
          )}
        </Dialog>
      </Portal>
    </SalinoGradientBackground>
  );
}

function formatQuantityForDisplay(quantity: number): string {
  if (Number.isNaN(quantity) || !Number.isFinite(quantity)) return String(quantity);
  const rounded = Math.round(quantity);
  const isInt = Math.abs(quantity - rounded) < 1e-9;
  return isInt ? String(rounded) : String(quantity);
}

function QuickAddItemField({
  value,
  onChangeText,
  suggestions,
  isAutocompleteVisible,
  onSuggestionSelected,
  onFocusChange,
  onAdd,
  isAdding,
  error,
  isRtl,
  placeholder,
  addLabel,
  emptyErrorText,
  genericErrorText,
}: {
  value: string;
  onChangeText: (text: string) => void;
  suggestions: AutocompleteSuggestion[];
  isAutocompleteVisible: boolean;
  onSuggestionSelected: (suggestion: AutocompleteSuggestion) => void;
  onFocusChange: (focused: boolean) => void;
  onAdd: () => void;
  isAdding: boolean;
  error: 'empty_name' | 'generic' | null;
  isRtl: boolean;
  placeholder: string;
  addLabel: string;
  emptyErrorText: string;
  genericErrorText: string;
}) {
  const colors = useThemeColors();

  return (
    <View style={styles.quickAddSection}>
      <View style={styles.quickAddFieldWrap}>
        <ItemNameAutocompleteField
          value={value}
          onChangeText={onChangeText}
          suggestions={suggestions}
          isAutocompleteVisible={isAutocompleteVisible}
          onSuggestionSelected={onSuggestionSelected}
          placeholder={placeholder}
          isError={error != null}
          onSubmitEditing={onAdd}
          suggestionsMaxHeight={260}
          onFocusChange={onFocusChange}
        />
        <Pressable
          onPress={onAdd}
          disabled={!value.trim() || isAdding}
          accessibilityRole="button"
          accessibilityLabel={addLabel}
          style={({ pressed }) => [
            styles.quickAddButton,
            { backgroundColor: colors.primary },
            isRtl ? styles.quickAddButtonLeft : styles.quickAddButtonRight,
            (!value.trim() || isAdding) && styles.quickAddButtonDisabled,
            pressed && styles.quickAddButtonPressed,
          ]}
        >
          <MaterialCommunityIcons name="plus" size={26} color="#102326" />
        </Pressable>
      </View>
      {error && (
        <Text
          style={[
            Typography.bodySmall,
            { color: colors.error, marginTop: 4, marginHorizontal: 16 } as any,
          ]}
        >
          {error === 'empty_name' ? emptyErrorText : genericErrorText}
        </Text>
      )}
    </View>
  );
}

/**
 * CurvedTopBar — replicates Android shopping-list topBar:
 *   drawCircle(color=curveBg, radius=size.width*4, center=(width/2, height-4W+4))
 * The huge circle radius makes the topbar appear filled with curveBg with a
 * subtle convex bottom edge (corners curve up, center bulges down).
 */
function CurvedTopBar({
  isHebrew,
  isDark,
  title,
  badge,
}: {
  isHebrew: boolean;
  isDark: boolean;
  title: string;
  badge: string;
}) {
  const insets = useSafeAreaInsets();
  const colors = useThemeColors();
  const settingsAnchor = useTourAnchor('list.settings');
  const activityAnchor = useTourAnchor('list.activity');
  const [size, setSize] = useState({ w: 0, h: 0 });
  const tintSettings = isDark ? '#FFFFFF' : AccentColors.tintSettingsLight;
  const tintActivity = isDark ? '#FFFFFF' : AccentColors.tintActivityLight;
  const tintHistory = isDark ? '#FFFFFF' : AccentColors.tintSettingsLight;
  const curveBg = isDark ? AccentColors.topBarCurveDark : AccentColors.topBarCurveLight;
  const titleColor = isDark ? '#FFFFFF' : undefined;

  const onLayout = (e: LayoutChangeEvent) => {
    const { width, height } = e.nativeEvent.layout;
    if (width !== size.w || height !== size.h) {
      setSize({ w: width, h: height });
    }
  };

  return (
    <View style={styles.curveWrap} onLayout={onLayout}>
      {size.w > 0 && size.h > 0 && (
        <Svg
          pointerEvents="none"
          style={StyleSheet.absoluteFill}
          width={size.w}
          height={size.h}
        >
          <Circle
            cx={size.w / 2}
            cy={size.h - size.w * 4 + 4}
            r={size.w * 4}
            fill={curveBg}
          />
        </Svg>
      )}
      <View style={{ paddingTop: insets.top }}>
        <View
          style={[
            styles.topRow,
            { paddingTop: 14, paddingBottom: 10, paddingLeft: 0, paddingRight: 4 },
          ]}
        >
          {isHebrew ? (
            <View style={styles.hebrewLogoWrap}>
              <Image
                source={
                  isDark
                    ? require('../../assets/images/logo_header_dark.png')
                    : require('../../assets/images/logo_header.png')
                }
                style={styles.hebrewLogo}
                resizeMode="contain"
              />
            </View>
          ) : (
            <>
              <BrandLogo iconSize={38} showWordmark={false} showGlow />
              <View style={{ flex: 1, paddingLeft: 10, paddingRight: 8 }}>
                <SalinoWebAppBarTitle text={title} color={titleColor} />
                <Text
                  style={[
                    Typography.labelMedium,
                    {
                      fontSize: 11,
                      fontWeight: '500',
                      letterSpacing: 0.2,
                      color: colors.onSurfaceVariant,
                      paddingTop: 2,
                    } as any,
                  ]}
                  numberOfLines={2}
                >
                  {badge}
                </Text>
              </View>
            </>
          )}
          <View style={styles.topActions}>
            <View
              ref={settingsAnchor.ref}
              style={settingsAnchor.highlightStyle}
              collapsable={false}
            >
              <TopBarIconButton
                icon="cog"
                tint={tintSettings}
                onPress={() => router.push('/(main)/settings')}
              />
            </View>
            <View
              ref={activityAnchor.ref}
              style={activityAnchor.highlightStyle}
              collapsable={false}
            >
              <TopBarMaterialIconButton
                icon="timeline"
                tint={tintActivity}
                onPress={() => router.push('/(main)/activity')}
              />
            </View>
            <TopBarIconButton
              icon="history"
              tint={tintHistory}
              onPress={() => router.push('/(main)/history')}
            />
          </View>
        </View>
      </View>
    </View>
  );
}

function TopBarIconButton({
  icon,
  tint,
  onPress,
}: {
  icon: keyof typeof MaterialCommunityIcons.glyphMap;
  tint: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      hitSlop={6}
      style={({ pressed }) => [styles.iconBtn, { opacity: pressed ? 0.5 : 1 }]}
    >
      <MaterialCommunityIcons name={icon} size={22} color={tint} />
    </Pressable>
  );
}

function TopBarMaterialIconButton({
  icon,
  tint,
  onPress,
}: {
  icon: keyof typeof MaterialIcons.glyphMap;
  tint: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      hitSlop={6}
      style={({ pressed }) => [styles.iconBtn, { opacity: pressed ? 0.5 : 1 }]}
    >
      <MaterialIcons name={icon} size={22} color={tint} />
    </Pressable>
  );
}

/** Material 3 Extended FAB — 56dp tall pill with icon + label. */
function FabButton({
  icon,
  label,
  color,
  onPress,
}: {
  icon: keyof typeof MaterialCommunityIcons.glyphMap;
  label: string;
  color: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.fab,
        {
          backgroundColor: color,
          opacity: pressed ? 0.9 : 1,
          // Material 3 Extended FAB resting elevation (6dp). Two-layer soft shadow
          // matching Compose ambientColor + spotColor.
          boxShadow:
            '0px 1px 3px rgba(0,0,0,0.12), 0px 4px 8px rgba(0,0,0,0.10)',
        },
      ]}
    >
      <MaterialCommunityIcons name={icon} size={22} color="#FFFFFF" />
      <Text style={[Typography.labelLarge, styles.fabText]} numberOfLines={1}>
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  loadingWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  curveWrap: {
    width: '100%',
    overflow: 'hidden',
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
  },
  // Force LTR direction inside the logo wrap (mirrors Android's
  // CompositionLocalProvider(LocalLayoutDirection provides LayoutDirection.Ltr)
  // so the image stays right-pinned even in Hebrew RTL mode).
  hebrewLogoWrap: {
    flex: 1,
    height: 88,
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    paddingHorizontal: 8,
    direction: 'ltr',
  },
  hebrewLogo: {
    height: 88,
    width: 264,
    maxWidth: '100%',
  },
  topActions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  iconBtn: {
    width: 42,
    height: 42,
    alignItems: 'center',
    justifyContent: 'center',
  },
  quickAddSection: {
    paddingVertical: 8,
    width: '100%',
  },
  quickAddFieldWrap: {
    position: 'relative',
    width: '100%',
  },
  quickAddButton: {
    position: 'absolute',
    top: 14,
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 2,
  },
  quickAddButtonLeft: {
    left: 6,
  },
  quickAddButtonRight: {
    right: 6,
  },
  quickAddButtonDisabled: {
    opacity: 0.45,
  },
  quickAddButtonPressed: {
    opacity: 0.75,
  },
  boughtToggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingRight: 4,
  },
  showMoreButton: {
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  fabRow: {
    position: 'absolute',
    left: 16,
    right: 16,
    bottom: 0,
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 12,
  },
  fab: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 56,
    paddingStart: 16,
    paddingEnd: 20,
    borderRadius: 28,
    gap: 8,
  },
  fabText: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
});
