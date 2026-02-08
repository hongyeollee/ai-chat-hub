import { Mistral } from '@mistralai/mistralai';
import type { Message } from '@/types';

let mistralClient: Mistral | null = null;

function getMistralClient(): Mistral {
  if (!mistralClient) {
    const apiKey = process.env.MISTRAL_API_KEY;
    if (!apiKey) {
      throw new Error('MISTRAL_API_KEY is not configured');
    }
    mistralClient = new Mistral({ apiKey });
  }
  return mistralClient;
}

// Export client getter for model sync
export { getMistralClient };

interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

/**
 * Stream responses from Mistral AI
 * @param providerModelId - The actual Mistral model ID (e.g., 'mistral-small-latest')
 */
export async function* streamMistral(
  providerModelId: string,
  messages: Message[],
  summary?: string | null,
  customInstructions?: string | null,
  modelSwitchContext?: string | null,
  alternativeResponseContext?: string | null,
  baseSystemPrompt?: string
): AsyncGenerator<string, void, unknown> {
  const client = getMistralClient();

  // System prompt 구성
  let systemContent = baseSystemPrompt || 'You are Mistral AI, a helpful assistant created by Mistral AI. You are known for being fast, efficient, and helpful.';

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

  const chatMessages: ChatMessage[] = [
    { role: 'system', content: systemContent },
    ...messages.map((m) => ({
      role: m.role as 'user' | 'assistant',
      content: m.content,
    })),
  ];

  const stream = await client.chat.stream({
    model: providerModelId,
    messages: chatMessages,
  });

  for await (const event of stream) {
    const content = event.data.choices[0]?.delta?.content;
    if (content && typeof content === 'string') {
      yield content;
    }
  }
}

// Helper to check if error is quota related
export function isMistralQuotaError(error: unknown): boolean {
  if (error instanceof Error) {
    return error.message.includes('429') ||
           error.message.includes('quota') ||
           error.message.includes('rate limit');
  }
  return false;
}

// Get user-friendly error message
export function getMistralErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    if (error.message.includes('429') || error.message.includes('quota')) {
      return 'Mistral 서비스가 일시적으로 사용량 한도에 도달했습니다. 다른 모델을 사용해 주세요.';
    }
    if (error.message.includes('rate limit')) {
      return 'Mistral 요청이 너무 많습니다. 잠시 후 다시 시도해 주세요.';
    }
  }
  return 'Mistral 응답 중 오류가 발생했습니다.';
}
