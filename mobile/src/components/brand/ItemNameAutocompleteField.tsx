import React, { useCallback, useMemo, useRef } from 'react';
import {
  FlatList,
  Pressable,
  StyleSheet,
  View,
  type StyleProp,
  type TextStyle,
  type TextInput as RNTextInput,
} from 'react-native';
import { Text, TextInput as PaperTextInput } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { Layout, Typography, useThemeColors } from '../../theme';
import type { AutocompleteSuggestion } from '../../services/householdHistoryIndex';

interface Props {
  value: string;
  onChangeText: (text: string) => void;
  suggestions: AutocompleteSuggestion[];
  isAutocompleteVisible: boolean;
  onSuggestionSelected: (suggestion: AutocompleteSuggestion) => void;
  label?: string;
  placeholder?: string;
  isError?: boolean;
  onSubmitEditing?: () => void;
  suggestionsMaxHeight?: number;
  onFocusChange?: (focused: boolean) => void;
  contentStyle?: StyleProp<TextStyle>;
  cornerRadius?: number;
}

export function ItemNameAutocompleteField({
  value,
  onChangeText,
  suggestions,
  isAutocompleteVisible,
  onSuggestionSelected,
  label,
  placeholder,
  isError = false,
  onSubmitEditing,
  suggestionsMaxHeight = 280,
  onFocusChange,
  contentStyle,
  cornerRadius = Layout.inputCorner,
}: Props) {
  const colors = useThemeColors();
  const { t } = useTranslation();
  const inputRef = useRef<RNTextInput>(null);
  const isFocusedRef = useRef(false);
  const selectingSuggestionRef = useRef(false);
  const expanded = isAutocompleteVisible && suggestions.length > 0;

  const wrapperBorderColor = expanded
    ? colors.primary
    : 'transparent';

  const inputOutlineBorderColor = expanded
    ? 'transparent'
    : undefined;

  const household = useMemo(
    () => suggestions.filter((s) => s.source === 'HOUSEHOLD_HISTORY'),
    [suggestions],
  );
  const catalog = useMemo(
    () => suggestions.filter((s) => s.source === 'CATEGORY_CATALOG'),
    [suggestions],
  );

  type ListItem =
    | { type: 'header'; title: string; icon: string; key: string }
    | { type: 'suggestion'; data: AutocompleteSuggestion; key: string }
    | { type: 'divider'; key: string };

  const listData = useMemo<ListItem[]>(() => {
    const items: ListItem[] = [];
    if (household.length > 0) {
      items.push({
        type: 'header',
        title: t('autocomplete_section_household'),
        icon: 'history',
        key: 'header_household',
      });
      household.forEach((s) =>
        items.push({ type: 'suggestion', data: s, key: `h:${s.displayName}` }),
      );
    }
    if (household.length > 0 && catalog.length > 0) {
      items.push({ type: 'divider', key: 'divider' });
    }
    if (catalog.length > 0) {
      items.push({
        type: 'header',
        title: t('autocomplete_section_catalog'),
        icon: 'magnify',
        key: 'header_catalog',
      });
      catalog.forEach((s) =>
        items.push({ type: 'suggestion', data: s, key: `c:${s.displayName}` }),
      );
    }
    return items;
  }, [household, catalog, t]);

  const handleFocus = useCallback(() => {
    isFocusedRef.current = true;
    onFocusChange?.(true);
  }, [onFocusChange]);

  const handleBlur = useCallback(() => {
    // Tapping a suggestion blurs the field first; ignore that blur so the
    // parent can apply the selection without fighting the keyboard.
    if (selectingSuggestionRef.current) {
      selectingSuggestionRef.current = false;
      return;
    }
    isFocusedRef.current = false;
    onFocusChange?.(false);
  }, [onFocusChange]);

  const handleSuggestionPress = useCallback(
    (suggestion: AutocompleteSuggestion) => {
      selectingSuggestionRef.current = true;
      isFocusedRef.current = false;
      onSuggestionSelected(suggestion);
    },
    [onSuggestionSelected],
  );

  const renderItem = useCallback(
    ({ item }: { item: ListItem }) => {
      if (item.type === 'header') {
        return (
          <View style={styles.sectionHeader}>
            <MaterialCommunityIcons
              name={item.icon as any}
              size={16}
              color={colors.primary}
            />
            <Text
              style={[
                Typography.labelLarge,
                { color: colors.onSurfaceVariant, marginLeft: 8 } as any,
              ]}
            >
              {item.title}
            </Text>
          </View>
        );
      }
      if (item.type === 'divider') {
        return (
          <View
            style={[
              styles.divider,
              { backgroundColor: `${colors.outlineVariant}99` },
            ]}
          />
        );
      }
      const suggestion = item.data;
      return (
        <Pressable
          onPress={() => handleSuggestionPress(suggestion)}
          style={({ pressed }) => [
            styles.suggestionRow,
            pressed && { backgroundColor: `${colors.primary}11` },
          ]}
        >
          <Text
            style={[
              Typography.bodyLarge,
              { color: colors.onSurface, flex: 1 } as any,
            ]}
          >
            {suggestion.displayName}
          </Text>
          {suggestion.category && (
            <Text
              style={[
                Typography.bodySmall,
                { color: colors.onSurfaceVariant } as any,
              ]}
            >
              {t(`category_${suggestion.category.toLowerCase()}`)}
            </Text>
          )}
        </Pressable>
      );
    },
    [colors, handleSuggestionPress, t],
  );

  const wrapperRadius = expanded
    ? { borderTopLeftRadius: cornerRadius, borderTopRightRadius: cornerRadius, borderBottomLeftRadius: 16, borderBottomRightRadius: 16 }
    : { borderRadius: cornerRadius };

  return (
    <View
      style={[
        styles.wrapper,
        {
          borderColor: wrapperBorderColor,
          backgroundColor: expanded ? colors.surface : 'transparent',
        },
        wrapperRadius,
      ]}
    >
      <PaperTextInput
        ref={inputRef}
        value={value}
        onChangeText={onChangeText}
        label={label}
        placeholder={placeholder}
        mode="outlined"
        textColor={colors.onSurface}
        placeholderTextColor={colors.outline}
        outlineStyle={[
          styles.outline,
          { borderRadius: cornerRadius },
          inputOutlineBorderColor != null && { borderColor: inputOutlineBorderColor },
        ]}
        style={styles.input}
        contentStyle={contentStyle}
        error={isError}
        autoCorrect={false}
        returnKeyType="done"
        blurOnSubmit={false}
        onSubmitEditing={onSubmitEditing}
        onFocus={handleFocus}
        onBlur={handleBlur}
      />
      <View
        style={[
          styles.dropdownPanel,
          {
            maxHeight: expanded ? suggestionsMaxHeight : 0,
            backgroundColor: expanded ? colors.surface : 'transparent',
          },
        ]}
        pointerEvents={expanded ? 'auto' : 'none'}
      >
        <View style={[styles.borderLine, { backgroundColor: expanded ? colors.primary : 'transparent' }]} />
        <FlatList
          data={expanded ? listData : []}
          renderItem={renderItem}
          keyExtractor={(item) => item.key}
          keyboardShouldPersistTaps="handled"
          focusable={false}
          scrollEnabled
          nestedScrollEnabled
          removeClippedSubviews={false}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    borderWidth: 1,
    borderRadius: Layout.inputCorner,
    overflow: 'hidden',
  },
  outline: {
    borderRadius: Layout.inputCorner,
  },
  input: {
    backgroundColor: 'transparent',
  },
  dropdownPanel: {
    overflow: 'hidden',
  },
  borderLine: {
    height: 1,
    width: '100%',
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  suggestionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  divider: {
    height: 1,
    marginHorizontal: 12,
    marginVertical: 4,
  },
});
