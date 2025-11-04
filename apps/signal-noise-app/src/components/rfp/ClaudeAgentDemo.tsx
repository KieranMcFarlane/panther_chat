/**
 * 🤖 Claude Agent & Batch Processing Demo
 * 
 * Frontend component to demonstrate Claude Agent integration with CopilotKit
 * and batch processing capabilities for enriched data analysis
 */

'use client';

import React, { useState, useEffect } from 'react';
import { Brain, Zap, Play, Pause, RefreshCw, Download, Clock, CheckCircle, AlertTriangle, Activity, BarChart3, Target, Database } from 'lucide-react';

interface BatchJob {
  id: string;
  type: 'enrichment' | 'analysis' | 'reasoning' | 'classification' | 'market_intelligence';
  status: 'queued' | 'processing' | 'completed' | 'failed';
  itemCount: number;
  priority: 'high' | 'medium' | 'low';
  createdAt: string;
  processedAt?: string;
  results?: any;
  estimatedDuration?: number;
}

interface WebhookTest {
  type: 'rfp_alert' | 'entity_alert' | 'entity_enrichment' | 'market_intelligence';
  status: 'idle' | 'sending' | 'success' | 'error';
  result?: any;
  error?: string;
}

export const ClaudeAgentDemo: React.FC = () => {
  const [batchJobs, setBatchJobs] = useState<BatchJob[]>([]);
  const [selectedTab, setSelectedTab] = useState<'claude-agent' | 'batch-processing' | 'webhooks'>('claude-agent');
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [claudeAgentStatus, setClaudeAgentStatus] = useState<any>(null);

  // Webhook testing state
  const [webhookTests, setWebhookTests] = useState<WebhookTest[]>([
    { type: 'rfp_alert', status: 'idle' },
    { type: 'entity_alert', status: 'idle' },
    { type: 'entity_enrichment', status: 'idle' },
    { type: 'market_intelligence', status: 'idle' }
  ]);

  // Load initial data
  useEffect(() => {
    loadBatchJobs();
    loadClaudeAgentStatus();
    
    // Auto-refresh every 30 seconds
    const interval = setInterval(() => {
      loadBatchJobs();
      loadClaudeAgentStatus();
    }, 30000);
    
    return () => clearInterval(interval);
  }, []);

  const loadBatchJobs = async () => {
    try {
      const response = await fetch('/api/batch-processing?action=list&limit=20');
      const data = await response.json();
      
      if (data.success) {
        setBatchJobs(data.data.jobs);
      }
    } catch (error) {
      console.error('Error loading batch jobs:', error);
    }
  };

  const loadClaudeAgentStatus = async () => {
    try {
      const response = await fetch('/api/webhook/claude-agent?action=status');
      const data = await response.json();
      
      if (data.success) {
        setClaudeAgentStatus(data.data);
      }
    } catch (error) {
      console.error('Error loading Claude Agent status:', error);
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      await Promise.all([
        loadBatchJobs(),
        loadClaudeAgentStatus()
      ]);
    } finally {
      setRefreshing(false);
    }
  };

  const createBatchJob = async (type: BatchJob['type']) => {
    setLoading(true);
    
    try {
      const payloads = {
        enrichment: {
          type: 'enrichment' as const,
          data: [
            {
              id: `company-${Date.now()}`,
              name: 'Sports Technology Company',
              type: 'company',
              industry: 'Sports',
              size: 'medium',
              location: 'Austin, TX'
            },
            {
              id: `company-${Date.now() + 1}`,
              name: 'Digital Sports Platform',
              type: 'company', 
              industry: 'Sports',
              size: 'large',
              location: 'San Francisco, CA'
            }
          ],
          priority: 'medium' as const,
          options: {
            useClaudeAgent: true,
            mcpTools: ['neo4j', 'brightdata', 'memory']
          },
          metadata: {
            source: 'claude-agent-demo',
            userId: 'demo-user',
            tags: ['demo', 'enrichment']
          }
        },
        
        analysis: {
          type: 'analysis' as const,
          data: [
            {
              id: `rfp-${Date.now()}`,
              title: 'Sports Analytics Platform RFP',
              organization: 'Professional Sports League',
              description: 'Complete analytics platform for fan engagement and performance optimization',
              value: '$1.8M',
              category: 'Technology',
              deadline: '2024-04-15',
              source: 'procurement_portal',
              published: new Date().toISOString()
            }
          ],
          priority: 'high' as const,
          options: {
            useClaudeAgent: true,
            batchSize: 5
          },
          metadata: {
            source: 'claude-agent-demo',
            userId: 'demo-user',
            tags: ['demo', 'rfp-analysis']
          }
        },

        reasoning: {
          type: 'reasoning' as const,
          data: [
            {
              id: `alert-${Date.now()}`,
              type: 'promotion',
              entity: 'Michael Chen',
              description: 'promoted to Chief Technology Officer',
              impact: 0,
              source: 'linkedin',
              timestamp: new Date().toISOString()
            },
            {
              id: `alert-${Date.now() + 1}`,
              type: 'hiring',
              entity: 'SportsTech Inc',
              description: 'hiring 12 engineers for platform expansion',
              impact: 15.5,
              source: 'company_careers',
              timestamp: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString()
            }
          ],
          priority: 'medium' as const,
          options: {
            useClaudeAgent: true
          },
          metadata: {
            source: 'claude-agent-demo',
            userId: 'demo-user',
            tags: ['demo', 'reasoning']
          }
        }
      };

      const payload = payloads[type];
      if (!payload) return;

      const response = await fetch('/api/batch-processing', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      const result = await response.json();
      
      if (result.success) {
        await loadBatchJobs();
      } else {
        console.error('Failed to create batch job:', result.error);
      }
    } catch (error) {
      console.error('Error creating batch job:', error);
    } finally {
      setLoading(false);
    }
  };

  const testWebhook = async (webhookType: WebhookTest['type']) => {
    setWebhookTests(prev => prev.map(test => 
      test.type === webhookType ? { ...test, status: 'sending' } : test
    ));

    try {
      const testPayloads = {
        rfp_alert: {
          type: 'rfp_alert' as const,
          data: {
            rfp: {
              id: `test-rfp-${Date.now()}`,
              title: 'Test Sports Technology RFP',
              organization: 'Test Sports Organization',
              description: 'This is a test RFP for demonstrating Claude Agent webhook processing',
              value: '$500K',
              category: 'Technology',
              deadline: '2024-03-30',
              source: 'test_system',
              published: new Date().toISOString()
            },
            entity: {
              id: 'test-entity-1',
              name: 'Test Sports Organization',
              type: 'company',
              industry: 'Sports',
              size: 'medium',
              location: 'Test City, USA'
            }
          },
          priority: 'high' as const,
          timestamp: new Date().toISOString(),
          source: 'claude-agent-demo'
        },

        entity_alert: {
          type: 'entity_alert' as const,
          data: {
            alert: {
              id: `test-alert-${Date.now()}`,
              type: 'promotion',
              entity: 'Test Executive',
              description: 'promoted to VP of Strategy',
              impact: 0,
              source: 'test_linkedin',
              timestamp: new Date().toISOString()
            },
            entity: {
              id: 'test-entity-2',
              name: 'Test Executive',
              type: 'person',
              industry: 'Sports',
              company: 'Test Sports Company',
              location: 'Test Location'
            }
          },
          priority: 'medium' as const,
          timestamp: new Date().toISOString(),
          source: 'claude-agent-demo'
        },

        entity_enrichment: {
          type: 'entity_enrichment' as const,
          data: {
            entity: {
              id: 'test-entity-3',
              name: 'Test Sports Tech Company',
              type: 'company',
              industry: 'Sports',
              size: 'large',
              location: 'Test Metro Area',
              description: 'A test company for demonstrating entity enrichment'
            }
          },
          priority: 'medium' as const,
          timestamp: new Date().toISOString(),
          source: 'claude-agent-demo'
        },

        market_intelligence: {
          type: 'market_intelligence' as const,
          data: {
            industry: 'Sports Technology',
            region: 'North America'
          },
          priority: 'low' as const,
          timestamp: new Date().toISOString(),
          source: 'claude-agent-demo'
        }
      };

      const payload = testPayloads[webhookType];
      
      const response = await fetch('/api/webhook/claude-agent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      const result = await response.json();
      
      if (result.success) {
        setWebhookTests(prev => prev.map(test => 
          test.type === webhookType ? { ...test, status: 'success', result } : test
        ));
      } else {
        setWebhookTests(prev => prev.map(test => 
          test.type === webhookType ? { ...test, status: 'error', error: result.error } : test
        ));
      }
    } catch (error) {
      setWebhookTests(prev => prev.map(test => 
        test.type === webhookType ? { 
          ...test, 
          status: 'error', 
          error: error instanceof Error ? error.message : 'Unknown error' 
        } : test
      ));
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed':
      case 'success':
        return <CheckCircle className="w-4 h-4 text-green-500" />;
      case 'processing':
      case 'sending':
        return <RefreshCw className="w-4 h-4 text-blue-500 animate-spin" />;
      case 'failed':
      case 'error':
        return <AlertTriangle className="w-4 h-4 text-red-500" />;
      default:
        return <Clock className="w-4 h-4 text-gray-500" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed':
      case 'success':
        return 'text-green-600 bg-green-100';
      case 'processing':
      case 'sending':
        return 'text-blue-600 bg-blue-100';
      case 'failed':
      case 'error':
        return 'text-red-600 bg-red-100';
      default:
        return 'text-gray-600 bg-gray-100';
    }
  };

  return (
    <div className="bg-custom-box border border-custom-border rounded-lg shadow">
      {/* Header */}
      <div className="p-4 border-b border-custom-border">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Brain className="w-5 h-5 text-fm-yellow" />
            <h3 className="font-subheader text-fm-white">Claude Agent Integration</h3>
            <span className="px-2 py-1 text-xs rounded-full bg-green-100 text-green-800">
              Active
            </span>
          </div>
          
          <button
            onClick={handleRefresh}
            disabled={refreshing}
            className="p-2 text-fm-medium-grey hover:text-fm-white transition-colors disabled:opacity-50"
            title="Refresh data"
          >
            <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="flex space-x-1 mt-4">
          {[
            { id: 'claude-agent', label: 'Claude Agent', icon: Brain },
            { id: 'batch-processing', label: 'Batch Processing', icon: BarChart3 },
            { id: 'webhooks', label: 'Webhooks', icon: Zap }
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setSelectedTab(tab.id as any)}
              className={`flex items-center space-x-2 px-3 py-2 rounded-md font-body-medium text-sm transition-colors ${
                selectedTab === tab.id
                  ? 'bg-fm-yellow text-custom-bg'
                  : 'text-fm-medium-grey hover:text-fm-white'
              }`}
            >
              <tab.icon className="w-4 h-4" />
              <span>{tab.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Tab Content */}
      <div className="p-4">
        {selectedTab === 'claude-agent' && (
          <div className="space-y-6">
            {/* Claude Agent Status */}
            <div>
              <h4 className="font-body-medium text-fm-light-grey mb-3 flex items-center">
                <Activity className="w-4 h-4 mr-2 text-fm-yellow" />
                Claude Agent Status
              </h4>
              
              {claudeAgentStatus ? (
                <div className="bg-custom-bg rounded-lg p-4 space-y-3">
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="font-body-secondary text-fm-meta">Queue Status:</span>
                      <span className="ml-2 font-body-primary text-fm-white">
                        {claudeAgentStatus.totalInQueue} jobs in queue
                      </span>
                    </div>
                    <div>
                      <span className="font-body-secondary text-fm-meta">Available Handlers:</span>
                      <span className="ml-2 font-body-primary text-fm-white">
                        {claudeAgentStatus.availableHandlers?.length || 0} webhook types
                      </span>
                    </div>
                  </div>
                  
                  {claudeAgentStatus.queue && claudeAgentStatus.queue.length > 0 && (
                    <div>
                      <h5 className="font-body-medium text-fm-light-grey mb-2">Active Jobs</h5>
                      <div className="space-y-2">
                        {claudeAgentStatus.queue.slice(0, 3).map((job: any) => (
                          <div key={job.id} className="flex items-center justify-between text-xs">
                            <span className="text-fm-medium-grey">{job.type}</span>
                            <div className="flex items-center space-x-2">
                              <span className={`px-2 py-1 rounded ${getStatusColor(job.status)}`}>
                                {job.status}
                              </span>
                              <span className="text-fm-meta">{job.itemCount} items</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="text-center text-fm-medium-grey py-8">
                  <Brain className="w-12 h-12 mx-auto mb-3 opacity-50" />
                  <p>Loading Claude Agent status...</p>
                </div>
              )}
            </div>

            {/* Features */}
            <div>
              <h4 className="font-body-medium text-fm-light-grey mb-3 flex items-center">
                <Target className="w-4 h-4 mr-2 text-fm-yellow" />
                Claude Agent Capabilities
              </h4>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="bg-custom-bg rounded-lg p-4">
                  <h5 className="font-body-primary text-fm-white mb-2">🧠 Intelligent Analysis</h5>
                  <p className="font-body-secondary text-fm-medium-grey text-sm">
                    Uses Claude Agent SDK with CopilotKit integration for sophisticated RFP analysis and business intelligence.
                  </p>
                </div>
                
                <div className="bg-custom-bg rounded-lg p-4">
                  <h5 className="font-body-primary text-fm-white mb-2">🔗 MCP Tools Integration</h5>
                  <p className="font-body-secondary text-fm-medium-grey text-sm">
                    Leverages Neo4j database, web scraping, and knowledge retrieval through MCP servers.
                  </p>
                </div>
                
                <div className="bg-custom-bg rounded-lg p-4">
                  <h5 className="font-body-primary text-fm-white mb-2">⚡ Real-time Processing</h5>
                  <p className="font-body-secondary text-fm-medium-grey text-sm">
                    Processes alerts and RFPs in real-time with AI reasoning and confidence scoring.
                  </p>
                </div>
                
                <div className="bg-custom-bg rounded-lg p-4">
                  <h5 className="font-body-primary text-fm-white mb-2">📊 Business Intelligence</h5>
                  <p className="font-body-secondary text-fm-medium-grey text-sm">
                    Provides strategic recommendations, risk assessments, and opportunity scoring.
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}

        {selectedTab === 'batch-processing' && (
          <div className="space-y-6">
            {/* Create Batch Jobs */}
            <div>
              <h4 className="font-body-medium text-fm-light-grey mb-3 flex items-center">
                <BarChart3 className="w-4 h-4 mr-2 text-fm-yellow" />
                Create Batch Job
              </h4>
              
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <button
                  onClick={() => createBatchJob('enrichment')}
                  disabled={loading}
                  className="bg-custom-bg border border-custom-border rounded-lg p-4 hover:bg-fm-yellow hover:text-custom-bg transition-colors disabled:opacity-50"
                >
                  <Database className="w-6 h-6 mx-auto mb-2" />
                  <h5 className="font-body-primary text-fm-white mb-1">Entity Enrichment</h5>
                  <p className="font-body-secondary text-fm-medium-grey text-xs">
                    Enrich companies with AI intelligence
                  </p>
                </button>
                
                <button
                  onClick={() => createBatchJob('analysis')}
                  disabled={loading}
                  className="bg-custom-bg border border-custom-border rounded-lg p-4 hover:bg-fm-yellow hover:text-custom-bg transition-colors disabled:opacity-50"
                >
                  <Target className="w-6 h-6 mx-auto mb-2" />
                  <h5 className="font-body-primary text-fm-white mb-1">RFP Analysis</h5>
                  <p className="font-body-secondary text-fm-medium-grey text-xs">
                    Analyze RFPs for strategic fit
                  </p>
                </button>
                
                <button
                  onClick={() => createBatchJob('reasoning')}
                  disabled={loading}
                  className="bg-custom-bg border border-custom-border rounded-lg p-4 hover:bg-fm-yellow hover:text-custom-bg transition-colors disabled:opacity-50"
                >
                  <Brain className="w-6 h-6 mx-auto mb-2" />
                  <h5 className="font-body-primary text-fm-white mb-1">Alert Reasoning</h5>
                  <p className="font-body-secondary text-fm-medium-grey text-xs">
                    Apply AI reasoning to alerts
                  </p>
                </button>
              </div>
            </div>

            {/* Batch Jobs List */}
            <div>
              <h4 className="font-body-medium text-fm-light-grey mb-3">Recent Batch Jobs</h4>
              
              {batchJobs.length === 0 ? (
                <div className="text-center text-fm-medium-grey py-8">
                  <BarChart3 className="w-12 h-12 mx-auto mb-3 opacity-50" />
                  <p>No batch jobs yet. Create one above to get started.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {batchJobs.slice(0, 5).map((job) => (
                    <div key={job.id} className="bg-custom-bg rounded-lg p-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-3">
                          {getStatusIcon(job.status)}
                          <div>
                            <h5 className="font-body-primary text-fm-white capitalize">
                              {job.type.replace('_', ' ')}
                            </h5>
                            <p className="font-body-secondary text-fm-medium-grey text-sm">
                              {job.itemCount} items • {job.priority} priority
                            </p>
                          </div>
                        </div>
                        
                        <div className="text-right">
                          <div className={`px-2 py-1 text-xs rounded ${getStatusColor(job.status)}`}>
                            {job.status}
                          </div>
                          <p className="font-body-secondary text-fm-meta text-xs mt-1">
                            {new Date(job.createdAt).toLocaleString()}
                          </p>
                          {job.estimatedDuration && (
                            <p className="font-body-secondary text-fm-meta text-xs">
                              ~{job.estimatedDuration}s estimated
                            </p>
                          )}
                        </div>
                      </div>
                      
                      {job.results && (
                        <div className="mt-3 pt-3 border-t border-custom-border">
                          <p className="font-body-secondary text-fm-medium-grey text-xs">
                            ✅ Processed {job.results.processed || job.itemCount} items successfully
                          </p>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {selectedTab === 'webhooks' && (
          <div className="space-y-6">
            {/* Webhook Testing */}
            <div>
              <h4 className="font-body-medium text-fm-light-grey mb-3 flex items-center">
                <Zap className="w-4 h-4 mr-2 text-fm-yellow" />
                Test Webhook Processing
              </h4>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {webhookTests.map((test) => (
                  <div key={test.type} className="bg-custom-bg rounded-lg p-4">
                    <div className="flex items-center justify-between mb-3">
                      <h5 className="font-body-primary text-fm-white capitalize">
                        {test.type.replace('_', ' ')}
                      </h5>
                      {getStatusIcon(test.status)}
                    </div>
                    
                    <button
                      onClick={() => testWebhook(test.type)}
                      disabled={test.status === 'sending'}
                      className="w-full px-3 py-2 bg-fm-yellow text-custom-bg font-body-medium rounded hover:bg-yellow-400 transition-colors disabled:opacity-50 flex items-center justify-center space-x-2"
                    >
                      {test.status === 'sending' ? (
                        <>
                          <RefreshCw className="w-4 h-4 animate-spin" />
                          <span>Processing...</span>
                        </>
                      ) : (
                        <>
                          <Play className="w-4 h-4" />
                          <span>Test Webhook</span>
                        </>
                      )}
                    </button>
                    
                    {test.result && (
                      <div className="mt-3 p-2 bg-green-900 bg-opacity-20 rounded text-xs">
                        <p className="text-green-400 font-medium">✅ Success</p>
                        <p className="text-fm-medium-grey mt-1">
                          Webhook ID: {test.result.webhookId}
                        </p>
                        <p className="text-fm-medium-grey">
                          Processed at: {new Date(test.result.processedAt).toLocaleString()}
                        </p>
                      </div>
                    )}
                    
                    {test.error && (
                      <div className="mt-3 p-2 bg-red-900 bg-opacity-20 rounded text-xs">
                        <p className="text-red-400 font-medium">❌ Error</p>
                        <p className="text-fm-medium-grey mt-1">{test.error}</p>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Webhook Information */}
            <div>
              <h4 className="font-body-medium text-fm-light-grey mb-3">Webhook Endpoints</h4>
              <div className="bg-custom-bg rounded-lg p-4">
                <code className="font-body-secondary text-fm-yellow text-sm">
                  POST /api/webhook/claude-agent
                </code>
                <p className="font-body-secondary text-fm-medium-grey text-sm mt-2">
                  Real-time webhook processing with Claude Agent analysis for enriched data and alerts.
                </p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ClaudeAgentDemo;