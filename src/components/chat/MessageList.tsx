'use client';

import { useTranslations } from 'next-intl';
import { usePathname, useRouter } from 'next/navigation';
import { useChatStore } from '@/stores/chatStore';
import { useRef, useEffect, useState, useCallback } from 'react';
import { StreamingMessage } from './StreamingMessage';
import { MarkdownRenderer } from './MarkdownRenderer';
import { AI_MODEL_INFO, type Message, type AIModel } from '@/types';

// 모델 표시 정보를 AI_MODEL_INFO에서 가져옴
const getModelLabel = (model: AIModel): string => {
  return AI_MODEL_INFO[model]?.name || model;
};

const getModelIcon = (model: AIModel): string => {
  return AI_MODEL_INFO[model]?.icon || '🤖';
};

// 저비용 모델 목록 (Free/Light 티어용)
const LOW_COST_MODELS: AIModel[] = ['gpt-4o-mini', 'gemini-2.5-flash', 'deepseek-v3', 'mistral-small-3'];

function getAlternativeModel(currentModel: AIModel): AIModel {
  // 같은 카테고리 내에서 다른 모델 선택
  const currentIndex = LOW_COST_MODELS.indexOf(currentModel);
  if (currentIndex !== -1) {
    // 저비용 모델 내에서 순환
    return LOW_COST_MODELS[(currentIndex + 1) % LOW_COST_MODELS.length];
  }
  // 기본값: GPT-4o-mini
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
            <span>{getModelIcon(message.model)}</span>
            <span>{getModelLabel(message.model)}</span>
          </div>
        )}
        {isUser ? (
          <div className="whitespace-pre-wrap break-words">{message.content}</div>
        ) : (
          <MarkdownRenderer content={message.content} />
        )}

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
              model: getModelLabel(alternativeModel),
            })}
          </button>
        )}
      </div>
    </div>
  );
}

