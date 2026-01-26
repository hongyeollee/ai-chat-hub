'use client';

import { useTranslations } from 'next-intl';
import { useChatStore } from '@/stores/chatStore';
import { useRef, useEffect, useState } from 'react';
import { StreamingMessage } from './StreamingMessage';
import type { Message, AIModel } from '@/types';

const modelLabels: Record<AIModel, string> = {
  'gpt-4o-mini': 'GPT',
  'gemini-2.5-flash': 'Gemini',
};

const modelIcons: Record<AIModel, string> = {
  'gpt-4o-mini': '🤖',
  'gemini-2.5-flash': '✨',
};

function getAlternativeModel(currentModel: AIModel): AIModel {
  return currentModel === 'gpt-4o-mini' ? 'gemini-2.5-flash' : 'gpt-4o-mini';
}

interface MessageBubbleProps {
  message: Message;
  onAlternativeResponse?: (message: Message) => void;
  isLoadingAlternative?: boolean;
  messages: Message[];
}

function MessageBubble({ message, onAlternativeResponse, isLoadingAlternative, messages }: MessageBubbleProps) {
  const t = useTranslations();
  const isUser = message.role === 'user';
  const alternativeModel = !isUser ? getAlternativeModel(message.model) : null;

  // 같은 user message에 대해 이미 다른 모델의 응답이 있는지 확인
  const hasAlternativeResponse = !isUser && message.parent_message_id
    ? messages.some(
        (m) =>
          m.role === 'assistant' &&
          m.parent_message_id === message.parent_message_id &&
          m.model !== message.model
      )
    : false;

  // 이 assistant message의 직전 user message 찾기
  const findUserMessageForAssistant = (): Message | undefined => {
    if (isUser) return undefined;

    // parent_message_id가 있으면 그것을 사용
    if (message.parent_message_id) {
      return messages.find((m) => m.id === message.parent_message_id);
    }

    // 없으면 바로 직전의 user message 찾기
    const messageIndex = messages.findIndex((m) => m.id === message.id);
    for (let i = messageIndex - 1; i >= 0; i--) {
      if (messages[i].role === 'user') {
        return messages[i];
      }
    }
    return undefined;
  };

  const userMessage = findUserMessageForAssistant();

  // 같은 user message에 대해 다른 모델 응답이 이미 있는지 확인 (parent_message_id가 없는 경우)
  const hasAlternativeResponseForUser = !isUser && userMessage
    ? messages.some(
        (m) =>
          m.role === 'assistant' &&
          m.id !== message.id &&
          (m.parent_message_id === userMessage.id ||
            // parent_message_id가 없는 경우, 같은 user message 이후의 다른 모델 응답 확인
            (messages.findIndex((msg) => msg.id === m.id) > messages.findIndex((msg) => msg.id === userMessage.id) &&
             m.model !== message.model))
      )
    : false;

  const showAlternativeButton = !isUser && !hasAlternativeResponse && !hasAlternativeResponseForUser;

  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}>
      <div
        className={`
          max-w-[80%] rounded-2xl px-4 py-2
          ${
            isUser
              ? 'bg-blue-500 text-white rounded-br-md'
              : 'bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-white rounded-bl-md'
          }
        `}
      >
        {!isUser && (
          <div className="text-xs text-gray-500 dark:text-gray-400 mb-1 flex items-center gap-1">
            <span>{modelIcons[message.model]}</span>
            <span>{modelLabels[message.model] || message.model}</span>
          </div>
        )}
        <div className="whitespace-pre-wrap break-words">{message.content}</div>

        {/* 다른 모델로 답변받기 버튼 */}
        {showAlternativeButton && alternativeModel && onAlternativeResponse && (
          <button
            onClick={() => onAlternativeResponse(message)}
            disabled={isLoadingAlternative}
            className={`
              mt-2 text-xs flex items-center gap-1 transition-colors
              ${isLoadingAlternative
                ? 'text-gray-400 cursor-not-allowed'
                : 'text-gray-500 hover:text-blue-500 dark:text-gray-400 dark:hover:text-blue-400'
              }
            `}
          >
            🔄 {t('chat.alternativeResponse', {
              model: modelLabels[alternativeModel],
            })}
          </button>
        )}
      </div>
    </div>
  );
}

