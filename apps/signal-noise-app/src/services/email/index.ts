/**
 * Email Service Module - RFP Notifications & Campaign Management
 * 
 * This module contains all email-related functionality for the Signal Noise App:
 * - Resend integration for transactional emails
 * - RFP detection notification system
 * - Email campaign management
 * - Multi-channel notifications
 */

export { RFPNotificationProcessor } from './rfp-notification-processor';
export { EmailCampaignService } from './email-campaign-service';
export type { 
  RFPDNotificationPayload,
  EmailCampaign,
  GeneratedEmail,
  EmailStage
} from './types';

// Re-export Resend for convenience
export { Resend } from 'resend';