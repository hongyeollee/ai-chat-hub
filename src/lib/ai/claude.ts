import Anthropic from '@anthropic-ai/sdk';
import type { Message } from '@/types';

let anthropicClient: Anthropic | null = null;

function getAnthropicClient(): Anthropic {
  if (!anthropicClient) {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      throw new Error('ANTHROPIC_API_KEY is not configured');
    }
    anthropicClient = new Anthropic({ apiKey });
  }
  return anthropicClient;
}

// Export client getter for model sync
export { getAnthropicClient };

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

/**
 * Stream responses from Claude/Anthropic
 * @param providerModelId - The actual Anthropic model ID (e.g., 'claude-3-5-haiku-latest')
 */
export async function* streamClaude(
  providerModelId: string,
  messages: Message[],
  summary?: string | null,
  customInstructions?: string | null,
  modelSwitchContext?: string | null,
  alternativeResponseContext?: string | null,
  baseSystemPrompt?: string
): AsyncGenerator<string, void, unknown> {
  const client = getAnthropicClient();

  // System prompt 구성
  let systemContent = baseSystemPrompt || 'You are Claude, a helpful AI assistant created by Anthropic. You are thoughtful, nuanced, and aim to be genuinely helpful.';

  if (customInstructions) {
    systemContent += `\n\nUser preferences:\n${customInstructions}`;
  }

  if (modelSwitchContext) {
    systemContent += `\n\nRecent conversation context (model switch):\n${modelSwitchContext}\n\nContinue seamlessly from this context.`;
  }

  if (summary) {
    systemContent += `\n\nPrevious conversation summary:\n${summary}\n\nContinue the conversation naturally.`;
  }

  if (alternativeResponseContext) {
    systemContent += `\n\n[IMPORTANT - Alternative Response Mode]\n${alternativeResponseContext}`;
  }

  // Anthropic API requires messages to start with user and alternate
  // Filter out system messages and ensure proper format
  const chatMessages: ChatMessage[] = messages
    .filter((m) => m.role !== 'system')
    .map((m) => ({
      role: m.role as 'user' | 'assistant',
      content: m.content,
    }));

  // Ensure messages start with user
  if (chatMessages.length > 0 && chatMessages[0].role !== 'user') {
    chatMessages.unshift({
      role: 'user',
      content: '(continuing conversation)',
    });
  }

  // Ensure alternating pattern
  const cleanedMessages: ChatMessage[] = [];
  for (let i = 0; i < chatMessages.length; i++) {
    const expectedRole = i % 2 === 0 ? 'user' : 'assistant';
    if (chatMessages[i].role === expectedRole) {
      cleanedMessages.push(chatMessages[i]);
    } else if (expectedRole === 'user') {
      cleanedMessages.push({ role: 'user', content: '(continuing)' });
      cleanedMessages.push(chatMessages[i]);
    } else {
      cleanedMessages.push({ role: 'assistant', content: 'I understand.' });
      cleanedMessages.push(chatMessages[i]);
    }
  }

  // Ensure ends with user message (the last message to respond to)
  if (cleanedMessages.length > 0 && cleanedMessages[cleanedMessages.length - 1].role === 'assistant') {
    // This shouldn't happen normally, but handle it
    cleanedMessages.push({ role: 'user', content: 'Please continue.' });
  }

  const stream = await client.messages.stream({
    model: providerModelId,
    max_tokens: 4096,
    system: systemContent,
    messages: cleanedMessages,
  });

  for await (const event of stream) {
    if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
      yield event.delta.text;
    }
  }
}

// Helper to check if error is quota related
export function isClaudeQuotaError(error: unknown): boolean {
  if (error instanceof Error) {
    return error.message.includes('429') ||
           error.message.includes('quota') ||
           error.message.includes('rate_limit') ||
           error.message.includes('overloaded');
  }
  return false;
}

// Get user-friendly error message
export function getClaudeErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    if (error.message.includes('429') || error.message.includes('quota') || error.message.includes('rate_limit')) {
      return 'Claude 서비스가 일시적으로 사용량 한도에 도달했습니다. 다른 모델을 사용해 주세요.';
    }
    if (error.message.includes('overloaded')) {
      return 'Claude 서비스가 현재 과부하 상태입니다. 잠시 후 다시 시도해 주세요.';
    }
  }
  return 'Claude 응답 중 오류가 발생했습니다.';
}
