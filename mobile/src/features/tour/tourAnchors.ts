import type { RefObject } from 'react';
import type { View } from 'react-native';

import { TOUR_LAYOUT_FRAMES } from './config';
import type { TourAnchorId, TourRect } from './types';

const anchors = new Map<TourAnchorId, RefObject<View | null>>();

export function registerTourAnchor(id: TourAnchorId, ref: RefObject<View | null>): () => void {
  anchors.set(id, ref);
  return () => {
    if (anchors.get(id) === ref) anchors.delete(id);
  };
}

export function getTourAnchorRef(id: TourAnchorId): RefObject<View | null> | undefined {
  return anchors.get(id);
}

function waitFrames(count: number): Promise<void> {
  return new Promise((resolve) => {
    let remaining = count;
    const tick = () => {
      remaining -= 1;
      if (remaining <= 0) resolve();
      else requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  });
}

function measureNode(node: View): Promise<TourRect | null> {
  return new Promise((resolve) => {
    node.measureInWindow((x, y, width, height) => {
      if (width <= 0 || height <= 0 || !Number.isFinite(x) || !Number.isFinite(y)) {
        resolve(null);
        return;
      }
      resolve({ x, y, width, height });
    });
  });
}

/** Measures an anchor in window coordinates — used only for sheet placement. */
export async function measureTourAnchor(id: TourAnchorId): Promise<TourRect | null> {
  const ref = anchors.get(id);
  const node = ref?.current;
  if (!node) return null;

  await waitFrames(TOUR_LAYOUT_FRAMES);
  return measureNode(node);
}

/** Waits until a screen has mounted and registered the anchor (cross-route tour steps). */
export async function waitForTourAnchor(id: TourAnchorId, maxMs = 4000): Promise<boolean> {
  const deadline = Date.now() + maxMs;
  while (Date.now() < deadline) {
    if (anchors.get(id)?.current) return true;
    await new Promise<void>((resolve) => setTimeout(resolve, 50));
  }
  return !!anchors.get(id)?.current;
}
