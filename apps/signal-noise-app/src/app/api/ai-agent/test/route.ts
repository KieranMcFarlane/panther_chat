import { NextRequest, NextResponse } from 'next/server';

interface TestRequest {
  entityId: string;
  config: any;
  testEmail: {
    subject: string;
    body: string;
    sender: string;
  };
}

export async function POST(request: NextRequest) {
  try {
    const { entityId, config, testEmail }: TestRequest = await request.json();

    // Simulate AI processing
    const startTime = Date.now();

    // 1. Classification
    const classification = await simulateClassification(testEmail);
    
    // 2. Action determination
    const action = determineAction(classification, config);
    
    // 3. Response generation (if auto-reply)
    let generatedResponse = null;
    if (action.type === 'auto_reply') {
      generatedResponse = await simulateResponseGeneration(testEmail, config);
    }

    const processingTime = Date.now() - startTime;

    const testResults = {
      timestamp: new Date().toISOString(),
      processingTime,
      classification: classification.type,
      confidence: classification.confidence,
      action: action.type,
      matchedKeywords: classification.keywords,
      generatedResponse,
      aiAgentConfig: {
        enabled: config.enabled,
        autoReply: config.autoReply,
        responseStyle: config.responseStyle,
        responseDelay: config.responseDelay
      },
      testEmail: {
        subject: testEmail.subject,
        bodyLength: testEmail.body.length,
        sender: testEmail.sender
      }
    };

    return NextResponse.json(testResults);

  } catch (error) {
    console.error('Error testing AI agent:', error);
    return NextResponse.json(
      { 
        error: 'Failed to test AI agent',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

async function simulateClassification(email: any) {
  const content = `${email.subject} ${email.body}`.toLowerCase();
  
  // Simple keyword-based classification for testing
  const classificationRules = [
    {
      type: 'urgent',
      keywords: ['urgent', 'asap', 'immediately', 'emergency'],
      confidence: 0.9
    },
    {
      type: 'inquiry',
      keywords: ['question', 'inquiry', 'information', 'interested'],
      confidence: 0.8
    },
    {
      type: 'support',
      keywords: ['help', 'issue', 'problem', 'support'],
      confidence: 0.85
    },
    {
      type: 'partnership',
      keywords: ['partnership', 'collaborate', 'opportunity', 'business'],
      confidence: 0.9
    }
  ];

  let bestMatch = {
    type: 'general',
    confidence: 0.5,
    keywords: []
  };

  for (const rule of classificationRules) {
    const matchedKeywords = rule.keywords.filter(keyword => 
      content.includes(keyword)
    );

    if (matchedKeywords.length > 0 && rule.confidence > bestMatch.confidence) {
      bestMatch = {
        type: rule.type,
        confidence: rule.confidence,
        keywords: matchedKeywords
      };
    }
  }

  // Add some randomness to simulate AI uncertainty
  bestMatch.confidence = Math.min(0.95, bestMatch.confidence + (Math.random() - 0.5) * 0.1);

  return bestMatch;
}

function determineAction(classification: any, config: any) {
  // Find matching rule based on classification
  const rule = config.classificationRules?.find((r: any) => 
    r.enabled && r.type === classification.type
  );

  if (rule) {
    return {
      type: rule.action,
      template: rule.responseTemplate,
      priority: rule.priority
    };
  }

  // Default action based on classification
  switch (classification.type) {
    case 'urgent':
      return { type: 'flag_urgent', priority: 10 };
    case 'inquiry':
      return { type: 'auto_reply', priority: 5 };
    case 'support':
      return { type: 'flag_for_review', priority: 7 };
    case 'partnership':
      return { type: 'flag_for_review', priority: 8 };
    default:
      return { type: 'auto_reply', priority: 3 };
  }
}

async function simulateResponseGeneration(email: any, config: any) {
  const responses = {
    professional: {
      inquiry: "Thank you for your inquiry. I have received your message and will respond with the requested information within 24 business hours.",
      urgent: "I have received your urgent message and am giving it immediate attention. I will respond shortly with an update.",
      support: "Thank you for bringing this matter to our attention. I am reviewing your request and will provide assistance promptly.",
      partnership: "Thank you for your interest in partnership opportunities. I would be delighted to discuss this further. Please let me know your availability for a call next week."
    },
    friendly: {
      inquiry: "Hi there! Thanks so much for reaching out. I got your message and I'll get back to you soon with all the details you need!",
      urgent: "I see your message is urgent - I'm on it right now and will get back to you as quickly as possible!",
      support: "Thanks for letting me know about this! I'm looking into it and will help sort things out for you.",
      partnership: "Great to hear from you! I'm excited about the potential to work together. Let's definitely chat more about this - when works well for you?"
    }
  };

  const classification = await simulateClassification(email);
  const style = config.responseStyle || 'professional';
  const styleResponses = responses[style as keyof typeof responses] || responses.professional;
  
  return styleResponses[classification.type as keyof typeof styleResponses] || 
         styleResponses.inquiry;
}