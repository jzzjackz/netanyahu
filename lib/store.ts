import { create } from "zustand";

interface AppState {
  currentServerId: string | null;
  currentChannelId: string | null;
  currentConversationId: string | null; // for DMs
  setServer: (id: string | null) => void;
  setChannel: (id: string | null) => void;
  setConversation: (id: string | null) => void;
}

export const useAppStore = create<AppState>((set) => ({
  currentServerId: null,
  currentChannelId: null,
  currentConversationId: null,
  setServer: (id) => set({ currentServerId: id, currentChannelId: null, currentConversationId: null }),
  setChannel: (id) => set({ currentChannelId: id, currentConversationId: null }),
  setConversation: (id) => set({ currentConversationId: id, currentServerId: null, currentChannelId: null }),
}));
