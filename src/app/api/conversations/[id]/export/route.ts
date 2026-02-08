import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { TIER_LIMITS, AI_MODEL_INFO, type SubscriptionTier, type Message, type AIModel } from '@/types';

interface ExportedMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
  model: string;
  modelName: string;
  timestamp: string;
}

interface ExportedConversation {
  id: string;
  title: string | null;
  summary: string | null;
  messages: ExportedMessage[];
  exportedAt: string;
  format: 'json' | 'markdown';
}

// GET /api/conversations/[id]/export - Export conversation
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const { id: conversationId } = await params;

    // 프로필에서 구독 티어 가져오기
    const { data: profile } = await supabase
      .from('profiles')
      .select('subscription_tier')
      .eq('id', user.id)
      .single();

    const tier = (profile?.subscription_tier || 'free') as SubscriptionTier;
    const tierConfig = TIER_LIMITS[tier];

    // 대화 내보내기 기능 확인
    if (!tierConfig.features.exportConversation) {
      return NextResponse.json(
        {
          success: false,
          error: 'export_not_allowed',
          message: '대화 내보내기는 Light 이상 티어에서 사용 가능합니다.',
        },
        { status: 403 }
      );
    }

    // 대화 정보 가져오기
    const { data: conversation, error: convError } = await supabase
      .from('conversations')
      .select('*')
      .eq('id', conversationId)
      .eq('user_id', user.id)
      .single();

    if (convError || !conversation) {
      return NextResponse.json(
        { success: false, error: 'Conversation not found' },
        { status: 404 }
      );
    }

    // 메시지 가져오기
    const { data: messages, error: msgError } = await supabase
      .from('messages')
      .select('*')
      .eq('conversation_id', conversationId)
      .order('created_at', { ascending: true });

    if (msgError) {
      return NextResponse.json(
        { success: false, error: 'Failed to fetch messages' },
        { status: 500 }
      );
    }

    // 포맷 확인
    const format = request.nextUrl.searchParams.get('format') || 'json';

    // 메시지 변환
    const exportedMessages: ExportedMessage[] = (messages as Message[]).map((msg) => {
      const modelInfo = AI_MODEL_INFO[msg.model as AIModel];
      return {
        role: msg.role,
        content: msg.content,
        model: msg.model,
        modelName: modelInfo?.name || msg.model,
        timestamp: msg.created_at,
      };
    });

    const exportData: ExportedConversation = {
      id: conversation.id,
      title: conversation.title,
      summary: conversation.summary,
      messages: exportedMessages,
      exportedAt: new Date().toISOString(),
      format: format as 'json' | 'markdown',
    };

    if (format === 'markdown') {
      // Markdown 형식으로 변환
      const markdown = convertToMarkdown(exportData);
      return new Response(markdown, {
        headers: {
          'Content-Type': 'text/markdown; charset=utf-8',
          'Content-Disposition': `attachment; filename="conversation-${conversationId}.md"`,
        },
      });
    }

    // JSON 형식
    return new Response(JSON.stringify(exportData, null, 2), {
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        'Content-Disposition': `attachment; filename="conversation-${conversationId}.json"`,
      },
    });
  } catch (error) {
    console.error('Export error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// Markdown 변환 함수
function convertToMarkdown(data: ExportedConversation): string {
  const lines: string[] = [];

  // 헤더
  lines.push(`# ${data.title || 'Untitled Conversation'}`);
  lines.push('');
  lines.push(`**Exported:** ${new Date(data.exportedAt).toLocaleString()}`);
  lines.push('');

  // 요약
  if (data.summary) {
    lines.push('## Summary');
    lines.push('');
    lines.push(data.summary);
    lines.push('');
  }

  // 메시지
  lines.push('## Conversation');
  lines.push('');

  for (const msg of data.messages) {
    const timestamp = new Date(msg.timestamp).toLocaleString();
    const roleLabel = msg.role === 'user' ? '**You**' : `**${msg.modelName}**`;

    lines.push(`### ${roleLabel}`);
    lines.push(`*${timestamp}*`);
    lines.push('');
    lines.push(msg.content);
    lines.push('');
    lines.push('---');
    lines.push('');
  }

  lines.push('');
  lines.push('*Exported from NexusAI*');

  return lines.join('\n');
}
