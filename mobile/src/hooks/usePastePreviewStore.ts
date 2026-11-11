import { create } from 'zustand';

export type PasteSource = 'clipboard' | 'share';

/**
 * Text waiting for the paste-preview screen: from the "paste list" button, or
 * shared into the app from WhatsApp (which may arrive before sign-in finishes,
 * so it is held here until the main stack can show it).
 */
interface PastePreviewState {
  text: string | null;
  source: PasteSource;
  /** Bumped on every new text so the screen restarts parsing even for the same string. */
  version: number;
  /**
   * Shared text that still has to be shown. The main stack opens the preview
   * once it is mounted (i.e. signed in, with a home) and clears this flag.
   */
  pendingShare: boolean;
  open: (text: string, source: PasteSource) => void;
  consumePendingShare: () => boolean;
  clear: () => void;
}

export const usePastePreviewStore = create<PastePreviewState>((set, get) => ({
  text: null,
  source: 'clipboard',
  version: 0,
  pendingShare: false,
  open: (text, source) =>
    set((s) => ({ text, source, version: s.version + 1, pendingShare: source === 'share' })),
  consumePendingShare: () => {
    if (!get().pendingShare || !get().text) return false;
    set({ pendingShare: false });
    return true;
  },
  clear: () => set({ text: null, pendingShare: false }),
}));
