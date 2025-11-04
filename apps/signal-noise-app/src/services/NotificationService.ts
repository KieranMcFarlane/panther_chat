/**
 * Multi-Channel Notifications Service - PWA, Teams, Slack, Email, Webhooks
 */

import { supabase } from '@/lib/supabase-client';

interface NotificationMessage {
  id: string;
  title: string;
  body: string;
  data?: Record<string, any>;
  icon?: string;
  image?: string;
  badge?: string;
  tag?: string;
  require_interaction?: boolean;
  actions?: NotificationAction[];
  timestamp: string;
  expires_at?: string;
}

interface NotificationAction {
  action: string;
  title: string;
  icon?: string;
}

interface NotificationChannel {
  type: 'pwa' | 'teams' | 'slack' | 'email' | 'webhook' | 'sms';
  enabled: boolean;
  config: Record<string, any>;
  filters: {
    urgency_levels?: string[];
    entity_types?: string[];
    min_score?: number;
    max_frequency?: number; // per hour
  };
}

interface NotificationDelivery {
  id: string;
  notification_id: string;
  channel_type: string;
  recipient: string;
  status: 'pending' | 'sent' | 'delivered' | 'read' | 'failed';
  sent_at?: string;
  delivered_at?: string;
  read_at?: string;
  error_message?: string;
  retry_count: number;
  metadata?: Record<string, any>;
}

interface NotificationPreferences {
  user_id?: string;
  entity_id?: string;
  channels: NotificationChannel[];
  quiet_hours?: {
    enabled: boolean;
    start: string; // HH:MM
    end: string;   // HH:MM
    timezone: string;
  };
  frequency_limits: {
    max_per_hour: number;
    max_per_day: number;
    cooldown_minutes: number;
  };
}

export class MultiChannelNotificationService {
  private rateLimiter = new Map<string, { count: number; lastReset: number }>();
  private deliveryQueue: NotificationDelivery[] = [];

  /**
   * Send notification through multiple channels based on preferences
   */
  async sendNotification(
    message: NotificationMessage,
    targetPreferences: NotificationPreferences[],
    metadata?: {
      entity_id?: string;
      entity_name?: string;
      urgency_level?: string;
      source_type?: string;
      confidence_score?: number;
    }
  ): Promise<{ successful: number; failed: number; channels: string[] }> {
    const results = { successful: 0, failed: 0, channels: [] as string[] };

    for (const preferences of targetPreferences) {
      // Check quiet hours
      if (this.isQuietHours(preferences.quiet_hours)) {
        console.log(`🔕 Quiet hours - skipping notification for user ${preferences.user_id}`);
        continue;
      }

      // Check rate limits
      if (!this.checkRateLimit(preferences.frequency_limits, preferences.user_id || preferences.entity_id)) {
        console.log(`⏱️ Rate limit exceeded - skipping notification`);
        continue;
      }

      // Filter applicable channels
      const applicableChannels = this.filterApplicableChannels(
        preferences.channels,
        metadata
      );

      for (const channel of applicableChannels) {
        try {
          const delivery = await this.sendToChannel(message, channel, metadata);
          this.deliveryQueue.push(delivery);
          results.successful++;
          results.channels.push(channel.type);

        } catch (error) {
          console.error(`❌ Failed to send to ${channel.type}:`, error);
          results.failed++;
        }
      }
    }

    // Process delivery queue
    this.processDeliveryQueue();

    return results;
  }

