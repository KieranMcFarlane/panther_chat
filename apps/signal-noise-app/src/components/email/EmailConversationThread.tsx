'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  MessageCircle, Reply, Forward, Star, Trash2, ExternalLink, 
  Clock, User, Bot, Send, Paperclip, Search, Filter,
  ChevronDown, ChevronUp, Mail, CheckCircle, AlertCircle
} from 'lucide-react';

interface EmailRecord {
  id: string;
  subject: string;
  body: string;
  sentDate: string;
  sender: {
    name: string;
    email: string;
  };
  recipient: {
    name: string;
    email: string;
  };
  direction: 'inbound' | 'outbound';
  status: 'sent' | 'delivered' | 'opened' | 'replied' | 'bounced';
  aiGenerated: boolean;
  classification?: string;
  sentiment?: string;
  priority?: 'low' | 'medium' | 'high';
  threadId?: string;
  replyToId?: string;
  attachments?: Attachment[];
  metadata?: {
    openCount?: number;
    replyCount?: number;
    forwardedCount?: number;
  };
}

interface Attachment {
  id: string;
  name: string;
  size: number;
  type: string;
  url: string;
}

interface EmailConversationThreadProps {
  emails: EmailRecord[];
  onReply: (email: EmailRecord) => void;
  onForward?: (email: EmailRecord) => void;
}

