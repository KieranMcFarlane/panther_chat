import { NextRequest, NextResponse } from 'next/server';
import { emailVersions, emailThreads } from '@/lib/email-storage';

// Get or create email thread and save version
export async function POST(request: NextRequest) {
  try {
    const { 
      toEmail, 
      subject, 
      content, 
      changeType = 'user_edit',
      changeDescription,
      userId,
      metadata = {}
    } = await request.json();

    if (!toEmail || !content) {
      return NextResponse.json({ error: 'toEmail and content are required' }, { status: 400 });
    }

    // Generate thread ID based on email and subject
    const threadKey = `${toEmail}:${subject || 'no-subject'}`;
    
    // Get or create thread
    let threadId = emailThreads.get(threadKey)?.id;
    if (!threadId) {
      threadId = `thread_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      emailThreads.set(threadKey, {
        id: threadId,
        toEmail,
        subject,
        userId,
        metadata,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      });
    }

    // Create new version
    const versionId = `version_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const newVersion = {
      id: versionId,
      threadId,
      version_number: (emailVersions.get(threadId)?.length || 0) + 1,
      content,
      subject,
      to_email: toEmail,
      change_type: changeType,
      change_description: changeDescription,
      created_at: new Date().toISOString(),
      metadata
    };

    // Store version
    if (!emailVersions.has(threadId)) {
      emailVersions.set(threadId, []);
    }
    emailVersions.get(threadId)!.push(newVersion);

    return NextResponse.json({
      success: true,
      threadId,
      versionId,
      message: 'Email version saved successfully'
    });

  } catch (error) {
    console.error('Save email version error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// Get version history for an email thread
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const threadId = searchParams.get('threadId');
    const toEmail = searchParams.get('toEmail');
    const subject = searchParams.get('subject');
    const limit = parseInt(searchParams.get('limit') || '50');

    if (!threadId && (!toEmail)) {
      return NextResponse.json({ error: 'Either threadId or toEmail is required' }, { status: 400 });
    }

    let targetThreadId = threadId;

    // If no threadId, try to find thread by email and subject
    if (!targetThreadId && toEmail) {
      const threadKey = `${toEmail}:${subject || 'no-subject'}`;
      const thread = emailThreads.get(threadKey);
      targetThreadId = thread?.id;
    }

    if (!targetThreadId) {
      // Return empty result for new threads
      return NextResponse.json({
        success: true,
        threadId: null,
        versions: [],
        count: 0
      });
    }

    // Get version history from memory
    const versions = emailVersions.get(targetThreadId) || [];
    const limitedVersions = versions.slice(-limit);

    return NextResponse.json({
      success: true,
      threadId: targetThreadId,
      versions: limitedVersions,
      count: limitedVersions.length
    });

  } catch (error) {
    console.error('Get email history error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}