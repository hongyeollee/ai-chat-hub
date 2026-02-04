import { GoogleGenerativeAI, type GenerativeModel } from '@google/generative-ai';
import type { Message } from '@/types';

let genAIClient: GoogleGenerativeAI | null = null;
let geminiModel: GenerativeModel | null = null;

function getGeminiModel(): GenerativeModel {
  if (!geminiModel) {
    const apiKey = process.env.GOOGLE_GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error('GOOGLE_GEMINI_API_KEY is not configured');
    }
    genAIClient = new GoogleGenerativeAI(apiKey);
    geminiModel = genAIClient.getGenerativeModel({ model: 'gemini-2.5-flash' });
  }
  return geminiModel;
}

interface GeminiContent {
  role: 'user' | 'model';
  parts: { text: string }[];
}

export async function* streamGemini(
  messages: Message[],
  summary?: string | null,
  customInstructions?: string | null,
  modelSwitchContext?: string | null,
  alternativeResponseContext?: string | null
): AsyncGenerator<string, void, unknown> {
  const model = getGeminiModel();

  const history: GeminiContent[] = [];

  // Add custom instructions and summary as context if available
  let contextParts: string[] = [];

  if (customInstructions) {
    contextParts.push(`[User preferences: ${customInstructions}]`);
  }

  if (modelSwitchContext) {
    contextParts.push(`[Recent conversation context after model switch:\n${modelSwitchContext}]`);
  }

  if (summary) {
    contextParts.push(`[Previous conversation summary: ${summary}]`);
  }

  if (alternativeResponseContext) {
    contextParts.push(`[IMPORTANT - Alternative Response Mode]\n${alternativeResponseContext}`);
  }

  if (contextParts.length > 0) {
    history.push({
      role: 'user',
      parts: [{ text: contextParts.join('\n\n') }],
    });
    history.push({
      role: 'model',
      parts: [{ text: 'I understand the context and your preferences. Please continue.' }],
    });
  }

  // Convert messages to Gemini format
  // Gemini requires alternating user/model messages
  const geminiMessages = messages.map((m) => ({
    role: (m.role === 'assistant' ? 'model' : 'user') as 'user' | 'model',
    parts: [{ text: m.content }],
  }));

  // Get the last message as the current prompt
  const lastMessage = geminiMessages.pop();
  if (!lastMessage) {
    throw new Error('No messages provided');
  }

  // Merge consecutive same-role messages
  const mergedHistory: GeminiContent[] = [...history];
  for (const msg of geminiMessages) {
    const lastHistoryMsg = mergedHistory[mergedHistory.length - 1];
    if (lastHistoryMsg && lastHistoryMsg.role === msg.role) {
      // Merge with previous message
      lastHistoryMsg.parts.push({ text: msg.parts[0].text });
    } else {
      mergedHistory.push(msg);
    }
  }

  // Ensure history starts with user and alternates
  const cleanedHistory: GeminiContent[] = [];
  for (let i = 0; i < mergedHistory.length; i++) {
    const expectedRole = i % 2 === 0 ? 'user' : 'model';
    if (mergedHistory[i].role === expectedRole) {
      cleanedHistory.push(mergedHistory[i]);
    } else if (expectedRole === 'user') {
      // Insert placeholder user message
      cleanedHistory.push({
        role: 'user',
        parts: [{ text: '(continuing conversation)' }],
      });
      cleanedHistory.push(mergedHistory[i]);
    } else {
      // Insert placeholder model message
      cleanedHistory.push({
        role: 'model',
        parts: [{ text: 'I understand.' }],
      });
      cleanedHistory.push(mergedHistory[i]);
    }
  }

  // Ensure history length is even (ends with model)
  if (cleanedHistory.length % 2 !== 0) {
    cleanedHistory.push({
      role: 'model',
      parts: [{ text: 'I understand. Please continue.' }],
    });
  }

  const chat = model.startChat({
    history: cleanedHistory,
  });

  const result = await chat.sendMessageStream(lastMessage.parts[0].text);

  for await (const chunk of result.stream) {
    const text = chunk.text();
    if (text) {
      yield text;
    }
  }
}
