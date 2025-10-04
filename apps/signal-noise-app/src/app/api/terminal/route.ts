import { NextRequest, NextResponse } from 'next/server';

const EC2_HOST = '13.60.60.50';
const EC2_USER = 'ec2-user';
const KEY_PATH = process.env.NODE_ENV === 'production' 
  ? '/home/ec2-user/yellowpanther.pem' 
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
        url: `http://localhost:7681`,
        command: `ttyd -p 7681 ssh -i ${KEY_PATH} ${EC2_USER}@${EC2_HOST}`
      });
    }

    if (action === 'status') {
      // Check if ttyd is running
      return NextResponse.json({
        success: true,
        running: false, // Would check actual process
        url: `http://localhost:7681`
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