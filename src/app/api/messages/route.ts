import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { streamOpenAI } from '@/lib/ai/openai';
import { streamGemini } from '@/lib/ai/gemini';
import { prepareMessagesForAI, shouldUpdateSummary, generateSummary, buildModelSwitchContext } from '@/lib/ai/context';
import { getKoreanDate, canMakeRequest, getRemainingUsage } from '@/lib/utils/usage';
import type { Message, AIModel, Profile } from '@/types';

// POST /api/messages - Send a message and get AI response (streaming)
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const { conversationId, content, model, previousModel, parentMessageId } = await request.json();

    if (!content || typeof content !== 'string') {
      return NextResponse.json(
        { success: false, error: 'Content is required' },
        { status: 400 }
      );
    }

    if (!model || !['gpt-4o-mini', 'gemini-2.5-flash'].includes(model)) {
      return NextResponse.json(
        { success: false, error: 'Invalid model' },
        { status: 400 }
      );
    }

    // Check usage limits
    const dateKr = getKoreanDate();
    const { data: usage } = await supabase
      .from('daily_usage')
      .select('*')
      .eq('user_id', user.id)
      .eq('date_kr', dateKr)
      .single();

    const requestCount = usage?.request_count || 0;
    const charCount = usage?.char_count || 0;

    const { allowed, reason } = canMakeRequest(requestCount, charCount);
    if (!allowed) {
      return NextResponse.json(
        { success: false, error: reason },
        { status: 429 }
      );
    }

    // Fetch user profile for custom_instructions
    const { data: profile } = await supabase
      .from('profiles')
      .select('custom_instructions')
      .eq('id', user.id)
      .single();

    const customInstructions = (profile as Profile | null)?.custom_instructions || null;

    // Update last_active_at
    await supabase
      .from('profiles')
      .update({ last_active_at: new Date().toISOString() })
      .eq('id', user.id);

    let actualConversationId = conversationId;

    // Create conversation if not provided
    if (!conversationId) {
      const { data: newConversation, error: convError } = await supabase
        .from('conversations')
        .insert({ user_id: user.id })
        .select()
        .single();

      if (convError) {
        console.error('Failed to create conversation:', convError);
        return NextResponse.json(
          { success: false, error: 'Failed to create conversation' },
          { status: 500 }
        );
      }

      actualConversationId = newConversation.id;
    } else {
      // Verify conversation belongs to user
      const { data: conversation, error: verifyError } = await supabase
        .from('conversations')
        .select('id, summary')
        .eq('id', conversationId)
        .eq('user_id', user.id)
        .single();

      if (verifyError || !conversation) {
        return NextResponse.json(
          { success: false, error: 'Conversation not found' },
          { status: 404 }
        );
      }
    }

    // parentMessageId가 제공된 경우: 기존 user message를 재사용 (다른 모델로 답변받기)
    // parentMessageId가 없는 경우: 새 user message 생성
    let userMessageId = parentMessageId;

    if (!parentMessageId) {
      // Save user message
      const { data: userMessage, error: userMsgError } = await supabase
        .from('messages')
        .insert({
          conversation_id: actualConversationId,
          role: 'user',
          content,
          model,
        })
        .select()
        .single();

      if (userMsgError) {
        console.error('Failed to save user message:', userMsgError);
        return NextResponse.json(
          { success: false, error: 'Failed to save message' },
          { status: 500 }
        );
      }

      userMessageId = userMessage.id;
    }

    // Get conversation data and messages for context
    const { data: conversation } = await supabase
      .from('conversations')
      .select('summary')
      .eq('id', actualConversationId)
      .single();

    const { data: allMessages } = await supabase
      .from('messages')
      .select('*')
      .eq('conversation_id', actualConversationId)
      .order('created_at', { ascending: true });

    const { messages: contextMessages, summary } = prepareMessagesForAI(
      (allMessages as Message[]) || [],
      conversation?.summary || null
    );

    const modelChanged = previousModel && previousModel !== model;
    const modelSwitchContext = modelChanged
      ? buildModelSwitchContext((allMessages as Message[]) || [])
      : null;

    // Create streaming response
    const encoder = new TextEncoder();
    let fullResponse = '';

    const stream = new ReadableStream({
      async start(controller) {
        try {
          // Send conversation ID first
          controller.enqueue(
            encoder.encode(`event: meta\ndata: ${JSON.stringify({ conversationId: actualConversationId, userMessageId })}\n\n`)
          );

          // Stream AI response (custom_instructions 포함)
          const streamFn = model === 'gpt-4o-mini' ? streamOpenAI : streamGemini;

          for await (const token of streamFn(contextMessages, summary, customInstructions, modelSwitchContext)) {
            fullResponse += token;
            controller.enqueue(
              encoder.encode(`event: token\ndata: ${JSON.stringify({ token })}\n\n`)
            );
          }

          // Save assistant message
          const { data: assistantMessage } = await supabase
            .from('messages')
            .insert({
              conversation_id: actualConversationId,
              parent_message_id: userMessageId,
              role: 'assistant',
              content: fullResponse,
              model,
            })
            .select()
            .single();

          // Update usage
          await supabase
            .from('daily_usage')
            .upsert({
              user_id: user.id,
              date_kr: dateKr,
              request_count: requestCount + 1,
              char_count: charCount + content.length,
              updated_at: new Date().toISOString(),
            });

          const remainingUsage = getRemainingUsage(
            requestCount + 1,
            charCount + content.length
          );

          // Update conversation timestamp
          await supabase
            .from('conversations')
            .update({ updated_at: new Date().toISOString() })
            .eq('id', actualConversationId);

          // Check if we need to update summary
          const totalMessages = (allMessages?.length || 0) + 2; // +2 for new user and assistant messages
          if (shouldUpdateSummary(totalMessages)) {
            const newSummary = await generateSummary((allMessages as Message[]) || []);
            await supabase
              .from('conversations')
              .update({ summary: newSummary })
              .eq('id', actualConversationId);
          }

          controller.enqueue(
            encoder.encode(
              `event: done\ndata: ${JSON.stringify({
                messageId: assistantMessage?.id,
                remainingRequests: remainingUsage.remainingRequests,
              })}\n\n`
            )
          );
          controller.close();
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Unknown error';
          console.error('Streaming error:', error);
          console.error('Error details:', {
            model,
            conversationId: actualConversationId,
            messageCount: contextMessages.length,
            errorMessage,
          });
          controller.enqueue(
            encoder.encode(`event: error\ndata: ${JSON.stringify({ error: errorMessage })}\n\n`)
          );
          controller.close();
        }
      },
    });

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive',
      },
    });
  } catch (error) {
    console.error('Messages POST error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
