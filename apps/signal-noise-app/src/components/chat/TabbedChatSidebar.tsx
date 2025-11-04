'use client';

import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  MessageCircle, 
  Brain, 
  Settings, 
  X, 
  Minimize2,
  Plus,
  TrendingUp,
  Target,
  Mail,
  ExternalLink,
  ChevronDown,
  Globe,
  Zap
} from 'lucide-react';
import { useUser } from '@/contexts/UserContext';
import { v4 as uuidv4 } from 'uuid';

interface ClaudeAgentInstance {
  id: string;
  name: string;
  isActive: boolean;
  conversationHistory: any[];
  createdAt: Date;
  lastActive: Date;
  agentType: 'sports-intelligence' | 'rfp-analyst' | 'market-researcher';
}

interface TabbedChatSidebarProps {
  userId?: string;
  context?: any;
  className?: string;
}

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
    icon: <Globe className="w-4 h-4" />,
    color: 'text-purple-600',
    description: 'Conduct market research and analysis'
  }
};

export function TabbedChatSidebar({
  userId,
  context = {},
  className
}: TabbedChatSidebarProps) {
  const [isMinimized, setIsMinimized] = useState(false);
  const [activeTab, setActiveTab] = useState<string>('chat');
  const [instances, setInstances] = useState<ClaudeAgentInstance[]>([]);
  const [activeInstanceId, setActiveInstanceId] = useState<string>('');
  const [showNewInstanceMenu, setShowNewInstanceMenu] = useState(false);
  const [isRenaming, setIsRenaming] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const { userId: contextUserId } = useUser();
  const menuRef = useRef<HTMLDivElement>(null);

  // Load saved instances on mount
  useEffect(() => {
    const savedInstances = localStorage.getItem(`claude-agent-instances-${userId || contextUserId}`);
    if (savedInstances) {
      const parsed = JSON.parse(savedInstances);
      setInstances(parsed.map((inst: any) => ({
        ...inst,
        createdAt: new Date(inst.createdAt),
        lastActive: new Date(inst.lastActive)
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
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setShowNewInstanceMenu(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

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

  const activeInstance = instances.find(inst => inst.id === activeInstanceId);

  // Mock RFP data for RFP Intelligence tab
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
                        <span className="text-sm font-medium truncate">{instance.name}</span>
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
                      <Minimize2 className="w-4 h-4" />
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
                  className="h-full"
                >
                  <div className="h-full flex flex-col">
                    {/* Chat Messages Area */}
                    <div className="flex-1 overflow-y-auto p-4">
                      <div className="text-center text-gray-500 mb-4">
                        <div className="inline-flex items-center gap-2 px-4 py-2 bg-gray-50 rounded-lg mb-4">
                          <div className={`p-2 rounded-lg ${agentTypes[activeInstance.agentType].color} bg-current/10`}>
                            {agentTypes[activeInstance.agentType].icon}
                          </div>
                          <div className="text-left">
                            <div className="font-medium text-gray-900">{activeInstance.name}</div>
                            <div className="text-sm text-gray-500">
                              {agentTypes[activeInstance.agentType].description}
                            </div>
                          </div>
                        </div>
                        <p className="text-sm">
                          {activeInstance.conversationHistory.length === 0 
                            ? `Start a conversation with ${activeInstance.name.toLowerCase()}...`
                            : `${activeInstance.conversationHistory.length} messages`
                          }
                        </p>
                      </div>

                      {/* Mock conversation display */}
                      {activeInstance.conversationHistory.length === 0 && (
                        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
                          <div className="flex items-start gap-3">
                            <div className="p-2 bg-blue-100 rounded-lg">
                              <Brain className="w-4 h-4 text-blue-600" />
                            </div>
                            <div className="flex-1">
                              <div className="font-medium text-gray-900 mb-1">Assistant</div>
                              <div className="text-sm text-gray-700">
                                Hello! I'm your {agentTypes[activeInstance.agentType].name.toLowerCase()} assistant. 
                                I can help you with {agentTypes[activeInstance.agentType].description.toLowerCase()}. 
                                How can I assist you today?
                              </div>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Chat Input */}
                    <div className="border-t border-gray-200 p-4">
                      <div className="flex gap-2">
                        <input
                          type="text"
                          placeholder={`Ask ${activeInstance.name.toLowerCase()}...`}
                          className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                          onKeyPress={(e) => {
                            if (e.key === 'Enter' && e.currentTarget.value.trim()) {
                              updateInstanceHistory(activeInstance.id, {
                                role: 'user',
                                content: e.currentTarget.value,
                                timestamp: new Date()
                              });
                              e.currentTarget.value = '';
                            }
                          }}
                        />
                        <button className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors">
                          <Plus className="w-4 h-4" />
                        </button>
                      </div>
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
                        <h5 className="font-medium text-gray-900 mb-2">Active Agent Instance</h5>
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
                        </div>
                      </div>
                    )}
                  </div>
                </motion.div>
              )}
            </div>

            {/* Enhanced Footer */}
            <div className="border-t border-gray-200 p-4 bg-gray-50">
              <div className="flex items-center justify-between text-sm">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 bg-green-500 rounded-full" />
                  <span className="text-gray-600">
                    {activeInstance ? activeInstance.name : 'Ready'}
                  </span>
                </div>
                <div className="text-gray-400">
                  {instances.length} instance{instances.length !== 1 ? 's' : ''}
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}

export default TabbedChatSidebar;