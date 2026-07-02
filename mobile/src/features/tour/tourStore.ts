import { create } from 'zustand';

import type { TourAnchorId } from './types';

interface OverlayData {
  title: string;
  body: string;
  stepLabel: string;
  isLast: boolean;
  sheetPlacement: 'top' | 'bottom';
}

interface TourState {
  active: boolean;
  stepIndex: number;
  replayRequested: boolean;
  activeAnchorId: TourAnchorId | null;
  overlay: OverlayData | null;
  start: () => void;
  requestReplay: () => void;
  clearReplayRequest: () => void;
  stop: () => void;
  next: () => void;
  skip: () => void;
  setStepIndex: (index: number) => void;
  setActiveAnchorId: (id: TourAnchorId | null) => void;
  showOverlay: (data: OverlayData) => void;
  hideOverlay: () => void;
}

export const useTourStore = create<TourState>((set, get) => ({
  active: false,
  stepIndex: 0,
  replayRequested: false,
  activeAnchorId: null,
  overlay: null,

  start: () => set({ active: true, stepIndex: 0, replayRequested: false, activeAnchorId: null }),

  requestReplay: () => set({ replayRequested: true }),

  clearReplayRequest: () => set({ replayRequested: false }),

  stop: () =>
    set({
      active: false,
      stepIndex: 0,
      replayRequested: false,
      activeAnchorId: null,
      overlay: null,
    }),

  next: () => {
    const { stepIndex } = get();
    set({ stepIndex: stepIndex + 1, activeAnchorId: null, overlay: null });
  },

  skip: () =>
    set({
      active: false,
      stepIndex: 0,
      replayRequested: false,
      activeAnchorId: null,
      overlay: null,
    }),

  setStepIndex: (index) => set({ stepIndex: index, activeAnchorId: null, overlay: null }),

  setActiveAnchorId: (id) => set({ activeAnchorId: id }),

  showOverlay: (data) => set({ overlay: data }),

  hideOverlay: () => set({ overlay: null }),
}));
