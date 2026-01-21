import { NextRequest, NextResponse } from 'next/server';
import { query } from '@anthropic-ai/claude-agent-sdk';

export async function POST(request: NextRequest) {
  try {
    const { messageThread, currentEmailContent, recipient } = await request.json();

    if (!messageThread || messageThread.length === 0) {
      return NextResponse.json({ error: 'No message thread provided' }, { status: 400 });
    }

    // Format message thread for AI analysis
    const threadSummary = messageThread
      .map(msg => `${msg.direction === 'inbound' ? 'RECEIVED' : 'SENT'} from ${msg.sender} (${msg.timestamp}):\n${msg.content}`)
      .join('\n\n---\n\n');

    const systemPrompt = `You are a sales pipeline analysis expert specializing in B2B sales for the sports industry. 

Analyze the provided email thread and determine:
1. Current sales pipeline stage (initial, qualification, discovery, proposal, negotiation, closing, followup)
2. Confidence level (0-100%)
3. Recommended next action
4. Risk factors or obstacles
5. Opportunity score (0-100)

Pipeline Stage Definitions:
- INITIAL: First contact, introductory phase
- QUALIFICATION: Determining if prospect is a good fit
- DISCOVERY: Understanding needs, pain points, requirements
- PROPOSAL: Presenting solutions, pricing, formal proposals
- NEGOTIATION: Terms discussion, objections, closing details
- CLOSING: Final agreement, contract signing
- FOLLOWUP: Post-sale relationship management

Consider these factors:
- Email frequency and response patterns
- Language indicating buying signals
- Mention of budgets, timelines, decision makers
- Competitive positioning
- Relationship progression
- Sports industry context (clubs, leagues, venues, sponsors)

Respond in JSON format with:
{
  "stage": "stage_name",
  "confidence": 0-100,
  "nextAction": "Specific recommended action",
  "riskFactors": ["List of potential risks"],
  "opportunityScore": 0-100,
  "analysis": "Brief reasoning"
}`;

    const prompt = `Analyze this sales pipeline for communication with ${recipient}:

Current Email Being Composed:
${currentEmailContent || '[No content yet]'}

Message Thread History:
${threadSummary}

Please analyze the current sales pipeline stage and provide strategic guidance.`;

    // Use Claude Agent SDK for analysis
    const queryResponse = await query({
      prompt,
      options: {
        systemPrompt,
        model: 'claude-3-sonnet-20241022',
        maxTokens: 2000,
        temperature: 0.3
      }
    });

    const aiResponse = queryResponse.content || '';

    // Extract JSON from AI response
    const jsonMatch = aiResponse.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error('Could not parse AI response');
    }

    let analysis;
    try {
      analysis = JSON.parse(jsonMatch[0]);
    } catch (parseError) {
      // Fallback if JSON parsing fails
      analysis = {
        stage: 'discovery',
        confidence: 70,
        nextAction: 'Continue conversation to better understand needs',
        riskFactors: ['Unclear requirements'],
        opportunityScore: 60,
        analysis: aiResponse.substring(0, 200)
      };
    }

    return NextResponse.json(analysis);

  } catch (error) {
    console.error('Sales pipeline analysis error:', error);
    
    // Fallback analysis
    const fallbackAnalysis = {
      stage: 'discovery',
      confidence: 50,
      nextAction: 'Continue engaging to understand prospect needs better',
      riskFactors: ['Limited conversation history'],
      opportunityScore: 50,
      analysis: 'Unable to perform detailed analysis due to error'
    };

    return NextResponse.json(fallbackAnalysis);
  }
}