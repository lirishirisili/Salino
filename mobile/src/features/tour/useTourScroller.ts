import { useEffect, type RefObject } from 'react';
import type { FlatList, ScrollView, View } from 'react-native';

import { registerTourScroller, type TourScrollScreen } from './tourScroll';

type TourScrollRef = ScrollView | FlatList<any>;

/** Registers a screen ScrollView or FlatList + content wrapper for tour auto-scroll. */
export function useTourScroller(
  screen: TourScrollScreen,
  scrollRef: RefObject<TourScrollRef | null>,
  contentRef: RefObject<View | null>,
  kind: 'scroll' | 'flat' = 'scroll',
) {
  useEffect(
    () => registerTourScroller(screen, scrollRef, contentRef, kind),
    [screen, scrollRef, contentRef, kind],
  );
}
