/**
 * Notifications API - Send and manage multi-channel notifications
 */

import { NextRequest, NextResponse } from 'next/server';
import { notificationService } from '@/services/NotificationService';

/**
 * Send notification through multiple channels
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { 
      message, 
      target_preferences, 
      metadata 
    } = body;

    // Validate required fields
    if (!message || !message.title || !message.body) {
      return NextResponse.json({
        error: 'Missing required fields: message.title and message.body'
      }, { status: 400 });
    }

    // Create notification message
    const notificationMessage = {
      id: message.id || `notif_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      title: message.title,
      body: message.body,
      data: message.data || {},
      icon: message.icon,
      image: message.image,
      badge: message.badge,
      tag: message.tag,
      require_interaction: message.require_interaction,
      actions: message.actions || [],
      timestamp: message.timestamp || new Date().toISOString(),
      expires_at: message.expires_at
    };

    // Send notification
    const results = await notificationService.sendNotification(
      notificationMessage,
      target_preferences || [],
      metadata
    );

    return NextResponse.json({
      status: 'notification_sent',
      message_id: notificationMessage.id,
      results,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('❌ Failed to send notification:', error);
    return NextResponse.json({
      error: error instanceof Error ? error.message : 'Failed to send notification'
    }, { status: 500 });
  }
}

/**
 * Get PWA notifications for a user
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const user_id = searchParams.get('user_id');
    const entity_id = searchParams.get('entity_id');
    const unread_only = searchParams.get('unread_only') === 'true';
    const limit = parseInt(searchParams.get('limit') || '50');

    if (!user_id) {
      return NextResponse.json({
        error: 'Missing required parameter: user_id'
      }, { status: 400 });
    }

    const notifications = await notificationService.getPWANotifications(user_id, {
      limit,
      unread_only,
      entity_id: entity_id || undefined
    });

    return NextResponse.json({
      notifications,
      total: notifications.length,
      filters: { user_id, entity_id, unread_only, limit },
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('❌ Failed to get notifications:', error);
    return NextResponse.json({
      error: error instanceof Error ? error.message : 'Failed to get notifications'
    }, { status: 500 });
  }
}

/**
 * Mark notifications as read
 */
export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();
    const { notification_ids } = body;

    if (!notification_ids || !Array.isArray(notification_ids)) {
      return NextResponse.json({
        error: 'Missing required field: notification_ids (array)'
      }, { status: 400 });
    }

    await notificationService.markPWANotificationsRead(notification_ids);

    return NextResponse.json({
      status: 'notifications_marked_read',
      notification_ids,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('❌ Failed to mark notifications as read:', error);
    return NextResponse.json({
      error: error instanceof Error ? error.message : 'Failed to mark notifications as read'
    }, { status: 500 });
  }
}