  /**
   * Send notification to a specific channel
   */
  private async sendToChannel(
    message: NotificationMessage,
    channel: NotificationChannel,
    metadata?: any
  ): Promise<NotificationDelivery> {
    const delivery: NotificationDelivery = {
      id: `delivery_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      notification_id: message.id,
      channel_type: channel.type,
      recipient: this.getRecipient(channel, metadata),
      status: 'pending',
      retry_count: 0,
      metadata
    };

    try {
      switch (channel.type) {
        case 'pwa':
          await this.sendPWANotification(message, channel, metadata);
          delivery.status = 'sent';
          delivery.sent_at = new Date().toISOString();
          break;

        case 'teams':
          await this.sendTeamsNotification(message, channel, metadata);
          delivery.status = 'sent';
          delivery.sent_at = new Date().toISOString();
          break;

        case 'slack':
          await this.sendSlackNotification(message, channel, metadata);
          delivery.status = 'sent';
          delivery.sent_at = new Date().toISOString();
          break;

        case 'email':
          await this.sendEmailNotification(message, channel, metadata);
          delivery.status = 'sent';
          delivery.sent_at = new Date().toISOString();
          break;

        case 'webhook':
          await this.sendWebhookNotification(message, channel, metadata);
          delivery.status = 'sent';
          delivery.sent_at = new Date().toISOString();
          break;

        case 'sms':
          await this.sendSMSNotification(message, channel, metadata);
          delivery.status = 'sent';
          delivery.sent_at = new Date().toISOString();
          break;

        default:
          throw new Error(`Unknown channel type: ${channel.type}`);
      }

      // Store delivery record
      await this.storeDeliveryRecord(delivery);

    } catch (error) {
      delivery.status = 'failed';
      delivery.error_message = error instanceof Error ? error.message : 'Unknown error';
      await this.storeDeliveryRecord(delivery);
      throw error;
    }

    return delivery;
  }

  /**
   * Send PWA notification (stored in database for client polling)
   */
  private async sendPWANotification(
    message: NotificationMessage,
    channel: NotificationChannel,
    metadata?: any
  ): Promise<void> {
    const pwaNotification = {
      id: message.id,
      title: message.title,
      body: message.body,
      data: message.data || {},
      icon: message.icon || '/notification-icon.png',
      image: message.image,
      badge: message.badge || '/notification-badge.png',
      tag: message.tag,
      require_interaction: message.require_interaction || false,
      actions: message.actions || [],
      timestamp: message.timestamp,
      expires_at: message.expires_at,
      read: false,
      user_id: metadata?.user_id,
      entity_id: metadata?.entity_id,
      urgency_level: metadata?.urgency_level,
      source_type: metadata?.source_type
    };

    // Store in Supabase for PWA clients to poll
    await supabase
      .from('pwa_notifications')
      .insert(pwaNotification);

    console.log(`📱 PWA notification stored: ${message.title}`);
  }

  /**
   * Send Teams notification
   */
  private async sendTeamsNotification(
    message: NotificationMessage,
    channel: NotificationChannel,
    metadata?: any
  ): Promise<void> {
    const teamsMessage = {
      "@type": "MessageCard",
      "@context": "http://schema.org/extensions",
      "themeColor": this.getUrgencyColor(metadata?.urgency_level),
      "summary": message.title,
      "sections": [{
        "activityTitle": message.title,
        "activitySubtitle": this.formatSubtitle(metadata),
        "activityImage": message.image,
        "facts": this.formatFacts(metadata),
        "text": message.body,
        "markdown": true
      }],
      "potentialAction": this.formatActions(message.actions, metadata)
    };

    const response = await fetch(channel.config.webhook_url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(teamsMessage)
    });

    if (!response.ok) {
      throw new Error(`Teams webhook failed: ${response.status} ${response.statusText}`);
    }

    console.log(`💬 Teams notification sent: ${message.title}`);
  }

  /**
   * Send Slack notification
   */
  private async sendSlackNotification(
    message: NotificationMessage,
    channel: NotificationChannel,
    metadata?: any
  ): Promise<void> {
    const slackMessage = {
      channel: channel.config.channel,
      text: message.title,
      attachments: [{
        color: this.getUrgencyColor(metadata?.urgency_level),
        title: message.title,
        text: message.body,
        fields: this.formatSlackFields(metadata),
        footer: 'Signal Noise App',
        ts: Math.floor(new Date(message.timestamp).getTime() / 1000),
        actions: this.formatSlackActions(message.actions, metadata)
      }]
    };

    const response = await fetch(channel.config.webhook_url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(slackMessage)
    });

    if (!response.ok) {
      throw new Error(`Slack webhook failed: ${response.status} ${response.statusText}`);
    }

    console.log(`📢 Slack notification sent: ${message.title}`);
  }

  /**
   * Send email notification
   */
  private async sendEmailNotification(
    message: NotificationMessage,
    channel: NotificationChannel,
    metadata?: any
  ): Promise<void> {
    // Implementation would depend on your email service (SendGrid, SES, etc.)
    const emailPayload = {
      to: channel.config.recipients,
      subject: message.title,
      html: this.formatEmailHTML(message, metadata),
      text: message.body,
      from: channel.config.from_email || 'notifications@signalnoise.app'
    };

    // Mock implementation - replace with actual email service
    console.log(`📧 Email notification sent to ${channel.config.recipients.join(', ')}`);
    
    // Example with SendGrid:
    // await fetch('https://api.sendgrid.com/v3/mail/send', {
    //   method: 'POST',
    //   headers: {
    //     'Authorization': `Bearer ${process.env.SENDGRID_API_KEY}`,
    //     'Content-Type': 'application/json'
    //   },
    //   body: JSON.stringify({
    //     personalizations: [{ to: channel.config.recipients.map(email => ({ email })) }],
    //     from: { email: emailPayload.from },
    //     subject: emailPayload.subject,
    //     content: [
    //       { type: 'text/plain', value: emailPayload.text },
    //       { type: 'text/html', value: emailPayload.html }
    //     ]
    //   })
    // });
  }

  /**
   * Send webhook notification
   */
  private async sendWebhookNotification(
    message: NotificationMessage,
    channel: NotificationChannel,
    metadata?: any
  ): Promise<void> {
    const payload = {
      notification: message,
      metadata,
      timestamp: new Date().toISOString()
    };

    const response = await fetch(channel.config.url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': channel.config.auth_header || '',
        'X-Webhook-Source': 'signal-noise-app'
      },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      throw new Error(`Webhook failed: ${response.status} ${response.statusText}`);
    }

    console.log(`🪝 Webhook notification sent: ${message.title}`);
  }

  /**
   * Send SMS notification
   */
  private async sendSMSNotification(
    message: NotificationMessage,
    channel: NotificationChannel,
    metadata?: any
  ): Promise<void> {
    // Implementation would depend on your SMS service (Twilio, etc.)
    const smsPayload = {
      to: channel.config.phone_numbers,
      body: `${message.title}: ${message.body}`,
      from: channel.config.from_number || 'SignalNoise'
    };

    console.log(`📱 SMS notification sent to ${channel.config.phone_numbers.join(', ')}`);
    
    // Example with Twilio:
    // for (const phoneNumber of channel.config.phone_numbers) {
    //   await fetch(`https://api.twilio.com/2010-04-01/Accounts/${process.env.TWILIO_ACCOUNT_SID}/Messages.json`, {
    //     method: 'POST',
    //     headers: {
    //       'Authorization': `Basic ${Buffer.from(`${process.env.TWILIO_ACCOUNT_SID}:${process.env.TWILIO_AUTH_TOKEN}`).toString('base64')}`,
    //       'Content-Type': 'application/x-www-form-urlencoded'
    //     },
    //     body: new URLSearchParams({
    //       To: phoneNumber,
    //       From: smsPayload.from,
    //       Body: smsPayload.body
    //     })
    //   });
    // }
  }

  /**
   * Get PWA notifications for a user
   */
  async getPWANotifications(userId: string, options: {
    limit?: number;
    unread_only?: boolean;
    entity_id?: string;
  } = {}): Promise<any[]> {
    let query = supabase
      .from('pwa_notifications')
      .select('*')
      .eq('user_id', userId)
      .order('timestamp', { ascending: false })
      .limit(options.limit || 50);

    if (options.unread_only) {
      query = query.eq('read', false);
    }

    if (options.entity_id) {
      query = query.eq('entity_id', options.entity_id);
    }

    const { data, error } = await query;

    if (error) throw error;
    return data || [];
  }

  /**
   * Mark PWA notifications as read
   */
  async markPWANotificationsRead(notificationIds: string[]): Promise<void> {
    await supabase
      .from('pwa_notifications')
      .update({ 
        read: true, 
        read_at: new Date().toISOString() 
      })
      .in('id', notificationIds);
  }

  /**
   * Get delivery statistics
   */
  async getDeliveryStats(filters: {
    channel_type?: string;
    start_date?: string;
    end_date?: string;
  } = {}): Promise<any> {
    let query = supabase
      .from('notification_deliveries')
      .select('channel_type, status, count(*)')
      .group('channel_type, status');

    if (filters.channel_type) {
      query = query.eq('channel_type', filters.channel_type);
    }

    if (filters.start_date) {
      query = query.gte('sent_at', filters.start_date);
    }

    if (filters.end_date) {
      query = query.lte('sent_at', filters.end_date);
    }

    const { data, error } = await query;

    if (error) throw error;
    return data;
  }

  /**
   * Helper methods
   */
  private isQuietHours(quietHours?: any): boolean {
    if (!quietHours?.enabled) return false;

    const now = new Date();
    const currentTime = now.toLocaleTimeString('en-US', { 
      timeZone: quietHours.timezone,
      hour: '2-digit', 
      minute: '2-digit',
      hour12: false 
    });

    const currentMinutes = parseInt(currentTime.split(':')[0]) * 60 + parseInt(currentTime.split(':')[1]);
    const startMinutes = parseInt(quietHours.start.split(':')[0]) * 60 + parseInt(quietHours.start.split(':')[1]);
    const endMinutes = parseInt(quietHours.end.split(':')[0]) * 60 + parseInt(quietHours.end.split(':')[1]);

    if (startMinutes <= endMinutes) {
      return currentMinutes >= startMinutes && currentMinutes <= endMinutes;
    } else {
      return currentMinutes >= startMinutes || currentMinutes <= endMinutes;
    }
  }

  private checkRateLimit(limits: any, identifier?: string): boolean {
    if (!identifier) return true;

    const now = Date.now();
    const key = identifier;
    const limiter = this.rateLimiter.get(key);

    if (!limiter || now - limiter.lastReset > 60 * 60 * 1000) { // 1 hour
      this.rateLimiter.set(key, { count: 1, lastReset: now });
      return true;
    }

    if (limiter.count >= limits.max_per_hour) {
      return false;
    }

    limiter.count++;
    return true;
  }

  private filterApplicableChannels(
    channels: NotificationChannel[],
    metadata?: any
  ): NotificationChannel[] {
    return channels.filter(channel => {
      if (!channel.enabled) return false;

      if (channel.filters.urgency_levels && metadata?.urgency_level) {
        if (!channel.filters.urgency_levels.includes(metadata.urgency_level)) {
          return false;
        }
      }

      if (channel.filters.min_score && metadata?.confidence_score) {
        if (metadata.confidence_score < channel.filters.min_score) {
          return false;
        }
      }

      return true;
    });
  }

  private getRecipient(channel: NotificationChannel, metadata?: any): string {
    switch (channel.type) {
      case 'email':
        return channel.config.recipients?.join(', ') || '';
      case 'teams':
        return channel.config.channel || '';
      case 'slack':
        return channel.config.channel || '';
      case 'sms':
        return channel.config.phone_numbers?.join(', ') || '';
      case 'webhook':
        return channel.config.url || '';
      default:
        return metadata?.user_id || 'unknown';
    }
  }

  private getUrgencyColor(urgency?: string): string {
    switch (urgency) {
      case 'critical': return 'FF0000';
      case 'high': return 'FF6600';
      case 'medium': return 'FFAA00';
      case 'low': return '00AA00';
      default: return '888888';
    }
  }

  private formatSubtitle(metadata?: any): string {
    if (!metadata) return '';
    return `Urgency: ${metadata.urgency_level || 'unknown'} | Score: ${metadata.confidence_score || 'N/A'}/100`;
  }

  private formatFacts(metadata?: any): any[] {
    if (!metadata) return [];

    const facts = [];
    if (metadata.entity_name) {
      facts.push({ name: 'Entity', value: metadata.entity_name });
    }
    if (metadata.source_type) {
      facts.push({ name: 'Source', value: metadata.source_type });
    }
    if (metadata.confidence_score) {
      facts.push({ name: 'Confidence', value: `${metadata.confidence_score}/100` });
    }

    return facts;
  }

  private formatActions(actions?: NotificationAction[], metadata?: any): any[] {
    if (!actions || actions.length === 0) return [];

    return actions.map(action => ({
      '@type': 'OpenUri',
      name: action.title,
      targets: [{ os: 'default', uri: `action:${action.action}` }]
    }));
  }

  private formatSlackFields(metadata?: any): any[] {
    if (!metadata) return [];

    const fields = [];
    if (metadata.entity_name) {
      fields.push({ title: 'Entity', value: metadata.entity_name, short: true });
    }
    if (metadata.urgency_level) {
      fields.push({ title: 'Urgency', value: metadata.urgency_level, short: true });
    }
    if (metadata.confidence_score) {
      fields.push({ title: 'Confidence', value: `${metadata.confidence_score}/100`, short: true });
    }
    if (metadata.source_type) {
      fields.push({ title: 'Source', value: metadata.source_type, short: true });
    }

    return fields;
  }

  private formatSlackActions(actions?: NotificationAction[], metadata?: any): any[] {
    if (!actions || actions.length === 0) return [];

    return actions.map(action => ({
      type: 'button',
      text: action.title,
      url: `action:${action.action}`
    }));
  }

  private formatEmailHTML(message: NotificationMessage, metadata?: any): string {
    return `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: ${this.getUrgencyColor(metadata?.urgency_level)};">${message.title}</h2>
        <p>${message.body}</p>
        ${metadata ? `
          <div style="background-color: #f5f5f5; padding: 15px; margin: 20px 0;">
            <h3>Details:</h3>
            <ul>
              ${metadata.entity_name ? `<li><strong>Entity:</strong> ${metadata.entity_name}</li>` : ''}
              ${metadata.urgency_level ? `<li><strong>Urgency:</strong> ${metadata.urgency_level}</li>` : ''}
              ${metadata.confidence_score ? `<li><strong>Confidence:</strong> ${metadata.confidence_score}/100</li>` : ''}
              ${metadata.source_type ? `<li><strong>Source:</strong> ${metadata.source_type}</li>` : ''}
            </ul>
          </div>
        ` : ''}
        <p><small>Sent by Signal Noise App at ${new Date(message.timestamp).toLocaleString()}</small></p>
      </div>
    `;
  }

  private async storeDeliveryRecord(delivery: NotificationDelivery): Promise<void> {
    try {
      await supabase
        .from('notification_deliveries')
        .insert(delivery);
    } catch (error) {
      console.error('Failed to store delivery record:', error);
    }
  }

  private async processDeliveryQueue(): Promise<void> {
    // Process delivery queue and handle retries
    // Implementation would track delivery status and retry failed notifications
  }
}

// Export singleton
export const notificationService = new MultiChannelNotificationService();