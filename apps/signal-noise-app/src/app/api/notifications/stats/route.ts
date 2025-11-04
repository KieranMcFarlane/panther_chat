/**
 * Notification Statistics API - Get delivery stats and analytics
 */

import { NextRequest, NextResponse } from 'next/server';
import { notificationService } from '@/services/NotificationService';
import { supabase } from '@/lib/supabase-client';

// Mark route as dynamic to prevent static generation
export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

/**
 * Get notification delivery statistics
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const channel_type = searchParams.get('channel_type');
    const start_date = searchParams.get('start_date');
    const end_date = searchParams.get('end_date');
    const user_id = searchParams.get('user_id');

    // Get delivery stats
    const deliveryStats = await notificationService.getDeliveryStats({
      channel_type: channel_type || undefined,
      start_date: start_date || undefined,
      end_date: end_date || undefined
    });

    // Get PWA notification stats for user
    let pwaStats = null;
    if (user_id) {
      const { data: pwaData } = await supabase
        .from('pwa_notifications')
        .select('read, urgency_level, source_type')
        .eq('user_id', user_id);

      if (pwaData) {
        pwaStats = {
          total: pwaData.length,
          read: pwaData.filter(n => n.read).length,
          unread: pwaData.filter(n => !n.read).length,
          by_urgency: pwaData.reduce((acc, n) => {
            acc[n.urgency_level || 'unknown'] = (acc[n.urgency_level || 'unknown'] || 0) + 1;
            return acc;
          }, {} as Record<string, number>),
          by_source: pwaData.reduce((acc, n) => {
            acc[n.source_type || 'unknown'] = (acc[n.source_type || 'unknown'] || 0) + 1;
            return acc;
          }, {} as Record<string, number>)
        };
      }
    }

    return NextResponse.json({
      delivery_stats: deliveryStats,
      pwa_stats: pwaStats,
      filters: { channel_type, start_date, end_date, user_id },
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('❌ Failed to get notification stats:', error);
    return NextResponse.json({
      error: error instanceof Error ? error.message : 'Failed to get notification stats'
    }, { status: 500 });
  }
}