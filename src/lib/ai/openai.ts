import OpenAI from 'openai';
import type { Message } from '@/types';

let openaiClient: OpenAI | null = null;

function getOpenAIClient(): OpenAI {
  if (!openaiClient) {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      throw new Error('OPENAI_API_KEY is not configured');
    }
    openaiClient = new OpenAI({ apiKey });
  }
  return openaiClient;
}

// Export client getter for model sync
export { getOpenAIClient };

interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

/**
 * Stream responses from OpenAI
 * @param providerModelId - The actual OpenAI model ID (e.g., 'gpt-4o-mini', 'gpt-4o')
 */
export async function* streamOpenAI(
  providerModelId: string,
  messages: Message[],
  summary?: string | null,
  customInstructions?: string | null,
  modelSwitchContext?: string | null,
  alternativeResponseContext?: string | null,
  baseSystemPrompt?: string
): AsyncGenerator<string, void, unknown> {
  const openai = getOpenAIClient();

  // System prompt 구성
  let systemContent = baseSystemPrompt || 'You are a helpful AI assistant powered by OpenAI.';

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

  const systemMessage: ChatMessage = {
    role: 'system',
    content: systemContent,
  };

  const chatMessages: ChatMessage[] = [
    systemMessage,
    ...messages.map((m) => ({
      role: m.role as 'user' | 'assistant',
      content: m.content,
    })),
  ];

  const stream = await openai.chat.completions.create({
    model: providerModelId,
    messages: chatMessages,
    stream: true,
  });

  for await (const chunk of stream) {
    const content = chunk.choices[0]?.delta?.content;
    if (content) {
      yield content;
    }
  }
}

// Helper to check if error is quota related
export function isQuotaError(error: unknown): boolean {
  if (error instanceof Error) {
    return error.message.includes('429') ||
           error.message.includes('quota') ||
           error.message.includes('rate limit');
  }
  return false;
}

// Get user-friendly error message
export function getOpenAIErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    if (error.message.includes('429') || error.message.includes('quota')) {
      return 'GPT 서비스가 일시적으로 사용량 한도에 도달했습니다. Gemini를 사용해 주세요.';
    }
    if (error.message.includes('rate limit')) {
      return 'GPT 요청이 너무 많습니다. 잠시 후 다시 시도해 주세요.';
    }
  }
  return 'GPT 응답 중 오류가 발생했습니다.';
}

export async function generateSummary(messages: Message[]): Promise<string> {
  const openai = getOpenAIClient();

  const conversationText = messages
    .map((m) => `${m.role}: ${m.content}`)
    .join('\n');

  const response = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [
      {
        role: 'system',
        content:
          'Summarize the following conversation in 2-3 sentences, capturing the key topics and context.',
      },
      {
        role: 'user',
        content: conversationText,
      },
    ],
    max_tokens: 200,
  });

  return response.choices[0]?.message?.content || '';
}

export async function generateTitle(messages: Message[]): Promise<string> {
  const openai = getOpenAIClient();

  const conversationText = messages
    .slice(0, 4)
    .map((m) => `${m.role}: ${m.content}`)
    .join('\n');

  const response = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [
      {
        role: 'system',
        content:
          'Generate a short title (max 6 words) for this conversation. Return only the title, no quotes or punctuation.',
      },
      {
        role: 'user',
        content: conversationText,
      },
    ],
    max_tokens: 20,
  });

  return response.choices[0]?.message?.content?.trim() || 'New Conversation';
}
