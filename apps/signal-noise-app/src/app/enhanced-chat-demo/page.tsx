'use client';

import { useState, Suspense } from 'react';
import EnhancedSimpleChatSidebar from '@/components/chat/EnhancedSimpleChatSidebar';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  MessageSquare, 
  Zap, 
  Target, 
  Database,
  TrendingUp,
  Users,
  Globe,
  BarChart3
} from 'lucide-react';

export default function EnhancedChatDemo() {
  const [demoMode, setDemoMode] = useState<'overview' | 'features' | 'integration'>('overview');

  const features = [
    {
      icon: <MessageSquare className="w-6 h-6" />,
      title: "Cursor AI Aesthetic",
      description: "Professional sidebar with smooth animations and resizable panels",
      benefits: ["Bottom-aligned status", "Dynamic action verbs", "Flower/dot animations"]
    },
    {
      icon: <Target className="w-6 h-6" />,
      title: "RFP Intelligence Integration",
      description: "Seamless access to your RFP opportunities and analysis tools",
      benefits: ["Real-time fit scores", "Email composition", "Company research"]
    },
    {
      icon: <Database className="w-6 h-6" />,
      title: "Tool Status Monitoring",
      description: "Live status of your MCP tools and database connections",
      benefits: ["Neo4j connection", "BrightData scraper", "Perplexity AI"]
    },
    {
      icon: <Zap className="w-6 h-6" />,
      title: "Enhanced Dynamic Status",
      description: "Your action verbs system with Cursor/Claude-style animations",
      benefits: ["Phase-aware animations", "Tool-specific verbs", "Status persistence"]
    }
  ];

  const integrations = [
    { name: "Neo4j MCP", status: "Connected", color: "text-fm-green" },
    { name: "BrightData Scraper", status: "Ready", color: "text-fm-yellow" },
    { name: "Perplexity AI", status: "Available", color: "text-fm-green" },
    { name: "Claude Agent SDK", status: "Active", color: "text-fm-green" },
    { name: "Supabase Cache", status: "Synced", color: "text-fm-green" },
    { name: "Email Service", status: "Configured", color: "text-fm-yellow" }
  ];

  return (
    <div className="min-h-screen bg-custom-bg">
      {/* Enhanced Copilot Sidebar */}
      <Suspense fallback={<div className="fixed right-0 top-0 h-full w-96 bg-gray-900 animate-pulse" />}>
        <EnhancedSimpleChatSidebar />
      </Suspense>

      {/* Main Content */}
      <div className="p-8 max-w-6xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="font-header text-4xl text-fm-off-white mb-2">
            Enhanced CopilotKit Sidebar
          </h1>
          <p className="text-body-primary text-fm-light-grey">
            Professional AI assistant with Cursor/Claude aesthetics and RFP intelligence integration
          </p>
        </div>

        {/* Mode Selector */}
        <div className="flex gap-2 mb-8">
          <Button
            variant={demoMode === 'overview' ? 'default' : 'outline'}
            onClick={() => setDemoMode('overview')}
            className={demoMode === 'overview' ? 'bg-fm-green text-custom-bg' : 'border-custom-border text-fm-light-grey'}
          >
            Overview
          </Button>
          <Button
            variant={demoMode === 'features' ? 'default' : 'outline'}
            onClick={() => setDemoMode('features')}
            className={demoMode === 'features' ? 'bg-fm-green text-custom-bg' : 'border-custom-border text-fm-light-grey'}
          >
            Features
          </Button>
          <Button
            variant={demoMode === 'integration' ? 'default' : 'outline'}
            onClick={() => setDemoMode('integration')}
            className={demoMode === 'integration' ? 'bg-fm-green text-custom-bg' : 'border-custom-border text-fm-light-grey'}
          >
            Integration
          </Button>
        </div>

        {/* Overview Mode */}
        {demoMode === 'overview' && (
          <div className="space-y-8">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              <Card className="bg-custom-box border-custom-border">
                <CardHeader className="pb-3">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-fm-green/20 rounded-lg">
                      <MessageSquare className="w-5 h-5 text-fm-green" />
                    </div>
                    <div>
                      <CardTitle className="text-fm-off-white text-lg">Professional UI</CardTitle>
                      <p className="text-fm-meta text-sm">Cursor AI aesthetic</p>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <p className="text-fm-medium-grey text-sm">
                    Resizable panels, smooth animations, and your Football Manager theme
                  </p>
                </CardContent>
              </Card>

              <Card className="bg-custom-box border-custom-border">
                <CardHeader className="pb-3">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-fm-yellow/20 rounded-lg">
                      <Target className="w-5 h-5 text-fm-yellow" />
                    </div>
                    <div>
                      <CardTitle className="text-fm-off-white text-lg">RFP Intelligence</CardTitle>
                      <p className="text-fm-meta text-sm">Business opportunities</p>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <p className="text-fm-medium-grey text-sm">
                    Real-time RFP analysis with fit scores and email templates
                  </p>
                </CardContent>
              </Card>

              <Card className="bg-custom-box border-custom-border">
                <CardHeader className="pb-3">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-blue-500/20 rounded-lg">
                      <Database className="w-5 h-5 text-blue-500" />
                    </div>
                    <div>
                      <CardTitle className="text-fm-off-white text-lg">Tool Status</CardTitle>
                      <p className="text-fm-meta text-sm">MCP integration</p>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <p className="text-fm-medium-grey text-sm">
                    Live monitoring of Neo4j, BrightData, Perplexity tools
                  </p>
                </CardContent>
              </Card>

              <Card className="bg-custom-box border-custom-border">
                <CardHeader className="pb-3">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-purple-500/20 rounded-lg">
                      <Zap className="w-5 h-5 text-purple-500" />
                    </div>
                    <div>
                      <CardTitle className="text-fm-off-white text-lg">Dynamic Status</CardTitle>
                      <p className="text-fm-meta text-sm">Action verbs</p>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <p className="text-fm-medium-grey text-sm">
                    Your action verbs with Cursor/Claude animations
                  </p>
                </CardContent>
              </Card>
            </div>

            <Card className="bg-custom-box border-custom-border">
              <CardHeader>
                <CardTitle className="text-fm-off-white flex items-center gap-2">
                  <TrendingUp className="w-5 h-5 text-fm-green" />
                  Key Improvements
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <h4 className="font-subheader text-fm-off-white mb-3">User Experience</h4>
                    <ul className="space-y-2 text-fm-medium-grey text-sm">
                      <li className="flex items-center gap-2">
                        <div className="w-2 h-2 bg-fm-green rounded-full" />
                       Resizable panels with localStorage persistence
                      </li>
                      <li className="flex items-center gap-2">
                        <div className="w-2 h-2 bg-fm-green rounded-full" />
                        Smooth Framer Motion animations
                      </li>
                      <li className="flex items-center gap-2">
                        <div className="w-2 h-2 bg-fm-green rounded-full" />
                        Tabbed interface for better organization
                      </li>
                      <li className="flex items-center gap-2">
                        <div className="w-2 h-2 bg-fm-green rounded-full" />
                        Professional status animations
                      </li>
                    </ul>
                  </div>
                  <div>
                    <h4 className="font-subheader text-fm-off-white mb-3">Integration Features</h4>
                    <ul className="space-y-2 text-fm-medium-grey text-sm">
                      <li className="flex items-center gap-2">
                        <div className="w-2 h-2 bg-fm-yellow rounded-full" />
                        Real-time RFP opportunity tracking
                      </li>
                      <li className="flex items-center gap-2">
                        <div className="w-2 h-2 bg-fm-yellow rounded-full" />
                        MCP tool status monitoring
                      </li>
                      <li className="flex items-center gap-2">
                        <div className="w-2 h-2 bg-fm-yellow rounded-full" />
                        Email composition integration
                      </li>
                      <li className="flex items-center gap-2">
                        <div className="w-2 h-2 bg-fm-yellow rounded-full" />
                        Enhanced action verb system
                      </li>
                    </ul>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Features Mode */}
        {demoMode === 'features' && (
          <div className="space-y-6">
            {features.map((feature, index) => (
              <Card key={index} className="bg-custom-box border-custom-border">
                <CardHeader>
                  <div className="flex items-center gap-4">
                    <div className="p-3 bg-fm-green/20 rounded-lg text-fm-green">
                      {feature.icon}
                    </div>
                    <div className="flex-1">
                      <CardTitle className="text-fm-off-white text-xl">
                        {feature.title}
                      </CardTitle>
                      <p className="text-fm-medium-grey">
                        {feature.description}
                      </p>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="flex flex-wrap gap-2">
                    {feature.benefits.map((benefit, i) => (
                      <Badge key={i} variant="outline" className="border-custom-border text-fm-light-grey">
                        {benefit}
                      </Badge>
                    ))}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* Integration Mode */}
        {demoMode === 'integration' && (
          <div className="space-y-8">
            <Card className="bg-custom-box border-custom-border">
              <CardHeader>
                <CardTitle className="text-fm-off-white flex items-center gap-2">
                  <Database className="w-5 h-5 text-fm-green" />
                  Tool Integration Status
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {integrations.map((tool, index) => (
                    <div key={index} className="flex items-center justify-between p-3 bg-header-bg border border-custom-border rounded-lg">
                      <div className="flex items-center gap-3">
                        <div className={`w-2 h-2 ${tool.color} rounded-full`} />
                        <span className="text-fm-off-white">{tool.name}</span>
                      </div>
                      <Badge variant="outline" className={`${tool.color} border-current`}>
                        {tool.status}
                      </Badge>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card className="bg-custom-box border-custom-border">
              <CardHeader>
                <CardTitle className="text-fm-off-white flex items-center gap-2">
                  <Globe className="w-5 h-5 text-fm-yellow" />
                  Integration Instructions
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4 text-fm-medium-grey">
                  <div>
                    <h4 className="font-subheader text-fm-off-white mb-2">1. Replace Existing Component</h4>
                    <p className="text-sm">
                      The enhanced sidebar automatically replaces your existing SimpleChatSidebar component.
                    </p>
                  </div>
                  <div>
                    <h4 className="font-subheader text-fm-off-white mb-2">2. Configure CopilotKit</h4>
                    <p className="text-sm">
                      Ensure your CopilotKit provider is properly configured in your app layout.
                    </p>
                  </div>
                  <div>
                    <h4 className="font-subheader text-fm-off-white mb-2">3. Test Features</h4>
                    <p className="text-sm">
                      Try the RFP intelligence tab, tool status monitoring, and enhanced chat interface.
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </div>
  );
}