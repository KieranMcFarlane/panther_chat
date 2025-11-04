import { NextRequest, NextResponse } from 'next/server';
import { Resend } from 'resend';
import { RFPDNotificationPayload, SlackNotificationData } from './types';

/**
 * Real-time RFP Detection Notification System
 * Processes high-priority RFP detections and sends immediate alerts
 */
class RFPNotificationProcessor {
  private readonly resend: Resend;
  private readonly slackWebhookUrl: string;

  constructor() {
    this.resend = new Resend(process.env.RESEND_API_KEY);
    this.slackWebhookUrl = process.env.SLACK_WEBHOOK_URL || '';
  }

  async processRFPNotification(payload: RFPDNotificationPayload): Promise<{
    email_sent: boolean;
    slack_sent: boolean;
    dashboard_updated: boolean;
  }> {
    const results = {
      email_sent: false,
      slack_sent: false,
      dashboard_updated: false
    };

    try {
      // Send immediate email for HIGH priority
      if (payload.priority === 'HIGH') {
        results.email_sent = await this.sendHighPriorityEmail(payload);
      }

      // Send Slack notification for HIGH/MEDIUM priority
      if (['HIGH', 'MEDIUM'].includes(payload.priority)) {
        results.slack_sent = await this.sendSlackNotification(payload);
      }

      // Update dashboard with real-time data
      results.dashboard_updated = await this.updateDashboard(payload);

      console.log(`✅ RFP notification processed: ${payload.organization}`);
      return results;

    } catch (error) {
      console.error('RFP notification processing error:', error);
      throw error;
    }
  }

  private async sendHighPriorityEmail(payload: RFPDNotificationPayload): Promise<boolean> {
    try {
      const emailHtml = this.generateRFPEmailHTML(payload);
      
      await this.resend.emails.send({
        from: 'RFP Alerts <noreply@nakanodigital.com>',
        to: ['sales@yellow-panther.com', 'opportunities@yellow-panther.com'],
        subject: `🚨 HIGH PRIORITY RFP DETECTED: ${payload.organization}`,
        html: emailHtml,
        tags: [
          {
            name: 'rfp-detection',
            value: 'high-priority'
          },
          {
            name: 'organization',
            value: payload.organization
          }
        ]
      });

      console.log(`📧 High priority email sent: ${payload.organization}`);
      return true;

    } catch (error) {
      console.error('Email sending error:', error);
      return false;
    }
  }

  private generateRFPEmailHTML(payload: RFPDNotificationPayload): string {
    const urgencyEmoji = {
      'CRITICAL': '🚨',
      'HIGH': '🔴',
      'MEDIUM': '🟡',
      'LOW': '🟢'
    }[payload.urgency] || '🟡';

    return `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <title>High Priority RFP Detected</title>
          <style>
            body { font-family: Arial, sans-serif; margin: 0; padding: 20px; background-color: #f5f5f5; }
            .container { max-width: 600px; margin: 0 auto; background: white; border-radius: 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
            .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
            .content { padding: 20px; }
            .metric { display: flex; justify-content: space-between; margin: 15px 0; padding: 10px; background: #f8f9fa; border-radius: 4px; }
            .metric-label { font-weight: bold; color: #666; }
            .metric-value { font-weight: bold; color: #333; }
            .priority-high { border-left: 4px solid #dc3545; }
            .priority-medium { border-left: 4px solid #ffc107; }
            .actions { margin-top: 20px; text-align: center; }
            .action-btn { display: inline-block; padding: 12px 24px; margin: 5px; background: #667eea; color: white; text-decoration: none; border-radius: 4px; font-weight: bold; }
            .footer { text-align: center; margin-top: 30px; padding-top: 20px; border-top: 1px solid #eee; color: #666; font-size: 12px; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>🚨 RFP DETECTED</h1>
              <p>High Priority Procurement Opportunity</p>
            </div>
            
            <div class="content ${payload.priority === 'HIGH' ? 'priority-high' : 'priority-medium'}">
              <h2>${payload.organization}</h2>
              <p><strong>Urgency:</strong> ${urgencyEmoji} ${payload.urgency}</p>
              
              <div class="metric">
                <span class="metric-label">Yellow Panther Fit Score</span>
                <span class="metric-value">${payload.fit_score}/100</span>
              </div>
              
              <div class="metric">
                <span class="metric-label">Estimated Value</span>
                <span class="metric-value">${payload.estimated_value || 'To be determined'}</span>
              </div>
              
              <div class="metric">
                <span class="metric-label">Sport Focus</span>
                <span class="metric-value">${payload.sport || 'Multi-sport'}</span>
              </div>
              
              <div class="metric">
                <span class="metric-label">Detected at</span>
                <span class="metric-value">${new Date(payload.detected_at).toLocaleString()}</span>
              </div>
              
              ${payload.post_url ? `
                <div class="metric">
                  <span class="metric-label">Source</span>
                  <span class="metric-value"><a href="${payload.post_url}" target="_blank">LinkedIn Post</a></span>
                </div>
              ` : ''}
              
              <h3>Recommendation</h3>
              <p><strong>${payload.recommendation}</strong></p>
              
              <div class="actions">
                <a href="${process.env.NEXT_PUBLIC_BASE_URL}/dashboard" class="action-btn">View Dashboard</a>
                <a href="${process.env.NEXT_PUBLIC_BASE_URL}/rfp-scanner" class="action-btn">RFP Scanner</a>
                <a href="mailto:sales@yellow-panther.com?subject=${encodeURIComponent(`RFP Follow-up: ${payload.organization}`)}" class="action-btn">Take Action</a>
              </div>
            </div>
            
            <div class="footer">
              <p>This alert was automatically generated by the Yellow Panther RFP Detection System</p>
              <p>LinkedIn monitoring powered by BrightData webhooks</p>
            </div>
          </div>
        </body>
      </html>
    `;
  }

