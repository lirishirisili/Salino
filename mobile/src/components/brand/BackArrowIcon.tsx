import React from 'react';
import { I18nManager } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';

/**
 * "Back" arrow that points the reading direction's way: right in Hebrew/Arabic,
 * left otherwise. Icon glyphs are not mirrored by RN's RTL layout.
 */
export function BackArrowIcon({ size = 24, color }: { size?: number; color: string }) {
  return (
    <MaterialCommunityIcons
      name={I18nManager.isRTL ? 'arrow-right' : 'arrow-left'}
      size={size}
      color={color}
    />
  );
}
