'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Brain, Settings, Bot, MessageCircle, Mail, Clock, Target, 
  Zap, AlertTriangle, CheckCircle, Play, Pause, RotateCcw,
  Filter, Code, TestTube, Save, Trash2, Plus, Edit
} from 'lucide-react';

interface AIAgentConfig {
  enabled: boolean;
  autoReply: boolean;
  responseStyle: 'professional' | 'friendly' | 'formal' | 'casual';
  responseDelay: number; // minutes
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
  timeframe: number; // hours
  action: 'notify_manager' | 'escalate_to_team' | 'create_ticket';
  enabled: boolean;
}

interface AIEmailAgentProps {
  entityId: string;
  config: AIAgentConfig | null;
  enabled: boolean;
  onConfigChange: (config: AIAgentConfig) => void;
}

export function AIEmailAgent({ entityId, config, enabled, onConfigChange }: AIEmailAgentProps) {
  const [agentConfig, setAgentConfig] = useState<AIAgentConfig>(config || {
    enabled: false,
    autoReply: false,
    responseStyle: 'professional',
    responseDelay: 15,
    classificationRules: [],
    customPrompts: [],
    workingHours: {
      start: '09:00',
      end: '17:00',
      timezone: 'UTC',
      weekends: false
    },
    escalationRules: []
  });

  const [activeTab, setActiveTab] = useState('overview');
  const [isTesting, setIsTesting] = useState(false);
  const [testResults, setTestResults] = useState<any>(null);
  const [editingRule, setEditingRule] = useState<ClassificationRule | null>(null);
  const [editingPrompt, setEditingPrompt] = useState<CustomPrompt | null>(null);

  useEffect(() => {
    setAgentConfig(prev => ({ ...prev, enabled }));
  }, [enabled]);

  const saveConfig = async () => {
    try {
      const response = await fetch('/api/ai-agent/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          entityId,
          config: agentConfig
        })
      });

      if (response.ok) {
        onConfigChange(agentConfig);
      }
    } catch (error) {
      console.error('Error saving AI agent config:', error);
    }
  };

  const testAgent = async () => {
    setIsTesting(true);
    try {
      const response = await fetch('/api/ai-agent/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          entityId,
          config: agentConfig,
          testEmail: {
            subject: 'Test Inquiry About Partnership',
            body: 'Hi, I\'m interested in discussing a potential partnership opportunity.',
            sender: 'test@example.com'
          }
        })
      });

      const results = await response.json();
      setTestResults(results);
    } catch (error) {
      console.error('Error testing AI agent:', error);
    } finally {
      setIsTesting(false);
    }
  };

  const addClassificationRule = () => {
    const newRule: ClassificationRule = {
      id: Date.now().toString(),
      type: 'general',
      keywords: [],
      action: 'auto_reply',
      priority: 1,
      enabled: true
    };
    setAgentConfig(prev => ({
      ...prev,
      classificationRules: [...prev.classificationRules, newRule]
    }));
  };

  const updateClassificationRule = (ruleId: string, updates: Partial<ClassificationRule>) => {
    setAgentConfig(prev => ({
      ...prev,
      classificationRules: prev.classificationRules.map(rule =>
        rule.id === ruleId ? { ...rule, ...updates } : rule
      )
    }));
  };

  const deleteClassificationRule = (ruleId: string) => {
    setAgentConfig(prev => ({
      ...prev,
      classificationRules: prev.classificationRules.filter(rule => rule.id !== ruleId)
    }));
  };

  const addCustomPrompt = () => {
    const newPrompt: CustomPrompt = {
      id: Date.now().toString(),
      name: 'New Response Template',
      trigger: 'general_inquiry',
      template: 'Thank you for your inquiry. I will get back to you soon.',
      variables: ['name', 'inquiry'],
      enabled: true
    };
    setAgentConfig(prev => ({
      ...prev,
      customPrompts: [...prev.customPrompts, newPrompt]
    }));
  };

  const updateCustomPrompt = (promptId: string, updates: Partial<CustomPrompt>) => {
    setAgentConfig(prev => ({
      ...prev,
      customPrompts: prev.customPrompts.map(prompt =>
        prompt.id === promptId ? { ...prompt, ...updates } : prompt
      )
    }));
  };

  const deleteCustomPrompt = (promptId: string) => {
    setAgentConfig(prev => ({
      ...prev,
      customPrompts: prev.customPrompts.filter(prompt => prompt.id !== promptId)
    }));
  };

  return (
    <div className="space-y-6">
      {/* Agent Status Card */}
      <Card className="border-2">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Brain className="h-5 w-5" />
              AI Email Agent Status
            </CardTitle>
            <div className="flex items-center gap-2">
              <Badge variant={agentConfig.enabled ? "default" : "secondary"}>
                {agentConfig.enabled ? 'ACTIVE' : 'INACTIVE'}
              </Badge>
              <Button
                variant="outline"
                size="sm"
                onClick={testAgent}
                disabled={isTesting || !agentConfig.enabled}
              >
                <TestTube className="h-4 w-4 mr-2" />
                {isTesting ? 'Testing...' : 'Test Agent'}
              </Button>
              <Button onClick={saveConfig}>
                <Save className="h-4 w-4 mr-2" />
                Save Config
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="flex items-center justify-between p-3 border rounded-lg">
              <div className="flex items-center gap-2">
                <Bot className="h-4 w-4 text-blue-600" />
                <span className="text-sm font-medium">Auto-Reply</span>
              </div>
              <Switch
                checked={agentConfig.autoReply}
                onCheckedChange={(checked) => 
                  setAgentConfig(prev => ({ ...prev, autoReply: checked }))
                }
              />
            </div>
            
            <div className="p-3 border rounded-lg">
              <div className="flex items-center gap-2 mb-2">
                <Clock className="h-4 w-4 text-green-600" />
                <span className="text-sm font-medium">Response Delay</span>
              </div>
              <Input
                type="number"
                value={agentConfig.responseDelay}
                onChange={(e) => 
                  setAgentConfig(prev => ({ ...prev, responseDelay: parseInt(e.target.value) || 0 }))
                }
                className="w-full"
                placeholder="Minutes"
              />
            </div>
            
            <div className="p-3 border rounded-lg">
              <div className="flex items-center gap-2 mb-2">
                <MessageCircle className="h-4 w-4 text-purple-600" />
                <span className="text-sm font-medium">Response Style</span>
              </div>
              <Select
                value={agentConfig.responseStyle}
                onValueChange={(value: any) => 
                  setAgentConfig(prev => ({ ...prev, responseStyle: value }))
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="professional">Professional</SelectItem>
                  <SelectItem value="friendly">Friendly</SelectItem>
                  <SelectItem value="formal">Formal</SelectItem>
                  <SelectItem value="casual">Casual</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Configuration Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="classification">Classification</TabsTrigger>
          <TabsTrigger value="templates">Templates</TabsTrigger>
          <TabsTrigger value="escalation">Escalation</TabsTrigger>
          <TabsTrigger value="analytics">Analytics</TabsTrigger>
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value="overview" className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Working Hours */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Clock className="h-5 w-5" />
                  Working Hours
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="start-time">Start Time</Label>
                    <Input
                      id="start-time"
                      type="time"
                      value={agentConfig.workingHours.start}
                      onChange={(e) => 
                        setAgentConfig(prev => ({
                          ...prev,
                          workingHours: { ...prev.workingHours, start: e.target.value }
                        }))
                      }
                    />
                  </div>
                  <div>
                    <Label htmlFor="end-time">End Time</Label>
                    <Input
                      id="end-time"
                      type="time"
                      value={agentConfig.workingHours.end}
                      onChange={(e) => 
                        setAgentConfig(prev => ({
                          ...prev,
                          workingHours: { ...prev.workingHours, end: e.target.value }
                        }))
                      }
                    />
                  </div>
                </div>
                
                <div>
                  <Label htmlFor="timezone">Timezone</Label>
                  <Input
                    id="timezone"
                    value={agentConfig.workingHours.timezone}
                    onChange={(e) => 
                      setAgentConfig(prev => ({
                        ...prev,
                        workingHours: { ...prev.workingHours, timezone: e.target.value }
                      }))
                    }
                  />
                </div>
                
                <div className="flex items-center space-x-2">
                  <Switch
                    id="weekends"
                    checked={agentConfig.workingHours.weekends}
                    onCheckedChange={(checked) => 
                      setAgentConfig(prev => ({
                        ...prev,
                        workingHours: { ...prev.workingHours, weekends: checked }
                      }))
                    }
                  />
                  <Label htmlFor="weekends">Work on weekends</Label>
                </div>
              </CardContent>
            </Card>

            {/* Test Results */}
            {testResults && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <TestTube className="h-5 w-5" />
                    Test Results
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    <div className="flex items-center gap-2">
                      <CheckCircle className="h-4 w-4 text-green-600" />
                      <span className="text-sm">Classification: {testResults.classification}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Mail className="h-4 w-4 text-blue-600" />
                      <span className="text-sm">Action: {testResults.action}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Zap className="h-4 w-4 text-purple-600" />
                      <span className="text-sm">Response Time: {testResults.responseTime}ms</span>
                    </div>
                    {testResults.generatedResponse && (
                      <div className="p-3 bg-muted rounded-lg">
                        <p className="text-sm font-medium mb-1">Generated Response:</p>
                        <p className="text-sm text-muted-foreground">{testResults.generatedResponse}</p>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        </TabsContent>

        {/* Classification Rules Tab */}
        <TabsContent value="classification" className="space-y-6">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2">
                  <Filter className="h-5 w-5" />
                  Email Classification Rules
                </CardTitle>
                <Button onClick={addClassificationRule}>
                  <Plus className="h-4 w-4 mr-2" />
                  Add Rule
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {agentConfig.classificationRules.map((rule) => (
                  <div key={rule.id} className="p-4 border rounded-lg">
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <Switch
                          checked={rule.enabled}
                          onCheckedChange={(checked) => 
                            updateClassificationRule(rule.id, { enabled: checked })
                          }
                        />
                        <Input
                          value={rule.type}
                          onChange={(e) => 
                            updateClassificationRule(rule.id, { type: e.target.value })
                          }
                          className="w-48"
                          placeholder="Rule type"
                        />
                      </div>
                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setEditingRule(rule)}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => deleteClassificationRule(rule.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div>
                        <Label>Keywords (comma-separated)</Label>
                        <Input
                          value={rule.keywords.join(', ')}
                          onChange={(e) => 
                            updateClassificationRule(rule.id, { 
                              keywords: e.target.value.split(',').map(k => k.trim()).filter(k => k)
                            })
                          }
                          placeholder="urgent, important, asap"
                        />
                      </div>
                      
                      <div>
                        <Label>Action</Label>
                        <Select
                          value={rule.action}
                          onValueChange={(value: any) => 
                            updateClassificationRule(rule.id, { action: value })
                          }
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="auto_reply">Auto Reply</SelectItem>
                            <SelectItem value="flag_urgent">Flag as Urgent</SelectItem>
                            <SelectItem value="forward">Forward</SelectItem>
                            <SelectItem value="archive">Archive</SelectItem>
                            <SelectItem value="flag_for_review">Flag for Review</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      
                      <div>
                        <Label>Priority</Label>
                        <Input
                          type="number"
                          value={rule.priority}
                          onChange={(e) => 
                            updateClassificationRule(rule.id, { priority: parseInt(e.target.value) || 1 })
                          }
                          min="1"
                          max="10"
                        />
                      </div>
                    </div>
                    
                    {rule.action === 'auto_reply' && (
                      <div className="mt-3">
                        <Label>Response Template</Label>
                        <Textarea
                          value={rule.responseTemplate || ''}
                          onChange={(e) => 
                            updateClassificationRule(rule.id, { responseTemplate: e.target.value })
                          }
                          placeholder="Thank you for your email. I'll get back to you shortly."
                        />
                      </div>
                    )}
                  </div>
                ))}
                
                {agentConfig.classificationRules.length === 0 && (
                  <div className="text-center py-8 text-muted-foreground">
                    <Filter className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p>No classification rules configured</p>
                    <p className="text-sm">Add rules to automatically categorize incoming emails</p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Templates Tab */}
        <TabsContent value="templates" className="space-y-6">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2">
                  <Code className="h-5 w-5" />
                  Custom Response Templates
                </CardTitle>
                <Button onClick={addCustomPrompt}>
                  <Plus className="h-4 w-4 mr-2" />
                  Add Template
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {agentConfig.customPrompts.map((prompt) => (
                  <div key={prompt.id} className="p-4 border rounded-lg">
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <Switch
                          checked={prompt.enabled}
                          onCheckedChange={(checked) => 
                            updateCustomPrompt(prompt.id, { enabled: checked })
                          }
                        />
                        <Input
                          value={prompt.name}
                          onChange={(e) => 
                            updateCustomPrompt(prompt.id, { name: e.target.value })
                          }
                          className="w-64"
                          placeholder="Template name"
                        />
                      </div>
                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setEditingPrompt(prompt)}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => deleteCustomPrompt(prompt.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                    
                    <div className="space-y-3">
                      <div>
                        <Label>Trigger</Label>
                        <Input
                          value={prompt.trigger}
                          onChange={(e) => 
                            updateCustomPrompt(prompt.id, { trigger: e.target.value })
                          }
                          placeholder="Trigger condition"
                        />
                      </div>
                      
                      <div>
                        <Label>Template</Label>
                        <Textarea
                          value={prompt.template}
                          onChange={(e) => 
                            updateCustomPrompt(prompt.id, { template: e.target.value })
                          }
                          placeholder="Email response template with variables like {name}, {inquiry}"
                          rows={4}
                        />
                      </div>
                      
                      <div>
                        <Label>Variables (comma-separated)</Label>
                        <Input
                          value={prompt.variables.join(', ')}
                          onChange={(e) => 
                            updateCustomPrompt(prompt.id, { 
                              variables: e.target.value.split(',').map(v => v.trim()).filter(v => v)
                            })
                          }
                          placeholder="name, inquiry, company"
                        />
                      </div>
                    </div>
                  </div>
                ))}
                
                {agentConfig.customPrompts.length === 0 && (
                  <div className="text-center py-8 text-muted-foreground">
                    <Code className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p>No custom templates configured</p>
                    <p className="text-sm">Add templates for personalized AI responses</p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Analytics Tab */}
        <TabsContent value="analytics" className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Emails Processed</CardTitle>
                <Mail className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">247</div>
                <p className="text-xs text-muted-foreground">
                  +12% from last month
                </p>
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Auto-Replies Sent</CardTitle>
                <Bot className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">89</div>
                <p className="text-xs text-muted-foreground">
                  36% response rate
                </p>
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Avg Response Time</CardTitle>
                <Clock className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">4.2m</div>
                <p className="text-xs text-muted-foreground">
                  -2.1m from target
                </p>
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Accuracy Rate</CardTitle>
                <Target className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">94%</div>
                <p className="text-xs text-muted-foreground">
                  Classification accuracy
                </p>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}