export function MessageList() {
  const t = useTranslations();
  const router = useRouter();
  const pathname = usePathname();
  const {
    messages,
    isStreaming,
    streamingContents,
    activeStreamingModels,
    error,
    clearError,
    setError,
    currentConversationId,
    addActiveStreamingModel,
    removeActiveStreamingModel,
    appendStreamingContentForModel,
    clearStreamingContentForModel,
    addMessage,
    lastUsedModel,
    setLastUsedModel,
    selectedModels,
  } = useChatStore();
  const bottomRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [loadingAlternativeFor, setLoadingAlternativeFor] = useState<string | null>(null);
  const [userHasScrolledUp, setUserHasScrolledUp] = useState(false);
  const lastScrollTop = useRef(0);
  const [creditData, setCreditData] = useState<{
    usageType: 'daily' | 'credits';
    tier: string;
    credits?: {
      available: number;
      total: number;
      used: number;
      base: number;
      rollover: number;
      purchased: number;
    };
  } | null>(null);
  const [isCreditLoading, setIsCreditLoading] = useState(false);
  const [showPurchaseModal, setShowPurchaseModal] = useState(false);
  const [purchaseQuantity, setPurchaseQuantity] = useState(1);
  const [isPurchasing, setIsPurchasing] = useState(false);
  const [purchaseError, setPurchaseError] = useState<string | null>(null);

  const currentLocale = pathname.split('/')[1] || 'ko';
  const isInsufficientCredits = error === 'insufficient_credits';
  const activeModel = lastUsedModel || selectedModels[0];
  const activeModelInfo = activeModel ? AI_MODEL_INFO[activeModel] : null;
  const canPurchaseCredits = creditData?.usageType === 'credits' && creditData?.tier !== 'free';
  const isFreeTier = creditData?.tier === 'free' || creditData?.usageType === 'daily';

  const CREDIT_PRICES: Record<string, number> = {
    light: 2.99,
    pro: 1.99,
  };
  const pricePerUnit = creditData?.tier ? CREDIT_PRICES[creditData.tier] || 0 : 0;
  const totalCredits = purchaseQuantity * 1000;
  const totalPrice = (pricePerUnit * purchaseQuantity).toFixed(2);


  // Check if user is near bottom (within 100px)
  const isNearBottom = useCallback(() => {
    const container = containerRef.current;
    if (!container) return true;
    const threshold = 100;
    return container.scrollHeight - container.scrollTop - container.clientHeight < threshold;
  }, []);

  // Handle scroll events to detect user scrolling up
  const handleScroll = useCallback(() => {
    const container = containerRef.current;
    if (!container) return;

    const currentScrollTop = container.scrollTop;
    const isScrollingUp = currentScrollTop < lastScrollTop.current;

    // If user scrolls up while streaming, mark as user-controlled
    if (isScrollingUp && activeStreamingModels.length > 0) {
      setUserHasScrolledUp(true);
    }

    // If user scrolls to bottom, resume auto-scroll
    if (isNearBottom()) {
      setUserHasScrolledUp(false);
    }

    lastScrollTop.current = currentScrollTop;
  }, [activeStreamingModels.length, isNearBottom]);

  // Reset userHasScrolledUp when streaming ends
  useEffect(() => {
    if (activeStreamingModels.length === 0) {
      setUserHasScrolledUp(false);
    }
  }, [activeStreamingModels.length]);

  useEffect(() => {
    if (!isInsufficientCredits) return;
    let isMounted = true;

    const fetchCredits = async () => {
      try {
        setIsCreditLoading(true);
        const response = await fetch('/api/credits');
        const result = await response.json();
        if (isMounted && result.success) {
          setCreditData(result.data);
        }
      } catch (fetchError) {
        console.error('Failed to fetch credits:', fetchError);
      } finally {
        if (isMounted) setIsCreditLoading(false);
      }
    };

    fetchCredits();
    return () => {
      isMounted = false;
    };
  }, [isInsufficientCredits]);

  // Auto-scroll only when user hasn't scrolled up
  useEffect(() => {
    if (!userHasScrolledUp) {
      bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, streamingContents, activeStreamingModels, userHasScrolledUp]);

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

  const handleOpenPurchaseModal = () => {
    setPurchaseQuantity(1);
    setPurchaseError(null);
    setShowPurchaseModal(true);
  };

  const handleClosePurchaseModal = () => {
    setShowPurchaseModal(false);
    setPurchaseError(null);
  };

  const handlePurchase = async () => {
    setIsPurchasing(true);
    setPurchaseError(null);

    try {
      const response = await fetch('/api/credits/purchase', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ quantity: purchaseQuantity }),
      });

      const result = await response.json();

      if (result.success && result.data.url) {
        window.location.href = result.data.url;
      } else {
        setPurchaseError(result.error || t('common.error'));
        setIsPurchasing(false);
      }
    } catch (purchaseErr) {
      console.error('Credit purchase error:', purchaseErr);
      setPurchaseError(t('common.error'));
      setIsPurchasing(false);
    }
  };

  const purchaseModal = showPurchaseModal && (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="relative bg-[var(--surface)] rounded-2xl p-6 max-w-md w-full animate-fade-in">
        <h3 className="text-xl font-semibold text-[var(--text-primary)] mb-2">
          {t('credits.purchaseModal.title')}
        </h3>
        <p className="text-sm text-[var(--text-muted)] mb-6">
          {t('credits.purchaseModal.description')}
        </p>

        {!creditData ? (
          <div className="text-center py-6">
            <p className="text-[var(--text-secondary)] mb-4">
              {t('chat.insufficientCredits.loading')}
            </p>
            <button
              onClick={handleClosePurchaseModal}
              className="btn-secondary px-6 py-2"
            >
              {t('common.close')}
            </button>
          </div>
        ) : isFreeTier ? (
          <div className="text-center py-4">
            <p className="text-[var(--text-secondary)] mb-4">
              {t('credits.purchaseModal.freeUserNotice')}
            </p>
            <button
              onClick={() => {
                handleClosePurchaseModal();
                router.push(`/${currentLocale}/plans`);
              }}
              className="btn-primary px-6 py-2"
            >
              {t('credits.purchaseModal.upgradeFirst')}
            </button>
          </div>
        ) : (
          <>
            <div className="space-y-4 mb-6">
              <div className="flex justify-between items-center text-sm">
                <span className="text-[var(--text-secondary)]">
                  {t('credits.purchaseModal.pricePerUnit')}
                </span>
                <span className="font-medium text-[var(--text-primary)]">
                  ${pricePerUnit.toFixed(2)}
                </span>
              </div>

              <div>
                <label className="block text-sm text-[var(--text-secondary)] mb-2">
                  {t('credits.purchaseModal.quantity')}
                </label>
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => setPurchaseQuantity(Math.max(1, purchaseQuantity - 1))}
                    disabled={purchaseQuantity <= 1}
                    className="w-10 h-10 rounded-lg border border-[var(--border)] flex items-center justify-center text-lg font-medium disabled:opacity-50 hover:bg-[var(--background)]"
                  >
                    −
                  </button>
                  <input
                    type="number"
                    value={purchaseQuantity}
                    onChange={(e) => {
                      const val = parseInt(e.target.value, 10);
                      if (val >= 1 && val <= 10) setPurchaseQuantity(val);
                    }}
                    min={1}
                    max={10}
                    className="w-20 text-center input"
                  />
                  <button
                    onClick={() => setPurchaseQuantity(Math.min(10, purchaseQuantity + 1))}
                    disabled={purchaseQuantity >= 10}
                    className="w-10 h-10 rounded-lg border border-[var(--border)] flex items-center justify-center text-lg font-medium disabled:opacity-50 hover:bg-[var(--background)]"
                  >
                    +
                  </button>
                </div>
              </div>

              <div className="flex justify-between items-center text-sm">
                <span className="text-[var(--text-secondary)]">
                  {t('credits.purchaseModal.totalCredits')}
                </span>
                <span className="font-medium text-[var(--text-primary)]">
                  {totalCredits.toLocaleString()}
                </span>
              </div>

              <div className="flex justify-between items-center text-sm">
                <span className="text-[var(--text-secondary)]">
                  {t('credits.purchaseModal.totalPrice')}
                </span>
                <span className="font-semibold text-[var(--text-primary)]">
                  ${totalPrice}
                </span>
              </div>
            </div>

            {purchaseError && (
              <p className="text-sm text-red-500 mb-4">{purchaseError}</p>
            )}

            <div className="flex gap-2">
              <button
                onClick={handlePurchase}
                disabled={isPurchasing}
                className="btn-primary flex-1"
              >
                {isPurchasing
                  ? t('credits.purchaseModal.processing')
                  : t('credits.purchaseModal.purchaseButton')}
              </button>
              <button
                onClick={handleClosePurchaseModal}
                className="btn-secondary"
              >
                {t('common.cancel')}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );

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
          previousModel: assistantMessage.model,
          parentMessageId: userMessage.id,
          isAlternativeResponse: true,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        const errorCode = errorData?.error;
        const errorMessage = errorCode === 'insufficient_credits'
          ? errorCode
          : errorCode || errorData?.message || 'Failed to get alternative response';
        setError(errorMessage);
        return;
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
      <div className="flex-1 flex flex-col items-center justify-center p-8 gap-6">
        <div className="text-center max-w-md">
          <div className="text-6xl mb-4">💬</div>
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
            {t('chat.emptyState')}
          </h2>
          <p className="text-gray-600 dark:text-gray-400">
            {t('chat.emptyStateDescription')}
          </p>
        </div>
        {error && (
          <div className="w-full max-w-2xl">
            <div className="flex justify-center">
              {isInsufficientCredits ? (
                <div className="w-full bg-amber-50 dark:bg-amber-900/30 border border-amber-200 dark:border-amber-800 rounded-xl p-4 flex items-start gap-4">
                  <div className="text-2xl">💳</div>
                  <div className="flex-1 space-y-2">
                    <div>
                      <p className="text-sm font-semibold text-amber-800 dark:text-amber-200">
                        {t('chat.insufficientCredits.title')}
                      </p>
                      <p className="text-xs text-amber-700 dark:text-amber-300 mt-1">
                        {t('chat.insufficientCredits.description')}
                      </p>
                    </div>
                    <div className="text-xs text-amber-700 dark:text-amber-300 space-y-1">
                      {activeModelInfo && (
                        <p>
                          {t('chat.insufficientCredits.cost', {
                            model: activeModelInfo.name,
                            credits: activeModelInfo.credits,
                          })}
                        </p>
                      )}
                      {creditData?.credits && (
                        <p>
                          {t('chat.insufficientCredits.balance', {
                            available: creditData.credits.available.toLocaleString(),
                          })}
                        </p>
                      )}
                      {isCreditLoading && (
                        <p>{t('chat.insufficientCredits.loading')}</p>
                      )}
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {canPurchaseCredits || !creditData ? (
                        <button
                          onClick={handleOpenPurchaseModal}
                          className="btn-primary px-4 py-2 text-sm"
                        >
                          {t('chat.insufficientCredits.ctaPurchase')}
                        </button>
                      ) : (
                        <button
                          onClick={() => router.push(`/${currentLocale}/plans`)}
                          className="btn-primary px-4 py-2 text-sm"
                        >
                          {t('chat.insufficientCredits.ctaUpgrade')}
                        </button>
                      )}
                      <button
                        onClick={clearError}
                        className="btn-secondary px-4 py-2 text-sm"
                      >
                        {t('common.close')}
                      </button>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="w-full bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 rounded-lg p-3 flex items-start gap-3">
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
              )}
            </div>
          </div>
        )}
        {purchaseModal}
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      onScroll={handleScroll}
      className="flex-1 overflow-y-auto p-4 space-y-4"
    >
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
          {isInsufficientCredits ? (
            <div className="max-w-[80%] w-full bg-amber-50 dark:bg-amber-900/30 border border-amber-200 dark:border-amber-800 rounded-xl p-4 flex items-start gap-4">
              <div className="text-2xl">💳</div>
              <div className="flex-1 space-y-2">
                <div>
                  <p className="text-sm font-semibold text-amber-800 dark:text-amber-200">
                    {t('chat.insufficientCredits.title')}
                  </p>
                  <p className="text-xs text-amber-700 dark:text-amber-300 mt-1">
                    {t('chat.insufficientCredits.description')}
                  </p>
                </div>
                <div className="text-xs text-amber-700 dark:text-amber-300 space-y-1">
                  {activeModelInfo && (
                    <p>
                      {t('chat.insufficientCredits.cost', {
                        model: activeModelInfo.name,
                        credits: activeModelInfo.credits,
                      })}
                    </p>
                  )}
                  {creditData?.credits && (
                    <p>
                      {t('chat.insufficientCredits.balance', {
                        available: creditData.credits.available.toLocaleString(),
                      })}
                    </p>
                  )}
                  {isCreditLoading && (
                    <p>{t('chat.insufficientCredits.loading')}</p>
                  )}
                </div>
                <div className="flex flex-wrap gap-2">
                  {canPurchaseCredits || !creditData ? (
                    <button
                      onClick={handleOpenPurchaseModal}
                      className="btn-primary px-4 py-2 text-sm"
                    >
                      {t('chat.insufficientCredits.ctaPurchase')}
                    </button>
                  ) : (
                    <button
                      onClick={() => router.push(`/${currentLocale}/plans`)}
                      className="btn-primary px-4 py-2 text-sm"
                    >
                      {t('chat.insufficientCredits.ctaUpgrade')}
                    </button>
                  )}
                  <button
                    onClick={clearError}
                    className="btn-secondary px-4 py-2 text-sm"
                  >
                    {t('common.close')}
                  </button>
                </div>
              </div>
            </div>
          ) : (
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
          )}
        </div>
      )}

      {/* 멀티 모델 스트리밍 메시지 표시 */}
      {activeStreamingModels.map((model) => (
        <div key={model} className="flex justify-start">
          <div className="max-w-[80%] rounded-2xl px-4 py-2 bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-white rounded-bl-md">
            <div className="text-xs text-gray-500 dark:text-gray-400 mb-1 flex items-center gap-1">
              <span>{getModelIcon(model)}</span>
              <span>{getModelLabel(model)}</span>
            </div>
            <StreamingMessage content={streamingContents[model] || ''} />
          </div>
        </div>
      ))}

      <div ref={bottomRef} />

      {purchaseModal}
    </div>
  );
}
