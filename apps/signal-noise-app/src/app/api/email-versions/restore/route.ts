import { NextRequest, NextResponse } from 'next/server';
import { emailVersions } from '@/lib/email-storage';

// Restore email to specific version
export async function POST(request: NextRequest) {
  try {
    const { threadId, versionNumber } = await request.json();

    if (!threadId || !versionNumber) {
      return NextResponse.json({ error: 'threadId and versionNumber are required' }, { status: 400 });
    }

    // Find the version to restore
    const versions = emailVersions.get(threadId) || [];
    const targetVersion = versions.find(v => v.version_number === versionNumber);

    if (!targetVersion) {
      return NextResponse.json({ error: 'Version not found' }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      restoredVersion: {
        content: targetVersion.content,
        subject: targetVersion.subject,
        to_email: targetVersion.to_email,
        version_number: targetVersion.version_number
      },
      message: `Email restored to version ${versionNumber}`
    });

  } catch (error) {
    console.error('Restore email version error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}