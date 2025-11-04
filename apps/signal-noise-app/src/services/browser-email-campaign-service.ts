import { EmailStage, EmailCampaign, GeneratedEmail } from '@/services/email-campaign-service';

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

export class BrowserEmailCampaignService {
  private static instance: BrowserEmailCampaignService;
  private campaigns: Map<string, EmailCampaign> = new Map();

  // Email progression stages
  private static readonly EMAIL_STAGES: EmailStage[] = [
    {
      id: 'introduction',
      name: 'Initial Introduction',
      description: 'First contact with the organization',
      purpose: 'Establish awareness and initial connection',
      tone: 'Professional but approachable',
      keyElements: [
        'Brief introduction of Yellow Panther',
        'Specific observation about their organization',
        'Value proposition relevant to their needs',
        'Clear but soft call-to-action'
      ],
      estimatedDuration: 'First contact'
    },
    {
      id: 'warm_approach',
      name: 'Warm Approach',
      description: 'Follow-up with more detailed information',
      purpose: 'Build relationship and demonstrate value',
      tone: 'Consultative and insightful',
      keyElements: [
        'Reference to previous contact',
        'Specific insights about their digital transformation needs',
        'Case studies or relevant examples',
        'More detailed call-to-action (meeting, demo)'
      ],
      estimatedDuration: '3-5 days after intro'
    },
    {
      id: 'detailed_proposal',
      name: 'Detailed Proposal',
      description: 'Comprehensive solution proposal',
      purpose: 'Present specific solutions and pricing',
      tone: 'Professional and authoritative',
      keyElements: [
        'Summary of their challenges',
        'Detailed solution proposal',
        'Implementation timeline',
        'Investment details',
        'Clear next steps'
      ],
      estimatedDuration: '1 week after warm approach'
    },
    {
      id: 'follow_up',
      name: 'Follow-up & Clarification',
      description: 'Address questions and provide additional information',
      purpose: 'Remove objections and reinforce value',
      tone: 'Responsive and helpful',
      keyElements: [
        'Reference to proposal discussion',
        'Answers to specific questions',
        'Additional benefits or reassurances',
        'Clear path forward'
      ],
      estimatedDuration: '3-4 days after proposal'
    },
    {
      id: 'closing',
      name: 'Final Closing',
      description: 'Final push for decision',
      purpose: 'Secure commitment or next step',
      tone: 'Confident and urgent',
      keyElements: [
        'Summary of value proposition',
        'Final testimonials or social proof',
        'Limited-time incentives if applicable',
        'Direct ask for decision'
      ],
      estimatedDuration: '1 week after follow-up'
    }
  ];

  static getInstance(): BrowserEmailCampaignService {
    if (!BrowserEmailCampaignService.instance) {
      BrowserEmailCampaignService.instance = new BrowserEmailCampaignService();
    }
    return BrowserEmailCampaignService.instance;
  }

  // Create a new email campaign for an entity
  async createCampaign(entityId: string, entityName: string, entityData: any): Promise<EmailCampaign> {
    const campaignId = `campaign_${entityId}_${Date.now()}`;
    
    const targetContact = {
      name: entityData.properties.keyPersonnel?.[0] || entityData.properties.name || 'Decision Maker',
      email: entityData.properties.email || 'contact@' + entityName.toLowerCase().replace(/\s+/g, '-') + '.com',
      role: entityData.properties.type || 'Executive',
      organization: entityName
    };

    const campaign: EmailCampaign = {
      id: campaignId,
      entityId,
      entityName,
      targetContact,
      campaignGoal: this.generateCampaignGoal(entityData),
      stages: BrowserEmailCampaignService.EMAIL_STAGES,
      currentStage: 0,
      generatedEmails: [],
      status: 'active'
    };

    this.campaigns.set(campaignId, campaign);
    return campaign;
  }

  // Generate email for current stage using API
  async generateEmailForStage(
    campaignId: string, 
    stageId: string,
    entityData: any,
    customInstructions?: string
  ): Promise<GeneratedEmail> {
    const campaign = this.campaigns.get(campaignId);
    if (!campaign) {
      throw new Error('Campaign not found');
    }

    const stage = campaign.stages.find(s => s.id === stageId);
    if (!stage) {
      throw new Error('Stage not found');
    }

    try {
      // Call API to generate email
      const response = await fetch('/api/email-campaign/generate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          entityId: campaign.entityId,
          stageId,
          entityData,
          customInstructions
        })
      });

      if (!response.ok) {
        throw new Error('Failed to generate email via API');
      }

      const result = await response.json();
      const generatedEmail = result.email;

      campaign.generatedEmails.push(generatedEmail);
      return generatedEmail;

    } catch (error) {
      console.error('Error generating email:', error);
      
      // Fallback to basic template
      const fallbackEmail: GeneratedEmail = {
        id: `email_${campaignId}_${stageId}_${Date.now()}`,
        stageId,
        stageName: stage.name,
        subject: `Yellow Panther Partnership - ${stage.name}`,
        body: `Dear ${campaign.targetContact.name},

I hope this email finds you well.

${stage.description}

${stage.purpose}

I would love to discuss how Yellow Panther can help ${campaign.entityName} with our digital transformation solutions.

Best regards,
The Yellow Panther Team`,
        tone: stage.tone,
        keyPoints: stage.keyElements,
        callToAction: 'Contact us for more information',
        followUpTiming: stage.estimatedDuration,
        generatedAt: new Date(),
        status: 'draft'
      };

      campaign.generatedEmails.push(fallbackEmail);
      return fallbackEmail;
    }
  }

  // Get campaign by ID
  getCampaign(campaignId: string): EmailCampaign | undefined {
    return this.campaigns.get(campaignId);
  }

  // Get all campaigns
  getAllCampaigns(): EmailCampaign[] {
    return Array.from(this.campaigns.values());
  }

  // Update campaign status
  updateCampaignStatus(campaignId: string, status: EmailCampaign['status']): void {
    const campaign = this.campaigns.get(campaignId);
    if (campaign) {
      campaign.status = status;
    }
  }

  // Move to next stage
  advanceToNextStage(campaignId: string): boolean {
    const campaign = this.campaigns.get(campaignId);
    if (campaign && campaign.currentStage < campaign.stages.length - 1) {
      campaign.currentStage++;
      return true;
    }
    return false;
  }

  // Update email status
  updateEmailStatus(campaignId: string, emailId: string, status: GeneratedEmail['status']): void {
    const campaign = this.campaigns.get(campaignId);
    if (campaign) {
      const email = campaign.generatedEmails.find(e => e.id === emailId);
      if (email) {
        email.status = status;
      }
    }
  }

  // Generate campaign goal based on entity data
  private generateCampaignGoal(entityData: any): string {
    const digitalScore = entityData.properties.digitalScore;
    const opportunities = entityData.properties.digitalOpportunities;
    
    if (digitalScore < 50) {
      return 'Digital Transformation Partnership - Help modernize sports organization technology infrastructure';
    } else if (opportunities && opportunities.length > 0) {
      return `Strategic Partnership - Leverage opportunities: ${opportunities.slice(0, 2).join(', ')}`;
    } else {
      return 'Strategic Technology Partnership - Enhance digital capabilities and fan engagement';
    }
  }

  // Get available stages
  getAvailableStages(): EmailStage[] {
    return BrowserEmailCampaignService.EMAIL_STAGES;
  }
}