'use client';

import React, { useState, useCallback, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ResizableBox } from 're-resizable';
import { CopilotSidebar } from '@copilotkit/react-ui';
import { useCopilotChat, useCopilotAction } from '@copilotkit/react-core';
import { useUser } from '@/contexts/UserContext';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { 
  MessageSquare, 
  Plus, 
  X, 
  Target, 
  Database, 
  Search, 
  Mail,
  TrendingUp,
  Clock,
  CheckCircle,
  Loader2,
  Brain,
  Zap
} from 'lucide-react';

// Your existing action verbs
const actionVerbs = [
  "Accomplishing", "Actioning", "Actualizing", "Analyzing", "Baking", "Brewing",
  "Calculating", "Cerebrating", "Churning", "Clauding", "Coalescing",
  "Cogitating", "Computing", "Conjuring", "Considering", "Cooking",
  "Crafting", "Creating", "Crunching", "Deliberating", "Determining",
  "Effecting", "Executing", "Exploring", "Finagling", "Forging", "Forming", 
  "Generating", "Gathering", "Hatching", "Herding", "Honking", "Hustling", 
  "Ideating", "Inferring", "Investigating", "Manifesting", "Marinating", 
  "Moseying", "Mulling", "Mustering", "Musing", "Noodling", "Percolating", 
  "Pondering", "Processing", "Puttering", "Querying", "Reticulating", 
  "Ruminating", "Sarching", "Schlepping", "Scraping", "Searching", 
  "Shucking", "Simmering", "Smooshing", "Spinning", "Stewing", 
  "Synthesizing", "Thinking", "Transmuting", "Vibing", "Working"
];

const toolActionMap: { [key: string]: string[] } = {
  "mcp__neo4j-mcp__execute_query": ["Querying", "Analyzing", "Investigating"],
  "mcp__neo4j-mcp__search_nodes": ["Searching", "Finding", "Discovering"],
  "mcp__brightData__search_engine": ["Searching", "Scouring", "Exploring"],
  "mcp__brightData__scrape_as_markdown": ["Scraping", "Gathering", "Collecting"],
  "mcp__perplexity-mcp__chat_completion": ["Analyzing", "Reasoning", "Synthesizing"],
  "WebSearch": ["Searching", "Exploring", "Discovering"],
  "WebFetch": ["Fetching", "Gathering", "Retrieving"]
};

// ASCII flower frames for Claude-style animation
const flowerFrames = ["(·)", "(•)", "(✿)", "(🌸)", "(✿)", "(•)", "(·)"];

interface EnhancedCopilotSidebarProps {
  userId?: string;
  context?: any;
  className?: string;
}

