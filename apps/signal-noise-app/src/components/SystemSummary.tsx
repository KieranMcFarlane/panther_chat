'use client';

import React, { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

export default function SystemSummary() {
  const [systemDoc, setSystemDoc] = useState<string>('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchSystemSummary();
  }, []);

  const fetchSystemSummary = async () => {
    try {
      // For now, we'll read from the static .md file
      // In a real deployment, you might fetch this from an API
      const response = await fetch('/api/get-system-summary');
      if (response.ok) {
        const data = await response.json();
        setSystemDoc(data.summary);
      } else {
        // Fallback to basic summary if API not available
        setSystemDoc(`## 🎯 RFP Intelligence System

**Core Capabilities:**
- Neo4j Knowledge Graph (2,997 sports entities)
- BrightData Web Scraping & Search
- Perplexity Market Intelligence
- Claude Agent SDK Analysis

**Detection Patterns:**
- Digital Transformation RFPs
- Mobile Application Development
- Ticketing System Proposals
- Fan Engagement Platforms
- Web Platform Tenders

**Last Updated:** ${new Date().toLocaleDateString()}`);
      }
    } catch (error) {
      console.error('Failed to fetch system summary:', error);
      setSystemDoc('System summary temporarily unavailable.');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <Card className="bg-gray-800 border-gray-700">
        <CardHeader>
          <CardTitle className="text-white">📋 System Specification</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center h-32">
            <div className="text-gray-400">Loading system specification...</div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="bg-gray-800 border-gray-700">
      <CardHeader>
        <CardTitle className="text-white flex items-center gap-2">
          📋 System Specification
          <span className="text-xs bg-green-600/30 text-green-300 px-2 py-1 rounded">
            from COMPREHENSIVE-RFP-MONITORING-SYSTEM.md
          </span>
        </CardTitle>
        <CardDescription className="text-gray-300">
          Current RFP detection patterns and system configuration
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="prose prose-invert max-w-none">
          <div className="bg-gray-900 rounded-lg p-4 font-mono text-sm text-gray-300 leading-relaxed">
            <pre className="whitespace-pre-wrap">{systemDoc}</pre>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}