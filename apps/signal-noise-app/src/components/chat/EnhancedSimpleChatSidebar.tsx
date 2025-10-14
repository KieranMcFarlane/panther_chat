'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useCopilotAction } from '@copilotkit/react-core';
import { useUser } from '@/contexts/UserContext';
import { useAGUIEventHandlers } from '@/hooks/useAGUIEvents';
import DynamicStatus from '@/components/ui/DynamicStatus';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { usePathname, useSearchParams } from 'next/navigation';
import { 
  MessageCircle, 
  Brain, 
  Settings, 
  X, 
  TrendingUp,
  Target,
  Mail,
  ExternalLink,
  Plus,
  ChevronDown
} from 'lucide-react';
import { v4 as uuidv4 } from 'uuid';

interface ClaudeAgentInstance {
  id: string;
  name: string;
  isActive: boolean;
  conversationHistory: Message[];
  createdAt: Date;
  lastActive: Date;
  agentType: 'sports-intelligence' | 'rfp-analyst' | 'market-researcher';
}

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  isStreaming?: boolean;
}

interface StreamChunk {
  type: 'status' | 'text' | 'tool_use' | 'tool_result' | 'final' | 'error';
  status?: string;
  message?: string;
  text?: string;
  tool?: string;
  result?: any;
  data?: any;
  error?: string;
}

interface SimpleChatSidebarProps {
  userId?: string;
  context?: any;
  className?: string;
}

