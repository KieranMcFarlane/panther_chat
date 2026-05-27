import { NextRequest, NextResponse } from 'next/server';

const EC2_HOST = process.env.TERMINAL_SSH_HOST || process.env.VPS_PUBLIC_HOST || '127.0.0.1';
const EC2_USER = process.env.TERMINAL_SSH_USER || 'ubuntu';
const KEY_PATH = process.env.NODE_ENV === 'production' 
  ? process.env.TERMINAL_SSH_KEY_PATH || '/home/ubuntu/.ssh/id_rsa'
  : '/Users/kieranmcfarlane/Downloads/panther_chat/yellowpanther.pem';

export async function POST(request: NextRequest) {
  try {
    const { action } = await request.json();

    if (action === 'start') {
      // In a real implementation, this would start ttyd on the server
      // For now, we'll simulate the response
      return NextResponse.json({
        success: true,
        message: 'Terminal started successfully',
        url: `${process.env.TTYD_PUBLIC_URL || 'http://127.0.0.1:7681'}`,
        command: `ttyd -p 7681 ssh -i ${KEY_PATH} ${EC2_USER}@${EC2_HOST}`
      });
    }

    if (action === 'status') {
      // Check if ttyd is running
      return NextResponse.json({
        success: true,
        running: false, // Would check actual process
        url: `${process.env.TTYD_PUBLIC_URL || 'http://127.0.0.1:7681'}`
      });
    }

    return NextResponse.json({ success: false, message: 'Unknown action' });
  } catch (error) {
    console.error('Terminal API error:', error);
    return NextResponse.json(
      { success: false, message: 'Internal server error' },
      { status: 500 }
    );
  }
}
