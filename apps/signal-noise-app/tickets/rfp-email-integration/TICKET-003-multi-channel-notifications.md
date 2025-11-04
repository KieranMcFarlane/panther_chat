# TICKET-003: Multi-Channel Notification System

**Status:** 🟡 Ready for Development  
**Priority:** 🟡 P1 - High  
**Ticket ID:** RFP-EMAIL-003  
**Created:** 2024-10-27  
**Assignee:** Backend Developer  
**Estimated:** 2-3 hours  
**Sprint:** Q4-2024-Sprint-4

---

## 🎯 Objective

Implement a multi-channel notification system that routes RFP alerts through Email, Slack, and Dashboard updates based on priority levels, ensuring the right information reaches the right people at the right time.

---

## 📋 User Story

As a **Team Member**, I want to **receive RFP notifications through multiple channels** based on priority, so that **I can stay informed through my preferred communication method** and **never miss important opportunities**.

---

## ✅ Acceptance Criteria

### **Channel Routing Requirements**
- [ ] **Email notifications** for high-priority RFPs (confidence_score ≥ 80)
- [ ] **Slack notifications** for medium+ priority RFPs (confidence_score ≥ 60)
- [ ] **Dashboard updates** for all RFPs regardless of priority
- [ ] **PWA notifications** for logged-in users (future enhancement)
- [ ] **SMS notifications** for critical opportunities (future enhancement)

### **Priority-Based Routing**
```typescript
interface NotificationChannels {
  CRITICAL: ['email', 'slack', 'dashboard', 'sms'],    // ≥95 confidence
  HIGH:     ['email', 'slack', 'dashboard'],          // 80-94 confidence
  MEDIUM:   ['slack', 'dashboard'],                  // 60-79 confidence  
  LOW:      ['dashboard']                            // <60 confidence
}
```

### **Content Adaptation**
- [ ] **Email:** Full detailed information with HTML formatting
- [ ] **Slack:** Concise summary with interactive buttons
- [ ] **Dashboard:** Real-time data updates with rich details
- [ ] **PWA:** Push notifications with brief summary
- [ ] **SMS:** Critical alert with call-to-action (125 characters)

### **Technical Requirements**
- [ ] Intelligent channel selection based on RFP priority
- [ ] Deduplication to prevent spam across channels
- [ ] Rate limiting to respect platform limits
- [ ] Error handling with fallback channels
- [ ] Comprehensive logging and monitoring
- [ ] User preference management (future)

---

## 🏗️ Architecture Overview

### **Notification Flow**
```
RFP Detection → Priority Assessment → Channel Router → 
├── Email Channel → Resend API → Sales Team
├── Slack Channel → Webhook → #rfp-alerts
├── Dashboard Channel → Supabase → Real-time UI
└── PWA Channel → Push Service → Mobile Users
```

### **Core Components**

#### **1. Channel Router**
```typescript
class NotificationChannelRouter {
  route(rfp: RFPNotification): NotificationChannel[] {
    const channels = this.getChannelsByPriority(rfp.confidence_score);
    return this.filterChannels(channels, rfp);
  }
  
  private getChannelsByPriority(score: number): NotificationChannel[] {
    if (score >= 95) return ['email', 'slack', 'dashboard', 'sms'];
    if (score >= 80) return ['email', 'slack', 'dashboard'];
    if (score >= 60) return ['slack', 'dashboard'];
    return ['dashboard'];
  }
}
```

#### **2. Channel Managers**
```typescript
interface ChannelManager {
  send(notification: RFPNotification): Promise<DeliveryResult>;
  formatContent(notification: RFPNotification): string;
  validateConfiguration(): boolean;
}

class EmailChannelManager implements ChannelManager { /* ... */ }
class SlackChannelManager implements ChannelManager { /* ... */ }
class DashboardChannelManager implements ChannelManager { /* ... */ }
```

#### **3. Notification Orchestrator**
```typescript
class MultiChannelNotificationService {
  async sendNotification(rfp: RFPNotification): Promise<NotificationResult> {
    const channels = this.router.route(rfp);
    const results = await Promise.allSettled(
      channels.map(channel => this.channelManagers[channel].send(rfp))
    );
    
    return this.aggregateResults(results);
  }
}
```

---

## 📧 Email Channel Implementation

