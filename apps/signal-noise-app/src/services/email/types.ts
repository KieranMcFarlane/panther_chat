/**
 * Email Service Types
 */

export interface RFPDNotificationPayload {
  type: 'rfp_detected';
  priority: 'HIGH' | 'MEDIUM' | 'LOW';
  organization: string;
  fit_score: number;
  estimated_value?: string;
  urgency: string;
  recommendation: string;
  post_url?: string;
  detected_at: string;
  sport?: string;
}

export interface SlackNotificationData {
  channel: string;
  text: string;
  blocks: any[];
  attachments?: any[];
}

export interface EmailStage {
  id: string;
  name: string;
  description: string;
  purpose: string;
  tone: string;
  keyElements: string[];
  estimatedDuration: string;
}

export interface EmailCampaign {
  id: string;
  entityId: string;
  entityName: string;
  targetContact: {
    name: string;
    email: string;
    role: string;
    organization: string;
  };
  campaignGoal: string;
  stages: EmailStage[];
  currentStage: number;
  generatedEmails: GeneratedEmail[];
  status: 'active' | 'completed' | 'paused';
}

export interface GeneratedEmail {
  id: string;
  stageId: string;
  stageName: string;
  subject: string;
  body: string;
  tone: string;
  keyPoints: string[];
  callToAction: string;
  followUpTiming: string;
  generatedAt: Date;
  status: 'draft' | 'sent' | 'scheduled';
}