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
import { Button, Dialog, Portal, Snackbar, Text } from 'react-native-paper';
import * as Clipboard from 'expo-clipboard';
import { MaterialCommunityIcons, MaterialIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Circle } from 'react-native-svg';
import { useTranslation } from 'react-i18next';
import { router } from 'expo-router';
import { useShoppingStore, useHouseholdStore } from '../../src/hooks';
import { useTourAnchor, useTourScroller, useTourStore, type TourAnchor } from '../../src/features/tour';
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
import { parseQuickAddText, type ParsedQuickAddItem } from '../../src/services/quickAddParser';
import type { SuggestionItem } from '../../src/models/types';
import { warmUpCatalog } from '../../src/services/categoryKeywordCatalog';
import {
  AutocompleteSuggestion,
  HouseholdHistoryIndex,
} from '../../src/services/householdHistoryIndex';
import { perfMark } from '../../src/utils/perf';
import { useVoiceInput } from '../../src/hooks/useVoiceInput';
import { useIsHouseholdReadOnly } from '../../src/hooks/useHouseholdExpiry';
import {
  HouseholdHeader,
  InviteMembersCard,
  useHouseholdSwitcherUi,
} from '../../src/components/household';
import { isTemporary } from '../../src/utils/householdExpiry';
import { OfflineBanner } from '../../src/components/OfflineBanner';
import { useUndoBarStore } from '../../src/hooks/useUndoBarStore';
import { useAddParsedItems } from '../../src/hooks/useAddParsedItems';
import { usePastePreviewStore } from '../../src/hooks/usePastePreviewStore';
import { usePhotoList } from '../../src/hooks/usePhotoList';
import { findForgottenItems } from '../../src/utils/forgottenItems';
import { requestFeatureUse } from '../../src/services/featureUnlock';
import { ForgottenItemsDialog } from '../../src/components/ForgottenItemsDialog';
import { NativeListAd } from '../../src/components/ads';

const BOUGHT_ITEMS_PAGE_SIZE = 10;

const NOOP = () => {};