function DynamicStatus({ currentTool, isLoading = true, statusMessage }: {
  currentTool?: string;
  isLoading?: boolean;
  statusMessage?: string;
}) {
  const [verb, setVerb] = useState("Analyzing");
  const [displayTool, setDisplayTool] = useState<string>("");
  const [counter, setCounter] = useState(0);
  const [currentStatus, setCurrentStatus] = useState<string>("");
  const [flowerFrame, setFlowerFrame] = useState(0);
  const [dotCycle, setDotCycle] = useState(0);
  const [phase, setPhase] = useState<'thinking' | 'generating' | 'tool' | 'done'>('thinking');

  useEffect(() => {
    if (!isLoading) return;

    const interval = setInterval(() => {
      setCounter(prev => prev + 1);
      
      // Change verb every 2.5 seconds for smoother cycling
      if (counter % 5 === 0) {
        let newVerb: string;
        
        if (currentTool && toolActionMap[currentTool]) {
          // Use tool-specific verbs
          const toolVerbs = toolActionMap[currentTool];
          newVerb = toolVerbs[Math.floor(Math.random() * toolVerbs.length)];
        } else {
          // Use general action verbs
          const random = Math.floor(Math.random() * actionVerbs.length);
          newVerb = actionVerbs[random];
        }
        
        setVerb(newVerb);
        
        // Update phase based on tool type
        if (currentTool) {
          setPhase('tool');
        } else {
          setPhase(Math.random() > 0.5 ? 'thinking' : 'generating');
        }
      }
    }, 500);

    return () => clearInterval(interval);
  }, [counter, currentTool, isLoading]);

  // Flower animation for thinking phase
  useEffect(() => {
    if (phase === 'thinking' && isLoading) {
      const interval = setInterval(() => setFlowerFrame(f => (f + 1) % flowerFrames.length), 200);
      return () => clearInterval(interval);
    }
  }, [phase, isLoading]);

  // Dot animation for generating/tool phase
  useEffect(() => {
    if ((phase === 'generating' || phase === 'tool') && isLoading) {
      const interval = setInterval(() => setDotCycle(c => (c + 1) % 4), 400);
      return () => clearInterval(interval);
    }
  }, [phase, isLoading]);

  useEffect(() => {
    if (currentTool) {
      const toolName = currentTool.replace('mcp__', '').replace('__', ' - ');
      setDisplayTool(toolName);
    } else {
      setDisplayTool("");
    }
  }, [currentTool]);

  useEffect(() => {
    if (statusMessage) {
      setCurrentStatus(statusMessage);
    }
  }, [statusMessage]);

  if (!isLoading) return null;

  const getDisplay = () => {
    const dots = ".".repeat(dotCycle);
    switch (phase) {
      case 'thinking':
        return `${flowerFrames[flowerFrame]} ${verb} deeply...`;
      case 'generating':
        return `✱ ${verb}${dots}`;
      case 'tool':
        return `⚡ ${verb}${dots}`;
      default:
        return `✱ ${verb}${dots}`;
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex flex-col items-center space-y-2 px-4 py-3 bg-header-bg border-t border-custom-border"
    >
      <div className="flex items-center gap-2">
        <motion.div
          animate={{ opacity: [0.6, 1, 0.6] }}
          transition={{ repeat: Infinity, duration: 1.5 }}
          className="text-xs font-mono text-fm-medium-grey"
        >
          {getDisplay()}
        </motion.div>
        {phase === 'tool' && <Zap className="w-3 h-3 text-fm-yellow" />}
        {phase === 'thinking' && <Brain className="w-3 h-3 text-fm-green" />}
      </div>
      
      {currentStatus && (
        <div className="text-xs text-fm-meta text-center max-w-xs">
          {currentStatus}
        </div>
      )}
      
      {displayTool && !currentStatus && (
        <div className="text-xs text-fm-meta text-center max-w-xs">
          Using <span className="font-medium text-fm-yellow">{displayTool}</span>
        </div>
      )}
    </motion.div>
  );
}

export default function EnhancedCopilotSidebar({
  userId,
  context = {},
  className
}: EnhancedCopilotSidebarProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [width, setWidth] = useState(420);
  const [currentTool, setCurrentTool] = useState<string>("");
  const [isProcessing, setIsProcessing] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string>("");
  
  const { userId: contextUserId } = useUser();
  const { 
    visibleMessages, 
    isLoading,
    appendMessage,
    setMessages,
    deleteMessage,
    reloadMessages,
    stopGeneration,
    regenerateResponse
  } = useCopilotChat();

  // Mock RFP data with enhanced fit scoring
  const mockRFPAlerts = [
    {
      id: '1',
      company: 'Manchester United FC',
      author: 'Sarah Chen',
      role: 'Chief Technology Officer',
      fit_score: 87,
      estimated_value: '£500K-£1M',
      status: 'hot',
      description: 'Digital transformation platform overhaul',
      deadline: '2024-02-15'
    },
    {
      id: '2',
      company: 'Twickenham Stadium',
      author: 'David Mitchell',
      role: 'Head of Digital',
      fit_score: 72,
      estimated_value: '£250K-£500K',
      status: 'warm',
      description: 'Fan engagement mobile application',
      deadline: '2024-03-01'
    },
    {
      id: '3',
      company: 'Leicester City FC',
      author: 'Emma Thompson',
      role: 'Digital Director',
      fit_score: null,
      estimated_value: 'TBD',
      status: 'analyzing',
      description: 'Performance analytics dashboard',
      deadline: 'TBD'
    }
  ];

  // Enhanced CopilotActions with status tracking
  useCopilotAction({
    name: "selectRFPAlert",
    description: "Select a specific RFP alert in the dashboard for analysis",
    parameters: [
      {
        name: "companyName",
        type: "string",
        description: "The name of the company to select",
        required: true
      }
    ],
    handler: async ({ companyName }) => {
      setIsProcessing(true);
      setStatusMessage(`Analyzing ${companyName} RFP opportunity...`);
      setCurrentTool("mcp__neo4j-mcp__execute_query");
      
      const alert = mockRFPAlerts.find(a => a.company.toLowerCase().includes(companyName.toLowerCase()));
      if (alert) {
        console.log(`🎯 AI Selected RFP Alert: ${alert.company} (${alert.fit_score}% fit)`);
        setStatusMessage(`Selected ${alert.company} - High fit opportunity identified`);
        return `Selected ${alert.company} - Fit Score: ${alert.fit_score}%, Value: ${alert.estimated_value}, Contact: ${alert.author} (${alert.role})`;
      } else {
        setStatusMessage(`No RFP found for ${companyName}`);
        return `Could not find RFP alert for company: ${companyName}. Available companies: ${mockRFPAlerts.map(a => a.company).join(', ')}`;
      }
    }
  });

  useCopilotAction({
    name: "openEmailForSelectedRFP", 
    description: "Open the email compose modal for the currently selected RFP opportunity",
    parameters: [
      {
        name: "companyName",
        type: "string",
        description: "The name of the company for which to open email compose",
        required: false
      }
    ],
    handler: async ({ companyName }) => {
      setIsProcessing(true);
      setStatusMessage(`Preparing email template for outreach...`);
      setCurrentTool("email_compose");
      
      const targetCompany = companyName || 'Leicester City FC';
      const alert = mockRFPAlerts.find(a => a.company.toLowerCase().includes(targetCompany.toLowerCase()));
      if (alert) {
        console.log(`📧 Opening email compose for ${alert.company} - ${alert.author}`);
        setStatusMessage(`Email template ready for ${alert.author} at ${alert.company}`);
        return `Opening email compose for ${alert.company} - Contact: ${alert.author} (${alert.role}), Estimated Value: ${alert.estimated_value}`;
      } else {
        setStatusMessage(`No RFP found for ${targetCompany}`);
        return `No RFP alert found for ${targetCompany}. Please select a valid RFP opportunity first.`;
      }
    }
  });

  // Track processing state
  useEffect(() => {
    if (isLoading) {
      setIsProcessing(true);
    } else {
      setTimeout(() => {
        setIsProcessing(false);
        setStatusMessage("");
        setCurrentTool("");
      }, 1000);
    }
  }, [isLoading]);

  // Store panel width in localStorage
  useEffect(() => {
    const stored = localStorage.getItem('enhanced-copilot-width');
    if (stored) setWidth(parseInt(stored));
  }, []);

  const handleResize = useCallback((newWidth: number) => {
    setWidth(newWidth);
    localStorage.setItem('enhanced-copilot-width', newWidth.toString());
  }, []);

  return (
    <AnimatePresence>
      {isOpen && (
        <ResizableBox
          width={width}
          height={window.innerHeight}
          minConstraints={350, 400]}
          maxConstraints={800, window.innerHeight}
          className="fixed right-0 top-0 h-full flex z-50"
          handle={
            <div className="w-1 cursor-ew-resize bg-custom-border hover:bg-fm-medium-grey transition-colors absolute left-0 top-0 h-full" />
          }
          onResize={(e, direction, ref, d) => {
            const newWidth = width + d.width;
            handleResize(newWidth);
          }}
        >
          <motion.div
            key="enhanced-ai-panel"
            initial={{ x: width, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: width, opacity: 0 }}
            transition={{ type: "spring", stiffness: 260, damping: 25 }}
            className="h-full flex flex-col bg-custom-box border-l border-custom-border shadow-lg w-full"
          >
            {/* Enhanced Header */}
            <div className="flex items-center justify-between border-b border-custom-border bg-header-bg px-4 py-3">
              <Tabs defaultValue="chat" className="w-full flex flex-col flex-1">
                <div className="flex items-center justify-between">
                  <TabsList className="flex gap-2 bg-transparent border-none shadow-none">
                    <TabsTrigger
                      value="chat"
                      className="flex items-center gap-2 text-sm text-fm-light-grey data-[state=active]:text-fm-off-white data-[state=active]:font-semibold data-[state=active]:bg-custom-bg px-3 py-2 rounded-md"
                    >
                      <MessageSquare className="w-4 h-4" />
                      Chat
                    </TabsTrigger>
                    <TabsTrigger
                      value="rfp"
                      className="flex items-center gap-2 text-sm text-fm-light-grey data-[state=active]:text-fm-off-white data-[state=active]:font-semibold data-[state=active]:bg-custom-bg px-3 py-2 rounded-md"
                    >
                      <Target className="w-4 h-4" />
                      RFP Intel
                    </TabsTrigger>
                    <TabsTrigger
                      value="tools"
                      className="flex items-center gap-2 text-sm text-fm-light-grey data-[state=active]:text-fm-off-white data-[state=active]:font-semibold data-[state=active]:bg-custom-bg px-3 py-2 rounded-md"
                    >
                      <Database className="w-4 h-4" />
                      Tools
                    </TabsTrigger>
                  </TabsList>

                  <Button
                    variant="ghost"
                    size="icon"
                    className="hover:bg-custom-bg text-fm-light-grey hover:text-fm-off-white"
                    onClick={() => setIsOpen(false)}
                  >
                    <X className="w-4 h-4" />
                  </Button>
                </div>

                {/* Chat Tab - Enhanced CopilotKit */}
                <TabsContent value="chat" className="flex-1 flex flex-col mt-0">
                  <div className="flex-1 flex flex-col">
                    <CopilotSidebar
                      labels={{
                        title: "Sports Intelligence Assistant",
                        initial: "Hi! 👋 I'm your Sports Intelligence AI. I can help you analyze sports entities, find business opportunities, and identify key decision makers. How can I assist you today?",
                        placeholder: "Ask about sports clubs, business opportunities, or decision makers..."
                      }}
                      instructions="You are a Sports Intelligence AI assistant powered by Claude Agent SDK with access to powerful MCP tools:

🔍 **Database Tools:**
- Neo4j database with 3,325+ sports entities (clubs, players, competitions, relationships)
- Execute Cypher queries for complex sports data analysis

🌐 **Real-time Intelligence:**
- BrightData web scraping for current sports news and market information
- Perplexity AI search for up-to-date insights and analysis

🎯 **RFP Intelligence Integration:**
- Access to current RFP Intelligence Dashboard state
- View selected RFP opportunities, fit scores, and analysis results
- Select specific RFP alerts by company name
- Open email compose for outreach to selected opportunities

📊 **Capabilities:**
- Search and analyze sports clubs, players, competitions
- Identify business opportunities and decision makers
- Analyze RFP opportunities and draft outreach emails
- Interact with the RFP Intelligence Dashboard

**RFP Commands:**
- "Select the Leicester City FC RFP opportunity"
- "Show me the highest fit score RFP"
- "Open email for the selected RFP"
- "Analyze the Manchester United procurement opportunity"
- "Select RFP for [Company Name]"
- "Which RFP has the best fit score?"

**Current RFP Opportunities Available:**
- Manchester United FC (87% fit, £500K-£1M, CTO)
- Twickenham Stadium (72% fit, £250K-£500K, Head of Digital)
- Leicester City FC (currently analyzing, Digital Director)

I can automatically use these tools when you ask questions about sports entities, need current information, or want detailed analysis. Just ask naturally!"
                      context={{
                        ...context,
                        userId: userId || contextUserId,
                        projectType: 'sports intelligence',
                        userRole: 'analyst'
                      }}
                      className="flex-1"
                      defaultOpen={true}
                      suggestions="auto"
                      onInProgress={(inProgress) => {
                        console.log('Enhanced CopilotKit chat in progress:', inProgress);
                        if (inProgress) {
                          setIsProcessing(true);
                          setStatusMessage("Processing your request...");
                        }
                      }}
                      onSubmitMessage={async (message) => {
                        console.log('Enhanced CopilotKit submitting message:', message);
                        setStatusMessage("Analyzing your request...");
                        setCurrentTool("mcp__perplexity-mcp__chat_completion");
                      }}
                      onThumbsUp={(message) => {
                        console.log('Enhanced CopilotKit thumbs up:', message);
                        setStatusMessage("Thanks for your feedback!");
                      }}
                      onThumbsDown={(message) => {
                        console.log('Enhanced CopilotKit thumbs down:', message);
                        setStatusMessage("I'll improve based on your feedback.");
                      }}
                    />
                  </div>
                </TabsContent>

                {/* RFP Intelligence Tab */}
                <TabsContent value="rfp" className="flex-1 flex flex-col mt-0">
                  <ScrollArea className="flex-1 p-4">
                    <div className="space-y-4">
                      <div className="flex items-center gap-2 mb-4">
                        <Target className="w-5 h-5 text-fm-yellow" />
                        <h3 className="font-subheader text-fm-off-white">RFP Opportunities</h3>
                        <Badge variant="outline" className="border-fm-yellow text-fm-yellow">
                          {mockRFPAlerts.length} Active
                        </Badge>
                      </div>
                      
                      {mockRFPAlerts.map((alert) => (
                        <Card key={alert.id} className="bg-header-bg border-custom-border">
                          <CardHeader className="pb-3">
                            <div className="flex items-start justify-between">
                              <div className="flex-1">
                                <CardTitle className="text-fm-off-white text-base mb-1">
                                  {alert.company}
                                </CardTitle>
                                <p className="text-fm-medium-grey text-sm">
                                  {alert.description}
                                </p>
                              </div>
                              <Badge 
                                variant={alert.status === 'hot' ? 'default' : 'secondary'}
                                className={alert.status === 'hot' ? 'bg-fm-green text-custom-bg' : 'border-fm-medium-grey text-fm-medium-grey'}
                              >
                                {alert.status}
                              </Badge>
                            </div>
                          </CardHeader>
                          <CardContent className="pt-0">
                            <div className="grid grid-cols-2 gap-4 text-sm">
                              <div>
                                <span className="text-fm-meta">Contact:</span>
                                <p className="text-fm-light-grey">{alert.author}</p>
                                <p className="text-fm-medium-grey">{alert.role}</p>
                              </div>
                              <div>
                                <span className="text-fm-meta">Details:</span>
                                {alert.fit_score && (
                                  <p className="text-fm-light-grey">Fit: {alert.fit_score}%</p>
                                )}
                                <p className="text-fm-light-grey">Value: {alert.estimated_value}</p>
                                <p className="text-fm-light-grey flex items-center gap-1">
                                  <Clock className="w-3 h-3" />
                                  {alert.deadline}
                                </p>
                              </div>
                            </div>
                            <div className="flex gap-2 mt-3">
                              <Button size="sm" className="bg-fm-green hover:bg-fm-green/80 text-custom-bg">
                                <Mail className="w-3 h-3 mr-1" />
                                Compose Email
                              </Button>
                              <Button size="sm" variant="outline" className="border-custom-border text-fm-light-grey hover:bg-custom-bg">
                                <Search className="w-3 h-3 mr-1" />
                                Research
                              </Button>
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  </ScrollArea>
                </TabsContent>

                {/* Tools Status Tab */}
                <TabsContent value="tools" className="flex-1 flex flex-col mt-0">
                  <div className="p-4 space-y-4">
                    <div className="flex items-center gap-2 mb-4">
                      <Database className="w-5 h-5 text-fm-yellow" />
                      <h3 className="font-subheader text-fm-off-white">Tool Status</h3>
                    </div>
                    
                    <Card className="bg-header-bg border-custom-border">
                      <CardContent className="p-4">
                        <div className="space-y-3">
                          <div className="flex items-center justify-between">
                            <span className="text-fm-light-grey">Neo4j Database</span>
                            <div className="flex items-center gap-2">
                              <CheckCircle className="w-4 h-4 text-fm-green" />
                              <span className="text-fm-green text-sm">Connected</span>
                            </div>
                          </div>
                          <Separator className="bg-custom-border" />
                          <div className="flex items-center justify-between">
                            <span className="text-fm-light-grey">BrightData Scraper</span>
                            <div className="flex items-center gap-2">
                              <CheckCircle className="w-4 h-4 text-fm-green" />
                              <span className="text-fm-green text-sm">Ready</span>
                            </div>
                          </div>
                          <Separator className="bg-custom-border" />
                          <div className="flex items-center justify-between">
                            <span className="text-fm-light-grey">Perplexity AI</span>
                            <div className="flex items-center gap-2">
                              <CheckCircle className="w-4 h-4 text-fm-green" />
                              <span className="text-fm-green text-sm">Available</span>
                            </div>
                          </div>
                          <Separator className="bg-custom-border" />
                          <div className="flex items-center justify-between">
                            <span className="text-fm-light-grey">Claude Agent SDK</span>
                            <div className="flex items-center gap-2">
                              <Loader2 className="w-4 h-4 text-fm-yellow animate-spin" />
                              <span className="text-fm-yellow text-sm">Processing</span>
                            </div>
                          </div>
                        </div>
                      </CardContent>
                    </Card>

                    <Card className="bg-header-bg border-custom-border">
                      <CardContent className="p-4">
                        <h4 className="font-subheader text-fm-off-white mb-3">Performance Metrics</h4>
                        <div className="space-y-2 text-sm">
                          <div className="flex justify-between">
                            <span className="text-fm-medium-grey">Entities Analyzed</span>
                            <span className="text-fm-light-grey">3,325+</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-fm-medium-grey">Queries Today</span>
                            <span className="text-fm-light-grey">47</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-fm-medium-grey">Response Time</span>
                            <span className="text-fm-green">1.2s avg</span>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  </div>
                </TabsContent>
              </Tabs>
            </div>

            {/* Enhanced Dynamic Status */}
            <DynamicStatus 
              currentTool={currentTool}
              isLoading={isProcessing}
              statusMessage={statusMessage}
            />
          </motion.div>
        </ResizableBox>
      )}

      {!isOpen && (
        <motion.button
          key="enhanced-ai-button"
          initial={{ x: 100, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          exit={{ x: 100, opacity: 0 }}
          transition={{ type: "spring", stiffness: 260, damping: 20 }}
          className="fixed right-6 bottom-6 bg-fm-green hover:bg-fm-green/80 text-custom-bg rounded-full p-4 shadow-lg transform hover:scale-105 transition-all duration-200 z-40"
          onClick={() => setIsOpen(true)}
        >
          <MessageSquare className="w-6 h-6" />
        </motion.button>
      )}
    </AnimatePresence>
  );
}