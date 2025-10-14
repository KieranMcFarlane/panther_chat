'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { CopilotSidebar } from '@copilotkit/react-ui';
import { useCopilotChat, useCopilotAction } from '@copilotkit/react-core';
import { useUser } from '@/contexts/UserContext';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  MessageSquare, 
  X, 
  Target, 
  Database, 
  Search, 
  Mail,
  Clock,
  CheckCircle,
  Loader2,
  Brain,
  Zap,
  Send,
  ThumbsUp,
  ThumbsDown
} from 'lucide-react';

// ASCII flower frames for Claude-style animation
const flowerFrames = ["(·)", "(•)", "(✿)", "(🌸)", "(✿)", "(•)", "(·)"];

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

// Mock RFP data
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
      
      if (counter % 5 === 0) {
        let newVerb: string;
        
        if (currentTool && toolActionMap[currentTool]) {
          const toolVerbs = toolActionMap[currentTool];
          newVerb = toolVerbs[Math.floor(Math.random() * toolVerbs.length)];
        } else {
          const random = Math.floor(Math.random() * actionVerbs.length);
          newVerb = actionVerbs[random];
        }
        
        setVerb(newVerb);
        
        if (currentTool) {
          setPhase('tool');
        } else {
          setPhase(Math.random() > 0.5 ? 'thinking' : 'generating');
        }
      }
    }, 500);

    return () => clearInterval(interval);
  }, [counter, currentTool, isLoading]);

  useEffect(() => {
    if (phase === 'thinking' && isLoading) {
      const interval = setInterval(() => setFlowerFrame(f => (f + 1) % flowerFrames.length), 200);
      return () => clearInterval(interval);
    }
  }, [phase, isLoading]);

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
      className="flex flex-col items-center space-y-2 px-4 py-3 bg-gray-50 border-t border-gray-200"
    >
      <div className="flex items-center gap-2">
        <motion.div
          animate={{ opacity: [0.6, 1, 0.6] }}
          transition={{ repeat: Infinity, duration: 1.5 }}
          className="text-xs font-mono text-gray-500"
        >
          {getDisplay()}
        </motion.div>
        {phase === 'tool' && <Zap className="w-3 h-3 text-yellow-500" />}
        {phase === 'thinking' && <Brain className="w-3 h-3 text-green-500" />}
      </div>
      
      {currentStatus && (
        <div className="text-xs text-gray-600 text-center max-w-xs">
          {currentStatus}
        </div>
      )}
      
      {displayTool && !currentStatus && (
        <div className="text-xs text-gray-600 text-center max-w-xs">
          Using <span className="font-medium text-blue-600">{displayTool}</span>
        </div>
      )}
    </motion.div>
  );
}

interface StyledCopilotSidebarProps {
  className?: string;
  instructions?: string;
  context?: any;
}