### **Enhanced Email Content**
```typescript
interface EmailNotificationContent {
  subject: string;
  htmlContent: string;
  textContent: string;
  recipients: string[];
  priority: 'high' | 'normal';
  tags: EmailTag[];
}

class EmailChannelManager {
  async send(notification: RFPNotification): Promise<DeliveryResult> {
    const content = this.formatContent(notification);
    
    const emailData = {
      from: 'RFP Alerts <rfp-alerts@yellow-panther.com>',
      to: content.recipients,
      subject: content.subject,
      html: content.htmlContent,
      text: content.textContent,
      priority: content.priority,
      tags: content.tags
    };
    
    return await this.resend.emails.send(emailData);
  }
  
  private formatContent(notification: RFPNotification): EmailNotificationContent {
    return {
      subject: `🚨 ${notification.priority} PRIORITY RFP: ${notification.organization}`,
      recipients: this.getRecipients(notification.priority),
      htmlContent: this.generateHTMLContent(notification),
      textContent: this.generateTextContent(notification),
      priority: notification.priority === 'HIGH' ? 'high' : 'normal',
      tags: [
        { name: 'rfp-priority', value: notification.priority },
        { name: 'sport', value: notification.sport },
        { name: 'confidence-score', value: notification.confidence_score.toString() }
      ]
    };
  }
}
```

---

## 💬 Slack Channel Implementation

### **Rich Slack Messages**
```typescript
interface SlackMessage {
  channel: string;
  text: string;
  blocks: SlackBlock[];
  attachments: SlackAttachment[];
}

class SlackChannelManager {
  async send(notification: RFPNotification): Promise<DeliveryResult> {
    const slackMessage = this.formatSlackMessage(notification);
    
    const response = await fetch(this.webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(slackMessage)
    });
    
    return await response.json();
  }
  
  private formatSlackMessage(notification: RFPNotification): SlackMessage {
    const urgencyEmoji = {
      'CRITICAL': '🚨',
      'HIGH': '🔴',
      'MEDIUM': '🟡',
      'LOW': '🟢'
    }[notification.priority] || '🟡';
    
    return {
      channel: '#rfp-alerts',
      text: `${urgencyEmoji} RFP Detected: ${notification.organization}`,
      blocks: [
        {
          type: 'header',
          text: {
            type: 'plain_text',
            text: `${urgencyEmoji} RFP OPPORTUNITY DETECTED`
          }
        },
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: `*Organization:* ${notification.organization}\n*Sport:* ${notification.sport}\n*Priority:* ${urgencyEmoji} ${notification.priority}`
          }
        },
        {
          type: 'section',
          fields: [
            {
              type: 'mrkdwn',
              text: `*Fit Score*\n${notification.confidence_score}/100`
            },
            {
              type: 'mrkdwin',
              text: `*Value*\n${notification.estimated_value || 'TBD'}`
            },
            {
              type: 'mrkdwn',
              text: `*Detected*\n${new Date(notification.detected_at).toLocaleString()}`
            },
            {
              type: 'mrkdwn',
              text: `*Score*\n${notification.confidence_score}/100`
            }
          ]
        },
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: `*Recommendation*\n${notification.recommendation}`
          }
        },
        {
          type: 'actions',
          elements: [
            {
              type: 'button',
              text: { type: 'plain_text', text: 'View Dashboard' },
              url: `${process.env.NEXT_PUBLIC_BASE_URL}/dashboard`
            },
            {
              type: 'button',
              text: { type: 'plain_text', text: 'RFP Scanner' },
              url: `${process.env.NEXT_PUBLIC_BASE_URL}/rfp-scanner`
            },
            {
              type: 'button',
              text: { type: 'plain_text', text: 'Take Action' },
              url: `mailto:sales@yellow-panther.com?subject=RFP Follow-up: ${notification.organization}`
            }
          ]
        }
      ],
      attachments: [
        {
          color: this.getPriorityColor(notification.priority),
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
  
  private getPriorityColor(priority: string): string {
    switch (priority) {
      case 'CRITICAL': return '#ff0000';
      case 'HIGH': return '#ff6600';
      case 'MEDIUM': return '#ffaa00';
      case 'LOW': return '#00aa00';
      default: return '#888888';
    }
  }
}
```

---

## 📊 Dashboard Channel Implementation

