import type { Message, SubscriptionTier } from '@/types';
import { CONTEXT_SETTINGS, TIER_LIMITS, getContextMessagesForTier } from '@/types';
import { getModelSwitchContextTurns } from '@/lib/config';
import { generateSummary as generateOpenAISummary } from './openai';

/**
 * 요약 갱신이 필요한지 확인
 * Pro 티어는 요약 기능 사용, 다른 티어는 사용하지 않음
 */
export function shouldUpdateSummary(
  messageCount: number,
  tier: SubscriptionTier = 'free'
): boolean {
  // Pro 티어만 요약 기능 사용
  if (tier !== 'pro' && tier !== 'enterprise') {
    return false;
  }

  // Trigger summary generation every SUMMARY_TRIGGER_TURNS turns (pairs of messages)
  return messageCount > 0 && messageCount % (CONTEXT_SETTINGS.SUMMARY_TRIGGER_TURNS * 2) === 0;
}

/**
 * 컨텍스트용 메시지 가져오기 (티어별 제한 적용)
 */
export function getMessagesForContext(
  messages: Message[],
  maxMessages: number = CONTEXT_SETTINGS.MAX_MESSAGES_FOR_CONTEXT
): Message[] {
  // Return the most recent messages for context
  return messages.slice(-maxMessages);
}

/**
 * 티어별 컨텍스트 메시지 가져오기
 */
export function getMessagesForContextByTier(
  messages: Message[],
  tier: SubscriptionTier
): Message[] {
  const maxMessages = getContextMessagesForTier(tier);
  return messages.slice(-maxMessages);
}

/**
 * 요약 생성 (OpenAI 사용)
 */
export async function generateSummary(messages: Message[]): Promise<string> {
  // Use OpenAI to generate summary regardless of the current model
  // This ensures consistent summarization quality
  return generateOpenAISummary(messages);
}

/**
 * AI 호출용 메시지 준비 (기존 함수 - 호환성 유지)
 */
export function prepareMessagesForAI(
  allMessages: Message[],
  summary: string | null
): { messages: Message[]; summary: string | null } {
  const recentMessages = getMessagesForContext(allMessages);
  return {
    messages: recentMessages,
    summary,
  };
}

/**
 * 티어별 AI 호출용 메시지 준비
 */
export function prepareMessagesForAIByTier(
  allMessages: Message[],
  summary: string | null,
  tier: SubscriptionTier
): { messages: Message[]; summary: string | null; maxContextMessages: number } {
  const maxContextMessages = getContextMessagesForTier(tier);
  const recentMessages = allMessages.slice(-maxContextMessages);

  // Pro/Enterprise 티어만 요약 사용
  const useSummary = tier === 'pro' || tier === 'enterprise';

  return {
    messages: recentMessages,
    summary: useSummary ? summary : null,
    maxContextMessages,
  };
}

/**
 * 모델 전환 시 컨텍스트 구성
 * 최근 대화 내용을 문자열로 변환하여 새 모델에 전달
 * @param messages - 전체 메시지 배열
 * @param maxMessages - 포함할 최대 메시지 수 (기본값: MODEL_SWITCH_CONTEXT_TURNS * 2 = 6개, 최근 3턴)
 * @returns 최근 대화 내용 문자열 또는 null
 */
export function buildModelSwitchContext(
  messages: Message[],
  maxMessages: number = getModelSwitchContextTurns() * 2
): string | null {
  if (messages.length === 0) return null;

  const recent = messages
    .slice(-maxMessages)
    .map((message) => `${message.role}: ${message.content}`)
    .join('\n');

  return recent || null;
}

/**
 * 티어별 컨텍스트 설정 가져오기
 */
export function getContextSettingsForTier(tier: SubscriptionTier): {
  maxMessages: number;
  summaryEnabled: boolean;
  summaryTriggerTurns: number;
} {
  const tierConfig = TIER_LIMITS[tier];
  const summaryEnabled = tier === 'pro' || tier === 'enterprise';

  return {
    maxMessages: tierConfig.maxContextMessages,
    summaryEnabled,
    summaryTriggerTurns: CONTEXT_SETTINGS.SUMMARY_TRIGGER_TURNS,
  };
}
