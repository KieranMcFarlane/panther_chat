import { NextRequest, NextResponse } from 'next/server';
import { Inbound } from '@inboundemail/sdk';

const inbound = new Inbound(process.env.INBOUND_API_KEY || 'demoZddUekPUOokPVAIgILCUkljUXaLsKPWAKCSlYZBwyFntfqegGIsRBxVyjKvSkPjN');

interface AIEmailRequest {
  entityId: string;
  config: AIEmailAgentConfig;
  incomingEmail: {
    from: string;
    to: string;
    subject: string;
    body: string;
    headers?: Record<string, string>;
  };
}

interface AIEmailAgentConfig {
  enabled: boolean;
  autoReply: boolean;
  responseStyle: 'professional' | 'friendly' | 'formal' | 'casual';
  responseDelay: number;
  classificationRules: ClassificationRule[];
  customPrompts: CustomPrompt[];
  workingHours: {
    start: string;
    end: string;
    timezone: string;
    weekends: boolean;
  };
  escalationRules: EscalationRule[];
}

interface ClassificationRule {
  id: string;
  type: string;
  keywords: string[];
  action: 'auto_reply' | 'flag_urgent' | 'forward' | 'archive' | 'flag_for_review';
  responseTemplate?: string;
  priority: number;
  enabled: boolean;
}

interface CustomPrompt {
  id: string;
  name: string;
  trigger: string;
  template: string;
  variables: string[];
  enabled: boolean;
}

interface EscalationRule {
  id: string;
  condition: 'no_response' | 'urgent_keyword' | 'high_priority_sender';
  timeframe: number;
  action: 'notify_manager' | 'escalate_to_team' | 'create_ticket';
  enabled: boolean;
}

export async function POST(request: NextRequest) {
  try {
    const { entityId, config, incomingEmail }: AIEmailRequest = await request.json();

    if (!config.enabled) {
      return NextResponse.json({ 
        processed: false,
        reason: 'AI agent disabled' 
      });
    }

    // 1. Check if within working hours
    if (!isWithinWorkingHours(config.workingHours)) {
      return NextResponse.json({ 
        processed: false,
        reason: 'Outside working hours',
        scheduledResponse: true
      });
    }

    // 2. Classify the incoming email
    const classification = await classifyEmail(incomingEmail, config.classificationRules);
    
    // 3. Determine action based on classification
    const action = determineAction(classification, config);
    
    let response: any = {
      processed: true,
      classification,
      action: action.type,
      timestamp: new Date().toISOString()
    };

    // 4. Execute action
    switch (action.type) {
      case 'auto_reply':
        if (config.autoReply) {
          const generatedResponse = await generateEmailResponse(
            incomingEmail, 
            config, 
            action.template
          );
          
          // Schedule delayed response
          const scheduledSendTime = new Date(Date.now() + config.responseDelay * 60 * 1000);
          
          response.autoReply = {
            scheduled: scheduledSendTime.toISOString(),
            response: generatedResponse,
            template: action.template
          };
          
          // Send response immediately for demo (in production, use a job queue)
          const { data, error } = await inbound.emails.send({
            from: incomingEmail.to,
            to: incomingEmail.from,
            subject: `Re: ${incomingEmail.subject}`,
            text: generatedResponse.text,
            html: generatedResponse.html,
            tags: [
              { name: 'ai_generated', value: 'true' },
              { name: 'classification', value: classification.type },
              { name: 'entity_id', value: entityId }
            ]
          });

          if (error) {
            const errorMsg = typeof error === 'string' ? error : 'Unknown error';
            throw new Error(`Failed to send auto-reply: ${errorMsg}`);
          }

          response.autoReply.sent = true;
          response.autoReply.emailId = data?.id;
        }
        break;

      case 'flag_urgent':
        response.flagged = {
          urgency: 'high',
          reason: 'Urgent keywords detected',
          needsHumanReview: true
        };
        break;

      case 'forward':
        response.forwarded = {
          to: 'admin@yellowpanther.ai',
          reason: 'Forward rule triggered'
        };
        break;

      case 'archive':
        response.archived = {
          reason: 'Auto-archive rule triggered'
        };
        break;

      case 'flag_for_review':
        response.flaggedForReview = {
          reason: 'Needs human review',
          priority: classification.priority
        };
        break;
    }

    // 5. Check escalation rules
    const escalation = checkEscalationRules(incomingEmail, classification, config.escalationRules);
    if (escalation) {
      response.escalation = escalation;
    }

    // 6. Log the interaction for analytics
    await logAIInteraction(entityId, {
      incomingEmail,
      classification,
      action: action.type,
      response,
      timestamp: new Date().toISOString()
    });

    return NextResponse.json(response);

  } catch (error) {
    console.error('AI Email Agent error:', error);
    return NextResponse.json(
      { 
        error: 'Failed to process email with AI agent',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

async function classifyEmail(
  email: any, 
  rules: ClassificationRule[]
): Promise<{ type: string; priority: number; keywords: string[] }> {
  const content = `${email.subject} ${email.body}`.toLowerCase();
  
  let bestMatch = {
    type: 'general',
    priority: 0,
    keywords: [] as string[]
  };

  for (const rule of rules.filter(r => r.enabled)) {
    const matchedKeywords = rule.keywords.filter(keyword => 
      content.includes(keyword.toLowerCase())
    );

    if (matchedKeywords.length > 0 && rule.priority > bestMatch.priority) {
      bestMatch = {
        type: rule.type,
        priority: rule.priority,
        keywords: matchedKeywords
      };
    }
  }

  return bestMatch;
}

function determineAction(classification: any, config: AIEmailAgentConfig) {
  const rule = config.classificationRules.find(r => 
    r.enabled && r.type === classification.type
  );

  return {
    type: rule?.action || 'auto_reply',
    template: rule?.responseTemplate
  };
}

async function generateEmailResponse(
  incomingEmail: any,
  config: AIEmailAgentConfig,
  template?: string
) {
  // Use custom template if available, otherwise generate AI response
  if (template) {
    const variables = {
      senderName: incomingEmail.from.split('@')[0],
      subject: incomingEmail.subject,
      timestamp: new Date().toLocaleString()
    };

    let response = template;
    Object.entries(variables).forEach(([key, value]) => {
      response = response.replace(new RegExp(`{${key}}`, 'g'), value as string);
    });

    return {
      text: response,
      html: `<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background: #f8f9fa; padding: 20px; border-radius: 8px; margin-bottom: 20px;">
          <p style="margin: 0;">${response.replace(/\n/g, '<br>')}</p>
        </div>
        <div style="margin-top: 30px; padding: 20px; background: #f8f9fa; border-radius: 8px; text-align: center;">
          <p style="margin: 0; font-size: 14px; color: #6c757d;">
            This email was generated by AI Assistant
          </p>
        </div>
      </div>`
    };
  }

  // Generate AI response using CopilotKit
  const prompt = `Generate a ${config.responseStyle} email response with the following requirements:
  
  Original Email:
  From: ${incomingEmail.from}
  Subject: ${incomingEmail.subject}
  Body: ${incomingEmail.body}
  
  Response Style: ${config.responseStyle}
  
  Generate a professional, helpful response that:
  1. Acknowledges the original email
  2. Provides relevant information or next steps
  3. Maintains a ${config.responseStyle} tone
  4. Is concise and actionable
  
  Response:`;

  try {
    const copilotResponse = await fetch('http://localhost:3000/api/copilotkit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        variables: {
          data: {
            messages: [
              {
                id: `ai_response_${Date.now()}`,
                textMessage: {
                  role: 'user',
                  content: prompt
                }
              }
            ],
            threadId: `ai_email_${Date.now()}`
          }
        }
      })
    });

    if (copilotResponse.ok) {
      const aiResponseText = await extractTextFromStream(copilotResponse);
      
      return {
        text: aiResponseText,
        html: `<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="background: #f8f9fa; padding: 20px; border-radius: 8px; margin-bottom: 20px;">
            <p style="margin: 0;">${aiResponseText.replace(/\n/g, '<br>')}</p>
          </div>
          <div style="margin-top: 30px; padding: 20px; background: #f8f9fa; border-radius: 8px; text-align: center;">
            <p style="margin: 0; font-size: 14px; color: #6c757d;">
              This email was generated by AI Assistant
            </p>
          </div>
        </div>`
      };
    }
  } catch (error) {
    console.error('Failed to generate AI response:', error);
  }

  // Fallback response
  const fallbackResponse = `Thank you for your email. I've received your message and will get back to you as soon as possible.`;
  
  return {
    text: fallbackResponse,
    html: `<div style="font-family: Arial, sans-serif;">
      <p>${fallbackResponse}</p>
      <p style="margin-top: 30px; font-size: 14px; color: #6c757d;">
        This email was generated by AI Assistant
      </p>
    </div>`
  };
}

