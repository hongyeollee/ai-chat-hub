import OpenAI from 'openai';
import type { Message } from '@/types';

let deepseekClient: OpenAI | null = null;

function getDeepSeekClient(): OpenAI {
  if (!deepseekClient) {
    const apiKey = process.env.DEEPSEEK_API_KEY;
    if (!apiKey) {
      throw new Error('DEEPSEEK_API_KEY is not configured');
    }
    // DeepSeek uses OpenAI-compatible API
    deepseekClient = new OpenAI({
      apiKey,
      baseURL: 'https://api.deepseek.com/v1',
    });
  }
  return deepseekClient;
}

interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

export async function* streamDeepSeek(
  messages: Message[],
  summary?: string | null,
  customInstructions?: string | null,
  modelSwitchContext?: string | null,
  alternativeResponseContext?: string | null
): AsyncGenerator<string, void, unknown> {
  const client = getDeepSeekClient();

  // System prompt 구성
  let systemContent = 'You are DeepSeek, a helpful and knowledgeable AI assistant. You excel at coding, reasoning, and technical tasks.';

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

  const stream = await client.chat.completions.create({
    model: 'deepseek-chat',  // DeepSeek V3
    messages: chatMessages,
    stream: true,
    max_tokens: 4096,
  });

  for await (const chunk of stream) {
    const content = chunk.choices[0]?.delta?.content;
    if (content) {
      yield content;
    }
  }
}

// Helper to check if error is quota related
export function isDeepSeekQuotaError(error: unknown): boolean {
  if (error instanceof Error) {
    return error.message.includes('429') ||
           error.message.includes('quota') ||
           error.message.includes('rate limit') ||
           error.message.includes('insufficient_balance');
  }
  return false;
}

// Get user-friendly error message
export function getDeepSeekErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    if (error.message.includes('429') || error.message.includes('quota') || error.message.includes('insufficient_balance')) {
      return 'DeepSeek 서비스가 일시적으로 사용량 한도에 도달했습니다. 다른 모델을 사용해 주세요.';
    }
    if (error.message.includes('rate limit')) {
      return 'DeepSeek 요청이 너무 많습니다. 잠시 후 다시 시도해 주세요.';
    }
  }
  return 'DeepSeek 응답 중 오류가 발생했습니다.';
}
