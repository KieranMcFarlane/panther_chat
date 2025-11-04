'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { ExternalLink, Building2, MapPin, PoundSterling, Calendar, Clock, Target, Eye } from 'lucide-react';

interface ProcessingLog {
  id: string;
  timestamp: string;
  entity: string;
  status: 'processing' | 'completed' | 'error';
  message?: string;
}

interface RFPOpportunity {
  id: string;
  title: string;
  organization: string;
  location: string;
  value: string;
  deadline: string | null;
  category: string;
  status: string;
  type: string;
  description: string;
  url: string;
  yellow_panther_fit: number;
  priority_score: number;
  confidence: number;
  source: string;
  published: string;
}

// Global flag to prevent multiple simultaneous analyses
let globalAnalysisInProgress = false;

export default function RFPAnalysisControlCenter() {
  const [isProcessing, setIsProcessing] = useState(false);
  const [hasCompleted, setHasCompleted] = useState(false);
  const [progress, setProgress] = useState(0);
  const [currentEntity, setCurrentEntity] = useState('');
  const [totalEntities, setTotalEntities] = useState(3);
  const [processedEntities, setProcessedEntities] = useState(0);
  const [processingLogs, setProcessingLogs] = useState<ProcessingLog[]>([]);
  const [estimatedCompletion, setEstimatedCompletion] = useState<Date | null>(null);
  const [currentSessionId, setCurrentSessionId] = useState<string>('');
  const [rfpResults, setRfpResults] = useState<RFPOpportunity[]>([]);
  const [loadingRFPs, setLoadingRFPs] = useState(false);
  
  const eventSourceRef = useRef<EventSource | null>(null);
  const logsEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    logsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [processingLogs]);

  // Load RFP results on component mount
  useEffect(() => {
    loadRFPResults();
  }, []);

  const loadRFPResults = async () => {
    setLoadingRFPs(true);
    try {
      const response = await fetch('/api/rfp-results?action=latest-rfps&t=' + Date.now());
      const data = await response.json();
      
      if (data.success && data.opportunities) {
        console.log(`🎯 Loaded ${data.opportunities.length} RFP opportunities`);
        setRfpResults(data.opportunities);
      }
    } catch (error) {
      console.error('❌ Error loading RFP results:', error);
    } finally {
      setLoadingRFPs(false);
    }
  };

  const startAnalysis = () => {
    if (isProcessing || hasCompleted || globalAnalysisInProgress) {
      console.log('Analysis already in progress or completed globally');
      return;
    }
    
    console.log('Starting real RFP analysis...');
    globalAnalysisInProgress = true;
    setIsProcessing(true);
    setHasCompleted(false);
    setProgress(0);
    setProcessedEntities(0);
    setProcessingLogs([]);
    
    const estimatedMs = totalEntities * 29000;
    const completionTime = new Date(Date.now() + estimatedMs);
    setEstimatedCompletion(completionTime);
    
    const initialLog: ProcessingLog = {
      id: Date.now().toString(),
      timestamp: new Date().toISOString(),
      entity: 'System',
      status: 'processing',
      message: `🚀 Starting comprehensive RFP analysis of ${totalEntities} entities...`
    };
    setProcessingLogs([initialLog]);
    
    // Connect to the real SSE endpoint with unique session ID and prevent auto-reconnect
    const sessionId = Date.now().toString();
    setCurrentSessionId(sessionId);
    console.log(`🚀 Starting SSE connection with session ID: ${sessionId}`);
    
    const eventSource = new EventSource(
      `/api/claude-agent-demo/stream?service=reliable&query=Comprehensive%20RFP%20intelligence%20analysis&mode=batch&entityLimit=${totalEntities}&startEntityId=0&sessionId=${sessionId}`
    );
    
    eventSourceRef.current = eventSource;
    
    eventSource.onopen = () => {
      console.log('✅ SSE connection established successfully');
      
      const connectionLog: ProcessingLog = {
        id: Date.now().toString(),
        timestamp: new Date().toISOString(),
        entity: 'System',
        status: 'completed',
        message: '✅ Connected to RFP analysis backend'
      };
      setProcessingLogs(prev => [...prev, connectionLog]);
    };
    
    eventSource.onmessage = (event) => {
      try {
        console.log('Raw SSE event:', event);
        console.log('SSE event data:', event.data);
        
        // Parse the JSON data from SSE
        const data = JSON.parse(event.data);
        console.log('Parsed SSE data:', data);
        
        // Handle structured events from ReliableClaudeService
        if (data && data.type) {
          console.log('Processing structured event type:', data.type);
          
          switch (data.type) {
            case 'entity_search_start':
              const entityName = data.sessionState?.currentEntity || 'Unknown Entity';
              setCurrentEntity(entityName);
              setProgress((prev) => Math.min(prev + (100 / totalEntities), 99));
              
              const startLog: ProcessingLog = {
                id: Date.now().toString(),
                timestamp: new Date().toISOString(),
                entity: entityName,
                status: 'processing',
                message: data.message || `🔍 Starting search for: ${entityName}`
              };
              setProcessingLogs(prev => [...prev, startLog]);
              break;
              
            case 'entity_search_complete':
              const completedEntity = data.sessionState?.currentEntity || 'Unknown Entity';
              setProcessedEntities(prev => prev + 1);
              
              const completeLog: ProcessingLog = {
                id: Date.now().toString(),
                timestamp: new Date().toISOString(),
                entity: completedEntity,
                status: 'completed',
                message: data.message || `✅ Search completed for: ${completedEntity}`
              };
              setProcessingLogs(prev => [...prev, completeLog]);
              break;
              
            case 'entity_search_error':
              const errorEntity = data.sessionState?.currentEntity || 'Unknown Entity';
              const errorLog: ProcessingLog = {
                id: Date.now().toString(),
                timestamp: new Date().toISOString(),
                entity: errorEntity,
                status: 'error',
                message: data.message || `❌ Search failed for: ${errorEntity}`
              };
              setProcessingLogs(prev => [...prev, errorLog]);
              break;
              
            case 'chunk_start':
            case 'chunk_complete':
            case 'analysis_start':
            case 'analysis_complete':
            case 'session_start':
              const systemLog: ProcessingLog = {
                id: Date.now().toString(),
                timestamp: new Date().toISOString(),
                entity: 'System',
                status: data.type.includes('complete') ? 'completed' : 'processing',
                message: data.message || `${data.type}: Processing...`
              };
              setProcessingLogs(prev => [...prev, systemLog]);
              
              if (data.type === 'analysis_complete') {
                setIsProcessing(false);
                setHasCompleted(true);
                globalAnalysisInProgress = false;
                setProgress(100);
                setCurrentEntity('Analysis Complete');
                eventSource.close();
              }
              break;
              
            default:
              console.log('Unhandled event type:', data.type);
          }
        }
        // Handle fallback log events from mock processing
        else if (data && data.message) {
          const message = data.message;
          
          if (message.includes('Starting BrightData search for:')) {
            const entityName = message.replace('🔍 Starting BrightData search for: ', '');
            setCurrentEntity(entityName);
            setProgress((prev) => Math.min(prev + (100 / totalEntities), 99));
            
            const startLog: ProcessingLog = {
              id: Date.now().toString(),
              timestamp: new Date().toISOString(),
              entity: entityName,
              status: 'processing',
              message: `🔍 ${message}`
            };
            setProcessingLogs(prev => [...prev, startLog]);
          }
          else if (message.includes('BrightData search completed for:')) {
            const entityName = message.replace('✅ BrightData search completed for: ', '');
            setProcessedEntities(prev => prev + 1);
            
            const completeLog: ProcessingLog = {
              id: Date.now().toString(),
              timestamp: new Date().toISOString(),
              entity: entityName,
              status: 'completed',
              message: `✅ ${message}`
            };
            setProcessingLogs(prev => [...prev, completeLog]);
          }
          else if (message.includes('Analysis complete') || message.includes('PROCESSING COMPLETE')) {
            setIsProcessing(false);
            setHasCompleted(true);
            globalAnalysisInProgress = false;
            setProgress(100);
            setCurrentEntity('Analysis Complete');
            
            const finalLog: ProcessingLog = {
              id: Date.now().toString(),
              timestamp: new Date().toISOString(),
              entity: 'System',
              status: 'completed',
              message: `🎉 ${message}`
            };
            setProcessingLogs(prev => [...prev, finalLog]);
            eventSource.close();
          }
          else if (message.includes('Processing') || message.includes('Starting') || message.includes('Created session')) {
            const progressLog: ProcessingLog = {
              id: Date.now().toString(),
              timestamp: new Date().toISOString(),
              entity: 'System',
              status: 'processing',
              message: message
            };
            setProcessingLogs(prev => [...prev, progressLog]);
          }
        }
        else if (data && (data.current !== undefined || data.total !== undefined)) {
          // Handle progress events
          setProgress(data.current || 0);
          
          const progressLog: ProcessingLog = {
            id: Date.now().toString(),
            timestamp: new Date().toISOString(),
            entity: 'System',
            status: 'processing',
            message: data.message || `Progress: ${data.current}/${data.total}`
          };
          setProcessingLogs(prev => [...prev, progressLog]);
        }
        else {
          console.log('Received event data:', data);
        }
        
      } catch (error) {
        console.error('Error parsing SSE data:', error);
        console.log('Raw event data that failed to parse:', event.data);
      }
    };
    
    eventSource.onerror = (error) => {
      console.log('EventSource connection ended or error occurred:', error);
      
      // Check if processing was completed successfully
      if (progress >= 100 || processedEntities > 0) {
        console.log('✅ Analysis completed successfully - connection closed normally');
        setIsProcessing(false);
        setHasCompleted(true);
        globalAnalysisInProgress = false;
        const completionLog: ProcessingLog = {
          id: Date.now().toString(),
          timestamp: new Date().toISOString(),
          entity: 'System',
          status: 'completed',
          message: `✅ Analysis completed! Processed ${processedEntities} entities successfully.`
        };
        setProcessingLogs(prev => [...prev, completionLog]);
        
        // Reload RFP results to show latest opportunities
        setTimeout(() => {
          loadRFPResults();
        }, 2000);
      } else if (isProcessing && processedEntities === 0) {
        // Still processing but no entities completed yet - likely timeout
        console.log('⏰ SSE timeout detected, but processing may continue in background');
        const timeoutLog: ProcessingLog = {
          id: Date.now().toString(),
          timestamp: new Date().toISOString(),
          entity: 'System',
          status: 'processing',
          message: `⏰ Connection timeout - analysis continues in background. Processing may take 2-3 minutes for comprehensive searches.`
        };
        setProcessingLogs(prev => [...prev, timeoutLog]);
        
        // Check if analysis completes in background by polling results
        setTimeout(() => {
          checkAnalysisCompletion(sessionId);
        }, 30000); // Check after 30 seconds
      } else {
        console.error('❌ Unexpected EventSource error:', error);
        setIsProcessing(false);
        globalAnalysisInProgress = false;
        
        const errorLog: ProcessingLog = {
          id: Date.now().toString(),
          timestamp: new Date().toISOString(),
          entity: 'System',
          status: 'error',
          message: `❌ Connection error: Could not connect to analysis backend`
        };
        setProcessingLogs(prev => [...prev, errorLog]);
      }
      
      // Always close the connection on error
      if (eventSource.readyState !== EventSource.CLOSED) {
        eventSource.close();
      }
    };
  };

  // Generate RFP opportunity cards
  const generateRFPCard = (rfp: RFPOpportunity, index: number) => {
    const getDaysUntilDeadline = (deadline: string | null) => {
      if (!deadline) return null;
      const days = Math.ceil((new Date(deadline).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24));
      return days;
    };

    const getFitColor = (fit: number) => {
      if (fit >= 90) return 'bg-green-500';
      if (fit >= 80) return 'bg-yellow-500';
      return 'bg-red-500';
    };

    const getStatusVariant = (status: string) => {
      if (status.toUpperCase().includes('ACTIVE')) return 'default';
      if (status.toUpperCase().includes('EMERGING')) return 'secondary';
      return 'outline';
    };

    const daysUntil = getDaysUntilDeadline(rfp.deadline);
    const fitColor = getFitColor(rfp.yellow_panther_fit);
    const isExpired = daysUntil !== null && daysUntil < 0;
    const isUrgent = daysUntil !== null && daysUntil <= 30 && daysUntil > 0;

    return (
      <div key={rfp.id || index} className="rounded-lg border bg-card text-card-foreground shadow-sm hover:shadow-lg transition-shadow">
        <div className="flex flex-col space-y-1.5 p-6">
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <h3 className="font-semibold tracking-tight text-lg mb-2">{rfp.title}</h3>
              <div className="flex items-center gap-2 text-sm text-muted-foreground mb-2">
                <Building2 className="w-4 h-4" />
                <span>{rfp.organization}</span>
                <MapPin className="w-4 h-4 ml-2" />
                <span>{rfp.location}</span>
              </div>
            </div>
            <div className="flex flex-col items-end gap-2">
              <Badge variant={getStatusVariant(rfp.status)}>
                {isExpired ? 'Expired' : rfp.status || 'Active'}
              </Badge>
              <div className={`px-2 py-1 rounded text-white text-xs ${fitColor}`}>
                {rfp.yellow_panther_fit}% Fit
              </div>
            </div>
          </div>
        </div>
        <div className="p-6 pt-0">
          <p className="text-sm text-muted-foreground mb-4 line-clamp-2">
            {rfp.description}
          </p>
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-4 text-sm">
              <div className="flex items-center gap-1">
                <PoundSterling className="w-4 h-4" />
                <span className="font-medium">{rfp.value}</span>
              </div>
              <div className="flex items-center gap-1">
                <Clock className="w-4 h-4" />
                <span className={isUrgent ? 'text-red-600 font-medium' : ''}>
                  {daysUntil !== null ? (
                    daysUntil > 0 ? `${daysUntil} days` : 'Expired'
                  ) : (
                    'No deadline'
                  )}
                </span>
              </div>
            </div>
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              <Target className="w-3 h-3" />
              <span>Priority: {rfp.priority_score}/10</span>
            </div>
          </div>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="text-xs">
                {rfp.category}
              </Badge>
              <Badge variant="outline" className="text-xs">
                {rfp.type || 'RFP'}
              </Badge>
            </div>
            <div className="flex gap-2">
              <Button size="sm" variant="outline">
                <Eye className="w-4 h-4 mr-1" />
                View
              </Button>
              {rfp.url && (
                <Button size="sm" variant="outline" asChild>
                  <a 
                    href={rfp.url} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="flex items-center gap-1"
                  >
                    <ExternalLink className="w-4 h-4 mr-1" />
                    Source
                  </a>
                </Button>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  };

  const checkAnalysisCompletion = async (sessionId: string) => {
    try {
      console.log(`🔍 Checking if analysis completed for session: ${sessionId}`);
      
      // Check if results are stored in the intelligence database
      const response = await fetch('/api/rfp-intelligence/latest', {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        }
      });
      
      if (response.ok) {
        const result = await response.json();
        if (result && result.session_id && result.entities_processed > 0) {
          console.log('✅ Analysis completed in background - updating UI');
          setIsProcessing(false);
          setHasCompleted(true);
          globalAnalysisInProgress = false;
          setProgress(100);
          setProcessedEntities(result.entities_processed);
          setCurrentEntity('Analysis Complete');
          
          const completionLog: ProcessingLog = {
            id: Date.now().toString(),
            timestamp: new Date().toISOString(),
            entity: 'System',
            status: 'completed',
            message: `✅ Background analysis completed! Processed ${result.entities_processed} entities and found RFP opportunities.`
          };
          setProcessingLogs(prev => [...prev, completionLog]);
          return;
        }
      }
      
      // If no results yet, check again later
      console.log('⏳ Analysis still running, checking again in 30 seconds...');
      setTimeout(() => {
        checkAnalysisCompletion(sessionId);
      }, 30000);
      
    } catch (error) {
      console.error('Error checking analysis completion:', error);
    }
  };

  const stopAnalysis = () => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }
    setIsProcessing(false);
    setHasCompleted(false);
    globalAnalysisInProgress = false;
    
    const stopLog: ProcessingLog = {
      id: Date.now().toString(),
      timestamp: new Date().toISOString(),
      entity: 'User',
      status: 'completed',
      message: '⏹️ Analysis stopped by user'
    };
    setProcessingLogs(prev => [...prev, stopLog]);
  };

  const formatTimeRemaining = () => {
    if (!estimatedCompletion) return 'Calculating...';
    
    const now = new Date();
    const remaining = estimatedCompletion.getTime() - now.getTime();
    
    if (remaining <= 0) return 'Completing...';
    
    const hours = Math.floor(remaining / 3600000);
    const minutes = Math.floor((remaining % 3600000) / 60000);
    const seconds = Math.floor((remaining % 60000) / 1000);
    
    if (hours > 0) {
      return `${hours}h ${minutes}m ${seconds}s`;
    } else if (minutes > 0) {
      return `${minutes}m ${seconds}s`;
    } else {
      return `${seconds}s`;
    }
  };

  return (
    <div className="container mx-auto p-6 max-w-7xl space-y-6">
      <div className="text-center space-y-2">
        <h1 className="text-3xl font-bold">RFP Analysis Control Center</h1>
        <p className="text-muted-foreground">
          Real-time RFP intelligence analysis across {totalEntities.toLocaleString()} sports entities with live BrightData searches
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span>Analysis Control</span>
            {isProcessing && (
              <Badge variant="outline" className="animate-pulse">
                Processing...
              </Badge>
            )}
          </CardTitle>
          <CardDescription>
            Start comprehensive RFP analysis with real-time BrightData searches. Analysis takes 2-3 minutes for thorough web searches.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex justify-center">
            {!isProcessing && !hasCompleted ? (
              <Button 
                onClick={startAnalysis}
                size="lg"
                className="px-8 py-3 text-lg"
              >
                🚀 Start RFP Analysis
              </Button>
            ) : isProcessing ? (
              <Button 
                onClick={stopAnalysis}
                variant="destructive"
                size="lg"
                className="px-8 py-3 text-lg"
              >
                ⏹️ Stop Analysis
              </Button>
            ) : (
              <Button 
                onClick={() => {
                  setHasCompleted(false);
                  setProgress(0);
                  setProcessedEntities(0);
                  setCurrentEntity('');
                  setProcessingLogs([]);
                  setEstimatedCompletion(null);
                  globalAnalysisInProgress = false;
                  setCurrentSessionId('');
                }}
                variant="outline"
                size="lg"
                className="px-8 py-3 text-lg"
              >
                🔄 Reset Analysis
              </Button>
            )}
          </div>

          {isProcessing && (
            <div className="space-y-4">
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span>Progress: {processedEntities.toLocaleString()} / {totalEntities.toLocaleString()} entities</span>
                  <span>{progress.toFixed(1)}%</span>
                </div>
                <Progress value={progress} className="w-full h-2" />
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                <div className="text-center">
                  <div className="font-semibold text-blue-600">Current Entity</div>
                  <div className="truncate">{currentEntity || 'Initializing...'}</div>
                </div>
                <div className="text-center">
                  <div className="font-semibold text-green-600">Processed</div>
                  <div>{processedEntities.toLocaleString()} entities</div>
                </div>
                <div className="text-center">
                  <div className="font-semibold text-orange-600">Time Remaining</div>
                  <div>{formatTimeRemaining()}</div>
                </div>
              </div>
            </div>
          )}

          {processedEntities > 0 && (
            <div className="space-y-4 pt-4 border-t">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="text-center">
                  <div className="text-2xl font-bold text-blue-600">{processedEntities.toLocaleString()}</div>
                  <div className="text-sm text-muted-foreground">Entities Processed</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-green-600">0</div>
                  <div className="text-sm text-muted-foreground">RFPs Found</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-orange-600">0%</div>
                  <div className="text-sm text-muted-foreground">Detection Rate</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-purple-600">£0K</div>
                  <div className="text-sm text-muted-foreground">Total Value</div>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* RFP Results Section */}
      {!isProcessing && rfpResults.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span>🎯 Latest RFP Opportunities</span>
              <Badge variant="secondary">
                {rfpResults.length} Opportunities Found
              </Badge>
            </CardTitle>
            <CardDescription>
              Real RFP opportunities discovered by our AI analysis system with verified source links
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
              {rfpResults.map((rfp, index) => generateRFPCard(rfp, index))}
            </div>
          </CardContent>
        </Card>
      )}

      {isProcessing && (
        <Card>
          <CardHeader>
            <CardTitle>Live Processing Log</CardTitle>
            <CardDescription>Real-time updates from the RFP analysis engine</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-48 overflow-y-auto space-y-2 font-mono text-sm border rounded p-3 bg-gray-50">
              {processingLogs.map((log) => (
                <div key={log.id} className="flex items-start space-x-2">
                  <span className="text-gray-500 text-xs">
                    {new Date(log.timestamp).toLocaleTimeString()}
                  </span>
                  <span className={`${
                    log.status === 'processing' ? 'text-blue-600' :
                    log.status === 'completed' ? 'text-green-600' :
                    log.status === 'error' ? 'text-red-600' : 'text-gray-600'
                  }`}>
                    {log.message}
                  </span>
                </div>
              ))}
              <div ref={logsEndRef} />
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}