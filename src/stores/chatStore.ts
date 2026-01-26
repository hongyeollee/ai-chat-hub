import { create } from 'zustand';
import type { Conversation, Message, AIModel } from '@/types';

interface ChatState {
  // Conversations
  conversations: Conversation[];
  currentConversationId: string | null;

  // Messages
  messages: Message[];
  isStreaming: boolean;
  streamingContent: string;

  // Multi-model streaming support
  selectedModels: AIModel[];  // 선택된 모델들 (체크박스)
  streamingContents: Partial<Record<AIModel, string>>;  // 모델별 스트리밍 콘텐츠
  activeStreamingModels: AIModel[];  // 현재 스트리밍 중인 모델들

  // Model (legacy - 호환성 유지)
  selectedModel: AIModel;
  lastUsedModel: AIModel | null;

  // Error
  error: string | null;

  // Actions
  setConversations: (conversations: Conversation[]) => void;
  addConversation: (conversation: Conversation) => void;
  updateConversation: (id: string, updates: Partial<Conversation>) => void;
  deleteConversation: (id: string) => void;
  setCurrentConversationId: (id: string | null) => void;

  setMessages: (messages: Message[]) => void;
  addMessage: (message: Message) => void;

  setIsStreaming: (isStreaming: boolean) => void;
  setStreamingContent: (content: string) => void;
  appendStreamingContent: (content: string) => void;
  clearStreamingContent: () => void;

  // Multi-model actions
  setSelectedModels: (models: AIModel[]) => void;
  toggleModel: (model: AIModel) => void;
  setStreamingContentForModel: (model: AIModel, content: string) => void;
  appendStreamingContentForModel: (model: AIModel, content: string) => void;
  clearStreamingContentForModel: (model: AIModel) => void;
  clearAllStreamingContents: () => void;
  addActiveStreamingModel: (model: AIModel) => void;
  removeActiveStreamingModel: (model: AIModel) => void;
  clearActiveStreamingModels: () => void;

  // Legacy (호환성)
  setSelectedModel: (model: AIModel) => void;
  setLastUsedModel: (model: AIModel | null) => void;

  setError: (error: string | null) => void;
  clearError: () => void;

  reset: () => void;
}

const initialState = {
  conversations: [],
  currentConversationId: null,
  messages: [],
  isStreaming: false,
  streamingContent: '',
  selectedModels: ['gemini-2.5-flash'] as AIModel[],
  streamingContents: {} as Partial<Record<AIModel, string>>,
  activeStreamingModels: [] as AIModel[],
  selectedModel: 'gemini-2.5-flash' as AIModel,
  lastUsedModel: null as AIModel | null,
  error: null as string | null,
};

export const useChatStore = create<ChatState>((set, get) => ({
  ...initialState,

  setConversations: (conversations) => set({ conversations }),

  addConversation: (conversation) =>
    set((state) => ({
      conversations: [conversation, ...state.conversations],
    })),

  updateConversation: (id, updates) =>
    set((state) => ({
      conversations: state.conversations.map((c) =>
        c.id === id ? { ...c, ...updates } : c
      ),
    })),

  deleteConversation: (id) =>
    set((state) => ({
      conversations: state.conversations.filter((c) => c.id !== id),
      currentConversationId:
        state.currentConversationId === id ? null : state.currentConversationId,
      messages: state.currentConversationId === id ? [] : state.messages,
    })),

  setCurrentConversationId: (id) => set({ currentConversationId: id }),

  setMessages: (messages) => set({ messages }),

  addMessage: (message) =>
    set((state) => ({
      messages: [...state.messages, message],
    })),

  setIsStreaming: (isStreaming) => set({ isStreaming }),

  setStreamingContent: (content) => set({ streamingContent: content }),

  appendStreamingContent: (content) =>
    set((state) => ({
      streamingContent: state.streamingContent + content,
    })),

  clearStreamingContent: () => set({ streamingContent: '' }),

  // Multi-model actions
  setSelectedModels: (models) => set({
    selectedModels: models,
    // 첫 번째 선택된 모델을 selectedModel로 설정 (호환성)
    selectedModel: models[0] || 'gemini-2.5-flash',
  }),

  toggleModel: (model) =>
    set((state) => {
      const isSelected = state.selectedModels.includes(model);

      // 최소 1개는 선택되어 있어야 함
      if (isSelected && state.selectedModels.length === 1) {
        return state;
      }

      const newModels = isSelected
        ? state.selectedModels.filter((m) => m !== model)
        : [...state.selectedModels, model];

      return {
        selectedModels: newModels,
        selectedModel: newModels[0] || 'gemini-2.5-flash',
      };
    }),

  setStreamingContentForModel: (model, content) =>
    set((state) => ({
      streamingContents: { ...state.streamingContents, [model]: content },
    })),

  appendStreamingContentForModel: (model, content) =>
    set((state) => ({
      streamingContents: {
        ...state.streamingContents,
        [model]: (state.streamingContents[model] || '') + content,
      },
    })),

  clearStreamingContentForModel: (model) =>
    set((state) => {
      const newContents = { ...state.streamingContents };
      delete newContents[model];
      return { streamingContents: newContents };
    }),

  clearAllStreamingContents: () => set({ streamingContents: {} }),

  addActiveStreamingModel: (model) =>
    set((state) => ({
      activeStreamingModels: state.activeStreamingModels.includes(model)
        ? state.activeStreamingModels
        : [...state.activeStreamingModels, model],
      isStreaming: true,
    })),

  removeActiveStreamingModel: (model) =>
    set((state) => {
      const newModels = state.activeStreamingModels.filter((m) => m !== model);
      return {
        activeStreamingModels: newModels,
        isStreaming: newModels.length > 0,
      };
    }),

  clearActiveStreamingModels: () =>
    set({ activeStreamingModels: [], isStreaming: false }),

  // Legacy (호환성)
  setSelectedModel: (model) => set({
    selectedModel: model,
    selectedModels: [model],
  }),

  setLastUsedModel: (model) => set({ lastUsedModel: model }),

  setError: (error) => set({ error }),
  clearError: () => set({ error: null }),

  reset: () => set(initialState),
}));