async function extractTextFromStream(response: Response): Promise<string> {
  const reader = response.body?.getReader();
  const decoder = new TextDecoder();
  let fullResponse = '';

  if (reader) {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      
      const chunk = decoder.decode(value, { stream: true });
      const lines = chunk.split('\n');
      
      for (const line of lines) {
        if (line.startsWith('data: ')) {
          try {
            const data = JSON.parse(line.slice(6));
            if (data.type === 'text' && data.text) {
              fullResponse += data.text;
            }
          } catch (e) {
            // Skip parsing errors
          }
        }
      }
    }
  }

  return fullResponse;
}

function isWithinWorkingHours(workingHours: any): boolean {
  const now = new Date();
  const currentTime = now.toTimeString().slice(0, 5); // HH:MM format
  
  // Check if current time is within working hours
  const timeInRange = currentTime >= workingHours.start && currentTime <= workingHours.end;
  
  // Check if it's a weekend
  const dayOfWeek = now.getDay(); // 0 = Sunday, 6 = Saturday
  const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
  
  // Return true if within working hours and either weekends are allowed or it's not a weekend
  return timeInRange && (workingHours.weekends || !isWeekend);
}

function checkEscalationRules(
  email: any, 
  classification: any, 
  rules: EscalationRule[]
): any {
  const enabledRules = rules.filter(r => r.enabled);
  
  for (const rule of enabledRules) {
    switch (rule.condition) {
      case 'urgent_keyword':
        if (classification.type === 'urgent' || classification.keywords.includes('urgent')) {
          return {
            ruleId: rule.id,
            condition: rule.condition,
            action: rule.action,
            triggered: true
          };
        }
        break;
        
      case 'high_priority_sender':
        // Add logic to check if sender is in priority list
        break;
        
      case 'no_response':
        // Add logic to check response time
        break;
    }
  }
  
  return null;
}

async function logAIInteraction(entityId: string, interaction: any) {
  // Log to database for analytics and training
  console.log('AI Interaction logged:', { entityId, interaction });
  
  // In production, save to database:
  // await saveAIInteraction(entityId, interaction);
}