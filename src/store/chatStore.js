import { create } from 'zustand';

export const useChatStore = create((set, get) => ({
  messages: [],
  sessionKey: null,
  isStreaming: false,
  streamingText: '',
  connectionStatus: 'idle', // idle | connecting | connected | error

  setConnectionStatus: (status) => set({ connectionStatus: status }),

  addMessage: (message) => set((state) => ({
    messages: [...state.messages, { id: Date.now(), ...message }]
  })),

  startStreaming: (sessionKey) => set({ isStreaming: true, streamingText: '', sessionKey }),

  appendToken: (token) => set((state) => ({
    streamingText: state.streamingText + token
  })),

  finishStreaming: () => {
    const { streamingText, messages } = get();
    if (!streamingText) return;
    set({
      isStreaming: false,
      streamingText: '',
      messages: [...messages, {
        id: Date.now(),
        role: 'assistant',
        content: streamingText,
        timestamp: new Date().toISOString()
      }]
    });
  },

  clearMessages: () => set({ messages: [], sessionKey: null }),
}));