  private async sendSlackNotification(payload: RFPDNotificationPayload): Promise<boolean> {
    if (!this.slackWebhookUrl) {
      console.warn('Slack webhook URL not configured');
      return false;
    }

    try {
      const slackData = this.generateSlackNotification(payload);
      
      const response = await fetch(this.slackWebhookUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(slackData)
      });

      if (response.ok) {
        console.log(`📨 Slack notification sent: ${payload.organization}`);
        return true;
      } else {
        console.error('Slack notification failed:', response.statusText);
        return false;
      }

    } catch (error) {
      console.error('Slack sending error:', error);
      return false;
    }
  }

  private generateSlackNotification(payload: RFPDNotificationPayload): SlackNotificationData {
    const urgencyEmoji = {
      'CRITICAL': '🚨',
      'HIGH': '🔴',
      'MEDIUM': '🟡',
      'LOW': '🟢'
    }[payload.urgency] || '🟡';

    const fitScoreColor = payload.fit_score >= 80 ? '#36a64f' : 
                          payload.fit_score >= 60 ? '#ff9800' : '#ff6b6b';

    return {
      channel: '#rfp-alerts',
      text: `🚨 RFP Detected: ${payload.organization}`,
      blocks: [
        {
          type: 'header',
          text: {
            type: 'plain_text',
            text: `RFP OPPORTUNITY DETECTED`
          }
        },
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: `*Organization:* ${payload.organization}\n*Sport:* ${payload.sport || 'Multi-sport'}\n*Priority:* ${urgencyEmoji} ${payload.urgency}`
          }
        },
        {
          type: 'section',
          fields: [
            {
              type: 'mrkdwn',
              text: `*Fit Score*\n${payload.fit_score}/100`
            },
            {
              type: 'mrkdwn',
              text: `*Value*\n${payload.estimated_value || 'TBD'}`
            },
            {
              type: 'mrkdwn',
              text: `*Detected*\n${new Date(payload.detected_at).toLocaleString()}`
            },
            {
              type: 'mrkdwn',
              text: `*Recommendation*\n${payload.recommendation}`
            }
          ]
        },
        {
          type: 'context',
          elements: [
            {
              type: 'mrkdwn',
              text: `🔗 <${process.env.NEXT_PUBLIC_BASE_URL}/dashboard|View Dashboard> | <${process.env.NEXT_PUBLIC_BASE_URL}/rfp-scanner|RFP Scanner>`
            }
          ]
        }
      ],
      attachments: [
        {
          color: fitScoreColor,
          blocks: [
            {
              type: 'section',
              text: {
                type: 'mrkdwn',
                text: `*Source:* LinkedIn monitoring powered by BrightData webhooks`
              }
            }
          ]
        }
      ]
    };
  }

  private async updateDashboard(payload: RFPDNotificationPayload): Promise<boolean> {
    try {
      // Update Supabase for real-time dashboard
      const response = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/rfp_notifications`, {
        method: 'POST',
        headers: {
          'apikey': process.env.SUPABASE_ANON_KEY || '',
          'Authorization': `Bearer ${process.env.SUPABASE_ANON_KEY}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          organization: payload.organization,
          priority: payload.priority,
          fit_score: payload.fit_score,
          estimated_value: payload.estimated_value,
          urgency: payload.urgency,
          sport: payload.sport,
          detected_at: payload.detected_at,
          recommendation: payload.recommendation,
          source: 'linkedin_webhook'
        })
      });

      if (response.ok) {
        console.log(`📊 Dashboard updated: ${payload.organization}`);
        return true;
      } else {
        console.error('Dashboard update failed:', response.statusText);
        return false;
      }

    } catch (error) {
      console.error('Dashboard update error:', error);
     return false;
    }
  }
}

export { RFPNotificationProcessor };