### **Real-time Supabase Updates**
```typescript
class DashboardChannelManager {
  async send(notification: RFPNotification): Promise<DeliveryResult> {
    const dashboardRecord = this.formatDashboardRecord(notification);
    
    const { data, error } = await this.supabase
      .from('rfp_notifications')
      .insert([dashboardRecord])
      .select();
    
    if (error) {
      throw new Error(`Dashboard update failed: ${error.message}`);
    }
    
    // Trigger real-time subscription
    await this.triggerRealtimeUpdate(dashboardRecord);
    
    return { success: true, id: data[0].id, channel: 'dashboard' };
  }
  
  private formatDashboardRecord(notification: RFPNotification) {
    return {
      id: `rfp_${notification.organization}_${Date.now()}`,
      organization: notification.organization,
      priority: notification.priority,
      confidence_score: notification.confidence_score,
      fit_score: notification.confidence_score,
      estimated_value: notification.estimated_value,
      urgency: this.mapPriorityToUrgency(notification.priority),
      sport: notification.sport,
      detected_at: notification.detected_at,
      recommendation: notification.recommendation,
      source: 'linkedin_webhook',
      created_at: new Date().toISOString(),
      notification_channels_sent: ['dashboard'],
      read: false,
      archived: false
    };
  }
  
  private async triggerRealtimeUpdate(record: any): Promise<void> {
    // This would trigger a Supabase realtime event
    // Connected clients would receive the update immediately
    console.log(`📊 Dashboard update triggered: ${record.organization}`);
  }
}
```

---

## 🧪 Testing Strategy

### **Unit Tests**
```typescript
describe('NotificationChannelRouter', () => {
  test('routes CRITICAL RFPs to all channels', () => {
    const rfp = { confidence_score: 95, organization: 'Test Org' };
    const channels = router.route(rfp);
    expect(channels).toEqual(['email', 'slack', 'dashboard', 'sms']);
  });
  
  test('routes HIGH RFPs to email, slack, dashboard', () => {
    const rfp = { confidence_score: 85, organization: 'Test Org' };
    const channels = router.route(rfp);
    expect(channels).toEqual(['email', 'slack', 'dashboard']);
  });
});

describe('MultiChannelNotificationService', () => {
  test('sends to all configured channels', async () => {
    const rfp = mockHighPriorityRFP();
    const result = await service.sendNotification(rfp);
    
    expect(result.email).toBeDefined();
    expect(result.slack).toBeDefined();
    expect(result.dashboard).toBeDefined();
    expect(result.successCount).toBe(3);
  });
});
```

### **Integration Tests**
```typescript
describe('End-to-End Notification Flow', () => {
  test('complete RFP to notification flow', async () => {
    // 1. Simulate RFP detection
    const rfp = createMockRFP({ confidence_score: 88 });
    
    // 2. Process through notification service
    const result = await notificationService.sendNotification(rfp);
    
    // 3. Verify email was sent
    expect(result.email.success).toBe(true);
    
    // 4. Verify Slack message was posted
    expect(result.slack.success).toBe(true);
    
    // 5. Verify dashboard was updated
    expect(result.dashboard.success).toBe(true);
    
    // 6. Verify no duplicate notifications
    expect(result.duplicates).toHaveLength(0);
  });
});
```

### **Performance Tests**
```typescript
describe('Notification Performance', () => {
  test('handles 10 concurrent RFP notifications', async () => {
    const rfps = Array.from({ length: 10 }, (_, i) => 
      createMockRFP({ confidence_score: 75 + i })
    );
    
    const startTime = Date.now();
    const results = await Promise.all(
      rfps.map(rfp => notificationService.sendNotification(rfp))
    );
    const duration = Date.now() - startTime;
    
    expect(duration).toBeLessThan(30000); // 30 seconds max
    expect(results.every(r => r.success)).toBe(true);
  });
});
```

---

## 📁 Implementation Files

### **Core Service Files**
```
src/services/notifications/
├── index.ts                           # Main exports
├── notification-service.ts            # Orchestrator
├── channel-router.ts                  # Priority-based routing
├── channels/
│   ├── base-channel.ts               # Abstract base class
│   ├── email-channel.ts              # Email implementation
│   ├── slack-channel.ts              # Slack implementation
│   ├── dashboard-channel.ts          # Dashboard implementation
│   └── pwa-channel.ts                # PWA implementation (future)
├── formatters/
│   ├── email-formatter.ts            # Email content formatting
│   ├── slack-formatter.ts            # Slack message formatting
│   └── dashboard-formatter.ts        # Dashboard data formatting
└── utils/
    ├── deduplication.ts              # Prevent duplicate notifications
    ├── rate-limiting.ts              # Respect platform limits
    └── error-handling.ts             # Fallback strategies
```

