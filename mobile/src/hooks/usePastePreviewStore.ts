import { create } from 'zustand';

export type PasteSource = 'clipboard' | 'share' | 'photo' | 'smart';

export interface PreviewImage {
  base64: string;
  mimeType: string;
  /** Local file uri, for the thumbnail. */
  uri: string;
}

export interface SmartRequest {
  request: string;
  people?: number;
}

/**
 * Input waiting for the paste-preview screen: text from the "paste list" button
 * or shared from WhatsApp (which may arrive before sign-in finishes, so it is
 * held here until the main stack can show it), a photo, or a "smart list" request.
 */
interface PastePreviewState {
  text: string | null;
  image: PreviewImage | null;
  smart: SmartRequest | null;
  source: PasteSource;
  /** Bumped on every new input so the screen restarts parsing even for the same string. */
  version: number;
  /**
   * Shared text that still has to be shown. The main stack opens the preview
   * once it is mounted (i.e. signed in, with a home) and clears this flag.
   */
  pendingShare: boolean;
  open: (text: string, source: PasteSource) => void;
  /** `fromShare`: shared into the app — opened by the (main) layout once signed in. */
  openImage: (image: PreviewImage, fromShare?: boolean) => void;
  openSmart: (smart: SmartRequest) => void;
  consumePendingShare: () => boolean;
  clear: () => void;
}

export const usePastePreviewStore = create<PastePreviewState>((set, get) => ({
  text: null,
  image: null,
  smart: null,
  source: 'clipboard',
  version: 0,
  pendingShare: false,
  open: (text, source) =>
    set((s) => ({
      text,
      image: null,
      smart: null,
      source,
      version: s.version + 1,
      pendingShare: source === 'share',
    })),
  openImage: (image, fromShare = false) =>
    set((s) => ({
      text: null,
      image,
      smart: null,
      source: 'photo',
      version: s.version + 1,
      pendingShare: fromShare,
    })),
  openSmart: (smart) =>
    set((s) => ({ text: null, image: null, smart, source: 'smart', version: s.version + 1, pendingShare: false })),
  consumePendingShare: () => {
    if (!get().pendingShare || !(get().text || get().image)) return false;
    set({ pendingShare: false });
    return true;
  },
  clear: () => set({ text: null, image: null, smart: null, pendingShare: false }),
}));
