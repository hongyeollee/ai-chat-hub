'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { useRouter, usePathname } from 'next/navigation';
import { useChatStore } from '@/stores/chatStore';
import type { AIModel } from '@/types';

export function MessageInput() {
  const t = useTranslations();
  const router = useRouter();
  const pathname = usePathname();
  const [input, setInput] = useState('');
  const {
    currentConversationId,
    selectedModels,
    lastUsedModel,
    isStreaming,
    error,
    addMessage,
    addConversation,
    setCurrentConversationId,
    updateConversation,
    setLastUsedModel,
    setError,
    clearError,
    addActiveStreamingModel,
    removeActiveStreamingModel,
    appendStreamingContentForModel,
    clearAllStreamingContents,
    setPendingUserMessage,
    clearPendingUserMessage,
    updateMessageId,
    removeMessage,
  } = useChatStore();

  const currentLocale = pathname.split('/')[1] || 'ko';
  const isDailyLimitReached = error === 'daily_request_limit';
  const isInsufficientCredits = error === 'insufficient_credits';

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

  const streamSingleModel = async (
    content: string,
    model: AIModel,
    conversationId: string | null,
    userMessageId?: string,
    tempMessageId?: string  // Optimistic UI용 임시 메시지 ID
  ): Promise<{
    conversationId: string;
    userMessageId: string;
    success: boolean;
  }> => {
    addActiveStreamingModel(model);

    try {
      const response = await fetch('/api/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          conversationId,
          content,
          model,
          previousModel: lastUsedModel,
          parentMessageId: userMessageId,  // 이미 생성된 user message ID 전달
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        const errorCode = errorData?.error;
        const errorMessage = errorCode === 'insufficient_credits'
          ? errorCode
          : errorCode || errorData?.message || 'Failed to send message';
        setError(errorMessage);
        return {
          conversationId: conversationId || '',
          userMessageId: userMessageId || '',
          success: false,
        };
      }

      if (!response.body) {
        throw new Error('No response body');
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();

      let resultConversationId = conversationId || '';
      let resultUserMessageId = userMessageId || '';

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

              if (event === 'meta') {
                resultConversationId = data.conversationId as string;
                resultUserMessageId = data.userMessageId as string;

                // 새 대화가 생성된 경우에만 conversation 추가
                if (!conversationId && resultConversationId) {
                  setCurrentConversationId(resultConversationId);
                  addConversation({
                    id: resultConversationId,
                    user_id: '',
                    title: null,
                    summary: null,
                    created_at: new Date().toISOString(),
                    updated_at: new Date().toISOString(),
                  });
                }

                // Optimistic UI: 임시 메시지 ID를 실제 ID로 업데이트
                if (tempMessageId && resultUserMessageId) {
                  updateMessageId(tempMessageId, resultUserMessageId);
                  // conversation_id도 업데이트 (새 대화인 경우)
                  if (resultConversationId) {
                    const currentMessages = useChatStore.getState().messages;
                    const updatedMessages = currentMessages.map((m) =>
                      m.id === resultUserMessageId
                        ? { ...m, conversation_id: resultConversationId }
                        : m
                    );
                    useChatStore.setState({ messages: updatedMessages });
                  }
                } else if (!userMessageId && resultUserMessageId && !tempMessageId) {
                  // 기존 로직: 임시 메시지가 없는 경우에만 새로 추가
                  addMessage({
                    id: resultUserMessageId,
                    conversation_id: resultConversationId,
                    role: 'user',
                    content,
                    model,
                    created_at: new Date().toISOString(),
                  });
                }
              } else if (event === 'token') {
                appendStreamingContentForModel(model, data.token);
              } else if (event === 'done') {
                // Get the full streamed content for this model
                const streamedContent = useChatStore.getState().streamingContents[model] || '';
                addMessage({
                  id: data.messageId,
                  conversation_id: resultConversationId,
                  parent_message_id: resultUserMessageId,
                  role: 'assistant',
                  content: streamedContent,
                  model,
                  created_at: new Date().toISOString(),
                });

                // Generate title if this is the first exchange
                if (!conversationId) {
                  generateTitle(resultConversationId);
                }

                await refreshUsage(data.remainingRequests);
                setLastUsedModel(model);
              } else if (event === 'error') {
                console.error('Stream error:', data.error);
                setError(data.error);
              }
            }
          }
        }
      }

      return {
        conversationId: resultConversationId,
        userMessageId: resultUserMessageId,
        success: true,
      };
    } catch (error) {
      console.error(`Failed to stream ${model}:`, error);
      setError(error instanceof Error ? error.message : 'Failed to send message');
      return {
        conversationId: conversationId || '',
        userMessageId: userMessageId || '',
        success: false,
      };
    } finally {
      removeActiveStreamingModel(model);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!input.trim() || isStreaming) return;

    const content = input.trim();
    setInput('');
    clearAllStreamingContents();
    clearError();

    // Optimistic UI: 사용자 메시지를 즉시 표시
    const tempMessageId = `temp-${Date.now()}`;
    const tempUserMessage = {
      id: tempMessageId,
      conversation_id: currentConversationId || 'temp-conversation',
      role: 'user' as const,
      content,
      model: selectedModels[0],
      created_at: new Date().toISOString(),
    };

    // 임시 메시지를 바로 messages에 추가
    addMessage(tempUserMessage);

    if (selectedModels.length === 1) {
      // 단일 모델 - 기존 로직
      const result = await streamSingleModel(content, selectedModels[0], currentConversationId, undefined, tempMessageId);
      // 에러 발생 시 임시 메시지 제거 (ID가 업데이트되지 않은 경우)
      if (!result.success && tempMessageId) {
        const messages = useChatStore.getState().messages;
        const stillTemp = messages.find((m) => m.id === tempMessageId);
        if (stillTemp) {
          removeMessage(tempMessageId);
        }
      }
    } else {
      // 두 모델 동시 응답 - 병렬 처리
      // 첫 번째 모델로 먼저 요청을 시작하여 conversation과 user message 생성
      const firstModel = selectedModels[0];
      const secondModel = selectedModels[1];

      // 병렬로 두 모델 스트리밍 시작
      // 첫 번째 모델이 conversationId와 userMessageId를 생성하면
      // 두 번째 모델도 같은 conversation에 응답을 추가
      const firstPromise = streamSingleModel(content, firstModel, currentConversationId, undefined, tempMessageId);

      // 약간의 지연 후 두 번째 요청 시작 (첫 번째 요청이 conversation 생성할 시간 확보)
      const secondPromise = new Promise<void>(async (resolve) => {
        // 첫 번째 요청에서 conversationId가 생성될 때까지 대기
        await new Promise((r) => setTimeout(r, 100));

        // 현재 conversationId 가져오기
        let convId = currentConversationId;
        let attempts = 0;

        // 새 대화인 경우 conversationId가 생성될 때까지 대기
        while (!convId && attempts < 30) {
          await new Promise((r) => setTimeout(r, 100));
          convId = useChatStore.getState().currentConversationId;
          attempts++;
        }

        if (convId) {
          // 첫 번째 모델의 userMessageId를 찾기 (업데이트된 ID 사용)
          const messages = useChatStore.getState().messages;
          const userMessage = messages.find(
            (m) => m.conversation_id === convId && m.role === 'user' && m.content === content
          );

          await streamSingleModel(content, secondModel, convId, userMessage?.id);
        }

        resolve();
      });

      const [firstResult] = await Promise.all([firstPromise, secondPromise]);
      // 첫 번째 모델 에러 시 임시 메시지 제거
      if (!firstResult.success && tempMessageId) {
        const messages = useChatStore.getState().messages;
        const stillTemp = messages.find((m) => m.id === tempMessageId);
        if (stillTemp) {
          removeMessage(tempMessageId);
        }
      }
    }

    clearAllStreamingContents();
  };

  const generateTitle = async (conversationId: string) => {
    try {
      const response = await fetch(`/api/conversations/${conversationId}/title`, {
        method: 'POST',
      });
      const result = await response.json();
      if (result.success) {
        updateConversation(conversationId, { title: result.data.title });
      }
    } catch (error) {
      console.error('Failed to generate title:', error);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  // 일일 한도 소진 또는 크레딧 부족 시 읽기 전용 모드 UI
  if (isDailyLimitReached || isInsufficientCredits) {
    return (
      <div className="p-4 border-t border-gray-200 dark:border-gray-800">
        <div className={`
          flex items-center justify-between gap-4 px-4 py-3 rounded-lg
          ${isDailyLimitReached
            ? 'bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-800'
            : 'bg-amber-50 dark:bg-amber-900/30 border border-amber-200 dark:border-amber-800'
          }
        `}>
          <div className="flex items-center gap-3">
            <span className="text-xl">{isDailyLimitReached ? '⏰' : '💳'}</span>
            <div>
              <p className={`text-sm font-medium ${
                isDailyLimitReached
                  ? 'text-blue-800 dark:text-blue-200'
                  : 'text-amber-800 dark:text-amber-200'
              }`}>
                {isDailyLimitReached
                  ? t('chat.dailyLimitReached.title')
                  : t('chat.insufficientCredits.title')
                }
              </p>
              <p className={`text-xs ${
                isDailyLimitReached
                  ? 'text-blue-600 dark:text-blue-300'
                  : 'text-amber-600 dark:text-amber-300'
              }`}>
                {isDailyLimitReached
                  ? t('chat.dailyLimitReached.resetInfo')
                  : t('chat.insufficientCredits.description')
                }
              </p>
            </div>
          </div>
          <button
            onClick={() => router.push(`/${currentLocale}/plans`)}
            className="btn-primary px-4 py-2 text-sm whitespace-nowrap"
          >
            {t('chat.dailyLimitReached.ctaUpgrade')}
          </button>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="p-4 border-t border-gray-200 dark:border-gray-800">
      <div className="flex gap-2">
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={t('chat.placeholder')}
          disabled={isStreaming}
          rows={1}
          className="flex-1 resize-none rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-4 py-2 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
        />
        <button
          type="submit"
          disabled={!input.trim() || isStreaming}
          className="px-4 py-2 bg-blue-500 hover:bg-blue-600 disabled:bg-gray-300 disabled:dark:bg-gray-700 text-white rounded-lg font-medium transition-colors disabled:cursor-not-allowed"
        >
          {t('chat.send')}
        </button>
      </div>
    </form>
  );
}