### **Configuration Files**
```typescript
// src/config/notifications.ts
export const notificationConfig = {
  channels: {
    email: {
      enabled: true,
      thresholds: { min: 80 },
      recipients: {
        HIGH: ['sales@yellow-panther.com', 'opportunities@yellow-panther.com'],
        CRITICAL: ['sales@yellow-panther.com', 'opportunities@yellow-panther.com', 'management@yellow-panther.com']
      }
    },
    slack: {
      enabled: true,
      thresholds: { min: 60 },
      webhook: process.env.SLACK_WEBHOOK_URL,
      channel: '#rfp-alerts'
    },
    dashboard: {
      enabled: true,
      thresholds: { min: 0 }, // All RFPs go to dashboard
      realtime: true
    }
  },
  rateLimiting: {
    email: { max: 10, per: 'minute' },
    slack: { max: 30, per: 'minute' },
    dashboard: { max: 100, per: 'minute' }
  }
};
```

---

## 🚀 Deployment Steps

### **Phase 1: Core Infrastructure (Day 1)**
1. [ ] Set up notification service architecture
2. [ ] Implement channel router logic
3. [ ] Create base channel classes
4. [ ] Configure environment variables

### **Phase 2: Channel Implementation (Day 2)**
1. [ ] Implement email channel manager
2. [ ] Implement Slack channel manager
3. [ ] Implement dashboard channel manager
4. [ ] Add error handling and fallbacks

### **Phase 3: Integration & Testing (Day 3)**
1. [ ] Integrate with RFP monitoring script
2. [ ] End-to-end testing with real data
3. [ ] Performance optimization
4. [ ] Documentation and monitoring setup

---

## 📊 Success Metrics

### **Delivery Metrics**
- ✅ Email delivery rate: >98%
- ✅ Slack delivery rate: >99%
- ✅ Dashboard update rate: >99%
- ✅ End-to-end delivery time: <30 seconds

### **Engagement Metrics**
- 📈 Multi-channel reach: 100% of high-priority RFPs
- 📈 Response time improvement: 60% faster
- 📈 Team awareness: 90% of team sees notifications within 5 minutes
- 📈 Cross-channel engagement: 40% interaction rate

### **Technical Metrics**
- ✅ System uptime: >99.5%
- ✅ Concurrent processing: 10+ simultaneous notifications
- ✅ Error rate: <1%
- ✅ Average processing time: <5 seconds per notification

---

## 🆘 Risk Mitigation

### **High Risk**
1. **Channel Failure**
   - **Mitigation:** Automatic fallback to alternative channels
   - **Monitoring:** Real-time delivery status tracking

2. **Rate Limiting**
   - **Mitigation:** Intelligent queuing and throttling
   - **Monitoring:** Platform limit tracking

### **Medium Risk**
1. **Message Duplication**
   - **Mitigation:** Deduplication logic
   - **Monitoring:** Duplicate detection alerts

2. **Platform Outages**
   - **Mitigation:** Multiple channel redundancy
   - **Monitoring:** External service health checks

---

## 📞 Contact Information

**Assignee:** Backend Developer  
**Reviewer:** Technical Lead  
**Stakeholders:** Sales Team, DevOps Team  
**Slack Channel:** #rfp-integration  
**Alerting:** #notifications-alerts

---

## 📝 Implementation Notes

### **Dependencies**
- ✅ Migrated email service
- ✅ Slack webhook configuration
- ✅ Supabase real-time subscriptions
- ⏳ Rate limiting infrastructure
- ⏳ Monitoring and alerting setup

### **Configuration Required**
```bash
# Email Configuration
RESEND_API_KEY=your-resend-api-key
RESEND_FROM_EMAIL=rfp-alerts@yellow-panther.com

# Slack Configuration
SLACK_WEBHOOK_URL=your-slack-webhook-url
SLACK_CHANNEL=#rfp-alerts

# Dashboard Configuration
SUPABASE_URL=your-supabase-url
SUPABASE_ANON_KEY=your-supabase-anon-key

# Application Configuration
NEXT_PUBLIC_BASE_URL=https://your-domain.com
```

### **Definition of Done**
- [ ] All channel managers implemented and tested
- [ ] Priority-based routing working correctly
- [ ] Cross-channel deduplication working
- [ ] Error handling and fallbacks tested
- [ ] Performance benchmarks met
- [ ] Monitoring and alerting configured
- [ ] Documentation completed
- [ ] User training provided

---

**Last Updated:** 2024-10-27  
**Next Review:** Daily standup  
**Status:** Ready for development