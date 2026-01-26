import type { Message } from '@/types';
import { CONTEXT_SETTINGS } from '@/types';
import { getModelSwitchContextTurns } from '@/lib/config';
import { generateSummary as generateOpenAISummary } from './openai';

export function shouldUpdateSummary(messageCount: number): boolean {
  // Trigger summary generation every SUMMARY_TRIGGER_TURNS turns (pairs of messages)
  return messageCount > 0 && messageCount % (CONTEXT_SETTINGS.SUMMARY_TRIGGER_TURNS * 2) === 0;
}

export function getMessagesForContext(
  messages: Message[],
  maxMessages: number = CONTEXT_SETTINGS.MAX_MESSAGES_FOR_CONTEXT
): Message[] {
  // Return the most recent messages for context
  return messages.slice(-maxMessages);
}

export async function generateSummary(messages: Message[]): Promise<string> {
  // Use OpenAI to generate summary regardless of the current model
  // This ensures consistent summarization quality
  return generateOpenAISummary(messages);
}

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
