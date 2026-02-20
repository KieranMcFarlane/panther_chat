'use client';

import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2, Mail, Edit, Save, Send, RefreshCw, AlertTriangle, CheckCircle2 } from 'lucide-react';

interface MessageComposerProps {
  approach: string;
  entity: {
    id: string;
    name: string;
    type: string;
  };
  contact?: {
    name: string;
    email: string;
    title: string;
  };
  onEdit?: () => void;
  onSaveDraft?: (message: DraftMessage) => void;
  onApprove?: (message: DraftMessage) => void;
  onRegenerate?: () => void;
}

interface DraftMessage {
  subject: string;
  body: string;
  approach: string;
  entityId: string;
  contactId?: string;
  createdAt: Date;
}

interface AntiPatternWarning {
  type: 'generic' | 'aggressive' | 'length' | 'format' | 'tone';
  message: string;
  suggestion: string;
  severity: 'warning' | 'error';
}

export function MessageComposer({
  approach,
  entity,
  contact,
  onEdit,
  onSaveDraft,
  onApprove,
  onRegenerate
}: MessageComposerProps) {
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [warnings, setWarnings] = useState<AntiPatternWarning[]>([]);
  const [showPreview, setShowPreview] = useState(true);

  // Generate message on mount
  useEffect(() => {
    generateMessage();
  }, [approach, entity, contact]);

  // Validate for anti-patterns
  useEffect(() => {
    validateMessage();
  }, [subject, body]);

  const generateMessage = async () => {
    setIsGenerating(true);
    try {
      // Simulate AI generation (in real app, call API)
      await new Promise(resolve => setTimeout(resolve, 1500));

      const generatedSubject = `Exploring ${entity.name}'s Digital Transformation Journey`;
      const generatedBody = `Hi ${contact?.name || 'there'},

I came across ${entity.name}'s recent initiatives and was impressed by your organization's commitment to innovation.

I'm reaching out because I believe we could support your digital transformation goals with our AI-powered analytics platform. Our solution has helped similar organizations:

• Reduce data processing time by 60%
• Improve decision-making with real-time insights
• Scale analytics capabilities without increasing headcount

Would you be open to a brief 15-minute call to explore how this might apply to ${entity.name}'s specific context?

Best regards,
[Your Name]`;

      setSubject(generatedSubject);
      setBody(generatedBody);
    } catch (error) {
      console.error('Failed to generate message:', error);
    } finally {
      setIsGenerating(false);
    }
  };

  const validateMessage = () => {
    const newWarnings: AntiPatternWarning[] = [];

    // Check for generic language
    const genericPhrases = ['innovative solutions', 'cutting-edge technology', 'state-of-the-art', 'world-class'];
    const hasGeneric = genericPhrases.some(phrase =>
      body.toLowerCase().includes(phrase.toLowerCase())
    );
    if (hasGeneric) {
      newWarnings.push({
        type: 'generic',
        message: 'Generic buzzwords detected',
        suggestion: 'Replace with specific, tangible benefits relevant to the recipient',
        severity: 'warning'
      });
    }

    // Check for aggressive language
    const aggressivePhrases = ['must have', 'need to', 'should consider', 'don\'t miss'];
    const hasAggressive = aggressivePhrases.some(phrase =>
      body.toLowerCase().includes(phrase.toLowerCase())
    );
    if (hasAggressive) {
      newWarnings.push({
        type: 'aggressive',
        message: 'Aggressive language detected',
        suggestion: 'Use softer, collaborative language instead of directives',
        severity: 'warning'
      });
    }

    // Check length
    const wordCount = body.split(/\s+/).length;
    if (wordCount > 200) {
      newWarnings.push({
        type: 'length',
        message: `Message too long (${wordCount} words)`,
        suggestion: 'Aim for 100-150 words for better engagement',
        severity: 'warning'
      });
    }

    // Check for personalization
    const hasPersonalization = body.includes(entity.name) || (contact && body.includes(contact.name));
    if (!hasPersonalization) {
      newWarnings.push({
        type: 'generic',
        message: 'Lacks personalization',
        suggestion: 'Include specific details about the recipient or their organization',
        severity: 'error'
      });
    }

    // Check for clear call-to-action
    const hasCTA = body.toLowerCase().includes('call') || body.toLowerCase().includes('meeting') || body.toLowerCase().includes('discuss');
    if (!hasCTA) {
      newWarnings.push({
        type: 'format',
        message: 'No clear call-to-action',
        suggestion: 'Add a specific next step (e.g., "Would you be open to a 15-minute call?")',
        severity: 'error'
      });
    }

    setWarnings(newWarnings);
  };

  const handleSaveDraft = () => {
    setIsSaving(true);
    const draft: DraftMessage = {
      subject,
      body,
      approach,
      entityId: entity.id,
      contactId: contact?.email,
      createdAt: new Date()
    };

    setTimeout(() => {
      setIsSaving(false);
      onSaveDraft?.(draft);
    }, 500);
  };

  const handleApprove = () => {
    const message: DraftMessage = {
      subject,
      body,
      approach,
      entityId: entity.id,
      contactId: contact?.email,
      createdAt: new Date()
    };
    onApprove?.(message);
  };

  return (
    <div className="space-y-6">
      {/* Anti-Pattern Warnings */}
      {warnings.length > 0 && (
        <Alert variant={warnings.some(w => w.severity === 'error') ? 'destructive' : 'default'}>
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            <div className="space-y-2">
              <p className="font-medium">Message Quality Issues Detected:</p>
              <ul className="space-y-1 text-sm">
                {warnings.map((warning, idx) => (
                  <li key={idx} className="flex items-start gap-2">
                    <span className="mt-0.5">
                      {warning.severity === 'error' ? '❌' : '⚠️'}
                    </span>
                    <span>
                      <strong>{warning.message}</strong>: {warning.suggestion}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          </AlertDescription>
        </Alert>
      )}

      {/* Message Editor */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Mail className="h-5 w-5" />
            Compose Message
            {warnings.length === 0 && (
              <Badge variant="outline" className="ml-auto">
                <CheckCircle2 className="h-3 w-3 mr-1" />
                Ready to Send
              </Badge>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Subject Line */}
          <div className="space-y-2">
            <label className="text-sm font-medium">Subject</label>
            <Input
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="Enter subject line..."
              className="font-medium"
            />
          </div>

          {/* Body Editor */}
          <div className="space-y-2">
            <label className="text-sm font-medium">Message Body</label>
            <Textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder="Compose your message..."
              rows={8}
              className="font-mono text-sm"
            />
            <p className="text-xs text-muted-foreground">
              {body.split(/\s+/).filter(w => w.length > 0).length} words
            </p>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-wrap gap-2">
            <Button
              onClick={handleApprove}
              disabled={warnings.some(w => w.severity === 'error') || isGenerating}
              variant="default"
            >
              <Send className="h-4 w-4 mr-2" />
              Approve & Queue
            </Button>
            <Button
              onClick={handleSaveDraft}
              disabled={isSaving}
              variant="outline"
            >
              <Save className="h-4 w-4 mr-2" />
              {isSaving ? 'Saving...' : 'Save Draft'}
            </Button>
            <Button
              onClick={() => onEdit?.()}
              variant="outline"
            >
              <Edit className="h-4 w-4 mr-2" />
              Edit Manually
            </Button>
            <Button
              onClick={() => {
                onRegenerate?.();
                generateMessage();
              }}
              disabled={isGenerating}
              variant="ghost"
            >
              <RefreshCw className={`h-4 w-4 mr-2 ${isGenerating ? 'animate-spin' : ''}`} />
              {isGenerating ? 'Generating...' : 'Regenerate with AI'}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Email Preview */}
      {showPreview && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">Email Preview</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="border rounded-lg p-4 bg-background space-y-3">
              {/* Email Header */}
              <div className="space-y-1 text-sm">
                <div className="flex">
                  <span className="font-medium w-16 text-muted-foreground">From:</span>
                  <span>your-email@company.com</span>
                </div>
                <div className="flex">
                  <span className="font-medium w-16 text-muted-foreground">To:</span>
                  <span>{contact?.email || 'recipient@example.com'}</span>
                </div>
                <div className="flex">
                  <span className="font-medium w-16 text-muted-foreground">Subject:</span>
                  <span className="font-medium">{subject || '(No subject)'}</span>
                </div>
              </div>

              {/* Email Body Preview */}
              <div className="border-t pt-3">
                <div className="whitespace-pre-wrap text-sm font-mono">
                  {body || '(No content)'}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