export function MessageList() {
  const t = useTranslations();
  const {
    messages,
    isStreaming,
    streamingContents,
    activeStreamingModels,
    error,
    clearError,
    currentConversationId,
    addActiveStreamingModel,
    removeActiveStreamingModel,
    appendStreamingContentForModel,
    clearStreamingContentForModel,
    addMessage,
    lastUsedModel,
    setLastUsedModel,
  } = useChatStore();
  const bottomRef = useRef<HTMLDivElement>(null);
  const [loadingAlternativeFor, setLoadingAlternativeFor] = useState<string | null>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, streamingContents, activeStreamingModels]);

  const refreshUsage = async (remainingRequests?: number) => {
    if (typeof window === 'undefined') return;

    if (typeof remainingRequests === 'number') {
      window.dispatchEvent(
        new CustomEvent('usage-update', {
          detail: { remainingRequests },
        })
      );
      return;
    }

    try {
      const response = await fetch('/api/usage/today');
      const result = await response.json();
      if (result.success) {
        window.dispatchEvent(
          new CustomEvent('usage-update', {
            detail: { remainingRequests: result.data.remainingRequests },
          })
        );
      }
    } catch (error) {
      console.error('Failed to refresh usage:', error);
    }
  };

  const handleAlternativeResponse = async (assistantMessage: Message) => {
    if (!currentConversationId || isStreaming) return;

    // 해당 assistant message의 user message 찾기
    let userMessage: Message | undefined;

    if (assistantMessage.parent_message_id) {
      userMessage = messages.find((m) => m.id === assistantMessage.parent_message_id);
    } else {
      // parent_message_id가 없으면 바로 직전의 user message 찾기
      const messageIndex = messages.findIndex((m) => m.id === assistantMessage.id);
      for (let i = messageIndex - 1; i >= 0; i--) {
        if (messages[i].role === 'user') {
          userMessage = messages[i];
          break;
        }
      }
    }

    if (!userMessage) return;

    const alternativeModel = getAlternativeModel(assistantMessage.model);
    setLoadingAlternativeFor(assistantMessage.id);
    addActiveStreamingModel(alternativeModel);

    try {
      const response = await fetch('/api/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          conversationId: currentConversationId,
          content: userMessage.content,
          model: alternativeModel,
          previousModel: lastUsedModel,
          parentMessageId: userMessage.id,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to get alternative response');
      }

      if (!response.body) {
        throw new Error('No response body');
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const text = decoder.decode(value, { stream: true });
        const lines = text.split('\n');

        for (let i = 0; i < lines.length; i++) {
          const line = lines[i];

          if (line.startsWith('event: ')) {
            const event = line.slice(7);
            const dataLine = lines[i + 1];

            if (dataLine?.startsWith('data: ')) {
              const data = JSON.parse(dataLine.slice(6));

              if (event === 'token') {
                appendStreamingContentForModel(alternativeModel, data.token);
              } else if (event === 'done') {
                const streamedContent = useChatStore.getState().streamingContents[alternativeModel] || '';
                addMessage({
                  id: data.messageId,
                  conversation_id: currentConversationId,
                  parent_message_id: userMessage.id,
                  role: 'assistant',
                  content: streamedContent,
                  model: alternativeModel,
                  created_at: new Date().toISOString(),
                });

                await refreshUsage(data.remainingRequests);
                setLastUsedModel(alternativeModel);
              } else if (event === 'error') {
                console.error('Stream error:', data.error);
              }
            }
          }
        }
      }
    } catch (error) {
      console.error('Failed to get alternative response:', error);
    } finally {
      removeActiveStreamingModel(alternativeModel);
      clearStreamingContentForModel(alternativeModel);
      setLoadingAlternativeFor(null);
    }
  };

  if (messages.length === 0 && !isStreaming) {
    return (
      <div className="flex-1 flex items-center justify-center p-8">
        <div className="text-center max-w-md">
          <div className="text-6xl mb-4">💬</div>
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
            {t('chat.emptyState')}
          </h2>
          <p className="text-gray-600 dark:text-gray-400">
            {t('chat.emptyStateDescription')}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto p-4 space-y-4">
      {messages.map((message) => (
        <MessageBubble
          key={message.id}
          message={message}
          messages={messages}
          onAlternativeResponse={handleAlternativeResponse}
          isLoadingAlternative={loadingAlternativeFor === message.id || activeStreamingModels.length > 0}
        />
      ))}

      {error && (
        <div className="flex justify-center">
          <div className="max-w-[80%] w-full bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 rounded-lg p-3 flex items-start gap-3">
            <span className="text-red-500 text-lg">⚠️</span>
            <div className="flex-1">
              <p className="text-sm text-red-700 dark:text-red-300 font-medium">
                {t('chat.errorOccurred')}
              </p>
              <p className="text-xs text-red-600 dark:text-red-400 mt-1">
                {error}
              </p>
            </div>
            <button
              onClick={clearError}
              className="text-red-400 hover:text-red-600 dark:hover:text-red-300"
              aria-label="Close"
            >
              ✕
            </button>
          </div>
        </div>
      )}

      {/* 멀티 모델 스트리밍 메시지 표시 */}
      {activeStreamingModels.map((model) => (
        <div key={model} className="flex justify-start">
          <div className="max-w-[80%] rounded-2xl px-4 py-2 bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-white rounded-bl-md">
            <div className="text-xs text-gray-500 dark:text-gray-400 mb-1 flex items-center gap-1">
              <span>{modelIcons[model]}</span>
              <span>{modelLabels[model] || model}</span>
            </div>
            <StreamingMessage content={streamingContents[model] || ''} />
          </div>
        </div>
      ))}

      <div ref={bottomRef} />
    </div>
  );
}
