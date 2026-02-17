import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import {
  getMessagesForContextByTier,
  shouldUpdateSummary,
  generateSummary,
  buildModelSwitchContext,
} from '@/lib/ai/context';
import {
  getKoreanDate,
  getEffectiveLimits,
  checkUsageWithOverride,
  validateInputLengthWithOverride,
  isModelAllowedWithOverride,
} from '@/lib/utils/usage';
import { getUserCredits, deductCredits } from '@/lib/utils/credits';
import type { Message, AIModel, Profile, SubscriptionTier } from '@/types';
import { TIER_LIMITS, AI_MODEL_INFO } from '@/types';
import {
  getStreamGenerator,
  getProviderErrorMessage,
} from '@/lib/ai/provider-factory';
import { isValidModel, getEnabledModelIds } from '@/config/models';

// 지원되는 모델 목록 - MODEL_REGISTRY에서 동적으로 가져옴
const SUPPORTED_MODELS = getEnabledModelIds();

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

    const { conversationId, content, model, previousModel, parentMessageId, isAlternativeResponse } = await request.json();

    if (!content || typeof content !== 'string') {
      return NextResponse.json(
        { success: false, error: 'Content is required' },
        { status: 400 }
      );
    }

    if (!model || !isValidModel(model)) {
      return NextResponse.json(
        { success: false, error: 'Invalid model' },
        { status: 400 }
      );
    }

    // 프로필에서 구독 티어, 메모리 설정, 커스텀 지시사항 가져오기
    const { data: profile } = await supabase
      .from('profiles')
      .select('subscription_tier, custom_instructions, memory_enabled')
      .eq('id', user.id)
      .single();

    const tier = (profile?.subscription_tier || 'free') as SubscriptionTier;
    const tierConfig = TIER_LIMITS[tier];
    const customInstructions = (profile as Profile | null)?.custom_instructions || null;
    const memoryEnabled = (profile as Profile | null)?.memory_enabled ?? true;

    // 오버라이드 적용된 실제 제한값 가져오기
    const effectiveLimits = await getEffectiveLimits(user.id, tier);

    // 모델 접근 권한 확인 (오버라이드 적용)
    const modelAllowed = await isModelAllowedWithOverride(user.id, model, tier);
    if (!modelAllowed) {
      const modelInfo = AI_MODEL_INFO[model as AIModel];
      return NextResponse.json(
        {
          success: false,
          error: 'model_not_allowed',
          message: `${modelInfo.name}은(는) 현재 사용할 수 없습니다. 업그레이드가 필요합니다.`,
        },
        { status: 403 }
      );
    }

    // 입력 글자 수 검증 (오버라이드 적용)
    const inputValidation = await validateInputLengthWithOverride(user.id, content, tier);
    if (!inputValidation.valid) {
      return NextResponse.json(
        {
          success: false,
          error: 'input_too_long',
          message: `입력이 너무 깁니다. (${inputValidation.currentLength}자 / 최대 ${inputValidation.maxLength}자)`,
        },
        { status: 400 }
      );
    }

    // 사용량 확인 (오버라이드 적용 - Free/테스터: 일일 횟수, 유료: 크레딧)
    const dateKr = getKoreanDate();
    let dailyRequestCount = 0;
    let dailyCharCount = 0;
    let availableCredits = 0;

    // 일일 사용량 조회 (daily 방식용)
    const { data: dailyUsage } = await supabase
      .from('daily_usage')
      .select('*')
      .eq('user_id', user.id)
      .eq('date_kr', dateKr)
      .single();

    dailyRequestCount = dailyUsage?.request_count || 0;
    dailyCharCount = dailyUsage?.char_count || 0;

    // 크레딧 조회 (credits 방식용)
    const credits = await getUserCredits(user.id);
    availableCredits = credits?.available || 0;

    // 오버라이드 적용된 사용량 체크
    const usageCheck = await checkUsageWithOverride(
      user.id,
      tier,
      dailyRequestCount,
      availableCredits,
      model
    );

    if (!usageCheck.allowed) {
      if (usageCheck.usageType === 'daily') {
        return NextResponse.json(
          { success: false, error: usageCheck.reason },
          { status: 429 }
        );
      } else {
        return NextResponse.json(
          {
            success: false,
            error: usageCheck.reason,
            message: `크레딧이 부족합니다. (잔여: ${availableCredits}, 필요: ${usageCheck.creditsNeeded})`,
          },
          { status: 429 }
        );
      }
    }

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

    // 메모리 활성화 여부에 따라 컨텍스트 메시지 처리
    // memoryEnabled가 false여도 최근 4개 메시지는 포함 (연속 대화 context 보장)
    const MIN_CONTEXT_MESSAGES = 4;
    let contextMessages = memoryEnabled
      ? getMessagesForContextByTier((allMessages as Message[]) || [], tier)
      : ((allMessages as Message[]) || []).slice(-MIN_CONTEXT_MESSAGES);

    if (contextMessages.length === 0) {
      contextMessages = [
        {
          id: userMessageId || 'temp-user-message',
          conversation_id: actualConversationId || 'temp-conversation',
          role: 'user',
          content,
          model,
          created_at: new Date().toISOString(),
        },
      ];
    }

    // Pro/Enterprise 티어만 요약 사용 (메모리 비활성화 시 요약도 미사용)
    const useSummary = memoryEnabled && (tier === 'pro' || tier === 'enterprise');
    const summary = useSummary ? conversation?.summary || null : null;

    const modelChanged = previousModel && previousModel !== model;
    const modelSwitchContext = modelChanged
      ? buildModelSwitchContext((allMessages as Message[]) || [])
      : null;

    // Build alternative response context if this is an alternative response request
    let alternativeResponseContext: string | null = null;
    if (isAlternativeResponse && parentMessageId) {
      // Find the original user question and the other AI's response
      const userQuestion = (allMessages as Message[])?.find(m => m.id === parentMessageId);
      const otherAiResponses = (allMessages as Message[])?.filter(
        m => m.parent_message_id === parentMessageId && m.role === 'assistant'
      );

      if (userQuestion && otherAiResponses.length > 0) {
        const otherResponses = otherAiResponses
          .map(r => {
            const modelInfo = AI_MODEL_INFO[r.model as AIModel];
            const modelName = modelInfo?.name || r.model;
            return `${modelName}: ${r.content.slice(0, 500)}${r.content.length > 500 ? '...' : ''}`;
          })
          .join('\n\n');

        alternativeResponseContext = `The user asked: "${userQuestion.content}"

Another AI has already provided a response:
${otherResponses}

Now it's YOUR turn to answer the SAME question. Provide your own unique perspective and answer. Focus on answering the user's question directly with your own knowledge and approach.`;
      }
    }

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

          // Stream AI response using provider factory
          const streamGenerator = getStreamGenerator(model, {
            messages: contextMessages,
            summary,
            customInstructions,
            modelSwitchContext,
            alternativeResponseContext,
          });

          for await (const token of streamGenerator) {
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

          // Update usage based on effective usage type (override applied)
          let remainingUsage: { remainingRequests?: number; remainingCredits?: number } = {};

          if (usageCheck.usageType === 'daily') {
            // 일일 횟수 방식 (Free 티어 또는 daily 오버라이드 테스터)
            await supabase
              .from('daily_usage')
              .upsert({
                user_id: user.id,
                date_kr: dateKr,
                request_count: dailyRequestCount + 1,
                char_count: dailyCharCount + content.length,
                updated_at: new Date().toISOString(),
              });

            const maxRequests = effectiveLimits.dailyRequests || 10;
            remainingUsage = { remainingRequests: Math.max(0, maxRequests - dailyRequestCount - 1) };
          } else {
            // 크레딧 방식 (유료 티어 또는 credits 오버라이드 테스터)
            const deductResult = await deductCredits(
              user.id,
              model,
              assistantMessage?.id
            );

            if (deductResult.success) {
              remainingUsage = { remainingCredits: deductResult.remaining };
            } else {
              console.error('Failed to deduct credits:', deductResult.error);
            }
          }

          // Update conversation timestamp
          await supabase
            .from('conversations')
            .update({ updated_at: new Date().toISOString() })
            .eq('id', actualConversationId);

          // Check if we need to update summary (Pro/Enterprise only)
          const totalMessages = (allMessages?.length || 0) + 2; // +2 for new user and assistant messages
          if (shouldUpdateSummary(totalMessages, tier)) {
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
                tier,
                usageType: usageCheck.usageType,
                hasOverride: effectiveLimits.hasOverride,
                ...remainingUsage,
              })}\n\n`
            )
          );
          controller.close();
        } catch (error) {
          const rawErrorMessage = error instanceof Error ? error.message : 'Unknown error';
          console.error('Streaming error:', error);
          console.error('Error details:', {
            model,
            conversationId: actualConversationId,
            messageCount: contextMessages.length,
            errorMessage: rawErrorMessage,
          });

          // Use provider factory for error message
          const userFriendlyMessage = getProviderErrorMessage(model, error);

          controller.enqueue(
            encoder.encode(`event: error\ndata: ${JSON.stringify({ error: userFriendlyMessage })}\n\n`)
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
