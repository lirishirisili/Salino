import { create } from 'zustand';

/**
 * The bottom "undo" bar on the shopping list. Global so another screen (e.g. the
 * paste preview) can add items, go back, and still offer Undo on the list.
 */
export interface UndoBarEntry {
  key: number;
  message: string;
  /** null = a plain notice without an Undo action. */
  undo: (() => Promise<unknown> | void) | null;
}

interface UndoBarState {
  entry: UndoBarEntry | null;
  show: (message: string, undo: (() => Promise<unknown> | void) | null) => void;
  clear: () => void;
}

export const useUndoBarStore = create<UndoBarState>((set) => ({
  entry: null,
  show: (message, undo) => set({ entry: { key: Date.now(), message, undo } }),
  clear: () => set({ entry: null }),
}));
