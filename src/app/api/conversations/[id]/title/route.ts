import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { generateTitle } from '@/lib/ai/openai';
import type { Message } from '@/types';

// POST /api/conversations/[id]/title - Generate and update conversation title
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Verify conversation belongs to user and get current title
    const { data: conversation, error: convError } = await supabase
      .from('conversations')
      .select('id, title')
      .eq('id', id)
      .eq('user_id', user.id)
      .single();

    if (convError || !conversation) {
      return NextResponse.json(
        { success: false, error: 'Conversation not found' },
        { status: 404 }
      );
    }

    // Only generate title if it's null
    if (conversation.title) {
      return NextResponse.json({ success: true, data: { title: conversation.title } });
    }

    // Get messages for title generation
    const { data: messages, error: msgError } = await supabase
      .from('messages')
      .select('*')
      .eq('conversation_id', id)
      .order('created_at', { ascending: true })
      .limit(4);

    if (msgError || !messages || messages.length === 0) {
      return NextResponse.json(
        { success: false, error: 'No messages found' },
        { status: 400 }
      );
    }

    // Generate title using AI
    const title = await generateTitle(messages as Message[]);

    // Update conversation title
    const { error: updateError } = await supabase
      .from('conversations')
      .update({ title, updated_at: new Date().toISOString() })
      .eq('id', id);

    if (updateError) {
      console.error('Failed to update title:', updateError);
      return NextResponse.json(
        { success: false, error: 'Failed to update title' },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true, data: { title } });
  } catch (error) {
    console.error('Title generation error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