export default function ShoppingListScreen() {
  const { width: windowWidth, height: windowHeight } = useWindowDimensions();
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

  // Ended trip home: the list stays visible but nothing can be added or changed.
  const readOnly = useIsHouseholdReadOnly();
  const tourActive = useTourStore((s) => s.active);
  const tourOverlay = useTourStore((s) => s.overlay);

  const [boughtExpanded, setBoughtExpanded] = useState(false);
  const [boughtVisibleCount, setBoughtVisibleCount] = useState(BOUGHT_ITEMS_PAGE_SIZE);
  const [quickAddName, setQuickAddName] = useState('');
  const [quickAddQuantity, setQuickAddQuantity] = useState(1);
  const [quickAddUnit, setQuickAddUnit] = useState<ItemUnit | null>(null);
  const [quickAddSuggestions, setQuickAddSuggestions] = useState<AutocompleteSuggestion[]>([]);
  const [isQuickAddAutocompleteVisible, setIsQuickAddAutocompleteVisible] = useState(false);
  const [quickAddCategory, setQuickAddCategory] = useState<ItemCategory | null>(null);
  const [isQuickAdding, setIsQuickAdding] = useState(false);
  const [quickAddError, setQuickAddError] = useState<'empty_name' | 'generic' | null>(null);
  // One undo bar for check-off / delete / add: the latest action replaces the previous.
  // Global so the paste preview can add items, come back here and still offer Undo.
  const undoState = useUndoBarStore((s) => s.entry);
  /** Shows the bottom bar; pass `null` for a plain notice without an Undo action. */
  const showUndo = useUndoBarStore((s) => s.show);
  const clearUndo = useUndoBarStore((s) => s.clear);
  const addParsed = useAddParsedItems();
  const openPastePreview = usePastePreviewStore((s) => s.open);
  const [quickAddDuplicateDialog, setQuickAddDuplicateDialog] = useState<{
    duplicateMatch: DuplicateMatch;
    addQuantity: number;
    itemName: string;
    itemCategory: ItemCategory;
    itemUnit: ItemUnit | null;
  } | null>(null);
  const quickAddAutocompleteTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isHebrew = i18n.language === 'he';

  const listRef = useRef<FlatList<number>>(null);
  const listContentRef = useRef<View>(null);
  useTourScroller('shopping-list', listRef, listContentRef, 'flat');

  const heroAnchor = useTourAnchor('list.hero');
  const filtersAnchor = useTourAnchor('list.filters');
  const addFabAnchor = useTourAnchor('list.addFab');
  const supermarketFabAnchor = useTourAnchor('list.supermarketFab');
  const quickAddAnchor = useTourAnchor('list.quickAdd');
  const pasteAnchor = useTourAnchor('list.paste');

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

  // One-shot cold-start marker: the first time the list has any items to show.
  useEffect(() => {
    if (activeItems.length > 0 || boughtItems.length > 0) {
      perfMark('first_list_paint');
    }
  }, [activeItems.length, boughtItems.length]);

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
      setQuickAddQuantity(1);
      setQuickAddUnit(null);
      setQuickAddCategory(null);
      setQuickAddError(null);
      refreshQuickAddAutocomplete(text);
    },
    [refreshQuickAddAutocomplete],
  );

  const { isListening: isQuickAddListening, startListening: startQuickAddListening, stopListening: stopQuickAddListening } =
    useVoiceInput({
      onResult: (parsed) => {
        if (!parsed.name) return;
        setQuickAddName(parsed.name);
        setQuickAddQuantity(parsed.quantity);
        setQuickAddUnit(parsed.unit);
        setQuickAddCategory(detectCategory(parsed.name));
        setQuickAddError(null);
        refreshQuickAddAutocomplete(parsed.name);
      },
    });

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
        setQuickAddQuantity(1);
        setQuickAddUnit(null);
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
        setQuickAddQuantity(1);
        setQuickAddUnit(null);
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

  /**
   * Adds several parsed items at once (pasted list / "milk, bread, eggs").
   * Exact duplicates merge their quantity into the existing item; one undo
   * removes everything that was newly added.
   */
  const addParsedItems = useCallback(
    async (parsed: ParsedQuickAddItem[]) => {
      if (!activeHouseholdId || isQuickAdding || parsed.length === 0) return;
      setIsQuickAdding(true);
      setQuickAddError(null);
      try {
        const result = await addParsed(
          parsed.map((p) => ({
            ...p,
            category: detectCategory(p.name) ?? ItemCategory.OTHER,
          }))
        );
        setQuickAddName('');
        setQuickAddQuantity(1);
        setQuickAddUnit(null);
        setQuickAddCategory(null);
        showUndo(t('quick_add_bulk_added', { count: parsed.length }), result.undo);
      } catch {
        setQuickAddError('generic');
      } finally {
        setIsQuickAdding(false);
      }
    },
    [activeHouseholdId, addParsed, isQuickAdding, showUndo, t],
  );

  const handleQuickAdd = useCallback(() => {
    const raw = quickAddName.trim();
    if (!raw) {
      setQuickAddError('empty_name');
      return;
    }
    if (!activeHouseholdId || isQuickAdding) return;
    if (quickAddAutocompleteTimerRef.current) {
      clearTimeout(quickAddAutocompleteTimerRef.current);
    }

    setQuickAddSuggestions([]);
    setIsQuickAddAutocompleteVisible(false);

    // "2 חלב" / "חלב 3 ליטר" / "חלב, לחם, ביצים". Voice input already set the
    // quantity/unit and a clean name, so only parse plain typed text.
    const typed = quickAddQuantity === 1 && quickAddUnit == null;
    const parsed = typed ? parseQuickAddText(raw) : [];
    if (parsed.length > 1) {
      void addParsedItems(parsed);
      return;
    }
    const name = parsed[0]?.name ?? raw;
    const quantity = parsed[0]?.quantity ?? quickAddQuantity;
    const unit = parsed[0] ? parsed[0].unit : quickAddUnit;

    const itemCategory = quickAddCategory ?? detectCategory(name) ?? ItemCategory.OTHER;

    const dup = findDuplicate(name, activeItems);
    if (dup && dup.reason === DuplicateReason.EXACT_DUPLICATE) {
      Keyboard.dismiss();
      setQuickAddDuplicateDialog({
        duplicateMatch: dup,
        addQuantity: quantity,
        itemName: name,
        itemCategory,
        itemUnit: unit,
      });
      return;
    }

    void performQuickAdd(name, quantity, unit, itemCategory);
  }, [
    activeHouseholdId,
    activeItems,
    addParsedItems,
    isQuickAdding,
    performQuickAdd,
    quickAddCategory,
    quickAddName,
    quickAddQuantity,
    quickAddUnit,
  ]);

  /**
   * "Paste list": the clipboard (a WhatsApp list, a sentence…) opens the preview,
   * where the free AI sorts it into items the user can fix before adding.
   */
  const startPhotoList = usePhotoList();

  // "What did I forget?": regular items that are due and not on the list.
  const forgottenItems = useMemo(
    () => findForgottenItems(boughtItems, activeItems),
    [boughtItems, activeItems],
  );
  const [forgottenVisible, setForgottenVisible] = useState(false);
  const openForgotten = useCallback(async () => {
    if (await requestFeatureUse('forgotten_items')) setForgottenVisible(true);
  }, []);

  const handlePasteList = useCallback(async () => {
    const text = ((await Clipboard.getStringAsync().catch(() => '')) ?? '').trim();
    if (!text) {
      Alert.alert('', t('quick_add_paste_empty'));
      return;
    }
    Keyboard.dismiss();
    openPastePreview(text, 'clipboard');
    router.push('/(main)/paste-preview');
  }, [openPastePreview, t]);

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

  const handleMarkBought = useCallback(
    (item: ShoppingItem) => {
      if (!activeHouseholdId) return;
      const householdId = activeHouseholdId;
      markAsBought(householdId, item.id)
        .then(() =>
          showUndo(t('undo_marked_bought', { name: item.name }), () =>
            markAsActive(householdId, item.id)
          )
        )
        .catch(() => {
          Alert.alert('', t('error_generic'));
        });
    },
    [activeHouseholdId, markAsActive, markAsBought, showUndo, t]
  );
  const handleMarkActive = useCallback(
    (item: ShoppingItem) => {
      if (!activeHouseholdId) return;
      markAsActive(activeHouseholdId, item.id).catch(() => {
        Alert.alert('', t('error_generic'));
      });
    },
    [activeHouseholdId, markAsActive, t]
  );
  // Delete at once with an undo bar instead of a confirm dialog on every delete.
  const handleDelete = useCallback(
    (item: ShoppingItem) => {
      if (!activeHouseholdId) return;
      const householdId = activeHouseholdId;
      deleteItem(householdId, item.id, item.name)
        .then(() =>
          showUndo(t('undo_deleted', { name: item.name }), () =>
            addItem(householdId, {
              name: item.name,
              quantity: item.quantity,
              unit: item.unit,
              category: item.category,
              note: item.note ?? '',
              isUrgent: item.isUrgent ?? false,
              isFavorite: item.isFavorite ?? false,
              boughtBy: null,
              boughtByName: null,
            })
          )
        )
        .catch(() => {
          Alert.alert('', t('error_generic'));
        });
    },
    [activeHouseholdId, addItem, deleteItem, showUndo, t]
  );
  const openEditItem = useCallback((item: ShoppingItem) => {
    router.push({ pathname: '/(main)/edit-item', params: { itemId: item.id } });
  }, []);

  // One tap adds a suggestion straight to the list (undo if it was a mis-tap).
  const handleSuggestionPress = useCallback(
    (s: SuggestionItem) => {
      if (!activeHouseholdId) return;
      const householdId = activeHouseholdId;
      const dup = findDuplicate(s.name, activeItems);
      if (dup && dup.reason === DuplicateReason.EXACT_DUPLICATE) {
        showUndo(t('quick_add_already_on_list', { name: dup.item.name }), null);
        return;
      }
      addItem(householdId, {
        name: s.name,
        quantity: s.quantity || 1,
        unit: s.unit ?? null,
        category: s.category ?? detectCategory(s.name) ?? ItemCategory.OTHER,
        note: s.note || '',
        isUrgent: false,
        isFavorite: false,
        boughtBy: null,
        boughtByName: null,
      })
        .then((added) =>
          showUndo(t('undo_added', { name: added.name }), () =>
            deleteItem(householdId, added.id, added.name)
          )
        )
        .catch(() => Alert.alert('', t('error_generic')));
    },
    [activeHouseholdId, activeItems, addItem, deleteItem, showUndo, t]
  );

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
  const showEmptyState = isEmpty && suggestions.length === 0 && !tourActive;

  // Inline element (not an inner component) so FlatList re-renders do not remount
  // the TextInput and dismiss the keyboard. The empty state lives in the same tree
  // (QuickAddItemField keeps its child slot) so adding the first item, or suggestions
  // arriving, does not remount the field mid-typing.
  const listContent = (
    <View
      ref={listContentRef}
      style={{
        width: Math.min(windowWidth, Layout.maxContentWidth),
        paddingHorizontal: Layout.horizontalPadding,
        paddingBottom: 130,
      }}
    >
      <HouseholdHeader />

      <OfflineBanner />

      {!readOnly && !tourActive && <InviteMembersCard />}

      {!showEmptyState && !readOnly && (
        <View ref={heroAnchor.ref} style={heroAnchor.highlightStyle} collapsable={false}>
          <View style={{ paddingVertical: 8 }}>
            <HeroSuggestionsCard
              title={t('suggestions_title')}
              subtitle={t('suggestions_subtitle_home')}
              suggestions={listSuggestions}
              onSuggestionPress={showTourPreview ? NOOP : handleSuggestionPress}
            />
          </View>
        </View>
      )}

      {!readOnly && (
      <View ref={quickAddAnchor.ref} style={quickAddAnchor.highlightStyle} collapsable={false}>
      <QuickAddItemField
        value={quickAddName}
        onChangeText={handleQuickAddNameChange}
        suggestions={quickAddSuggestions}
        isAutocompleteVisible={isQuickAddAutocompleteVisible}
        onSuggestionSelected={handleQuickAddSuggestionSelected}
        onFocusChange={(focused) => {
          if (focused) refreshQuickAddAutocomplete(quickAddName);
          else setIsQuickAddAutocompleteVisible(false);
        }}
        onAdd={() => void handleQuickAdd()}
        isAdding={isQuickAdding}
        error={quickAddError}
        placeholder={t('quick_add_placeholder')}
        addLabel={t('item_add')}
        emptyErrorText={t('item_error_empty_name')}
        genericErrorText={t('error_generic')}
        isListening={isQuickAddListening}
        onVoicePress={isQuickAddListening ? stopQuickAddListening : startQuickAddListening}
        voiceLabel={t('voice_input_action')}
        onPastePress={() => void handlePasteList()}
        pasteLabel={t('quick_add_paste_list')}
        pasteAnchor={pasteAnchor}
        pasteShortLabel={t('quick_add_paste_short')}
        extraActions={[
          { key: 'photo', icon: 'camera-outline', label: t('quick_add_photo_list'), onPress: startPhotoList },
          {
            key: 'smart',
            icon: 'creation',
            label: t('quick_add_smart_list'),
            onPress: () => router.push('/(main)/smart-list'),
          },
          ...(forgottenItems.length > 0
            ? [
                {
                  key: 'forgotten',
                  icon: 'lightbulb-on-outline' as const,
                  label: t('quick_add_forgotten'),
                  badge: forgottenItems.length,
                  onPress: () => void openForgotten(),
                },
              ]
            : []),
        ]}
      />
      </View>
      )}

      {showEmptyState ? (
        <EmptyState
          icon="cart-outline"
          title={t('shopping_list_empty_title')}
          subtitle={t('shopping_list_empty_subtitle')}
          actionLabel={readOnly ? undefined : t('item_add')}
          onAction={readOnly ? undefined : () => router.push('/(main)/add-item')}
        />
      ) : (
        <>
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
              onToggleBought={showTourPreview || readOnly ? NOOP : handleMarkBought}
              onItemPress={showTourPreview || readOnly ? NOOP : openEditItem}
              onDelete={showTourPreview || readOnly ? undefined : handleDelete}
            />
          </View>

          {!showTourPreview && <NativeListAd itemCount={listActiveItems.length} />}

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
                    onToggleBought={readOnly ? NOOP : handleMarkActive}
                    onItemPress={readOnly ? NOOP : openEditItem}
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
        </>
      )}
    </View>
  );

  return (
    <SalinoGradientBackground plain style={{ flex: 1 }}>
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
      ) : (
        <FlatList
          ref={listRef}
          data={[0]}
          keyExtractor={() => 'content'}
          renderItem={() => listContent}
          contentContainerStyle={{
            alignItems: 'center',
            width: '100%',
          }}
          ListHeaderComponent={null}
          style={{ flex: 1, alignSelf: 'center', width: '100%', maxWidth: Layout.maxContentWidth }}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="none"
          removeClippedSubviews={false}
        />
      )}

      {!showInitialLoading && !readOnly && (
        <View
          style={[styles.fabRow, { paddingBottom: 12 }]}
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

      <ForgottenItemsDialog
        items={forgottenItems}
        visible={forgottenVisible}
        onDismiss={() => setForgottenVisible(false)}
      />

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
        <Snackbar
          key={undoState?.key}
          visible={undoState != null}
          onDismiss={clearUndo}
          duration={5000}
          // Sit above the FAB row so it never covers "add" / "supermarket".
          wrapperStyle={{ bottom: 84 }}
          action={
            undoState?.undo
              ? {
                  label: t('supermarket_mode_undo'),
                  onPress: () => {
                    const undo = undoState.undo;
                    clearUndo();
                    Promise.resolve(undo?.()).catch(() => Alert.alert('', t('error_generic')));
                  },
                }
              : undefined
          }
        >
          {undoState?.message ?? ''}
        </Snackbar>
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

type QuickAction = {
  key: string;
  icon: React.ComponentProps<typeof MaterialCommunityIcons>['name'];
  label: string;
  /** Small count on the icon (e.g. how many items you may have forgotten). */
  badge?: number;
  onPress: () => void;
};

/** One tile of the AI quick-actions bar: icon over a one-line label, tonal background. */
function QuickActionTile({ action, accessibilityLabel }: { action: QuickAction; accessibilityLabel?: string }) {
  const colors = useThemeColors();
  const badge = action.badge && action.badge > 0 ? (action.badge > 9 ? '9+' : String(action.badge)) : null;
  return (
    <Pressable
      onPress={action.onPress}
      accessibilityRole="button"
      accessibilityLabel={
        badge ? `${accessibilityLabel ?? action.label} (${action.badge})` : (accessibilityLabel ?? action.label)
      }
      style={({ pressed }) => [
        styles.aiActionTile,
        { backgroundColor: `${colors.primary}1A` },
        pressed && { opacity: 0.6 },
      ]}
    >
      <View>
        <MaterialCommunityIcons name={action.icon} size={20} color={colors.primary} />
        {badge && (
          <View style={[styles.aiActionBadge, { backgroundColor: colors.primary }]}>
            <Text style={[styles.aiActionBadgeText, { color: colors.onPrimary }]}>{badge}</Text>
          </View>
        )}
      </View>
      <Text
        numberOfLines={1}
        adjustsFontSizeToFit
        minimumFontScale={0.8}
        style={[Typography.labelMedium, { color: colors.primary, textAlign: 'center' } as any]}
      >
        {action.label}
      </Text>
    </Pressable>
  );
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
  placeholder,
  addLabel,
  emptyErrorText,
  genericErrorText,
  isListening,
  onVoicePress,
  voiceLabel,
  onPastePress,
  pasteLabel,
  pasteAnchor,
  pasteShortLabel,
  extraActions,
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
  placeholder: string;
  addLabel: string;
  emptyErrorText: string;
  genericErrorText: string;
  isListening: boolean;
  onVoicePress: () => void;
  voiceLabel: string;
  onPastePress: () => void;
  pasteLabel: string;
  /** Tour anchor ("what's new": paste with AI). */
  pasteAnchor: TourAnchor;
  /** Short tile label for "paste list" (the full text stays the accessibility label). */
  pasteShortLabel: string;
  /** More AI shortcuts next to "paste list" (photo → list, smart list, what did I forget). */
  extraActions: QuickAction[];
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
          cornerRadius={28}
          outlineColor={colors.outlineVariant}
          activeOutlineColor={colors.outlineVariant}
          // Keep text clear of the trailing microphone and + buttons.
          contentStyle={{ paddingEnd: 112 }}
        />
        <View
          pointerEvents="none"
          style={[
            styles.quickAddDivider,
            { backgroundColor: `${colors.outline}80` },
          ]}
        />
        <Pressable
          onPress={onVoicePress}
          accessibilityRole="button"
          accessibilityLabel={voiceLabel}
          style={({ pressed }) => [
            styles.quickAddButton,
            styles.quickAddVoiceButtonEnd,
            { backgroundColor: '#0D9488' },
            pressed && styles.quickAddButtonPressed,
          ]}
        >
          <MaterialCommunityIcons
            name={isListening ? 'microphone-off' : 'microphone'}
            size={24}
            color="#FFFFFF"
          />
        </Pressable>
        <Pressable
          onPress={onAdd}
          disabled={!value.trim() || isAdding}
          accessibilityRole="button"
          accessibilityLabel={addLabel}
          style={({ pressed }) => [
            styles.quickAddButton,
            styles.quickAddPlusButton,
            // Match native trailingIcon: logical end (left in RTL, right in LTR).
            // Avoid left/right — RN mirrors them under forceRTL and flips the button.
            styles.quickAddButtonEnd,
            (!value.trim() || isAdding) && styles.quickAddButtonDisabled,
            pressed && styles.quickAddButtonPressed,
          ]}
        >
          <MaterialCommunityIcons name="plus" size={28} color={colors.primary} />
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
      {/* One row of equal tiles (icon over a short label) — never wraps to a second line. */}
      <View style={styles.aiActionsRow}>
        <View
          ref={pasteAnchor.ref}
          style={[styles.aiActionCell, styles.aiActionAnchor, pasteAnchor.highlightStyle]}
          collapsable={false}
        >
          <QuickActionTile
            action={{ key: 'paste', icon: 'content-paste', label: pasteShortLabel, onPress: onPastePress }}
            accessibilityLabel={pasteLabel}
          />
        </View>
        {extraActions.map((action) => (
          <View key={action.key} style={styles.aiActionCell}>
            <QuickActionTile action={action} />
          </View>
        ))}
      </View>
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
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const colors = useThemeColors();
  const settingsAnchor = useTourAnchor('list.settings');
  const homesAnchor = useTourAnchor('list.homes');
  const openHouseholdSwitcher = useHouseholdSwitcherUi((s) => s.setOpen);
  const household = useHouseholdStore((s) => s.household);
  const inTripHome = isTemporary(household);
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
          <View style={styles.topActionsColumn}>
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
                  accessibilityLabel={t('settings_title')}
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
                  accessibilityLabel={t('activity_feed_title')}
                />
              </View>
              <TopBarIconButton
                icon="history"
                tint={tintHistory}
                onPress={() => router.push('/(main)/history')}
                accessibilityLabel={t('history_title')}
              />
            </View>
            {/* Active home's name in the free space under the icons (the logo row is
                taller than them), so switching homes costs no extra height. */}
            <View ref={homesAnchor.ref} style={homesAnchor.highlightStyle} collapsable={false}>
              <Pressable
                onPress={() => openHouseholdSwitcher(true)}
                hitSlop={6}
                accessibilityRole="button"
                accessibilityLabel={`${t('household_switcher_title')}: ${household?.name ?? ''}`}
                style={({ pressed }) => [
                  styles.homeChip,
                  { borderColor: `${colors.outline}66`, opacity: pressed ? 0.6 : 1 },
                ]}
              >
                <MaterialCommunityIcons
                  name={inTripHome ? 'bag-suitcase' : 'home'}
                  size={14}
                  color={colors.primary}
                />
                <Text
                  numberOfLines={1}
                  style={[styles.homeChipText, { color: isDark ? '#FFFFFF' : colors.onSurface }]}
                >
                  {household?.name ?? ''}
                </Text>
                <MaterialCommunityIcons name="chevron-down" size={14} color={colors.onSurfaceVariant} />
              </Pressable>
            </View>
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
  accessibilityLabel,
}: {
  icon: keyof typeof MaterialCommunityIcons.glyphMap;
  tint: string;
  onPress: () => void;
  accessibilityLabel?: string;
}) {
  return (
    <Pressable
      onPress={onPress}
      hitSlop={6}
      accessibilityLabel={accessibilityLabel}
      accessibilityRole="button"
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
  accessibilityLabel,
}: {
  icon: keyof typeof MaterialIcons.glyphMap;
  tint: string;
  onPress: () => void;
  accessibilityLabel?: string;
}) {
  return (
    <Pressable
      onPress={onPress}
      hitSlop={6}
      accessibilityLabel={accessibilityLabel}
      accessibilityRole="button"
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
  topActionsColumn: {
    alignItems: 'center',
    gap: 2,
  },
  homeChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    maxWidth: 132,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 50,
    borderWidth: 1,
  },
  homeChipText: {
    fontSize: 12,
    fontWeight: '700',
    flexShrink: 1,
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
  aiActionsRow: {
    flexDirection: 'row',
    alignItems: 'stretch',
    marginTop: 10,
    marginHorizontal: 4,
    gap: 8,
  },
  aiActionCell: {
    flex: 1,
    minWidth: 0,
  },
  aiActionAnchor: {
    borderRadius: 16,
  },
  aiActionTile: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingVertical: 8,
    paddingHorizontal: 4,
    borderRadius: 16,
  },
  aiActionBadge: {
    position: 'absolute',
    top: -6,
    end: -10,
    minWidth: 18,
    height: 18,
    paddingHorizontal: 4,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
  },
  aiActionBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    lineHeight: 14,
  },
  quickAddFieldWrap: {
    position: 'relative',
    width: '100%',
  },
  quickAddButton: {
    position: 'absolute',
    // Center the 40px circle in the ~56px outlined input (not the whole wrap).
    top: 8,
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 2,
  },
  quickAddButtonEnd: {
    end: 6,
  },
  quickAddVoiceButtonEnd: {
    end: 62,
  },
  quickAddPlusButton: {
    backgroundColor: 'transparent',
  },
  quickAddDivider: {
    position: 'absolute',
    top: 17,
    end: 53,
    width: 1,
    height: 22,
    zIndex: 2,
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
