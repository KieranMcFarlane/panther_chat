'use client';

import React, { useState } from 'react';
import { Mail, Send, X, Sparkles, Copy, Edit } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { useCopilotReadable, useCopilotAction } from '@copilotkit/react-core';

interface EmailAssistantProps {
  contact: {
    id: string;
    name: string;
    email: string;
    role: string;
    affiliation: string;
    tags: string[];
  } | null;
  onSendEmail: (emailData: { to: string; subject: string; body: string }) => void;
}

interface EmailTemplate {
  subject: string;
  body: string;
  category: string;
}

export function EmailAssistant({ contact, onSendEmail }: EmailAssistantProps) {
  const [emailData, setEmailData] = useState({
    subject: '',
    body: ''
  });
  const [isGenerating, setIsGenerating] = useState(false);
  const [lastGenerated, setLastGenerated] = useState<EmailTemplate | null>(null);

  // Pre-defined templates for quick starts
  const emailTemplates: EmailTemplate[] = [
    {
      subject: `Introduction - Yellow Panther Sports Intelligence`,
      body: `Dear ${contact?.name || 'Team'},\n\nI hope this message finds you well. My name is [Your Name] and I'm reaching out from Yellow Panther, a leading sports intelligence and digital transformation consultancy.\n\nGiven your role as ${contact?.role} at ${contact?.affiliation}, I wanted to introduce our comprehensive platform that helps sports organizations leverage data-driven insights for competitive advantage.\n\nOur solutions include:\n• Real-time market intelligence and RFP scanning\n• Advanced data analytics and visualization\n• Digital transformation strategy and implementation\n• Performance optimization tools\n\nI would be delighted to schedule a brief call to discuss how we might support ${contact?.affiliation}'s digital ambitions.\n\nBest regards,\n[Your Name]\nYellow Panther`,
      category: 'Introduction'
    },
    {
      subject: `Partnership Opportunity - Sports Technology Solutions`,
      body: `Dear ${contact?.name || 'Team'},\n\nI'm reaching out from Yellow Panther regarding a potential partnership opportunity with ${contact?.affiliation}.\n\nHaving followed ${contact?.affiliation}'s innovative approach to ${contact?.tags?.[0] || 'sports'}, I believe our sports intelligence platform could significantly enhance your current capabilities.\n\nOur platform has helped leading sports organizations:\n• Increase revenue through data-driven insights\n• Streamline operations with intelligent automation\n• Enhance fan engagement with advanced analytics\n• Identify new market opportunities\n\nWould you be available for a 15-minute call next week to explore synergies between our organizations?\n\nI look forward to your response.\n\nBest regards,\n[Your Name]\nYellow Panther`,
      category: 'Partnership'
    },
    {
      subject: `Follow-up - Sports Intelligence Solutions`,
      body: `Dear ${contact?.name || 'Team'},\n\nI hope you've had a chance to consider our previous conversation about Yellow Panther's sports intelligence platform.\n\nI wanted to share a brief success story: A similar organization in ${contact?.tags?.[0] || 'sports'} recently implemented our solution and saw a 40% improvement in their data-driven decision making within the first quarter.\n\nKey benefits they experienced:\n• Real-time competitive intelligence\n• Automated market analysis\n• Enhanced fan engagement metrics\n• Streamlined reporting processes\n\nI would be happy to arrange a personalized demonstration for you and your team at ${contact?.affiliation}.\n\nWhen would be a good time for a brief call?\n\nBest regards,\n[Your Name]\nYellow Panther`,
      category: 'Follow-up'
    }
  ];

  // Make contact and templates available to CopilotKit
  useCopilotReadable({
    description: "Email templates and contact information for AI assistance",
    value: {
      contact: contact ? {
        name: contact.name,
        role: contact.role,
        affiliation: contact.affiliation,
        email: contact.email,
        tags: contact.tags,
        context: `Professional contact at ${contact.affiliation}, role: ${contact.role}, interests: ${contact.tags.join(', ')}`
      } : null,
      templates: emailTemplates,
      currentEmail: emailData
    }
  });

  // CopilotKit action for generating custom email content
  useCopilotAction({
    name: "generateCustomEmail",
    description: "Generate a personalized email based on specific requirements",
    parameters: [
      {
        name: "type",
        type: "string",
        description: "Type of email (introduction, partnership, follow-up, proposal, etc.)"
      },
      {
        name: "tone",
        type: "string",
        description: "Tone of the email (professional, friendly, formal, casual)"
      },
      {
        name: "keyMessage",
        type: "string",
        description: "Main message or value proposition to emphasize"
      },
      {
        name: "callToAction",
        type: "string",
        description: "Desired call to action (schedule call, meeting, demo, etc.)"
      }
    ],
    handler: async ({ type, tone, keyMessage, callToAction }) => {
      setIsGenerating(true);
      
      try {
        const prompt = `Generate a professional email for ${contact?.name}, ${contact?.role} at ${contact?.affiliation}.

Email Type: ${type}
Tone: ${tone}
Key Message: ${keyMessage}
Call to Action: ${callToAction}

Contact Details: ${contact?.name}, ${contact?.role} at ${contact?.affiliation}
Interests: ${contact?.tags?.join(', ')}

Company: Yellow Panther - Sports Intelligence and Digital Transformation

Please generate a complete email with:
1. A compelling subject line that mentions ${contact?.affiliation}
2. Professional greeting
3. Brief introduction of Yellow Panther
4. Clear value proposition based on the key message
5. Specific call to action
6. Professional closing

Make it personalized to their role and organization. Format the response clearly.`;

        const response = await fetch('/api/copilotkit', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            variables: {
              data: {
                messages: [
                  {
                    id: `email_custom_${Date.now()}`,
                    textMessage: {
                      role: 'user',
                      content: prompt
                    }
                  }
                ],
                threadId: `email_${contact?.id}`
              }
            }
          })
        });

        if (!response.ok) {
          throw new Error('Failed to generate email content');
        }

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

        // Extract subject and body from the response
        const lines = fullResponse.split('\n');
        let subject = '';
        let body = '';
        let captureBody = false;

        for (const line of lines) {
          const trimmedLine = line.trim();
          if (trimmedLine.toLowerCase().startsWith('subject:')) {
            subject = trimmedLine.replace(/^subject:\s*/i, '');
          } else if (subject && !captureBody && trimmedLine) {
            captureBody = true;
            body = trimmedLine;
          } else if (captureBody) {
            body += '\n' + line;
          }
        }

        // Fallback if we couldn't parse properly
        if (!subject) {
          subject = `Yellow Panther - ${type.charAt(0).toUpperCase() + type.slice(1)} for ${contact?.affiliation}`;
        }
        if (!body) {
          body = fullResponse;
        }

        const generatedEmail: EmailTemplate = {
          subject: subject.trim(),
          body: body.trim(),
          category: 'AI Generated'
        };

        setLastGenerated(generatedEmail);
        setEmailData({
          subject: generatedEmail.subject,
          body: generatedEmail.body
        });

      } catch (error) {
        console.error('Error generating email:', error);
      } finally {
        setIsGenerating(false);
      }
    }
  });

  // CopilotKit action to refine existing email
  useCopilotAction({
    name: "refineEmail",
    description: "Refine and improve the current email draft",
    parameters: [
      {
        name: "focus",
        type: "string",
        description: "What to focus on improving (tone, clarity, professionalism, etc.)"
      },
      {
        name: "specificChanges",
        type: "string",
        description: "Specific changes or improvements needed"
      }
    ],
    handler: async ({ focus, specificChanges }) => {
      setIsGenerating(true);
      
      try {
        const prompt = `Please refine this email to improve the ${focus}:

Current Subject: ${emailData.subject}
Current Body: ${emailData.body}

Requested Changes: ${specificChanges}

Contact: ${contact?.name}, ${contact?.role} at ${contact?.affiliation}

Please provide the improved version with both subject and body. Format clearly.`;

        const response = await fetch('/api/copilotkit', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            variables: {
              data: {
                messages: [
                  {
                    id: `email_refine_${Date.now()}`,
                    textMessage: {
                      role: 'user',
                      content: prompt
                    }
                  }
                ],
                threadId: `email_${contact?.id}`
              }
            }
          })
        });

        if (!response.ok) {
          throw new Error('Failed to refine email');
        }

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

        // Parse the refined email
        const lines = fullResponse.split('\n');
        let subject = emailData.subject;
        let body = '';
        let captureBody = false;

        for (const line of lines) {
          const trimmedLine = line.trim();
          if (trimmedLine.toLowerCase().startsWith('subject:')) {
            subject = trimmedLine.replace(/^subject:\s*/i, '');
          } else if (trimmedLine.toLowerCase().startsWith('body:')) {
            captureBody = true;
            body = trimmedLine.replace(/^body:\s*/i, '');
          } else if (captureBody) {
            body += '\n' + line;
          }
        }

        if (!body) {
          body = fullResponse;
        }

        setEmailData({
          subject: subject.trim(),
          body: body.trim()
        });

      } catch (error) {
        console.error('Error refining email:', error);
      } finally {
        setIsGenerating(false);
      }
    }
  });

  const useTemplate = (template: EmailTemplate) => {
    setEmailData({
      subject: template.subject,
      body: template.body
    });
    setLastGenerated(template);
  };

  const handleSendEmail = () => {
    if (contact && emailData.subject && emailData.body) {
      onSendEmail({
        to: contact.email,
        subject: emailData.subject,
        body: emailData.body
      });
    }
  };

  if (!contact) return null;

  return (
    <div className="space-y-6">
      {/* Contact Info */}
      <div className="bg-blue-50 border border-blue-200 p-4 rounded-lg">
        <div className="flex items-center justify-between">
          <div>
            <h4 className="font-semibold text-blue-900">{contact.name}</h4>
            <p className="text-blue-700 text-sm">{contact.role} at {contact.affiliation}</p>
            <p className="text-blue-600 text-xs">{contact.email}</p>
          </div>
          <div className="flex flex-wrap gap-1">
            {contact.tags.map((tag, index) => (
              <Badge key={index} variant="outline" className="text-xs bg-blue-100 text-blue-800">
                {tag}
              </Badge>
            ))}
          </div>
        </div>
      </div>

      {/* AI Assistant Tips */}
      <div className="bg-gradient-to-r from-purple-50 to-blue-50 border border-purple-200 p-4 rounded-lg">
        <div className="flex items-center gap-2 mb-3">
          <Sparkles className="w-4 h-4 text-purple-600" />
          <h4 className="font-semibold text-purple-900">AI Email Assistant</h4>
        </div>
        <div className="space-y-2 text-sm text-purple-800">
          <p>💡 Ask me to generate emails by saying:</p>
          <div className="space-y-1 text-xs">
            <div className="bg-white p-2 rounded border-l-4 border-purple-300">
              <strong>"Generate a partnership introduction email with professional tone"</strong>
            </div>
            <div className="bg-white p-2 rounded border-l-4 border-blue-300">
              <strong>"Create a follow-up email emphasizing our analytics capabilities"</strong>
            </div>
            <div className="bg-white p-2 rounded border-l-4 border-green-300">
              <strong>"Refine this email to be more concise and impactful"</strong>
            </div>
          </div>
        </div>
      </div>

      {/* Quick Templates */}
      <div>
        <h4 className="font-semibold mb-3 flex items-center gap-2">
          <Mail className="w-4 h-4" />
          Quick Templates
        </h4>
        <div className="grid grid-cols-1 gap-2">
          {emailTemplates.map((template, index) => (
            <div
              key={index}
              className="border border-gray-200 rounded-lg p-3 hover:border-blue-300 cursor-pointer transition-colors"
              onClick={() => useTemplate(template)}
            >
              <div className="flex items-center justify-between">
                <div>
                  <div className="font-medium text-sm">{template.subject}</div>
                  <div className="text-xs text-gray-500">{template.category}</div>
                </div>
                <Copy className="w-4 h-4 text-gray-400" />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Email Composition */}
      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium mb-1">Subject</label>
          <Input
            value={emailData.subject}
            onChange={(e) => setEmailData(prev => ({ ...prev, subject: e.target.value }))}
            placeholder="Email subject"
            className="w-full"
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">Message</label>
          <Textarea
            value={emailData.body}
            onChange={(e) => setEmailData(prev => ({ ...prev, body: e.target.value }))}
            placeholder="Write your email message here..."
            className="w-full min-h-[300px]"
          />
        </div>
      </div>

      {/* Generation Status */}
      {isGenerating && (
        <div className="flex items-center justify-center p-4 bg-blue-50 rounded-lg">
          <div className="flex items-center text-blue-600">
            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600 mr-2"></div>
            AI is generating your email...
          </div>
        </div>
      )}

      {/* Last Generated Info */}
      {lastGenerated && (
        <div className="flex items-center justify-between p-3 bg-green-50 rounded-lg">
          <span className="text-sm text-green-700">
            ✓ {lastGenerated.category} email ready
          </span>
          <Button
            size="sm"
            variant="outline"
            onClick={() => setLastGenerated(null)}
          >
            <Edit className="w-3 h-3 mr-1" />
            Edit
          </Button>
        </div>
      )}

      {/* Send Button */}
      <Button
        onClick={handleSendEmail}
        disabled={!emailData.subject || !emailData.body || isGenerating}
        className="w-full bg-blue-600 hover:bg-blue-700"
      >
        <Send className="w-4 h-4 mr-2" />
        Send Email to {contact.name}
      </Button>
    </div>
  );
}

export default EmailAssistant;