export function EmailConversationThread({ 
  emails, 
  onReply, 
  onForward 
}: EmailConversationThreadProps) {
  const [selectedEmail, setSelectedEmail] = useState<EmailRecord | null>(null);
  const [replyText, setReplyText] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [classificationFilter, setClassificationFilter] = useState('all');
  const [expandedThreads, setExpandedThreads] = useState<Set<string>>(new Set());
  const [showReplyBox, setShowReplyBox] = useState(false);

  // Group emails by thread
  const emailThreads = emails.reduce((acc, email) => {
    const threadId = email.threadId || email.id;
    if (!acc[threadId]) {
      acc[threadId] = [];
    }
    acc[threadId].push(email);
    return acc;
  }, {} as Record<string, EmailRecord[]>);

  // Sort threads by most recent email
  const sortedThreads = Object.entries(emailThreads)
    .sort(([, a], [, b]) => {
      const latestA = Math.max(...a.map(e => new Date(e.sentDate).getTime()));
      const latestB = Math.max(...b.map(e => new Date(e.sentDate).getTime()));
      return latestB - latestA;
    });

  // Filter emails based on search and classification
  const filteredEmails = emails.filter(email => {
    const matchesSearch = searchQuery === '' || 
      email.subject.toLowerCase().includes(searchQuery.toLowerCase()) ||
      email.body.toLowerCase().includes(searchQuery.toLowerCase()) ||
      email.sender.name.toLowerCase().includes(searchQuery.toLowerCase());
    
    const matchesClassification = classificationFilter === 'all' ||
      email.classification === classificationFilter;
    
    return matchesSearch && matchesClassification;
  });

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'sent':
        return <CheckCircle className="h-4 w-4 text-green-600" />;
      case 'delivered':
        return <CheckCircle className="h-4 w-4 text-blue-600" />;
      case 'opened':
        return <Mail className="h-4 w-4 text-purple-600" />;
      case 'replied':
        return <Reply className="h-4 w-4 text-green-600" />;
      case 'bounced':
        return <AlertCircle className="h-4 w-4 text-red-600" />;
      default:
        return <Clock className="h-4 w-4 text-gray-600" />;
    }
  };

  const getPriorityColor = (priority?: string) => {
    switch (priority) {
      case 'high':
        return 'bg-red-100 text-red-800 border-red-200';
      case 'medium':
        return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'low':
        return 'bg-green-100 text-green-800 border-green-200';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const getClassificationColor = (classification?: string) => {
    switch (classification) {
      case 'urgent':
        return 'bg-red-500 text-white';
      case 'important':
        return 'bg-orange-500 text-white';
      case 'inquiry':
        return 'bg-blue-500 text-white';
      case 'support':
        return 'bg-purple-500 text-white';
      case 'general':
        return 'bg-gray-500 text-white';
      default:
        return 'bg-gray-400 text-white';
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffTime = now.getTime() - date.getTime();
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays === 0) {
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } else if (diffDays === 1) {
      return 'Yesterday';
    } else if (diffDays < 7) {
      return date.toLocaleDateString([], { weekday: 'short' });
    } else {
      return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
    }
  };

  const toggleThreadExpansion = (threadId: string) => {
    const newExpanded = new Set(expandedThreads);
    if (newExpanded.has(threadId)) {
      newExpanded.delete(threadId);
    } else {
      newExpanded.add(threadId);
    }
    setExpandedThreads(newExpanded);
  };

  const handleReply = (email: EmailRecord) => {
    setSelectedEmail(email);
    setShowReplyBox(true);
    onReply(email);
  };

  const sendReply = async () => {
    if (!selectedEmail || !replyText.trim()) return;

    try {
      const response = await fetch('/api/email/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          to: selectedEmail.direction === 'inbound' ? selectedEmail.sender.email : selectedEmail.recipient.email,
          subject: `Re: ${selectedEmail.subject}`,
          body: replyText,
          replyToId: selectedEmail.id,
          threadId: selectedEmail.threadId || selectedEmail.id
        })
      });

      if (response.ok) {
        setReplyText('');
        setShowReplyBox(false);
        setSelectedEmail(null);
        // Refresh emails or update state
      }
    } catch (error) {
      console.error('Error sending reply:', error);
    }
  };

  return (
    <div className="space-y-6">
      {/* Search and Filter Bar */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <MessageCircle className="h-5 w-5" />
              Email Conversations ({emails.length})
            </CardTitle>
            <div className="flex items-center gap-2">
              <div className="relative">
                <Search className="h-4 w-4 absolute left-3 top-3 text-gray-400" />
                <Input
                  placeholder="Search emails..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10 w-64"
                />
              </div>
              
              <select
                value={classificationFilter}
                onChange={(e) => setClassificationFilter(e.target.value)}
                className="px-3 py-2 border rounded-md text-sm"
              >
                <option value="all">All Types</option>
                <option value="urgent">Urgent</option>
                <option value="important">Important</option>
                <option value="inquiry">Inquiry</option>
                <option value="support">Support</option>
                <option value="general">General</option>
              </select>
            </div>
          </div>
        </CardHeader>
      </Card>

      {/* Email Threads */}
      <ScrollArea className="h-[600px]">
        <div className="space-y-4">
          {sortedThreads.map(([threadId, threadEmails]) => {
            const latestEmail = threadEmails.sort((a, b) => 
              new Date(b.sentDate).getTime() - new Date(a.sentDate).getTime()
            )[0];

            const isExpanded = expandedThreads.has(threadId);

            return (
              <Card key={threadId} className="border-l-4 border-l-blue-500">
                <CardHeader 
                  className="cursor-pointer hover:bg-gray-50"
                  onClick={() => setSelectedEmail(latestEmail)}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-2">
                        {latestEmail.aiGenerated && (
                          <Badge variant="secondary" className="text-xs">
                            <Bot className="h-3 w-3 mr-1" />
                            AI Generated
                          </Badge>
                        )}
                        
                        {latestEmail.classification && (
                          <Badge className={`text-xs ${getClassificationColor(latestEmail.classification)}`}>
                            {latestEmail.classification}
                          </Badge>
                        )}
                        
                        {latestEmail.priority && (
                          <Badge variant="outline" className={`text-xs ${getPriorityColor(latestEmail.priority)}`}>
                            {latestEmail.priority}
                          </Badge>
                        )}
                        
                        <Badge variant="outline" className="text-xs">
                          {latestEmail.direction === 'inbound' ? 'Received' : 'Sent'}
                        </Badge>
                      </div>
                      
                      <div className="flex items-center justify-between mb-2">
                        <h3 className="font-medium truncate pr-4">
                          {latestEmail.subject}
                        </h3>
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          {getStatusIcon(latestEmail.status)}
                          {formatDate(latestEmail.sentDate)}
                        </div>
                      </div>
                      
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Avatar className="h-6 w-6">
                          <AvatarFallback className="text-xs">
                            {latestEmail.sender.name.charAt(0).toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                        <span>{latestEmail.sender.name}</span>
                        <span>→</span>
                        <span>{latestEmail.recipient.name}</span>
                      </div>
                      
                      <p className="text-sm text-muted-foreground mt-2 line-clamp-2">
                        {latestEmail.body}
                      </p>
                    </div>
                  </div>
                  
                  {threadEmails.length > 1 && (
                    <div className="flex items-center gap-2 mt-3">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleThreadExpansion(threadId);
                        }}
                        className="text-xs"
                      >
                        {isExpanded ? (
                          <ChevronUp className="h-3 w-3 mr-1" />
                        ) : (
                          <ChevronDown className="h-3 w-3 mr-1" />
                        )}
                        {threadEmails.length - 1} more messages
                      </Button>
                    </div>
                  )}
                </CardHeader>

                {/* Expanded Thread */}
                {isExpanded && threadEmails.length > 1 && (
                  <CardContent className="border-t">
                    <div className="space-y-4">
                      {threadEmails
                        .sort((a, b) => new Date(a.sentDate).getTime() - new Date(b.sentDate).getTime())
                        .map((email) => (
                          <div 
                            key={email.id}
                            className={`p-3 rounded-lg border ${
                              email.direction === 'outbound' 
                                ? 'ml-8 bg-blue-50 border-blue-200' 
                                : 'mr-8 bg-gray-50 border-gray-200'
                            }`}
                          >
                            <div className="flex items-center justify-between mb-2">
                              <div className="flex items-center gap-2">
                                <Avatar className="h-5 w-5">
                                  <AvatarFallback className="text-xs">
                                    {email.sender.name.charAt(0).toUpperCase()}
                                  </AvatarFallback>
                                </Avatar>
                                <span className="text-sm font-medium">{email.sender.name}</span>
                                {email.aiGenerated && (
                                  <Bot className="h-3 w-3 text-blue-600" />
                                )}
                              </div>
                              <span className="text-xs text-muted-foreground">
                                {formatDate(email.sentDate)}
                              </span>
                            </div>
                            <p className="text-sm">{email.body}</p>
                          </div>
                        ))}
                    </div>
                  </CardContent>
                )}
              </Card>
            );
          })}
        </div>
      </ScrollArea>

      {/* Selected Email Detail */}
      {selectedEmail && (
        <Card className="border-2">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-lg mb-2">{selectedEmail.subject}</CardTitle>
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <span>From: {selectedEmail.sender.name} &lt;{selectedEmail.sender.email}&gt;</span>
                  <span>•</span>
                  <span>To: {selectedEmail.recipient.name} &lt;{selectedEmail.recipient.email}&gt;</span>
                  <span>•</span>
                  <span>{new Date(selectedEmail.sentDate).toLocaleString()}</span>
                </div>
              </div>
              
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleReply(selectedEmail)}
                >
                  <Reply className="h-4 w-4 mr-2" />
                  Reply
                </Button>
                
                {onForward && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => onForward(selectedEmail)}
                  >
                    <Forward className="h-4 w-4 mr-2" />
                    Forward
                  </Button>
                )}
              </div>
            </div>
          </CardHeader>
          
          <CardContent>
            <div className="prose max-w-none">
              <p className="whitespace-pre-wrap">{selectedEmail.body}</p>
            </div>
            
            {selectedEmail.attachments && selectedEmail.attachments.length > 0 && (
              <div className="mt-4 p-3 bg-gray-50 rounded-lg">
                <h4 className="font-medium mb-2 flex items-center gap-2">
                  <Paperclip className="h-4 w-4" />
                  Attachments
                </h4>
                <div className="space-y-2">
                  {selectedEmail.attachments.map((attachment) => (
                    <div key={attachment.id} className="flex items-center gap-2 text-sm">
                      <ExternalLink className="h-3 w-3" />
                      <a href={attachment.url} className="text-blue-600 hover:underline">
                        {attachment.name}
                      </a>
                      <span className="text-muted-foreground">
                        ({(attachment.size / 1024).toFixed(1)} KB)
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Reply Box */}
      {showReplyBox && selectedEmail && (
        <Card className="border-2 border-blue-200">
          <CardHeader>
            <CardTitle className="text-lg">Reply to {selectedEmail.sender.name}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-1">Subject</label>
              <Input
                value={`Re: ${selectedEmail.subject}`}
                disabled
                className="bg-gray-50"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium mb-1">Message</label>
              <Textarea
                value={replyText}
                onChange={(e) => setReplyText(e.target.value)}
                placeholder="Type your reply here..."
                rows={6}
              />
            </div>
            
            <div className="flex gap-2">
              <Button onClick={sendReply} disabled={!replyText.trim()}>
                <Send className="h-4 w-4 mr-2" />
                Send Reply
              </Button>
              <Button
                variant="outline"
                onClick={() => {
                  setShowReplyBox(false);
                  setReplyText('');
                  setSelectedEmail(null);
                }}
              >
                Cancel
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}