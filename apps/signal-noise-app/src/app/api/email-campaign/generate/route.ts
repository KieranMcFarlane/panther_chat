import { NextRequest, NextResponse } from 'next/server';
import { createSportsIntelligenceQuery } from '@/lib/claude-agent-manager';
import { EmailCampaignService } from '@/services/email-campaign-service';

interface GenerateEmailRequest {
  entityId: string;
  stageId: string;
  entityData: any;
  customInstructions?: string;
}

export async function POST(request: NextRequest) {
  try {
    const { entityId, stageId, entityData, customInstructions }: GenerateEmailRequest = await request.json();

    if (!entityId || !stageId || !entityData) {
      return NextResponse.json(
        { error: 'Missing required fields: entityId, stageId, entityData' },
        { status: 400 }
      );
    }

    // Create campaign service instance
    const campaignService = EmailCampaignService.getInstance();
    
    // Create campaign if it doesn't exist
    let campaign = campaignService.getCampaign(`campaign_${entityId}`);
    if (!campaign) {
      campaign = await campaignService.createCampaign(entityId, entityData.properties.name, entityData);
    }

    // Generate email for the specified stage
    const email = await campaignService.generateEmailForStage(stageId, customInstructions);

    return NextResponse.json({
      success: true,
      email,
      campaign: {
        id: campaign.id,
        currentStage: campaign.currentStage,
        totalStages: campaign.stages.length,
        status: campaign.status
      }
    });

  } catch (error) {
    console.error('Error generating email:', error);
    return NextResponse.json(
      { error: 'Failed to generate email', message: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const entityId = searchParams.get('entityId');

    if (!entityId) {
      return NextResponse.json(
        { error: 'Missing entityId parameter' },
        { status: 400 }
      );
    }

    const campaignService = EmailCampaignService.getInstance();
    const campaign = campaignService.getCampaign(`campaign_${entityId}`);

    return NextResponse.json({
      success: true,
      campaign,
      availableStages: EmailCampaignService.prototype['EMAIL_STAGES'] || []
    });

  } catch (error) {
    console.error('Error fetching campaign:', error);
    return NextResponse.json(
      { error: 'Failed to fetch campaign', message: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}