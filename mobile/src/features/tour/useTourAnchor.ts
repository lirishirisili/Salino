import { useEffect, useMemo, useRef } from 'react';
import type { View, ViewStyle } from 'react-native';

import { useThemeColors } from '../../theme';
import { registerTourAnchor } from './tourAnchors';
import { useTourStore } from './tourStore';
import type { TourAnchorId } from './types';

export type TourAnchor = {
  ref: React.RefObject<View | null>;
  highlightStyle: ViewStyle;
  highlighted: boolean;
};

/** Returns a ref and highlight ring style for an in-app tour anchor. */
export function useTourAnchor(id: TourAnchorId): TourAnchor {
  const ref = useRef<View>(null);
  const colors = useThemeColors();
  const activeAnchorId = useTourStore((s) => s.activeAnchorId);
  const highlighted = activeAnchorId === id;

  const highlightStyle = useMemo((): ViewStyle => {
    if (!highlighted) return {};
    return {
      borderWidth: 2.5,
      borderColor: colors.primary,
      zIndex: 2,
      elevation: 10,
      shadowColor: colors.primary,
      shadowOffset: { width: 0, height: 0 },
      shadowOpacity: 0.85,
      shadowRadius: 10,
    };
  }, [highlighted, colors.primary]);

  useEffect(() => {
    return registerTourAnchor(id, ref);
  }, [id]);

  return { ref, highlightStyle, highlighted };
}
