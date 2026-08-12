import { create } from 'zustand';

interface InviteDeepLinkState {
  pendingInviteCode: string | null;
  setPendingInviteCode: (code: string | null) => void;
  consumePendingInviteCode: () => string | null;
}

export const useInviteDeepLinkStore = create<InviteDeepLinkState>((set, get) => ({
  pendingInviteCode: null,
  setPendingInviteCode: (code) => {
    set({
      pendingInviteCode: code ? code.trim().toUpperCase() : null,
    });
  },
  consumePendingInviteCode: () => {
    const code = get().pendingInviteCode;
    set({ pendingInviteCode: null });
    return code;
  },
}));