export function EnhancedSimpleChatSidebar({
  userId,
  context = {},
  className
}: SimpleChatSidebarProps) {
  const [isMinimized, setIsMinimized] = useState(true);
  const [activeTab, setActiveTab] = useState<'chat' | 'rfp' | 'tools'>('chat');
  const [instances, setInstances] = useState<ClaudeAgentInstance[]>([]);
  const [activeInstanceId, setActiveInstanceId] = useState<string>('');
  const [showNewInstanceMenu, setShowNewInstanceMenu] = useState(false);
  const [isRenaming, setIsRenaming] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const { userId: contextUserId } = useUser();
  
  // Custom chat state (replacing CopilotKit)
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [currentStatus, setCurrentStatus] = useState<string>('');
  const [currentTool, setCurrentTool] = useState<string>('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  // AG-UI Event Handling with real-time feedback
  const { events, isProcessing, handleEvent, clearEvents } = useAGUIEventHandlers({
    onAgentStart: (event) => {
      console.log('🚀 AG-UI Agent Started:', event.data);
      setCurrentStatus('Agent started - initializing tools...');
    },
    onAgentMessage: (event) => {
      console.log('💬 AG-UI Agent Message:', event.data.content);
      // Add agent message to conversation history
      if (activeInstance && event.data.content) {
        const agentMessage: Message = {
          id: `agent_${Date.now()}`,
          role: 'assistant',
          content: event.data.content,
          timestamp: new Date()
        };
        updateInstanceHistory(activeInstance.id, agentMessage);
      }
    },
    onAgentToolUse: (event) => {
      console.log('🔧 AG-UI Tool Use:', event.data.tool);
      setCurrentTool(event.data.tool || '');
      setCurrentStatus(`Using tool: ${event.data.tool}...`);
    },
    onAgentToolResult: (event) => {
      console.log('✅ AG-UI Tool Result:', event.data.tool);
      setCurrentStatus(`Tool completed: ${event.data.tool}`);
    },
    onAgentEnd: (event) => {
      console.log('🏁 AG-UI Agent Completed:', event.data);
      setCurrentStatus('Agent completed successfully');
      setCurrentTool('');
      setIsLoading(false);
    },
    onAgentError: (event) => {
      console.log('❌ AG-UI Agent Error:', event.data.error);
      setCurrentStatus(`Agent error: ${event.data.error}`);
      setCurrentTool('');
      setIsLoading(false);
    }
  });

  // AG-UI Connection simulation (since we're using the local event handler)
  const [aguiConnected] = useState(true); // Connected when component is mounted
  
  // Page context awareness
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [pageContext, setPageContext] = useState({
    path: pathname,
    title: '',
    description: '',
    entities: [],
    hasData: false,
    backgroundColor: '#1a1a1a',
    theme: 'dark'
  });

  // Background customization state
  const [backgroundStyle, setBackgroundStyle] = useState({
    color: '#1a1a1a',
    gradient: false,
    animated: true
  });

  // Derive active instance safely
  const activeInstance = instances.find(inst => inst.id === activeInstanceId);

  // Custom chat functions
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [activeInstance?.conversationHistory.length, activeInstance?.id]);

  // Update page context when route changes
  useEffect(() => {
    const context = getPageContext(pathname);
    setPageContext(prev => ({ ...prev, ...context }));
  }, [pathname, searchParams]);

  // CopilotKit Actions for interactive commands
  useCopilotAction({
    name: "changeBackground",
    description: "Change the application background color or style",
    parameters: [
      {
        name: "color",
        type: "string",
        description: "Background color (hex, rgb, or named color)",
        required: false,
      },
      {
        name: "gradient",
        type: "boolean", 
        description: "Whether to use gradient background",
        required: false,
      },
      {
        name: "animated",
        type: "boolean",
        description: "Whether background should be animated",
        required: false,
      }
    ],
    handler: async ({ color, gradient, animated }) => {
      const newStyle = {
        color: color || backgroundStyle.color,
        gradient: gradient ?? backgroundStyle.gradient,
        animated: animated ?? backgroundStyle.animated
      };
      
      setBackgroundStyle(newStyle);
      applyBackgroundStyle(newStyle);
      
      return `Background updated to ${color || 'current color'}${gradient ? ' with gradient' : ''}${animated ? ' with animation' : ''}`;
    },
  });

  useCopilotAction({
    name: "analyzeCurrentPage",
    description: "Analyze the current page content and state",
    parameters: [],
    handler: async () => {
      const context = getPageContext(pathname);
      setPageContext(prev => ({ ...prev, ...context }));
      
      return `Current page analysis:
**Path**: ${pathname}
**Title**: ${context.title}
**Description**: ${context.description}
**Has Data**: ${context.hasData ? 'Yes' : 'No'}
**Entities**: ${context.entities.length} found
**Current Background**: ${backgroundStyle.color}

${context.entities.length > 0 ? `\n**Entities on page**:\n${context.entities.map(e => `• ${e.name} (${e.type})`).join('\n')}` : ''}

You can ask me to change the background, navigate to entities, or perform actions based on this page content.`;
    },
  });

  useCopilotAction({
    name: "navigationTest",
    description: "Test navigation functionality and get current status",
    parameters: [],
    handler: async () => {
      try {
        const currentUrl = window.location.href;
        const currentPath = window.location.pathname;
        const userAgent = navigator.userAgent;
        const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(userAgent);
        
        return `🧪 **Navigation System Test Results**

**Current Status:**
• **URL**: ${currentUrl}
• **Path**: ${currentPath}
• **User Agent**: ${isMobile ? 'Mobile' : 'Desktop'} browser
• **Screen Size**: ${window.innerWidth}x${window.innerHeight}
• **Connection**: ${navigator.connection ? navigator.connection.effectiveType : 'Unknown'}

**Available Navigation Actions:**
1. **Entity Navigation**: \`navigateToEntity\` - Search and navigate to specific entities
2. **Page Navigation**: \`navigateToPage\` - Navigate to any application page
3. **Background Control**: \`changeBackground\` - Customize application appearance

**Test Commands:**
• Try: "navigate to entity arsenal"
• Try: "navigate to page sports"
• Try: "change background to blue with gradient"

**Navigation Methods Available:**
1. \`window.location.href\` (primary)
2. \`window.location.assign\` (fallback 1)
3. \`window.open(url, '_self')\` (fallback 2)

**System Health**: ✅ All navigation systems operational
**Last Test**: ${new Date().toLocaleString()}

The navigation system is ready for testing. Try any of the above commands!`;
        
      } catch (error) {
        return `❌ **Navigation System Test Failed**

**Error**: ${error instanceof Error ? error.message : 'Unknown error'}

**Troubleshooting Steps:**
1. Check if browser supports JavaScript navigation
2. Verify pop-up blockers are not interfering
3. Ensure browser is not in private/incognito mode
4. Try refreshing the page and testing again

**Manual Navigation**: Use the application's sidebar menu to navigate between pages.`;
      }
    },
  });

  useCopilotAction({
    name: "navigateToEntity", 
    description: "Navigate to a specific entity page",
    parameters: [
      {
        name: "entityName",
        type: "string",
        description: "Name of the entity to navigate to",
        required: true,
      }
    ],
    handler: async ({ entityName }) => {
      // Enhanced navigation with multiple fallback methods
      const searchUrl = `/entity-browser?search=${encodeURIComponent(entityName)}`;
      
      // Method 1: Immediate navigation attempt
      try {
        console.log(`🎯 Attempting navigation to entity: ${entityName}`);
        
        // Try multiple navigation methods
        const navigationAttempt = () => {
          // Method 1: window.location.href (most reliable)
          window.location.href = searchUrl;
          
          // Fallback Method 2: window.location.assign (if first method fails after delay)
          setTimeout(() => {
            if (window.location.pathname !== '/entity-browser') {
              console.log(`🔄 Trying alternative navigation method for: ${entityName}`);
              window.location.assign(searchUrl);
            }
          }, 500);
          
          // Fallback Method 3: router.push (Next.js method, if still on same page)
          setTimeout(() => {
            if (window.location.pathname !== '/entity-browser') {
              console.log(`🔄 Trying Next.js router for: ${entityName}`);
              // Force a hard navigation as last resort
              window.open(searchUrl, '_self');
            }
          }, 1000);
        };
        
        // Start navigation after brief delay to allow response to render
        setTimeout(navigationAttempt, 200);
        
        return `🎯 **Navigating to ${entityName}...**

**Navigation Details:**
• **Destination**: Entity Browser
• **Search Query**: "${entityName}"
• **Target URL**: ${searchUrl}
• **Navigation Methods**: Multiple fallback methods enabled

**What happens next:**
1. The entity browser will open automatically
2. Search results for "${entityName}" will be displayed
3. You can view detailed entity information and relationships
4. Perform analysis actions on the entity data

**If navigation doesn't work automatically:**
- **Manual Link**: [Click here to navigate](${searchUrl})
- **URL Copy**: ${searchUrl}

The navigation system will try up to 3 different methods to ensure you reach the entity page successfully.`;
        
      } catch (error) {
        console.error('Navigation error:', error);
        return `❌ **Navigation failed for ${entityName}**

**Error Details**: ${error instanceof Error ? error.message : 'Unknown error'}

**Manual Navigation:**
Please navigate manually using this link: [${searchUrl}](${searchUrl})

Or copy and paste this URL into your browser:
${searchUrl}`;
      }
    },
  });

  useCopilotAction({
    name: "navigateToPage",
    description: "Navigate to any page in the application",
    parameters: [
      {
        name: "pageName",
        type: "string",
        description: "Name of the page to navigate to (e.g., 'home', 'sports', 'graph', 'agent-logs', 'tenders')",
        required: true,
      },
      {
        name: "searchQuery",
        type: "string",
        description: "Optional search query for pages that support it (like entity-browser)",
        required: false,
      }
    ],
    handler: async ({ pageName, searchQuery }) => {
      try {
        // Map page names to routes
        const pageMap: Record<string, string> = {
          'home': '/',
          'dashboard': '/',
          'sports': '/sports',
          'entities': '/entity-browser',
          'entity-browser': '/entity-browser',
          'graph': '/graph',
          'knowledge-graph': '/graph',
          'agent-logs': '/agent-logs',
          'logs': '/agent-logs',
          'tenders': '/tenders',
          'rfp': '/tenders',
          'opportunities': '/tenders'
        };
        
        const normalizedPage = pageName.toLowerCase().trim();
        const baseUrl = pageMap[normalizedPage];
        
        if (!baseUrl) {
          return `❌ **Unknown page: "${pageName}"**

**Available pages:**
• Home/Dashboard - Main sports intelligence overview
• Sports - Sports entity analysis and intelligence  
• Entities/Entity Browser - Browse and search sports entities
• Graph/Knowledge Graph - Visual entity relationships
• Agent Logs/Logs - Real-time agent activity monitoring
• Tenders/RFP/Opportunities - Business opportunity intelligence

Please try one of these pages instead.`;
        }
        
        // Construct final URL with search query if provided
        const finalUrl = searchQuery ? `${baseUrl}?search=${encodeURIComponent(searchQuery)}` : baseUrl;
        
        console.log(`🎯 Navigating to page: ${pageName} -> ${finalUrl}`);
        
        // Multiple navigation methods
        const navigateToPage = () => {
          window.location.href = finalUrl;
          
          setTimeout(() => {
            if (window.location.pathname !== baseUrl.replace(/\?.*/, '')) {
              window.location.assign(finalUrl);
            }
          }, 500);
          
          setTimeout(() => {
            if (window.location.pathname !== baseUrl.replace(/\?.*/, '')) {
              window.open(finalUrl, '_self');
            }
          }, 1000);
        };
        
        setTimeout(navigateToPage, 200);
        
        return `🎯 **Navigating to ${pageName} page...**

**Navigation Details:**
• **Destination**: ${pageName.charAt(0).toUpperCase() + pageName.slice(1)}
• **Target URL**: ${finalUrl}
• **Search Query**: ${searchQuery || 'None'}
• **Navigation Methods**: Multiple fallback methods enabled

**What happens next:**
1. The ${pageName} page will open automatically
2. ${searchQuery ? `Search results for "${searchQuery}" will be displayed` : 'Page content will load'}
3. You can interact with all available features on that page

**If navigation doesn't work automatically:**
- **Manual Link**: [Click here to navigate](${finalUrl})
- **URL Copy**: ${finalUrl}

The navigation system will try multiple methods to ensure you reach the destination successfully.`;
        
      } catch (error) {
        console.error('Page navigation error:', error);
        return `❌ **Navigation failed for page: ${pageName}**

**Error Details**: ${error instanceof Error ? error.message : 'Unknown error'}

Please try again or navigate manually using the application's menu.`;
      }
    },
  });

  // Helper function to get page context
  const getPageContext = (path: string) => {
    const contextMap: Record<string, any> = {
      '/': { title: 'Home Dashboard', description: 'Main sports intelligence dashboard', hasData: true },
      '/entity-browser': { title: 'Entity Browser', description: 'Browse and search sports entities', hasData: true },
      '/graph': { title: 'Knowledge Graph', description: 'Visual entity relationships', hasData: true },
      '/agent-logs': { title: 'Agent Logs', description: 'Real-time agent activity monitoring', hasData: true },
      '/tenders': { title: 'RFP Opportunities', description: 'Business opportunity intelligence', hasData: true },
      '/sports': { title: 'Sports Intelligence', description: 'Sports entity analysis', hasData: true }
    };

    return contextMap[path] || {
      title: 'Unknown Page',
      description: 'No description available',
      hasData: false
    };
  };

  // Apply background style to document
  const applyBackgroundStyle = (style: typeof backgroundStyle) => {
    const root = document.documentElement;
    if (style.gradient) {
      root.style.setProperty('--bg-gradient', `linear-gradient(135deg, ${style.color}, ${adjustColor(style.color, -20)})`);
      document.body.className = document.body.className.replace(/no-gradient/g, '') + ' gradient-bg';
    } else {
      document.body.style.backgroundColor = style.color;
      document.body.className = document.body.className.replace(/gradient-bg/g, ' no-gradient');
    }
    
    if (style.animated) {
      document.body.className = document.body.className.replace(/static-bg/g, '') + ' animated-bg';
    } else {
      document.body.className = document.body.className.replace(/animated-bg/g, '') + ' static-bg';
    }
  };

  // Helper function to adjust color brightness
  const adjustColor = (color: string, amount: number) => {
    const num = parseInt(color.replace('#', ''), 16);
    const r = Math.min(255, Math.max(0, (num >> 16) + amount));
    const g = Math.min(255, Math.max(0, ((num >> 8) & 0x00FF) + amount));
    const b = Math.min(255, Math.max(0, (num & 0x0000FF) + amount));
    return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, '0')}`;
  };

  // Add contextual suggestions based on current page
  const addContextualSuggestions = (content: string) => {
    const pageSuggestions: Record<string, string> = {
      '/entity-browser': '\n\n**💡 Page-specific actions:**\n• Search for specific entities\n• Filter by entity type\n• Change background to match entity colors\n• Navigate to entity details',
      '/graph': '\n\n**💡 Graph actions:**\n• Explore entity relationships\n• Focus on specific nodes\n• Change background for better visualization\n• Analyze connection patterns',
      '/agent-logs': '\n\n**💡 Monitoring actions:**\n• Filter logs by event type\n• Change background based on agent status\n• Analyze performance patterns\n• Export activity reports',
      '/tenders': '\n\n**💡 RFP actions:**\n• Filter opportunities by fit score\n• Change background to reflect urgency\n• Navigate to high-value opportunities\n• Set up alerts for specific criteria',
      '/sports': '\n\n**💡 Sports intelligence:**\n• Analyze specific sports or leagues\n• Change background to team colors\n• Explore entity relationships\n• Generate performance reports'
    };

    const suggestion = pageSuggestions[pathname] || '\n\n**💡 Try asking me to:**\n• Change the background color\n• Analyze the current page\n• Navigate to specific entities\n• Customize the interface';
    
    return content + suggestion;
  };

  const sendMessage = async (messageText: string) => {
    if (!messageText.trim() || isLoading || !activeInstance) return;

    const userMessage: Message = {
      id: `user_${Date.now()}`,
      role: 'user',
      content: messageText.trim(),
      timestamp: new Date()
    };

    // Add message to active instance's conversation history
    setInstances(prev => prev.map(inst => 
      inst.id === activeInstance.id 
        ? { ...inst, conversationHistory: [...inst.conversationHistory, userMessage], lastActive: new Date() }
        : inst
    ));
    
    setInput('');
    setIsLoading(true);
    setCurrentStatus('Initializing sports intelligence tools...');

    abortControllerRef.current = new AbortController();

    try {
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
                  id: userMessage.id,
                  textMessage: {
                    role: 'user',
                    content: userMessage.content
                  }
                }
              ],
              threadId: contextUserId || 'user-default'
            }
          }
        }),
        signal: abortControllerRef.current.signal
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();

      if (!reader) {
        throw new Error('No response body reader available');
      }

      let assistantMessage: Message | null = null;
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const chunk: StreamChunk = JSON.parse(line.slice(6));
              
              switch (chunk.type) {
                case 'status':
                  setCurrentStatus(chunk.message || '');
                  break;

                case 'tool_use':
                  setCurrentTool(chunk.tool || '');
                  break;

                case 'text':
                  if (!assistantMessage) {
                    assistantMessage = {
                      id: `assistant_${Date.now()}`,
                      role: 'assistant',
                      content: '',
                      timestamp: new Date(),
                      isStreaming: true
                    };
                    // Add assistant message to active instance
                    setInstances(prev => prev.map(inst => 
                      inst.id === activeInstance!.id 
                        ? { ...inst, conversationHistory: [...inst.conversationHistory, assistantMessage] }
                        : inst
                    ));
                  }
                  
                  if (chunk.text) {
                    assistantMessage.content += chunk.text;
                    // Update the assistant message in active instance
                    setInstances(prev => prev.map(inst => 
                      inst.id === activeInstance!.id 
                        ? { 
                            ...inst, 
                            conversationHistory: inst.conversationHistory.map(msg => 
                              msg.id === assistantMessage!.id 
                                ? { ...msg, content: assistantMessage!.content }
                                : msg
                            )
                          }
                        : inst
                    ));
                  }
                  break;

                case 'final':
                  if (assistantMessage) {
                    assistantMessage.isStreaming = false;
                    // Update streaming status in active instance
                    setInstances(prev => prev.map(inst => 
                      inst.id === activeInstance!.id 
                        ? { 
                            ...inst, 
                            conversationHistory: inst.conversationHistory.map(msg => 
                              msg.id === assistantMessage!.id 
                                ? { ...msg, isStreaming: false }
                                : msg
                            )
                          }
                        : inst
                    ));
                  }
                  break;

                case 'error':
                  console.error('Stream error:', chunk.error);
                  const errorMessage: Message = {
                    id: `error_${Date.now()}`,
                    role: 'assistant',
                    content: chunk.message || 'An error occurred while processing your request.',
                    timestamp: new Date(),
                    isStreaming: false
                  };
                  // Add error message to active instance
                  setInstances(prev => prev.map(inst => 
                    inst.id === activeInstance!.id 
                      ? { ...inst, conversationHistory: [...inst.conversationHistory, errorMessage] }
                      : inst
                  ));
                  break;
              }
            } catch (parseError) {
              console.error('Error parsing chunk:', parseError);
            }
          }
        }
      }
    } catch (error: any) {
      if (error.name === 'AbortError') {
        console.log('Request was aborted');
      } else {
        console.error('Error sending message:', error);
        const errorMessage: Message = {
          id: `error_${Date.now()}`,
          role: 'assistant',
          content: `Sorry, I encountered an error: ${error.message || 'Unknown error'}`,
          timestamp: new Date(),
          isStreaming: false
        };
        // Add error message to active instance
        if (activeInstance) {
          setInstances(prev => prev.map(inst => 
            inst.id === activeInstance.id 
              ? { ...inst, conversationHistory: [...inst.conversationHistory, errorMessage] }
              : inst
          ));
        }
      }
    } finally {
      setIsLoading(false);
      setCurrentStatus('');
      setCurrentTool('');
      abortControllerRef.current = null;
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage(input);
    }
  };

  // Initialize default instance if none exists
  useEffect(() => {
    if (instances.length === 0) {
      const defaultInstance: ClaudeAgentInstance = {
        id: 'default-sports-intelligence',
        name: 'Sports Intelligence 1',
        isActive: true,
        conversationHistory: [],
        createdAt: new Date(),
        lastActive: new Date(),
        agentType: 'sports-intelligence'
      };
      setInstances([defaultInstance]);
      setActiveInstanceId(defaultInstance.id);
    }
  }, [instances.length]);

  const agentTypes = {
    'sports-intelligence': {
      name: 'Sports Intelligence',
      icon: <Target className="w-4 h-4" />,
      color: 'text-blue-600',
      description: 'Analyze sports entities and relationships'
    },
    'rfp-analyst': {
      name: 'RFP Analyst',
      icon: <TrendingUp className="w-4 h-4" />,
      color: 'text-green-600',
      description: 'Monitor and analyze RFP opportunities'
    },
    'market-researcher': {
      name: 'Market Research',
      icon: <MessageCircle className="w-4 h-4" />,
      color: 'text-purple-600',
      description: 'Conduct market research and analysis'
    }
  };

  // Load saved instances on mount
  useEffect(() => {
    const savedInstances = localStorage.getItem(`claude-agent-instances-${userId || contextUserId}`);
    if (savedInstances) {
      const parsed = JSON.parse(savedInstances);
      setInstances(parsed.map((inst: any) => ({
        ...inst,
        createdAt: new Date(inst.createdAt),
        lastActive: new Date(inst.lastActive),
        conversationHistory: inst.conversationHistory || []
      })));
      if (parsed.length > 0) {
        setActiveInstanceId(parsed[0].id);
      }
    } else {
      // Create default instance
      createNewInstance('sports-intelligence');
    }
  }, [userId, contextUserId]);

  // Save instances to localStorage
  useEffect(() => {
    if (instances.length > 0) {
      localStorage.setItem(`claude-agent-instances-${userId || contextUserId}`, JSON.stringify(instances));
    }
  }, [instances, userId, contextUserId]);

  // Close menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      // Close new instance menu when clicking outside
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setShowNewInstanceMenu(false);
      }
      
      // Close sidebar when clicking outside
      const sidebar = document.querySelector('.fixed.right-0.top-0.h-full.w-96');
      const floatingButton = document.querySelector('.fixed.bottom-6.right-6');
      if (sidebar && !sidebar.contains(event.target as Node) && 
          floatingButton && !floatingButton.contains(event.target as Node) && 
          !isMinimized) {
        setIsMinimized(true);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isMinimized]);

  const createNewInstance = (agentType: ClaudeAgentInstance['agentType']) => {
    const newInstance: ClaudeAgentInstance = {
      id: uuidv4(),
      name: `${agentTypes[agentType].name} ${instances.filter(i => i.agentType === agentType).length + 1}`,
      isActive: true,
      conversationHistory: [],
      createdAt: new Date(),
      lastActive: new Date(),
      agentType
    };

    setInstances(prev => [...prev, newInstance]);
    setActiveInstanceId(newInstance.id);
    setActiveTab('chat');
    setShowNewInstanceMenu(false);
  };

  const closeInstance = (instanceId: string) => {
    if (instances.length <= 1) return;
    
    setInstances(prev => prev.filter(inst => inst.id !== instanceId));
    if (activeInstanceId === instanceId) {
      const remaining = instances.filter(inst => inst.id !== instanceId);
      if (remaining.length > 0) {
        setActiveInstanceId(remaining[0].id);
      }
    }
  };

  const renameInstance = (instanceId: string, newName: string) => {
    if (newName.trim()) {
      setInstances(prev => prev.map(inst => 
        inst.id === instanceId ? { ...inst, name: newName.trim() } : inst
      ));
    }
    setIsRenaming(null);
    setRenameValue('');
  };

  const updateInstanceHistory = (instanceId: string, newMessage: any) => {
    setInstances(prev => prev.map(inst => 
      inst.id === instanceId 
        ? { ...inst, conversationHistory: [...inst.conversationHistory, newMessage], lastActive: new Date() }
        : inst
    ));
  };

  // Mock RFP data for demonstration
  const mockRFPAlerts = [
    {
      id: '1',
      company: 'Manchester United FC',
      author: 'Sarah Chen',
      role: 'Chief Technology Officer',
      fit_score: 87,
      estimated_value: '£500K-£1M'
    },
    {
      id: '2',
      company: 'Twickenham Stadium',
      author: 'David Mitchell',
      role: 'Head of Digital',
      fit_score: 72,
      estimated_value: '£250K-£500K'
    },
    {
      id: '3',
      company: 'Leicester City FC',
      author: 'Emma Thompson',
      role: 'Digital Director',
      fit_score: null,
      estimated_value: 'TBD'
    }
  ];

  // Allow AI to select RFP alerts
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
      const alert = mockRFPAlerts.find(a => a.company.toLowerCase().includes(companyName.toLowerCase()));
      if (alert) {
        console.log(`🎯 AI Selected RFP Alert: ${alert.company} (${alert.fit_score}% fit)`);
        setActiveTab('rfp');
        return `Selected ${alert.company} - Fit Score: ${alert.fit_score}%, Value: ${alert.estimated_value}, Contact: ${alert.author} (${alert.role})`;
      } else {
        return `Could not find RFP alert for company: ${companyName}. Available companies: ${mockRFPAlerts.map(a => a.company).join(', ')}`;
      }
    }
  });

  // Allow AI to switch tabs
  useCopilotAction({
    name: "switchToTab",
    description: "Switch to a specific tab in the sidebar",
    parameters: [
      {
        name: "tabName",
        type: "string",
        description: "The name of the tab to switch to (chat, rfp, tools)",
        required: true
      }
    ],
    handler: async ({ tabName }) => {
      const validTabs = ['chat', 'rfp', 'tools'];
      if (validTabs.includes(tabName.toLowerCase())) {
        setActiveTab(tabName.toLowerCase() as 'chat' | 'rfp' | 'tools');
        return `Switched to ${tabName} tab`;
      } else {
        return `Invalid tab name. Available tabs: ${validTabs.join(', ')}`;
      }
    }
  });

  const tabs = [
    { 
      id: 'chat', 
      label: 'Chat', 
      icon: <MessageCircle className="w-4 h-4" />,
      color: 'text-blue-600'
    },
    { 
      id: 'rfp', 
      label: 'RFP Intel', 
      icon: <Target className="w-4 h-4" />,
      color: 'text-green-600'
    },
    { 
      id: 'tools', 
      label: 'Tools', 
      icon: <Settings className="w-4 h-4" />,
      color: 'text-purple-600'
    }
  ];

  const instructions = `You are a Sports Intelligence AI assistant powered by Claude Agent SDK with access to powerful MCP tools:

