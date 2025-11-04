'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { 
  FileText, 
  Target, 
  Zap, 
  CheckCircle, 
  Clock, 
  TrendingUp,
  Database,
  Brain,
  Lightbulb,
  BookOpen,
  Activity
} from 'lucide-react';

interface BlueprintSection {
  title: string;
  icon: React.ElementType;
  content: string;
  status: 'complete' | 'partial' | 'info';
}

export default function BlueprintIntegrity() {
  const [blueprint, setBlueprint] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [expandedSection, setExpandedSection] = useState<string | null>(null);

  useEffect(() => {
    fetchBlueprint();
  }, []);

  const fetchBlueprint = async () => {
    try {
      const response = await fetch('/api/get-system-summary');
      const result = await response.json();
      setBlueprint(result);
    } catch (error) {
      console.error('Failed to fetch blueprint:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-400">Loading blueprint integrity...</div>
      </div>
    );
  }

  if (!blueprint) {
    return (
      <div className="text-center py-8 text-gray-400">
        <FileText className="w-12 h-12 mx-auto mb-2 opacity-50" />
        <p>Blueprint not found</p>
      </div>
    );
  }

  const sections: BlueprintSection[] = [
    {
      title: 'System Architecture',
      icon: Database,
      content: extractSection(blueprint.summary, ['System Architecture', 'Architecture Overview', 'Components']),
      status: 'complete'
    },
    {
      title: 'LLM Execution Instructions',
      icon: Brain,
      content: extractSection(blueprint.summary, ['LLM Execution Instructions', 'Agent Instructions', 'AI Layer']),
      status: 'complete'
    },
    {
      title: 'Verified RFP Examples',
      icon: Target,
      content: extractSection(blueprint.summary, ['Verified RFP Examples', 'RFP Detection Examples', 'Case Studies']),
      status: 'complete'
    },
    {
      title: 'Monitoring Engine',
      icon: Activity,
      content: extractSection(blueprint.summary, ['Monitoring Engine', 'Real-time Monitoring', 'Alert System']),
      status: 'complete'
    },
    {
      title: 'Business Case',
      icon: TrendingUp,
      content: extractSection(blueprint.summary, ['Business Case', 'Executive Summary', 'ROI Analysis']),
      status: 'complete'
    },
    {
      title: 'Latest Run Summaries',
      icon: Clock,
      content: extractSection(blueprint.summary, ['Latest Run Summary', 'Recent Executions', 'Performance Metrics']),
      status: 'info'
    }
  ];

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'complete': return 'bg-green-600/20 text-green-300 border-green-600/30';
      case 'partial': return 'bg-yellow-600/20 text-yellow-300 border-yellow-600/30';
      default: return 'bg-blue-600/20 text-blue-300 border-blue-600/30';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'complete': return <CheckCircle className="w-4 h-4" />;
      case 'partial': return <Lightbulb className="w-4 h-4" />;
      default: return <BookOpen className="w-4 h-4" />;
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <Card className="bg-gray-800 border-gray-700">
        <CardHeader>
          <CardTitle className="text-white flex items-center gap-2">
            <FileText className="w-5 h-5" />
            Blueprint Integrity Monitor
          </CardTitle>
          <CardDescription className="text-gray-300">
            Live view of COMPLETE-RFP-MONITORING-SYSTEM.md structure and status
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-4 text-sm">
            <Badge variant="outline" className="bg-green-600/20 text-green-300 border-green-600/30">
              <CheckCircle className="w-3 h-3 mr-1" />
              Blueprint Loaded
            </Badge>
            <Badge variant="outline" className="bg-blue-600/20 text-blue-300 border-blue-600/30">
              <FileText className="w-3 h-3 mr-1" />
              COMPLETE-RFP-MONITORING-SYSTEM.md
            </Badge>
            <Button onClick={fetchBlueprint} size="sm" variant="outline">
              🔄 Refresh
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Blueprint Sections */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {sections.map((section) => {
          const Icon = section.icon;
          const isExpanded = expandedSection === section.title;
          const hasContent = section.content && section.content.length > 100;

          return (
            <Card 
              key={section.title} 
              className="bg-gray-800 border-gray-700 hover:bg-gray-750 transition-colors cursor-pointer"
              onClick={() => setExpandedSection(isExpanded ? null : section.title)}
            >
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Icon className="w-5 h-5 text-blue-400" />
                    <CardTitle className="text-white text-lg">{section.title}</CardTitle>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className={getStatusColor(section.status)}>
                      {getStatusIcon(section.status)}
                      {section.status}
                    </Badge>
                    {hasContent && (
                      <Button size="sm" variant="ghost" className="text-gray-400 hover:text-white">
                        {isExpanded ? '▼' : '▶'}
                      </Button>
                    )}
                  </div>
                </div>
              </CardHeader>
              
              {hasContent && (
                <CardContent className={`transition-all duration-300 ${isExpanded ? 'block' : 'hidden'}`}>
                  <div className="prose prose-invert max-w-none">
                    <div className="bg-gray-900 rounded p-4 text-sm text-gray-300 leading-relaxed">
                      {section.content.length > 500 
                        ? `${section.content.substring(0, 500)}...`
                        : section.content
                      }
                    </div>
                  </div>
                </CardContent>
              )}

              {!hasContent && (
                <CardContent className="pt-0">
                  <div className="text-center text-gray-500 text-sm py-2">
                    Section content not found in blueprint
                  </div>
                </CardContent>
              )}
            </Card>
          );
        })}
      </div>

      {/* Blueprint Metadata */}
      <Card className="bg-gray-800 border-gray-700">
        <CardHeader>
          <CardTitle className="text-white flex items-center gap-2">
            <Zap className="w-5 h-5" />
            Blueprint Metadata
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            <div className="bg-gray-900 rounded p-3">
              <div className="text-2xl font-bold text-blue-400">{sections.length}</div>
              <div className="text-gray-400">Sections</div>
            </div>
            <div className="bg-gray-900 rounded p-3">
              <div className="text-2xl font-bold text-green-400">
                {sections.filter(s => s.status === 'complete').length}
              </div>
              <div className="text-gray-400">Complete</div>
            </div>
            <div className="bg-gray-900 rounded p-3">
              <div className="text-2xl font-bold text-yellow-400">
                {sections.filter(s => s.status === 'partial').length}
              </div>
              <div className="text-gray-400">Partial</div>
            </div>
            <div className="bg-gray-900 rounded p-3">
              <div className="text-2xl font-bold text-purple-400">
                {blueprint.summary?.length || 0}
              </div>
              <div className="text-gray-400">Characters</div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// Helper function to extract relevant content based on keywords
function extractSection(content: string, keywords: string[]): string {
  if (!content) return '';
  
  const lines = content.split('\n');
  let extracting = false;
  let extractedLines: string[] = [];
  
  for (const line of lines) {
    // Check if this line contains one of our keywords
    for (const keyword of keywords) {
      if (line.toLowerCase().includes(keyword.toLowerCase()) && line.includes('#')) {
        extracting = true;
        extractedLines.push(line);
        break;
      }
    }
    
    // Continue extracting until we hit another major section
    if (extracting) {
      if (line.startsWith('# ') && !keywords.some(k => line.toLowerCase().includes(k.toLowerCase()))) {
        extracting = false;
        break;
      }
      extractedLines.push(line);
      
      // Limit extraction to reasonable length
      if (extractedLines.length > 50) {
        break;
      }
    }
  }
  
  return extractedLines.join('\n').trim();
}