export default function StyledCopilotSidebar({
  className = "",
  instructions,
  context = {}
}: StyledCopilotSidebarProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [activeTab, setActiveTab] = useState('chat');
  const [currentTool, setCurrentTool] = useState<string>("");
  const [isProcessing, setIsProcessing] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string>("");
  const [messageInput, setMessageInput] = useState("");
  
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

  // CopilotActions
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

  const handleSubmit = async () => {
    if (!messageInput.trim()) return;
    
    try {
      setStatusMessage("Processing your request...");
      setCurrentTool("mcp__perplexity-mcp__chat_completion");
      
      await appendMessage({
        content: messageInput,
        role: "user"
      });
      
      setMessageInput("");
    } catch (error) {
      console.error("Error sending message:", error);
      setStatusMessage("Error sending message");
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const defaultInstructions = instructions || `You are a Sports Intelligence AI assistant powered by Claude Agent SDK with access to powerful MCP tools:

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

**Current RFP Opportunities Available:**
- Manchester United FC (87% fit, £500K-£1M, CTO)
- Twickenham Stadium (72% fit, £250K-£500K, Head of Digital)
- Leicester City FC (currently analyzing, Digital Director)

I can automatically use these tools when you ask questions about sports entities, need current information, or want detailed analysis. Just ask naturally!`;

  return (
    <>
      {/* Floating Action Button */}
      {!isOpen && (
        <motion.button
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          whileHover={{ scale: 1.1 }}
          whileTap={{ scale: 0.9 }}
          onClick={() => setIsOpen(true)}
          className="fixed bottom-6 right-6 bg-blue-600 hover:bg-blue-700 text-white rounded-full w-14 h-14 flex items-center justify-center shadow-lg z-50"
        >
          <MessageSquare className="w-6 h-6" />
        </motion.button>
      )}

      {/* Sidebar */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ x: 400, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: 400, opacity: 0 }}
            transition={{ type: "spring", stiffness: 260, damping: 25 }}
            className="fixed right-0 top-0 h-full w-96 bg-white shadow-2xl z-40 flex flex-col"
          >
            {/* Header */}
            <div className="bg-blue-600 text-white p-4 flex justify-between items-center">
              <div>
                <h3 className="font-semibold text-lg">Sports Intelligence</h3>
                <p className="text-sm opacity-90">Real-time AI Analysis</p>
              </div>
              <button 
                onClick={() => setIsOpen(false)}
                className="text-white hover:bg-blue-700 rounded p-1 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Tabs */}
            <div className="bg-gray-100 border-b">
              <div className="flex">
                <button
                  onClick={() => setActiveTab('chat')}
                  className={`flex-1 px-4 py-2 text-sm font-medium transition-colors ${
                    activeTab === 'chat' 
                      ? 'bg-white text-blue-600 border-b-2 border-blue-600' 
                      : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  Chat
                </button>
                <button
                  onClick={() => setActiveTab('rfp')}
                  className={`flex-1 px-4 py-2 text-sm font-medium transition-colors ${
                    activeTab === 'rfp' 
                      ? 'bg-white text-blue-600 border-b-2 border-blue-600' 
                      : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  RFP Intel
                </button>
                <button
                  onClick={() => setActiveTab('tools')}
                  className={`flex-1 px-4 py-2 text-sm font-medium transition-colors ${
                    activeTab === 'tools' 
                      ? 'bg-white text-blue-600 border-b-2 border-blue-600' 
                      : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  Tools
                </button>
              </div>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto">
              {/* Chat Tab */}
              {activeTab === 'chat' && (
                <div className="p-4 space-y-4">
                  {/* Welcome Message */}
                  <div className="text-center text-gray-500 py-8">
                    <div className="mb-4">
                      <MessageSquare className="w-12 h-12 mx-auto text-blue-600" />
                    </div>
                    <h4 className="font-semibold mb-2">Sports Intelligence Assistant</h4>
                    <p className="text-sm">
                      I can help you analyze sports entities and provide real-time insights.
                    </p>
                  </div>

                  {/* Messages */}
                  <div className="space-y-3">
                    {visibleMessages.map((message, index) => (
                      <div
                        key={index}
                        className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
                      >
                        <div
                          className={`max-w-[80%] rounded-lg px-3 py-2 ${
                            message.role === 'user'
                              ? 'bg-blue-600 text-white'
                              : 'bg-gray-100 text-gray-900'
                          }`}
                        >
                          <p className="text-sm">{message.content}</p>
                        </div>
                      </div>
                    ))}
                    {isLoading && (
                      <div className="flex justify-start">
                        <div className="bg-gray-100 text-gray-900 rounded-lg px-3 py-2">
                          <p className="text-sm">Thinking...</p>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* RFP Intel Tab */}
              {activeTab === 'rfp' && (
                <ScrollArea className="p-4">
                  <div className="space-y-4">
                    <h4 className="font-semibold text-gray-900 mb-3">Active RFP Opportunities</h4>
                    {mockRFPAlerts.map((alert) => (
                      <Card key={alert.id} className="border-gray-200">
                        <CardContent className="p-4">
                          <div className="flex items-start justify-between mb-2">
                            <h5 className="font-semibold text-gray-900">{alert.company}</h5>
                            <Badge 
                              variant={alert.status === 'hot' ? 'default' : 'secondary'}
                              className={alert.status === 'hot' ? 'bg-red-100 text-red-800' : 'bg-yellow-100 text-yellow-800'}
                            >
                              {alert.status}
                            </Badge>
                          </div>
                          <p className="text-sm text-gray-600 mb-3">{alert.description}</p>
                          <div className="grid grid-cols-2 gap-2 text-xs text-gray-500">
                            <div>
                              <span className="font-medium">Contact:</span>
                              <p>{alert.author}</p>
                              <p>{alert.role}</p>
                            </div>
                            <div>
                              <span className="font-medium">Details:</span>
                              {alert.fit_score && <p>Fit: {alert.fit_score}%</p>}
                              <p>Value: {alert.estimated_value}</p>
                              <p className="flex items-center gap-1">
                                <Clock className="w-3 h-3" />
                                {alert.deadline}
                              </p>
                            </div>
                          </div>
                          <div className="flex gap-2 mt-3">
                            <Button size="sm" className="bg-blue-600 hover:bg-blue-700 text-white">
                              <Mail className="w-3 h-3 mr-1" />
                              Email
                            </Button>
                            <Button size="sm" variant="outline" className="border-gray-300">
                              <Search className="w-3 h-3 mr-1" />
                              Research
                            </Button>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </ScrollArea>
              )}

              {/* Tools Tab */}
              {activeTab === 'tools' && (
                <div className="p-4 space-y-4">
                  <h4 className="font-semibold text-gray-900 mb-3">Tool Status</h4>
                  <div className="space-y-3">
                    <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                      <span className="text-gray-700">Neo4j Database</span>
                      <div className="flex items-center gap-2">
                        <CheckCircle className="w-4 h-4 text-green-500" />
                        <span className="text-sm text-green-600">Connected</span>
                      </div>
                    </div>
                    <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                      <span className="text-gray-700">BrightData Scraper</span>
                      <div className="flex items-center gap-2">
                        <CheckCircle className="w-4 h-4 text-green-500" />
                        <span className="text-sm text-green-600">Ready</span>
                      </div>
                    </div>
                    <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                      <span className="text-gray-700">Perplexity AI</span>
                      <div className="flex items-center gap-2">
                        <CheckCircle className="w-4 h-4 text-green-500" />
                        <span className="text-sm text-green-600">Available</span>
                      </div>
                    </div>
                    <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                      <span className="text-gray-700">Claude Agent SDK</span>
                      <div className="flex items-center gap-2">
                        <Loader2 className="w-4 h-4 text-yellow-500 animate-spin" />
                        <span className="text-sm text-yellow-600">Processing</span>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Dynamic Status */}
            <DynamicStatus 
              currentTool={currentTool}
              isLoading={isProcessing}
              statusMessage={statusMessage}
            />

            {/* Input Area */}
            <div className="border-t p-4">
              <div className="flex space-x-2">
                <Input
                  placeholder="Ask about sports entities, business opportunities, or market intelligence..."
                  value={messageInput}
                  onChange={(e) => setMessageInput(e.target.value)}
                  onKeyPress={handleKeyPress}
                  className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
                <Button
                  onClick={handleSubmit}
                  disabled={!messageInput.trim() || isLoading}
                  className="bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white px-4 py-2 rounded-lg transition-colors"
                >
                  <Send className="w-5 h-5" />
                </Button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}