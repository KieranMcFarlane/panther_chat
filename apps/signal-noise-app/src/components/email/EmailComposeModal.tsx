'use client';

import React, { useState, useEffect } from 'react';
import { Mail, Send, X, Loader2, Sparkles, CheckCircle, Target } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { useCopilotAction, useCopilotReadable } from '@copilotkit/react-core';
// import { BrowserEmailCampaignService, EmailCampaign, EmailStage, GeneratedEmail } from '@/services/browser-email-campaign-service';

interface EmailComposeModalProps {
  isOpen: boolean;
  onClose: () => void;
  contact: {
    id: string;
    name: string;
    email: string;
    role: string;
    affiliation: string;
    tags: string[];
  } | null;
  entity?: any; // Add entity prop for campaign creation
}

interface EmailData {
  to: string;
  subject: string;
  body: string;
  from: string;
}

export function EmailComposeModal({ isOpen, onClose, contact, entity }: EmailComposeModalProps) {
  const [emailData, setEmailData] = useState<EmailData>({
    to: '',
    subject: '',
    body: '',
    from: 'team@yellowpanther.ai'
  });
  const [isSending, setIsSending] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedSubject, setGeneratedSubject] = useState('');
  const [generatedBody, setGeneratedBody] = useState('');
  
  // Campaign management state - commented out to fix import issues
  // const [emailCampaignService] = useState(() => BrowserEmailCampaignService.getInstance());
  // const [currentCampaign, setCurrentCampaign] = useState<EmailCampaign | null>(null);
  // const [showCampaignView, setShowCampaignView] = useState(false);
  // const [selectedStage, setSelectedStage] = useState<EmailStage | null>(null);
  // const [isCreatingCampaign, setIsCreatingCampaign] = useState(false);

  // Update email data when contact changes
  useEffect(() => {
    if (contact) {
      setEmailData(prev => ({
        ...prev,
        to: contact.email,
        subject: '',
        body: ''
      }));
      setGeneratedSubject('');
      setGeneratedBody('');
    }
  }, [contact]);

  // Create new campaign - commented out to fix import issues
  // const createCampaign = async () => {
  //   if (!entity || !contact) return;
  //   
  //   setIsCreatingCampaign(true);
  //   try {
  //     const campaign = await emailCampaignService.createCampaign(
  //       entity.id,
  //       contact.name,
  //       entity
  //     );
  //     setCurrentCampaign(campaign);
  //     setShowCampaignView(true);
  //     setSelectedStage(campaign.stages[0]);
  //   } catch (error) {
  //     console.error('Error creating campaign:', error);
  //   } finally {
  //     setIsCreatingCampaign(false);
  //   }
  // };

  // Generate email for selected stage - commented out to fix import issues
  // const generateEmailForStage = async (stage: EmailStage, customInstructions?: string) => {
  //   if (!currentCampaign || !entity) return;
  //   
  //   setIsGenerating(true);
  //   try {
  //     const generatedEmail = await emailCampaignService.generateEmailForStage(
  //       currentCampaign.id,
  //       stage.id,
  //       entity,
  //       customInstructions
  //     );
      
  //     // Update form with generated content
  //     setEmailData(prev => ({
  //       ...prev,
  //       subject: generatedEmail.subject,
  //       body: generatedEmail.body
  //     }));
      
  //     setGeneratedSubject(generatedEmail.subject);
  //     setGeneratedBody(generatedEmail.body);
      
  //   } catch (error) {
  //     console.error('Error generating email:', error);
  //   } finally {
  //     setIsGenerating(false);
  //   }
  // };

  // Send email and advance campaign - simplified to avoid import issues
  // const sendEmailAndAdvanceCampaign = async () => {
  //   if (!emailData.to || !emailData.subject || !emailData.body) {
  //     return;
  //   }

  //   setIsSending(true);

  //   try {
  //     // Send email using Inbound API
  //     const response = await fetch('/api/email/send', {
  //       method: 'POST',
  //       headers: {
  //         'Content-Type': 'application/json',
  //       },
  //       body: JSON.stringify(emailData)
  //     });

  //     if (!response.ok) {
  //       throw new Error('Failed to send email');
  //     }

  //     const result = await response.json();
  //     console.log('Email sent successfully:', result.id);
      
  //     // If this is part of a campaign, update email status and advance
  //     if (currentCampaign && selectedStage) {
  //       const currentEmail = currentCampaign.generatedEmails.find(
  //         e => e.stageId === selectedStage.id && e.status === 'draft'
  //       );
        
  //       if (currentEmail) {
  //         emailCampaignService.updateEmailStatus(currentCampaign.id, currentEmail.id, 'sent');
  //       }
        
  //       // Auto-advance to next stage
  //       const canAdvance = emailCampaignService.advanceToNextStage(currentCampaign.id);
  //       if (canAdvance) {
  //         setCurrentCampaign(prev => {
  //           if (prev) {
  //             return { ...prev, currentStage: prev.currentStage + 1 };
  //           }
  //           return prev;
  //         });
  //         setSelectedStage(currentCampaign.stages[currentCampaign.currentStage + 1]);
  //       }
  //     }
      
  //     // Show success message and close modal
  //     setTimeout(() => {
  //       onClose();
  //       resetForm();
  //     }, 1000);
  //   } catch (error) {
  //     console.error('Error sending email:', error);
  //   } finally {
  //     setIsSending(false);
  //   }
  // };

  // Reset form and campaign state - simplified to avoid import issues
  const resetForm = () => {
    setEmailData({
      to: contact?.email || '',
      subject: '',
      body: '',
      from: 'team@yellowpanther.ai'
    });
    setGeneratedSubject('');
    setGeneratedBody('');
    // setCurrentCampaign(null);
    // setShowCampaignView(false);
    // setSelectedStage(null);
  };

  // Make contact info available to CopilotKit
  useCopilotReadable({
    description: "Current contact information for email composition",
    value: contact ? {
      name: contact.name,
      role: contact.role,
      affiliation: contact.affiliation,
      email: contact.email,
      tags: contact.tags,
      context: `Professional contact at ${contact.affiliation}, role: ${contact.role}, interests: ${contact.tags.join(', ')}`
    } : null
  });

  // CopilotKit action for generating email content
  useCopilotAction({
    name: "generateEmailContent",
    description: "Generate professional email content based on contact information and user intent",
    parameters: [
      {
        name: "intent",
        type: "string",
        description: "The purpose or goal of the email (e.g., 'introduction', 'follow-up', 'partnership proposal')"
      },
      {
        name: "tone",
        type: "string", 
        description: "Desired tone (e.g., 'professional', 'friendly', 'formal', 'casual')"
      },
      {
        name: "keyPoints",
        type: "string",
        description: "Key points to include in the email"
      }
    ],
    handler: async ({ intent, tone, keyPoints }) => {
      setIsGenerating(true);
      
      try {
        // Generate email content using CopilotKit
        const prompt = `Generate a professional email for ${contact?.name}, ${contact?.role} at ${contact?.affiliation}.

Intent: ${intent}
Tone: ${tone}
Key Points: ${keyPoints}

Contact context: ${contact?.tags.join(', ')}

Please generate:
1. A compelling subject line
2. A professional email body that includes:
   - Appropriate greeting
   - Introduction of Yellow Panther
   - Key points mentioned above
   - Clear call to action
   - Professional closing

Format your response as JSON:
{
  "subject": "Generated subject line",
  "body": "Full email body with proper formatting"
}`;

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
                    id: `email_gen_${Date.now()}`,
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

        // Try to parse JSON response
        try {
          const jsonMatch = fullResponse.match(/\{[\s\S]*\}/);
          if (jsonMatch) {
            const emailContent = JSON.parse(jsonMatch[0]);
            setGeneratedSubject(emailContent.subject);
            setGeneratedBody(emailContent.body);
            
            // Auto-fill the form
            setEmailData(prev => ({
              ...prev,
              subject: emailContent.subject,
              body: emailContent.body
            }));
          } else {
            // Fallback: use the raw response as body
            setGeneratedBody(fullResponse);
            setEmailData(prev => ({
              ...prev,
              body: fullResponse
            }));
          }
        } catch (e) {
          // Fallback: use the raw response
          setGeneratedBody(fullResponse);
          setEmailData(prev => ({
            ...prev,
            body: fullResponse
          }));
        }
      } catch (error) {
        console.error('Error generating email:', error);
      } finally {
        setIsGenerating(false);
      }
    }
  });

  // Handle send email - simplified to avoid campaign logic
  const handleSendEmail = async () => {
    if (!emailData.to || !emailData.subject || !emailData.body) {
      return;
    }

    setIsSending(true);

    try {
      const response = await fetch('/api/email/send', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(emailData)
      });

      if (!response.ok) {
        throw new Error('Failed to send email');
      }

      const result = await response.json();
      console.log('Email sent successfully:', result.id);
      
      setTimeout(() => {
        onClose();
        resetForm();
      }, 1000);
    } catch (error) {
      console.error('Error sending email:', error);
    } finally {
      setIsSending(false);
    }
  };

  if (!contact) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Mail className="w-5 h-5" />
            Compose Email to {contact.name}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Contact Info */}
          <div className="bg-gray-50 p-4 rounded-lg">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="font-semibold text-lg">{contact.name}</h4>
                <p className="text-gray-600">{contact.role} at {contact.affiliation}</p>
                <p className="text-sm text-gray-500">{contact.email}</p>
              </div>
              <div className="flex flex-wrap gap-1">
                {contact.tags.map((tag, index) => (
                  <Badge key={index} variant="outline" className="text-xs">
                    {tag}
                  </Badge>
                ))}
              </div>
            </div>
          </div>

          {/* Campaign Management Section - Temporarily Disabled */}
          {/* <div className="bg-blue-50 border border-blue-200 p-4 rounded-lg">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Mail className="w-4 h-4 text-blue-600" />
                <h4 className="font-semibold text-blue-900">Email Campaign Progression</h4>
              </div>
              {!currentCampaign && (
                <Button
                  onClick={createCampaign}
                  disabled={isCreatingCampaign}
                  variant="outline"
                  size="sm"
                  className="border-blue-300 text-blue-700 hover:bg-blue-100"
                >
                  {isCreatingCampaign ? (
                    <>
                      <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                      Creating...
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-3 h-3 mr-1" />
                      Start Campaign
                    </>
                  )}
                </Button>
              )}
            </div>

            {currentCampaign ? (
              <div className="space-y-3">
                <div className="bg-white p-3 rounded border border-blue-200">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium text-blue-900">
                      {currentCampaign.entityName} Campaign
                    </span>
                    <Badge variant="outline" className="text-xs">
                      Stage {currentCampaign.currentStage + 1}/{currentCampaign.stages.length}
                    </Badge>
                  </div>
                  <p className="text-xs text-gray-600 mb-3">
                    Goal: {currentCampaign.campaignGoal}
                  </p>
                  
                  <div className="space-y-2">
                    {currentCampaign.stages.map((stage, index) => (
                      <div
                        key={stage.id}
                        className={`p-2 rounded border cursor-pointer transition-colors ${
                          index === currentCampaign.currentStage
                            ? 'bg-blue-100 border-blue-400'
                            : index < currentCampaign.currentStage
                            ? 'bg-green-50 border-green-200'
                            : 'bg-gray-50 border-gray-200'
                        }`}
                        onClick={() => setSelectedStage(stage)}
                      >
                        <div className="flex items-center justify-between">
                          <div>
                            <div className="font-medium text-sm">{stage.name}</div>
                            <div className="text-xs text-gray-600">{stage.estimatedDuration}</div>
                          </div>
                          {index < currentCampaign.currentStage && (
                            <div className="text-green-600">
                              <CheckCircle className="w-4 h-4" />
                            </div>
                          )}
                          {index === currentCampaign.currentStage && (
                            <div className="text-blue-600">
                              <Target className="w-4 h-4" />
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {selectedStage && (
                  <div className="bg-white p-3 rounded border border-blue-200">
                    <div className="flex items-center justify-between mb-2">
                      <h5 className="font-medium text-sm">{selectedStage.name}</h5>
                      <Button
                        onClick={() => generateEmailForStage(selectedStage)}
                        disabled={isGenerating}
                        size="sm"
                        className="bg-blue-600 hover:bg-blue-700"
                      >
                        {isGenerating ? (
                          <>
                            <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                            Generating...
                          </>
                        ) : (
                          <>
                            <Sparkles className="w-3 h-3 mr-1" />
                            Generate Email
                          </>
                        )}
                      </Button>
                    </div>
                    <p className="text-xs text-gray-600 mb-2">{selectedStage.description}</p>
                    <p className="text-xs text-gray-700"><strong>Purpose:</strong> {selectedStage.purpose}</p>
                    <p className="text-xs text-gray-700"><strong>Tone:</strong> {selectedStage.tone}</p>
                  </div>
                )}
              </div>
            ) : (
              <div className="text-sm text-blue-800">
                <p className="mb-2">Start a multi-stage email campaign with AI-powered content generation for each stage:</p>
                <div className="grid grid-cols-1 gap-2 text-xs">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 bg-blue-600 rounded-full"></div>
                    <span>Initial Introduction - Professional first contact</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 bg-blue-600 rounded-full"></div>
                    <span>Warm Approach - Build relationship and demonstrate value</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 bg-blue-600 rounded-full"></div>
                    <span>Detailed Proposal - Comprehensive solution presentation</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 bg-blue-600 rounded-full"></div>
                    <span>Follow-up - Address questions and reinforce value</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 bg-blue-600 rounded-full"></div>
                    <span>Final Closing - Secure commitment</span>
                  </div>
                </div>
              </div>
            )}
          </div> */}

          {/* AI Generation Prompt */}
          <div className="bg-blue-50 border border-blue-200 p-4 rounded-lg">
            <div className="flex items-center gap-2 mb-3">
              <Sparkles className="w-4 h-4 text-blue-600" />
              <h4 className="font-semibold text-blue-900">AI Email Assistant</h4>
            </div>
            <p className="text-sm text-blue-800 mb-3">
              Ask the AI to generate a professional email. For example:
            </p>
            <div className="space-y-2 text-xs text-blue-700">
              <div className="bg-white p-2 rounded border">
                "Generate a partnership introduction email with professional tone, highlighting our digital transformation expertise"
              </div>
              <div className="bg-white p-2 rounded border">
                "Create a follow-up email regarding our sports technology solutions, friendly tone"
              </div>
            </div>
          </div>

          {/* Email Form */}
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-1">To</label>
              <Input
                value={emailData.to}
                onChange={(e) => setEmailData(prev => ({ ...prev, to: e.target.value }))}
                placeholder="recipient@example.com"
                className="w-full"
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">Subject</label>
              <Input
                value={emailData.subject}
                onChange={(e) => setEmailData(prev => ({ ...prev, subject: e.target.value }))}
                placeholder="Email subject"
                className="w-full"
              />
              {generatedSubject && (
                <p className="text-xs text-green-600 mt-1">✓ AI-generated subject</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">Message</label>
              <Textarea
                value={emailData.body}
                onChange={(e) => setEmailData(prev => ({ ...prev, body: e.target.value }))}
                placeholder="Write your email message here..."
                className="w-full min-h-[200px]"
              />
              {generatedBody && (
                <p className="text-xs text-green-600 mt-1">✓ AI-generated content</p>
              )}
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={onClose}
            disabled={isSending || isGenerating}
          >
            <X className="w-4 h-4 mr-2" />
            Cancel
          </Button>
          
          <div className="flex items-center gap-2">
            {isGenerating && (
              <div className="flex items-center text-sm text-blue-600">
                <Loader2 className="w-4 h-4 mr-1 animate-spin" />
                Generating...
              </div>
            )}
            
            <Button
              onClick={handleSendEmail}
              disabled={isSending || isGenerating || !emailData.to || !emailData.subject || !emailData.body}
              className="bg-blue-600 hover:bg-blue-700"
            >
              {isSending ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Sending...
                </>
              ) : (
                <>
                  <Send className="w-4 h-4 mr-2" />
                  Send Email
                </>
              )}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default EmailComposeModal;