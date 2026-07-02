import { Dimensions } from 'react-native';
import type { RefObject } from 'react';
import type { FlatList, ScrollView, View } from 'react-native';
import { initialWindowMetrics } from 'react-native-safe-area-context';

import {
  TOUR_AD_BANNER_HEIGHT,
  TOUR_FAB_ROW_HEIGHT,
  TOUR_SCROLL_SETTLE_MS,
  TOUR_SHEET_APPROX_HEIGHT,
  TOUR_TOP_BAR_HEIGHT,
} from './config';
import { getTourAnchorRef } from './tourAnchors';
import type { TourAnchorId } from './types';

export type TourScrollScreen = 'shopping-list' | 'settings';

type TourScrollRef = ScrollView | FlatList<any>;

type ScrollerRegistration = {
  scrollRef: RefObject<TourScrollRef | null>;
  contentRef: RefObject<View | null>;
  kind: 'scroll' | 'flat';
};

const scrollers = new Map<TourScrollScreen, ScrollerRegistration>();

const SCROLL_TARGETS: Partial<Record<TourAnchorId, TourScrollScreen>> = {
  'list.hero': 'shopping-list',
  'list.filters': 'shopping-list',
  'settings.invite': 'settings',
};

const SCROLL_PADDING = 16;

function getScrollInsets(screen: TourScrollScreen): { top: number; bottom: number } {
  const safeTop = initialWindowMetrics?.insets.top ?? 0;
  const safeBottom = initialWindowMetrics?.insets.bottom ?? 0;
  const fabClearance = screen === 'shopping-list' ? TOUR_FAB_ROW_HEIGHT : 0;
  const bannerClearance =
    screen === 'shopping-list' || screen === 'settings' ? 0 : TOUR_AD_BANNER_HEIGHT;
  const sheetClearance = TOUR_SHEET_APPROX_HEIGHT + 24;
  return {
    top: safeTop + TOUR_TOP_BAR_HEIGHT,
    bottom: safeBottom + fabClearance + bannerClearance + sheetClearance,
  };
}

/** Minimal scroll so the anchor sits in the visible band above the tour sheet. */
function computeTargetScrollY(
  anchorY: number,
  anchorH: number,
  topInset: number,
  bottomInset: number,
): number {
  const { height: screenH } = Dimensions.get('window');
  const minTop = topInset + SCROLL_PADDING;
  const maxBottom = screenH - bottomInset - SCROLL_PADDING;

  const topOnScreen = topInset + anchorY;
  const bottomOnScreen = topOnScreen + anchorH;

  if (topOnScreen >= minTop && bottomOnScreen <= maxBottom) {
    return 0;
  }

  if (bottomOnScreen > maxBottom) {
    const visibleBand = maxBottom - minTop;
    const targetScreenTop = minTop + Math.max(0, (visibleBand - anchorH) * 0.12);
    return Math.max(0, anchorY - (targetScreenTop - topInset));
  }

  return Math.max(0, anchorY - SCROLL_PADDING);
}

export function registerTourScroller(
  screen: TourScrollScreen,
  scrollRef: RefObject<TourScrollRef | null>,
  contentRef: RefObject<View | null>,
  kind: 'scroll' | 'flat' = 'scroll',
): () => void {
  scrollers.set(screen, { scrollRef, contentRef, kind });
  return () => {
    const current = scrollers.get(screen);
    if (current?.scrollRef === scrollRef) scrollers.delete(screen);
  };
}

function sleep(ms: number) {
  return new Promise<void>((resolve) => setTimeout(resolve, ms));
}

function scrollToY(
  registration: ScrollerRegistration,
  targetY: number,
): void {
  const { scrollRef, kind } = registration;
  const node = scrollRef.current;
  if (!node) return;

  if (kind === 'flat') {
    (node as FlatList<any>).scrollToOffset({ offset: targetY, animated: true });
  } else {
    (node as ScrollView).scrollTo({ y: targetY, animated: true });
  }
}

/** Scrolls a registered screen so the tour anchor is centered before highlighting. */
export async function scrollTourAnchorIntoView(anchorId: TourAnchorId): Promise<void> {
  const screen = SCROLL_TARGETS[anchorId];
  if (!screen) return;

  const registration = scrollers.get(screen);
  const content = registration?.contentRef.current;
  const anchor = getTourAnchorRef(anchorId)?.current;
  if (!registration || !content || !anchor) return;

  const { top: topInset, bottom: bottomInset } = getScrollInsets(screen);

  await new Promise<void>((resolve) => {
    anchor.measureLayout(
      content,
      (_x, y, _w, h) => {
        const targetY = computeTargetScrollY(y, h, topInset, bottomInset);
        scrollToY(registration, targetY);
        resolve();
      },
      () => resolve(),
    );
  });

  await sleep(TOUR_SCROLL_SETTLE_MS);
}
