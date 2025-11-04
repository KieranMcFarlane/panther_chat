import { processClaudeMessage, createSportsIntelligenceQuery } from '../../lib/claude-agent-manager';
import { EmailCampaign, GeneratedEmail, EmailStage } from './types';

export class EmailCampaignService {
  private static instance: EmailCampaignService;
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

  static getInstance(): EmailCampaignService {
    if (!EmailCampaignService.instance) {
      EmailCampaignService.instance = new EmailCampaignService();
    }
    return EmailCampaignService.instance;
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
      stages: EmailCampaignService.EMAIL_STAGES,
      currentStage: 0,
      generatedEmails: [],
      status: 'active'
    };

    this.campaigns.set(campaignId, campaign);
    return campaign;
  }

  // Generate email for current stage using Claude Agent SDK
  async generateEmailForStage(
    campaignId: string, 
    stageId: string,
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

    // Get entity data for context
    const entityContext = await this.getEntityContext(campaign.entityId);
    
    const prompt = this.buildEmailGenerationPrompt(campaign, stage, entityContext, customInstructions);
    
    try {
      let fullResponse = '';
      const emailQuery = createSportsIntelligenceQuery({
        maxTurns: 3,
        systemPrompt: {
          type: "preset",
          preset: "claude_code",
          append: `You are an expert email marketing strategist specializing in B2B sports industry outreach. Generate compelling, professional emails that get responses. Always focus on value, personalization, and clear calls-to-action.`
        }
      });

      // Generate email using Claude Agent SDK
      for await (const response of emailQuery(prompt)) {
        if (response.type === 'text') {
          fullResponse += response.text;
        }
      }

      // Parse the response
      const emailContent = this.parseEmailResponse(fullResponse);
      
      const generatedEmail: GeneratedEmail = {
        id: `email_${campaignId}_${stageId}_${Date.now()}`,
        stageId,
        stageName: stage.name,
        subject: emailContent.subject,
        body: emailContent.body,
        tone: stage.tone,
        keyPoints: emailContent.keyPoints,
        callToAction: emailContent.callToAction,
        followUpTiming: stage.estimatedDuration,
        generatedAt: new Date(),
        status: 'draft'
      };

      campaign.generatedEmails.push(generatedEmail);
      return generatedEmail;

    } catch (error) {
      console.error('Error generating email:', error);
      throw new Error('Failed to generate email');
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

  // Build prompt for email generation
  private buildEmailGenerationPrompt(
    campaign: EmailCampaign,
    stage: EmailStage,
    entityContext: any,
    customInstructions?: string
  ): string {
    return `
Generate a ${stage.name} email for the following campaign:

TARGET: ${campaign.targetContact.name} (${campaign.targetContact.role}) at ${campaign.targetContact.organization}
EMAIL: ${campaign.targetContact.email}
CAMPAIGN GOAL: ${campaign.campaignGoal}

CURRENT STAGE: ${stage.name}
PURPOSE: ${stage.purpose}
TONE: ${stage.tone}
KEY ELEMENTS TO INCLUDE: ${stage.keyElements.join(', ')}
DURATION: ${stage.estimatedDuration}

ENTITY CONTEXT:
${JSON.stringify(entityContext, null, 2)}

PREVIOUS EMAILS IN CAMPAIGN: ${campaign.generatedEmails.length}

${customInstructions ? `CUSTOM INSTRUCTIONS: ${customInstructions}` : ''}

Please generate a professional email with:
1. A compelling subject line
2. Personalized greeting
3. Well-structured body that includes the key elements
4. Clear call-to-action
5. Professional signature

Format your response as JSON:
{
  "subject": "Compelling subject line",
  "body": "Full email body with proper formatting and paragraphs",
  "keyPoints": ["Key point 1", "Key point 2", "Key point 3"],
  "callToAction": "Specific call-to-action for this email"
}
`;
  }

  // Parse Claude's response into email content
  private parseEmailResponse(response: string): {
    subject: string;
    body: string;
    keyPoints: string[];
    callToAction: string;
  } {
    try {
      // Try to extract JSON from the response
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        return {
          subject: parsed.subject || 'No subject',
          body: parsed.body || response,
          keyPoints: parsed.keyPoints || [],
          callToAction: parsed.callToAction || 'Contact us for more information'
        };
      }
      
      // Fallback parsing
      const lines = response.split('\n');
      const subjectLine = lines.find(line => line.toLowerCase().includes('subject'));
      const subject = subjectLine ? subjectLine.split(':')[1]?.trim() : 'Business Proposal';
      
      return {
        subject,
        body: response,
        keyPoints: [],
        callToAction: 'Contact us for more information'
      };
    } catch (error) {
      console.error('Error parsing email response:', error);
      return {
        subject: 'Business Proposal',
        body: response,
        keyPoints: [],
        callToAction: 'Contact us for more information'
      };
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

  // Get entity context for email generation
  private async getEntityContext(entityId: string): Promise<any> {
    try {
      const response = await fetch(`/api/entities/${entityId}`);
      if (response.ok) {
        return await response.json();
      }
    } catch (error) {
      console.error('Error fetching entity context:', error);
    }
    
    return {};
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
}