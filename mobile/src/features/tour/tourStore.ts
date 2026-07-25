import { create } from 'zustand';

import type { TourAnchorId } from './types';

export type TourBootstrapStatus = 'pending' | 'running' | 'done';

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
  /** Post-login gate for deferred notification permission. */
  bootstrapStatus: TourBootstrapStatus;
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
  setBootstrapStatus: (status: TourBootstrapStatus) => void;
  markBootstrapDone: () => void;
  resetBootstrap: () => void;
}

export const useTourStore = create<TourState>((set, get) => ({
  active: false,
  stepIndex: 0,
  replayRequested: false,
  activeAnchorId: null,
  overlay: null,
  bootstrapStatus: 'pending',

  start: () =>
    set({
      active: true,
      stepIndex: 0,
      replayRequested: false,
      activeAnchorId: null,
      overlay: null,
      bootstrapStatus: 'running',
    }),

  requestReplay: () => set({ replayRequested: true }),

  clearReplayRequest: () => set({ replayRequested: false }),

  stop: () =>
    set({
      active: false,
      stepIndex: 0,
      replayRequested: false,
      activeAnchorId: null,
      overlay: null,
      bootstrapStatus: 'done',
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
      bootstrapStatus: 'done',
    }),

  setStepIndex: (index) => set({ stepIndex: index, activeAnchorId: null, overlay: null }),

  setActiveAnchorId: (id) => set({ activeAnchorId: id }),

  showOverlay: (data) => set({ overlay: data }),

  hideOverlay: () => set({ overlay: null }),

  setBootstrapStatus: (status) => set({ bootstrapStatus: status }),

  markBootstrapDone: () => {
    if (get().bootstrapStatus !== 'done') {
      set({ bootstrapStatus: 'done' });
    }
  },

  resetBootstrap: () => set({ bootstrapStatus: 'pending' }),
}));