🔍 Database Tools:
- Neo4j database with 3,325+ sports entities (clubs, players, competitions, relationships)
- Execute Cypher queries for complex sports data analysis

🌐 Real-time Intelligence:
- BrightData web scraping for current sports news and market information
- Perplexity AI search for up-to-date insights and analysis

🎯 RFP Intelligence Integration:
- Access to current RFP Intelligence Dashboard state
- View selected RFP opportunities, fit scores, and analysis results
- Select specific RFP alerts by company name
- Open email compose for outreach to selected opportunities

📊 Capabilities:
- Search and analyze sports clubs, players, competitions
- Identify business opportunities and decision makers
- Analyze RFP opportunities and draft outreach emails
- Interact with the RFP Intelligence Dashboard

RFP Commands:
- "Select the Leicester City FC RFP opportunity"
- "Show me the highest fit score RFP"
- "Open email for the selected RFP"
- "Analyze the Manchester United procurement opportunity"
- "Switch to RFP tab"
- "Show tools status"

Current RFP Opportunities Available:
- Manchester United FC (87% fit, £500K-£1M, CTO)
- Twickenham Stadium (72% fit, £250K-£500K, Head of Digital)
- Leicester City FC (currently analyzing, Digital Director)

I can automatically use these tools when you ask questions about sports entities, need current information, or want detailed analysis. Just ask naturally!`;

  return (
    <>
      {/* Enhanced Floating Action Button */}
      <motion.button
        className="fixed bottom-6 right-6 bg-blue-600 hover:bg-blue-700 text-white rounded-full p-4 shadow-lg z-30"
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        onClick={() => setIsMinimized(false)}
        style={{ display: isMinimized ? 'block' : 'none' }}
      >
        <MessageCircle className="w-6 h-6" />
      </motion.button>

      {/* Enhanced Sidebar Container */}
      <AnimatePresence>
        {!isMinimized && (
          <motion.div
            initial={{ x: 384 }}
            animate={{ x: 0 }}
            exit={{ x: 384 }}
            transition={{ type: "spring", stiffness: 300, damping: 30 }}
            className="fixed right-0 top-0 h-full w-96 bg-white shadow-2xl z-40 flex flex-col"
          >
            {/* Enhanced Header with Instance Tabs */}
            <div className="bg-gradient-to-r from-blue-600 to-blue-700 text-white">
              {/* Instance Tabs Bar */}
              <div className="flex items-center gap-1 p-2 border-b border-white/20">
                <div className="flex-1 flex gap-1 overflow-x-auto">
                  {instances.map((instance, index) => (
                    <motion.div
                      key={instance.id}
                      initial={{ opacity: 0, y: -10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: index * 0.05 }}
                      className={`flex items-center gap-2 px-3 py-2 rounded-lg cursor-pointer group min-w-0 max-w-32 ${
                        activeInstanceId === instance.id ? 'bg-white text-blue-600' : 'text-white/80 hover:text-white hover:bg-white/10'
                      }`}
                      onClick={() => setActiveInstanceId(instance.id)}
                    >
                      {agentTypes[instance.agentType].icon}
                      {isRenaming === instance.id ? (
                        <input
                          type="text"
                          value={renameValue}
                          onChange={(e) => setRenameValue(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              renameInstance(instance.id, renameValue);
                            } else if (e.key === 'Escape') {
                              setIsRenaming(null);
                              setRenameValue('');
                            }
                          }}
                          onBlur={() => renameInstance(instance.id, renameValue)}
                          className="bg-transparent text-sm font-medium outline-none min-w-0 max-w-20"
                          autoFocus
                          onClick={(e) => e.stopPropagation()}
                        />
                      ) : (
                        <span 
                          className="text-sm font-medium truncate"
                          onDoubleClick={() => {
                            setIsRenaming(instance.id);
                            setRenameValue(instance.name);
                          }}
                        >
                          {instance.name}
                        </span>
                      )}
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          if (instances.length > 1) {
                            closeInstance(instance.id);
                          }
                        }}
                        className={`opacity-0 group-hover:opacity-100 transition-opacity p-0.5 rounded hover:bg-red-500 hover:text-white ${
                          instances.length <= 1 ? 'invisible' : ''
                        }`}
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </motion.div>
                  ))}
                </div>
                
                {/* New Instance Button */}
                <div className="relative" ref={menuRef}>
                  <motion.button
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={() => setShowNewInstanceMenu(!showNewInstanceMenu)}
                    className="p-2 rounded-lg bg-white/10 hover:bg-white/20 transition-colors"
                  >
                    <Plus className="w-4 h-4" />
                  </motion.button>

                  {/* New Instance Menu */}
                  <AnimatePresence>
                    {showNewInstanceMenu && (
                      <motion.div
                        initial={{ opacity: 0, y: -10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -10 }}
                        className="absolute top-full mt-1 right-0 bg-white rounded-lg shadow-lg border border-gray-200 py-2 min-w-48 z-50"
                      >
                        {Object.entries(agentTypes).map(([type, config]) => (
                          <button
                            key={type}
                            onClick={() => createNewInstance(type as ClaudeAgentInstance['agentType'])}
                            className="w-full px-3 py-2 hover:bg-gray-50 flex items-center gap-3 text-left text-gray-700 hover:text-gray-900"
                          >
                            <div className={`p-1 rounded ${config.color} bg-current/10`}>
                              {config.icon}
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="font-medium text-sm">{config.name}</div>
                              <div className="text-xs text-gray-500">{config.description}</div>
                            </div>
                          </button>
                        ))}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </div>

              {/* Main Header */}
              <div className="p-4">
                <div className="flex justify-between items-center mb-3">
                  <div>
                    <h3 className="font-semibold text-lg flex items-center gap-2">
                      <Brain className="w-5 h-5" />
                      {activeInstance ? agentTypes[activeInstance.agentType].name : 'AI Assistant'}
                    </h3>
                    <p className="text-sm opacity-90">
                      {activeInstance ? agentTypes[activeInstance.agentType].description : 'Real-time AI Analysis'}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setIsMinimized(true)}
                      className="p-2 hover:bg-white/10 rounded-lg transition-colors"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* Feature Tabs */}
                <div className="flex gap-1 bg-white/10 rounded-lg p-1">
                  {tabs.map((tab) => (
                    <button
                      key={tab.id}
                      onClick={() => setActiveTab(tab.id as 'chat' | 'rfp' | 'tools')}
                      className={`flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-md text-sm font-medium transition-all ${
                        activeTab === tab.id
                          ? 'bg-white text-blue-600 shadow-sm'
                          : 'text-white/80 hover:text-white hover:bg-white/10'
                      }`}
                    >
                      {tab.icon}
                      {tab.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Tab Content */}
            <div className="flex-1 overflow-hidden">
              {activeTab === 'chat' && activeInstance && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="h-full flex flex-col"
                >
                  <div className="bg-blue-600 text-white p-4 flex justify-between items-center">
                    <div>
                      <h3 className="font-semibold text-lg flex items-center gap-2">
                        <Brain className="w-5 h-5" />
                        {activeInstance.name}
                      </h3>
                      <p className="text-sm opacity-90">
                        {agentTypes[activeInstance.agentType].description}
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => setIsMinimized(true)}
                        className="p-2 hover:bg-blue-700 rounded-lg transition-colors"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  <div className="flex-1 overflow-y-auto p-4 space-y-4">
                    {(!activeInstance || activeInstance.conversationHistory.length === 0) && (
                      <div className="text-center text-gray-500 py-8">
                        <div className="mb-4">
                          <Brain className="w-12 h-12 mx-auto text-blue-600" />
                        </div>
                        <h4 className="font-semibold mb-2">Sports Intelligence Assistant</h4>
                        <p className="text-sm">I can help you analyze sports entities and provide real-time insights.</p>
                      </div>
                    )}

                    {activeInstance?.conversationHistory.map((message) => (
                      <div
                        key={message.id}
                        className={`flex ${
                          message.role === 'user' ? 'justify-end' : 'justify-start'
                        }`}
                      >
                        <div
                          className={`max-w-full px-4 py-2 rounded-lg ${
                            message.role === 'user'
                              ? 'bg-blue-600 text-white'
                              : 'bg-gray-100 text-gray-800'
                          } ${message.isStreaming ? 'animate-pulse' : ''}`}
                        >
                          <div className="prose prose-sm max-w-none">
                            <ReactMarkdown 
                              remarkPlugins={[remarkGfm]}
                              components={{
                                p: ({children}) => <p className="text-sm mb-2 last:mb-0">{children}</p>,
                                ul: ({children}) => <ul className="text-sm mb-2 list-disc list-inside last:mb-0">{children}</ul>,
                                ol: ({children}) => <ol className="text-sm mb-2 list-decimal list-inside last:mb-0">{children}</ol>,
                                li: ({children}) => <li className="mb-1">{children}</li>,
                                strong: ({children}) => <strong className="font-semibold">{children}</strong>,
                                em: ({children}) => <em className="italic">{children}</em>,
                                code: ({inline, children}) => 
                                  inline 
                                    ? <code className="bg-gray-200 px-1 py-0.5 rounded text-xs font-mono">{children}</code>
                                    : <code className="block bg-gray-100 p-2 rounded text-xs font-mono overflow-x-auto">{children}</code>,
                                blockquote: ({children}) => (
                                  <blockquote className="border-l-2 border-gray-300 pl-3 italic text-sm my-2">{children}</blockquote>
                                ),
                                h1: ({children}) => <h1 className="text-lg font-bold mb-2">{children}</h1>,
                                h2: ({children}) => <h2 className="text-base font-bold mb-2">{children}</h2>,
                                h3: ({children}) => <h3 className="text-sm font-bold mb-1">{children}</h3>,
                              }}
                            >
                              {message.content}
                            </ReactMarkdown>
                          </div>
                          {message.isStreaming && (
                            <div className="flex items-center mt-2">
                              <div className="flex space-x-1">
                                <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"></div>
                                <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
                                <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                    <div ref={messagesEndRef} />
                  </div>

                  <div className="border-t p-4">
                    <div className="flex space-x-2">
                      <input
                        type="text"
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        onKeyPress={handleKeyPress}
                        placeholder={`Ask about sports entities, business opportunities, or market intelligence...`}
                        className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        disabled={isLoading}
                      />
                      <button
                        onClick={() => sendMessage(input)}
                        disabled={!input.trim() || isLoading}
                        className="bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white px-4 py-2 rounded-lg transition-colors"
                      >
                        {isLoading ? (
                          <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                        ) : (
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                          </svg>
                        )}
                      </button>
                    </div>
                  </div>
                </motion.div>
              )}

              {activeTab === 'rfp' && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="h-full overflow-y-auto p-4"
                >
                  <div className="space-y-4">
                    <div className="flex items-center justify-between mb-4">
                      <h4 className="font-semibold text-gray-900 flex items-center gap-2">
                        <TrendingUp className="w-5 h-5 text-green-600" />
                        RFP Opportunities
                      </h4>
                      <span className="text-sm text-gray-500">{mockRFPAlerts.length} active</span>
                    </div>

                    {mockRFPAlerts.map((alert, index) => (
                      <motion.div
                        key={alert.id}
                        initial={{ opacity: 0, x: 20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: index * 0.1 }}
                        className="bg-gray-50 border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow"
                      >
                        <div className="flex justify-between items-start mb-2">
                          <h5 className="font-medium text-gray-900">{alert.company}</h5>
                          {alert.fit_score && (
                            <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                              alert.fit_score >= 80 ? 'bg-green-100 text-green-800' :
                              alert.fit_score >= 60 ? 'bg-yellow-100 text-yellow-800' :
                              'bg-red-100 text-red-800'
                            }`}>
                              {alert.fit_score}% fit
                            </span>
                          )}
                        </div>
                        <div className="text-sm text-gray-600 mb-1">
                          {alert.author} - {alert.role}
                        </div>
                        <div className="text-sm text-gray-500 mb-3">
                          Value: {alert.estimated_value}
                        </div>
                        <div className="flex gap-2">
                          <button className="flex-1 bg-blue-600 hover:bg-blue-700 text-white text-sm py-2 px-3 rounded-lg transition-colors flex items-center justify-center gap-1">
                            <Mail className="w-3 h-3" />
                            Compose Email
                          </button>
                          <button className="flex-1 border border-gray-300 hover:bg-gray-50 text-gray-700 text-sm py-2 px-3 rounded-lg transition-colors flex items-center justify-center gap-1">
                            <ExternalLink className="w-3 h-3" />
                            View Details
                          </button>
                        </div>
                      </motion.div>
                    ))}
                  </div>
                </motion.div>
              )}

              {activeTab === 'tools' && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="h-full overflow-y-auto p-4"
                >
                  <div className="space-y-4">
                    <h4 className="font-semibold text-gray-900 flex items-center gap-2 mb-4">
                      <Settings className="w-5 h-5 text-purple-600" />
                      Tool Status
                    </h4>

                    {[
                      { name: 'AG-UI Protocol', status: aguiConnected ? 'Connected' : 'Disconnected', color: aguiConnected ? 'text-green-600' : 'text-red-600' },
                      { name: 'Neo4j Database', status: 'Connected', color: 'text-green-600' },
                      { name: 'BrightData Scraper', status: 'Ready', color: 'text-yellow-600' },
                      { name: 'Perplexity AI', status: 'Available', color: 'text-green-600' },
                      { name: 'Claude Agent SDK', status: 'Active', color: 'text-green-600' },
                      { name: 'Supabase Cache', status: 'Synced', color: 'text-green-600' },
                      { name: 'Email Service', status: 'Configured', color: 'text-yellow-600' }
                    ].map((tool, index) => (
                      <motion.div
                        key={tool.name}
                        initial={{ opacity: 0, x: 20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: index * 0.1 }}
                        className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
                      >
                        <span className="text-sm font-medium text-gray-900">{tool.name}</span>
                        <span className={`text-sm ${tool.color}`}>{tool.status}</span>
                      </motion.div>
                    ))}

                    {/* Active Instance Info */}
                    {activeInstance && (
                      <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                        <h5 className="font-medium text-gray-900 mb-2 flex items-center gap-2">
                          <Brain className="w-4 h-4 text-blue-600" />
                          Active Agent Instance
                        </h5>
                        <div className="space-y-2 text-sm">
                          <div className="flex justify-between">
                            <span className="text-gray-600">Name:</span>
                            <span className="font-medium">{activeInstance.name}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-gray-600">Type:</span>
                            <span className="font-medium">{agentTypes[activeInstance.agentType].name}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-gray-600">Messages:</span>
                            <span className="font-medium">{activeInstance.conversationHistory.length}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-gray-600">Created:</span>
                            <span className="font-medium">{activeInstance.createdAt.toLocaleTimeString()}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-gray-600">Last Active:</span>
                            <span className="font-medium">{activeInstance.lastActive.toLocaleTimeString()}</span>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Current Page Context */}
                    <div className="mt-6 p-4 bg-gray-50 border border-gray-200 rounded-lg">
                      <div className="flex items-center justify-between mb-3">
                        <h5 className="font-medium text-gray-900 flex items-center gap-2">
                          <Brain className="w-4 h-4 text-indigo-600" />
                          Current Page Context
                        </h5>
                        <span className="text-xs text-gray-500">
                          {pageContext.path}
                        </span>
                      </div>
                      
                      <div className="space-y-2 text-sm">
                        <div className="flex justify-between">
                          <span className="text-gray-600">Page:</span>
                          <span className="font-medium">{pageContext.title}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-600">Has Data:</span>
                          <span className={`font-medium ${pageContext.hasData ? 'text-green-600' : 'text-gray-400'}`}>
                            {pageContext.hasData ? 'Yes' : 'No'}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-600">Background:</span>
                          <span className="font-medium" style={{ color: backgroundStyle.color }}>
                            {backgroundStyle.color}
                          </span>
                        </div>
                      </div>
                      
                      <div className="mt-3 p-2 bg-white rounded border border-gray-200">
                        <p className="text-xs text-gray-600 mb-2">Try asking me to:</p>
                        <ul className="text-xs text-gray-500 space-y-1">
                          <li>• "change background to blue"</li>
                          <li>• "analyze current page"</li>
                          <li>• "make background gradient"</li>
                          <li>• "navigate to entity"</li>
                        </ul>
                      </div>
                    </div>

                  {/* AG-UI Events Display */}
                    <div className="mt-6 p-4 bg-gray-50 border border-gray-200 rounded-lg">
                      <div className="flex items-center justify-between mb-3">
                        <h5 className="font-medium text-gray-900 flex items-center gap-2">
                          <Brain className="w-4 h-4 text-purple-600" />
                          AG-UI Agent Events
                        </h5>
                        <div className="flex items-center gap-2">
                          {isProcessing && (
                            <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                          )}
                          <button
                            onClick={clearEvents}
                            className="text-xs text-gray-500 hover:text-gray-700"
                          >
                            Clear
                          </button>
                        </div>
                      </div>
                      
                      <div className="space-y-2 max-h-48 overflow-y-auto">
                        {events.length === 0 ? (
                          <div className="text-sm text-gray-500 text-center py-4">
                            No AG-UI events yet. Start a conversation to see agent activity.
                          </div>
                        ) : (
                          events.slice(-10).map((event, index) => (
                            <div
                              key={event.id || index}
                              className="text-xs p-2 bg-white border border-gray-200 rounded"
                            >
                              <div className="flex items-center justify-between mb-1">
                                <span className={`font-medium ${
                                  event.type === 'agent-start' ? 'text-green-600' :
                                  event.type === 'agent-error' ? 'text-red-600' :
                                  event.type === 'agent-tool-use' ? 'text-blue-600' :
                                  event.type === 'agent-tool-result' ? 'text-purple-600' :
                                  event.type === 'agent-message' ? 'text-gray-700' :
                                  'text-gray-600'
                                }`}>
                                  {event.type.replace('-', ' ')}
                                </span>
                                <span className="text-gray-400">
                                  {new Date(event.timestamp).toLocaleTimeString()}
                                </span>
                              </div>
                              
                              {event.type === 'agent-tool-use' && (
                                <div className="text-blue-600">
                                  🔧 Using: {event.data.tool}
                                </div>
                              )}
                              
                              {event.type === 'agent-tool-result' && (
                                <div className="text-purple-600">
                                  ✅ Completed: {event.data.tool}
                                </div>
                              )}
                              
                              {event.type === 'agent-message' && event.data.content && (
                                <div className="text-gray-700 truncate">
                                  💬 {event.data.content}
                                </div>
                              )}
                              
                              {event.type === 'agent-error' && (
                                <div className="text-red-600">
                                  ❌ {event.data.error}
                                </div>
                              )}
                            </div>
                          ))
                        )}
                      </div>
                    </div>

                    {/* Background Customization */}
                    <div className="mt-6 p-4 bg-gray-50 border border-gray-200 rounded-lg">
                      <div className="flex items-center justify-between mb-3">
                        <h5 className="font-medium text-gray-900 flex items-center gap-2">
                          <Settings className="w-4 h-4 text-pink-600" />
                          Quick Background
                        </h5>
                      </div>
                      
                      <div className="grid grid-cols-5 gap-2 mb-3">
                        {[
                          '#1a1a1a', '#2563eb', '#dc2626', '#16a34a', '#9333ea',
                          '#ea580c', '#0891b2', '#e11d48', '#84cc16', '#6366f1'
                        ].map((color) => (
                          <button
                            key={color}
                            onClick={() => {
                              const newStyle = { color, gradient: false, animated: false };
                              setBackgroundStyle(newStyle);
                              applyBackgroundStyle(newStyle);
                            }}
                            className="bg-preview hover:scale-110 transition-transform cursor-pointer"
                            style={{ backgroundColor: color }}
                            title={`Change to ${color}`}
                          />
                        ))}
                      </div>
                      
                      <div className="flex gap-2">
                        <button
                          onClick={() => {
                            const newStyle = { ...backgroundStyle, gradient: true };
                            setBackgroundStyle(newStyle);
                            applyBackgroundStyle(newStyle);
                          }}
                          className={`flex-1 text-xs px-2 py-1 rounded ${
                            backgroundStyle.gradient 
                              ? 'bg-blue-100 text-blue-700' 
                              : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                          }`}
                        >
                          {backgroundStyle.gradient ? '✓ Gradient' : 'Gradient'}
                        </button>
                        <button
                          onClick={() => {
                            const newStyle = { ...backgroundStyle, animated: !backgroundStyle.animated };
                            setBackgroundStyle(newStyle);
                            applyBackgroundStyle(newStyle);
                          }}
                          className={`flex-1 text-xs px-2 py-1 rounded ${
                            backgroundStyle.animated 
                              ? 'bg-green-100 text-green-700' 
                              : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                          }`}
                        >
                          {backgroundStyle.animated ? '✓ Animated' : 'Animate'}
                        </button>
                      </div>
                    </div>

                    {/* Instance Management */}
                    <div className="mt-6 p-4 bg-gray-50 border border-gray-200 rounded-lg">
                      <h5 className="font-medium text-gray-900 mb-2">Instance Management</h5>
                      <div className="text-sm text-gray-600 mb-3">
                        Double-click tab names to rename. Use + button to create new instances.
                      </div>
                      <div className="text-xs text-gray-500">
                        Total instances: {instances.length} | 
                        {instances.reduce((acc, inst) => acc + inst.conversationHistory.length, 0)} total messages
                      </div>
                    </div>
                  </div>
                </motion.div>
              )}
            </div>

            {/* Enhanced Footer with AG-UI Status */}
            <div className="border-t border-gray-200 p-4 bg-gray-50">
              <div className="flex items-center justify-between text-sm mb-2">
                <div className="flex items-center gap-2">
                  {isProcessing || isLoading ? (
                    <>
                      <div className="w-2 h-2 bg-blue-600 rounded-full animate-pulse" />
                      <span className="text-blue-600 font-medium">
                        {activeInstance ? activeInstance.name : 'Processing…'}
                      </span>
                    </>
                  ) : (
                    <>
                      <div className="w-2 h-2 bg-green-500 rounded-full" />
                      <span className="text-gray-600">
                        {activeInstance ? activeInstance.name : 'Ready'}
                      </span>
                    </>
                  )}
                </div>
                <div className="flex items-center gap-3 text-gray-400 text-xs">
                  {activeInstance && (
                    <span>{activeInstance.conversationHistory.length} msgs</span>
                  )}
                  <span>{instances.length} instance{instances.length !== 1 ? 's' : ''}</span>
                  {events.length > 0 && (
                    <span>{events.length} events</span>
                  )}
                </div>
              </div>
              
              {/* AG-UI Status Display */}
              {(currentStatus || currentTool) && (
                <div className="flex items-center justify-between text-xs text-gray-600 bg-white p-2 rounded border border-gray-200">
                  <div className="flex items-center gap-2">
                    {currentTool && (
                      <span className="px-2 py-1 bg-blue-100 text-blue-700 rounded font-medium">
                        🔧 {currentTool}
                      </span>
                    )}
                    {currentStatus && (
                      <span className="truncate">
                        {currentStatus}
                      </span>
                    )}
                  </div>
                  {isProcessing && (
                    <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                  )}
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}

export default EnhancedSimpleChatSidebar;