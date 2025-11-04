# Email Service Module

This module provides comprehensive email functionality for the Signal Noise App, including RFP notifications and email campaign management.

## 📧 Features

### 1. **RFP Detection Notification System**
- Real-time email alerts when high-priority RFPs are detected
- Professional HTML email templates with Yellow Panther branding
- Slack integration for team notifications
- Dashboard updates via Supabase
- Multi-channel notifications (Email + Slack + Dashboard)

### 2. **Email Campaign Management**
- Multi-stage email campaigns for sports entities
- AI-powered email generation using Claude Agent SDK
- Campaign progression tracking
- Template-based email composition
- Professional email workflow management

### 3. **Resend Integration**
- Production-ready email delivery via Resend API
- Professional email templates
- Delivery tracking and analytics
- Error handling and retry logic

## 🗂️ File Structure

```
src/services/email/
├── index.ts                           # Main exports and convenience re-exports
├── types.ts                           # TypeScript interfaces and types
├── rfp-notification-processor.ts      # RFP detection notification system
├── email-campaign-service.ts          # Email campaign management
└── README.md                          # This documentation
```

## 🚀 Getting Started

### Environment Variables

Required environment variables for the email service:

```bash
# Resend Email Service
RESEND_API_KEY=your-resend-api-key
RESEND_FROM_EMAIL=noreply@your-domain.com

# Slack Integration (optional)
SLACK_WEBHOOK_URL=your-slack-webhook-url

# Application URLs
NEXT_PUBLIC_BASE_URL=https://your-domain.com
NEXT_PUBLIC_SUPABASE_URL=your-supabase-url
SUPABASE_ANON_KEY=your-supabase-anon-key
```

### Basic Usage

#### RFP Notifications

```typescript
import { RFPNotificationProcessor } from '@/services/email';

const processor = new RFPNotificationProcessor();

const payload = {
  type: 'rfp_detected',
  priority: 'HIGH',
  organization: 'Premier League',
  fit_score: 85,
  estimated_value: '£500K-£1M',
  urgency: 'HIGH',
  recommendation: 'Immediate outreach recommended',
  detected_at: new Date().toISOString(),
  sport: 'Football'
};

const results = await processor.processRFPNotification(payload);
// { email_sent: true, slack_sent: true, dashboard_updated: true }
```

#### Email Campaigns

```typescript
import { EmailCampaignService } from '@/services/email';

const campaignService = EmailCampaignService.getInstance();

// Create a campaign
const campaign = await campaignService.createCampaign(entityId, entityName, entityData);

// Generate email for a specific stage
const email = await campaignService.generateEmailForStage(
  campaign.id, 
  'introduction',
  'Focus on digital transformation opportunities'
);
```

## 📡 API Endpoints

### RFP Notifications

#### `POST /api/notifications/rfp-detected-migrated`
Process RFP detection notifications and send alerts.

**Request:**
```json
{
  "type": "rfp_detected",
  "priority": "HIGH",
  "organization": "Sports Organization",
  "fit_score": 85,
  "urgency": "HIGH",
  "recommendation": "Immediate action recommended",
  "detected_at": "2024-01-01T00:00:00Z"
}
```

**Response:**
```json
{
  "status": "success",
  "message": "RFP notification processed",
  "results": {
    "email_sent": true,
    "slack_sent": true,
    "dashboard_updated": true
  },
  "service": "migrated-email-service"
}
```

#### `GET /api/notifications/rfp-detected-migrated`
Health check for the migrated notification service.

### Email Campaigns

#### `POST /api/email-campaign/generate`
Generate emails for campaign stages.

**Request:**
```json
{
  "entityId": "entity-123",
  "stageId": "introduction",
  "entityData": { ... },
  "customInstructions": "Focus on mobile opportunities"
}
```

#### `GET /api/email-campaign/generate?entityId=123`
Retrieve campaign information and available stages.

## 🎯 Integration Points

### Webhook Integration

The enhanced RFP monitoring webhook automatically triggers notifications:

```typescript
// Located in: src/app/api/webhook/enhanced-rfp-monitoring/route.ts
await fetch(`${process.env.NEXT_PUBLIC_BASE_URL}/api/notifications/rfp-detected-migrated`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(alertData)
});
```

### Dashboard Integration

RFP notifications automatically update the Supabase dashboard:
- Real-time notification display
- Historical tracking
- Status monitoring

### AI Integration

Email generation uses Claude Agent SDK:
- Contextual email content
- Personalized messaging
- Professional tone and formatting

## 🔧 Configuration

### Email Templates

The system includes professional HTML email templates:
- Yellow Panther branding
- Responsive design
- Dynamic content insertion
- Action buttons and links

### Campaign Stages

Default email campaign stages:
1. **Introduction** - Initial contact
2. **Warm Approach** - Follow-up with details (3-5 days)
3. **Detailed Proposal** - Comprehensive solution (1 week)
4. **Follow-up** - Address questions (3-4 days)
5. **Closing** - Final push for decision (1 week)

### Notification Channels

Multi-channel notification support:
- **Email** - Resend-powered delivery
- **Slack** - Team notifications
- **Dashboard** - Real-time updates
- **PWA** - Browser notifications (future)

## 📊 Monitoring & Analytics

### Delivery Tracking

- Email delivery status via Resend
- Slack webhook responses
- Dashboard update confirmations
- Error logging and retry logic

### Performance Metrics

- Email open rates (via Resend)
- Response tracking
- Campaign progression analytics
- RFP conversion metrics

## 🔄 Migration Notes

This service has been migrated from the original locations:
- **From:** `src/app/api/notifications/rfp-detected/route.ts`
- **To:** `src/services/email/rfp-notification-processor.ts`

The migration provides:
- ✅ Better code organization
- ✅ Improved reusability
- ✅ Centralized email management
- ✅ Easier testing and maintenance
- ✅ Consistent API patterns

## 🧪 Testing

### Unit Tests
```typescript
// Test RFP notification processing
const processor = new RFPNotificationProcessor();
const results = await processor.processRFPNotification(mockPayload);
expect(results.email_sent).toBe(true);
```

### Integration Tests
```typescript
// Test full email campaign flow
const campaign = await campaignService.createCampaign(entityId, entityName, entityData);
const email = await campaignService.generateEmailForStage(campaign.id, 'introduction');
expect(email.subject).toBeTruthy();
```

## 🐛 Troubleshooting

### Common Issues

1. **Email not sending**
   - Check `RESEND_API_KEY` environment variable
   - Verify API key permissions
   - Check email template syntax

2. **Slack notifications failing**
   - Verify `SLACK_WEBHOOK_URL` is configured
   - Test webhook URL with a simple message
   - Check channel permissions

3. **Dashboard not updating**
   - Verify Supabase credentials
   - Check table schema
   - Review network connectivity

### Debug Logging

Enable debug logging by setting:
```bash
DEBUG=email:* npm run dev
```

## 📚 Additional Resources

- [Resend API Documentation](https://resend.com/docs)
- [Slack Webhook API](https://api.slack.com/messaging/webhooks)
- [Claude Agent SDK](https://docs.anthropic.com)
- [Supabase Realtime](https://supabase.com/docs/guides/realtime)

## 🤝 Contributing

When adding new email functionality:
1. Add types to `types.ts`
2. Implement in appropriate service file
3. Update the main `index.ts` exports
4. Add tests
5. Update this documentation

---

**Location:** `src/services/email/`  
**Migration Date:** October 27, 2024  
**Version:** 1.0.0