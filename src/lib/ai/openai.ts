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

interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

export async function* streamOpenAI(
  messages: Message[],
  summary?: string | null,
  customInstructions?: string | null,
  modelSwitchContext?: string | null
): AsyncGenerator<string, void, unknown> {
  const openai = getOpenAIClient();

  // System prompt 구성
  // 1. 기본 역할
  // 2. 사용자 맞춤 지시사항 (custom_instructions)
  // 3. 이전 대화 요약 (summary)
  let systemContent = 'You are a helpful AI assistant.';

  if (customInstructions) {
    systemContent += `\n\nUser preferences:\n${customInstructions}`;
  }

  if (modelSwitchContext) {
    systemContent += `\n\nRecent conversation context (model switch):\n${modelSwitchContext}\n\nContinue seamlessly from this context.`;
  }

  if (summary) {
    systemContent += `\n\nPrevious conversation summary:\n${summary}\n\nContinue the conversation naturally.`;
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
    model: 'gpt-4o-mini',
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
