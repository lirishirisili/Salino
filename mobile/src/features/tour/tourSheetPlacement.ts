import { Dimensions } from 'react-native';
import { initialWindowMetrics } from 'react-native-safe-area-context';

import {
  TOUR_AD_BANNER_HEIGHT,
  TOUR_FAB_ROW_HEIGHT,
  TOUR_SHEET_APPROX_HEIGHT,
} from './config';
import { measureTourAnchor } from './tourAnchors';
import type { TourAnchorId } from './types';

const ANCHOR_GAP = 20;

export type TourSheetPlacement = 'top' | 'bottom';

/** Picks top vs bottom sheet so the briefing card does not cover the highlighted element. */
export async function resolveSheetPlacement(
  anchorId: TourAnchorId | undefined,
): Promise<TourSheetPlacement> {
  if (!anchorId) return 'bottom';

  const rect = await measureTourAnchor(anchorId);
  if (!rect) return 'bottom';

  const safeBottom = initialWindowMetrics?.insets.bottom ?? 0;
  const { height: screenH } = Dimensions.get('window');

  const bottomReserved =
    safeBottom + TOUR_FAB_ROW_HEIGHT + TOUR_AD_BANNER_HEIGHT + TOUR_SHEET_APPROX_HEIGHT;
  const sheetTopY = screenH - bottomReserved;
  const anchorBottom = rect.y + rect.height;

  if (anchorBottom > sheetTopY - ANCHOR_GAP) {
    return 'top';
  }

  const anchorCenterY = rect.y + rect.height / 2;
  if (anchorCenterY > screenH * 0.52) {
    return 'top';
  }

  return 'bottom';
}
