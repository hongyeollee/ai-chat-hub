'use client';

import { useTranslations } from 'next-intl';
import { usePathname, useRouter } from 'next/navigation';
import { useChatStore } from '@/stores/chatStore';
import { useRef, useEffect, useState, useCallback, useMemo } from 'react';
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

// 메시지 그룹 타입 - 하나의 user 메시지와 여러 assistant 응답을 그룹화
interface MessageGroup {
  userMessage: Message;
  assistantResponses: Message[];
}

interface AssistantBubbleProps {
  message: Message;
  onAlternativeResponse?: (message: Message) => void;
  isLoadingAlternative?: boolean;
  hasMultipleResponses: boolean;
  isSelected?: boolean;
  onSelect?: (message: Message) => void;
  showAlternativeButton: boolean;
}

function AssistantBubble({
  message,
  onAlternativeResponse,
  isLoadingAlternative,
  hasMultipleResponses,
  isSelected,
  onSelect,
  showAlternativeButton,
}: AssistantBubbleProps) {
  const t = useTranslations();
  const alternativeModel = getAlternativeModel(message.model);

  // 단일 응답일 때는 기존 스타일, 다중 응답일 때는 카드 스타일
  if (!hasMultipleResponses) {
    return (
      <div className="flex justify-start">
        <div className="max-w-[80%] rounded-2xl px-4 py-2 bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-white rounded-bl-md">
          <div className="text-xs text-gray-500 dark:text-gray-400 mb-1 flex items-center gap-1">
            <span>{getModelIcon(message.model)}</span>
            <span>{getModelLabel(message.model)}</span>
          </div>
          <MarkdownRenderer content={message.content} />

          {showAlternativeButton && onAlternativeResponse && (
            <div className="mt-2">
              <button
                onClick={() => onAlternativeResponse(message)}
                disabled={isLoadingAlternative}
                className={`
                  text-xs flex items-center gap-1 transition-colors
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
            </div>
          )}
        </div>
      </div>
    );
  }

  // 다중 응답 - 카드 스타일 (카드 전체 클릭으로 선택 가능)
  const handleCardClick = () => {
    if (!isSelected && onSelect) {
      onSelect(message);
    }
  };

  return (
    <div
      onClick={handleCardClick}
      className={`
        rounded-2xl px-4 py-3 bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-white
        border-2 transition-all
        ${isSelected
          ? 'border-blue-500 dark:border-blue-400 shadow-md'
          : 'border-transparent hover:border-gray-300 dark:hover:border-gray-600 cursor-pointer'
        }
      `}
    >
      <div className="text-xs text-gray-500 dark:text-gray-400 mb-2 flex items-center gap-1 pb-2 border-b border-gray-200 dark:border-gray-700">
        <span className="text-base">{getModelIcon(message.model)}</span>
        <span className="font-medium">{getModelLabel(message.model)}</span>
        {isSelected && (
          <span className="ml-auto px-2 py-0.5 bg-blue-100 dark:bg-blue-900 text-blue-600 dark:text-blue-300 rounded-full text-[10px] font-medium">
            {t('chat.selectedAnswer')}
          </span>
        )}
        {!isSelected && (
          <span className="ml-auto text-[10px] text-gray-400 dark:text-gray-500">
            {t('chat.clickToSelect')}
          </span>
        )}
      </div>

      <div className="max-h-[400px] overflow-y-auto">
        <MarkdownRenderer content={message.content} />
      </div>
    </div>
  );
}

interface MessageGroupComponentProps {
  group: MessageGroup;
  onAlternativeResponse?: (message: Message) => void;
  isLoadingAlternative?: boolean;
  selectedAnswerId: string | null;
  onSelectAnswer: (message: Message) => void;
  allMessages: Message[];
}

function MessageGroupComponent({
  group,
  onAlternativeResponse,
  isLoadingAlternative,
  selectedAnswerId,
  onSelectAnswer,
  allMessages,
}: MessageGroupComponentProps) {
  const hasMultipleResponses = group.assistantResponses.length > 1;
  const responseCount = group.assistantResponses.length;

  // 선택된 답변 결정: 명시적 선택이 있으면 그것, 없으면 첫 번째 응답
  const effectiveSelectedId = selectedAnswerId || group.assistantResponses[0]?.id;

  return (
    <div className="space-y-3">
      {/* User message - 한 번만 표시 */}
      <div className="flex justify-end">
        <div className="max-w-[80%] rounded-2xl px-4 py-2 bg-blue-500 text-white rounded-br-md">
          <div className="whitespace-pre-wrap break-words">{group.userMessage.content}</div>
        </div>
      </div>

      {/* Assistant responses - 여러 개일 때 그리드 레이아웃 */}
      {responseCount > 0 && (
        <div className={`
          ${hasMultipleResponses ? 'grid gap-3' : ''}
          ${responseCount === 2 ? 'grid-cols-1 md:grid-cols-2' : ''}
          ${responseCount >= 3 ? 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3' : ''}
        `}>
          {group.assistantResponses.map((response, index) => {
            const isSelected = response.id === effectiveSelectedId;
            // 다른 모델로 답변받기 버튼은 응답이 1개일 때만 표시
            const showAlternativeButton = responseCount === 1;

            return (
              <AssistantBubble
                key={response.id}
                message={response}
                onAlternativeResponse={onAlternativeResponse}
                isLoadingAlternative={isLoadingAlternative}
                hasMultipleResponses={hasMultipleResponses}
                isSelected={isSelected}
                onSelect={onSelectAnswer}
                showAlternativeButton={showAlternativeButton}
              />
            );
          })}
        </div>
      )}
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
  const [selectedAnswers, setSelectedAnswers] = useState<Record<string, string>>({});
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
  const isDailyLimitReached = error === 'daily_request_limit';
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

  // 메시지를 그룹화 - user message와 그에 대한 assistant responses를 묶음
  const messageGroups = useMemo(() => {
    const groups: MessageGroup[] = [];
    const userMessageMap = new Map<string, Message>();
    const responsesByParent = new Map<string, Message[]>();

    // 먼저 모든 user message를 맵에 저장
    messages.forEach(msg => {
      if (msg.role === 'user') {
        userMessageMap.set(msg.id, msg);
      }
    });

    // assistant message들을 parent_message_id로 그룹화
    messages.forEach(msg => {
      if (msg.role === 'assistant') {
        const parentId = msg.parent_message_id;
        if (parentId && userMessageMap.has(parentId)) {
          const existing = responsesByParent.get(parentId) || [];
          existing.push(msg);
          responsesByParent.set(parentId, existing);
        }
      }
    });

    // 그룹 생성 - user message 순서대로
    messages.forEach(msg => {
      if (msg.role === 'user') {
        const responses = responsesByParent.get(msg.id) || [];
        // parent_message_id가 없는 assistant message 찾기 (레거시 지원)
        const msgIndex = messages.indexOf(msg);
        for (let i = msgIndex + 1; i < messages.length; i++) {
          const nextMsg = messages[i];
          if (nextMsg.role === 'user') break;
          if (nextMsg.role === 'assistant' && !nextMsg.parent_message_id) {
            if (!responses.find(r => r.id === nextMsg.id)) {
              responses.push(nextMsg);
            }
          }
        }

        if (responses.length > 0) {
          groups.push({
            userMessage: msg,
            assistantResponses: responses.sort((a, b) =>
              new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
            ),
          });
        } else {
          // 응답이 없는 user message도 표시
          groups.push({
            userMessage: msg,
            assistantResponses: [],
          });
        }
      }
    });

    return groups;
  }, [messages]);

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

  // 스크롤 투 바텀 함수
  const scrollToBottom = useCallback(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    setUserHasScrolledUp(false);
  }, []);

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

  // 답변 선택 핸들러
  const handleSelectAnswer = useCallback((message: Message) => {
    if (message.parent_message_id) {
      setSelectedAnswers(prev => ({
        ...prev,
        [message.parent_message_id!]: message.id,
      }));
    }
  }, []);

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
        const errorMessage = errorCode === 'insufficient_credits' || errorCode === 'daily_request_limit'
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

  // 에러 UI 컴포넌트
  const ErrorUI = ({ fullWidth = false }: { fullWidth?: boolean }) => {
    const widthClass = fullWidth ? 'w-full' : 'max-w-[80%] w-full';

    if (isInsufficientCredits) {
      return (
        <div className={`${widthClass} bg-amber-50 dark:bg-amber-900/30 border border-amber-200 dark:border-amber-800 rounded-xl p-4 flex items-start gap-4`}>
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
      );
    }

    if (isDailyLimitReached) {
      return (
        <div className={`${widthClass} bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-800 rounded-xl p-4 flex items-start gap-4`}>
          <div className="text-2xl">⏰</div>
          <div className="flex-1 space-y-2">
            <div>
              <p className="text-sm font-semibold text-blue-800 dark:text-blue-200">
                {t('chat.dailyLimitReached.title')}
              </p>
              <p className="text-xs text-blue-700 dark:text-blue-300 mt-1">
                {t('chat.dailyLimitReached.description', { max: 10 })}
              </p>
            </div>
            <div className="text-xs text-blue-700 dark:text-blue-300 space-y-1">
              <p>{t('chat.dailyLimitReached.resetInfo')}</p>
              <p>{t('chat.dailyLimitReached.upgradePrompt')}</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => router.push(`/${currentLocale}/plans`)}
                className="btn-primary px-4 py-2 text-sm"
              >
                {t('chat.dailyLimitReached.ctaUpgrade')}
              </button>
              <button
                onClick={clearError}
                className="btn-secondary px-4 py-2 text-sm"
              >
                {t('common.close')}
              </button>
            </div>
          </div>
        </div>
      );
    }

    return (
      <div className={`${widthClass} bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 rounded-lg p-3 flex items-start gap-3`}>
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
    );
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
              <ErrorUI fullWidth />
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
      className="flex-1 overflow-y-auto p-4 space-y-4 relative"
    >
      {/* 메시지 그룹 렌더링 */}
      {messageGroups.map((group) => (
        <MessageGroupComponent
          key={group.userMessage.id}
          group={group}
          onAlternativeResponse={handleAlternativeResponse}
          isLoadingAlternative={loadingAlternativeFor !== null || activeStreamingModels.length > 0}
          selectedAnswerId={selectedAnswers[group.userMessage.id] || null}
          onSelectAnswer={handleSelectAnswer}
          allMessages={messages}
        />
      ))}

      {error && (
        <div className="flex justify-center">
          <ErrorUI />
        </div>
      )}

      {/* 멀티 모델 스트리밍 메시지 표시 - 그리드 레이아웃 */}
      {activeStreamingModels.length > 0 && (
        <div className={`
          grid gap-3
          ${activeStreamingModels.length === 1 ? 'grid-cols-1' : ''}
          ${activeStreamingModels.length === 2 ? 'grid-cols-1 md:grid-cols-2' : ''}
          ${activeStreamingModels.length >= 3 ? 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3' : ''}
        `}>
          {activeStreamingModels.map((model) => (
            <div
              key={model}
              className="rounded-2xl px-4 py-3 bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-white border border-gray-200 dark:border-gray-700"
            >
              <div className="text-xs text-gray-500 dark:text-gray-400 mb-2 flex items-center gap-1 pb-2 border-b border-gray-200 dark:border-gray-700">
                <span className="text-base">{getModelIcon(model)}</span>
                <span className="font-medium">{getModelLabel(model)}</span>
                <span className="ml-auto flex items-center gap-1 text-blue-500">
                  <span className="animate-pulse">●</span>
                  <span className="text-[10px]">응답 중</span>
                </span>
              </div>
              <div className="max-h-[400px] overflow-y-auto">
                <StreamingMessage content={streamingContents[model] || ''} />
              </div>
            </div>
          ))}
        </div>
      )}

      <div ref={bottomRef} />

      {/* 스크롤 투 바텀 버튼 - 사용자가 위로 스크롤했을 때만 표시 */}
      {userHasScrolledUp && (
        <button
          onClick={scrollToBottom}
          className="fixed bottom-24 right-8 bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded-full shadow-lg flex items-center gap-2 transition-all z-40"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
          </svg>
          {t('chat.scrollToBottom')}
        </button>
      )}

      {purchaseModal}
    </div>
  );
}
