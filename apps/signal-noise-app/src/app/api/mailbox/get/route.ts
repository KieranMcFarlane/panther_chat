import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
);

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const emailId = searchParams.get('id');

    if (!emailId) {
      return NextResponse.json(
        { error: 'Missing email ID' },
        { status: 400 }
      );
    }

    // Try to fetch from Supabase
    try {
      const { data, error } = await supabase
        .from('emails')
        .select('*')
        .eq('id', emailId)
        .single();

      if (error && error.code !== '42P01') {
        throw error;
      }

      if (data) {
        const email = {
          id: data.id,
          from: data.from,
          fromName: data.from_name || data.from.split('@')[0],
          subject: data.subject,
          preview: data.preview || data.body?.substring(0, 100) || '',
          body: data.body || '',
          date: new Date(data.sent_at || data.created_at),
          read: data.read || false,
          folder: data.folder || 'inbox',
          tags: data.tags || [],
        };

        return NextResponse.json({ email });
      }
    } catch (dbError) {
      console.warn('Using sample email data');
    }

    // Return sample data if not found in database
    return NextResponse.json({
      error: 'Email not found',
    }, { status: 404 });
  } catch (error) {
    console.error('Error fetching email:', error);
    return NextResponse.json(
      {
        error: 'Failed to fetch email',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}











