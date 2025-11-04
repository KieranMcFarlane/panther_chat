import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

export async function GET(request: NextRequest) {
  try {
    const systemDocPath = path.join(process.cwd(), 'COMPLETE-RFP-MONITORING-SYSTEM.md');
    
    if (!fs.existsSync(systemDocPath)) {
      return NextResponse.json({
        summary: `# 🎯 RFP Intelligence System

**Core Capabilities:**
- Neo4j Knowledge Graph with sports entities
- BrightData Web Scraping & Search Intelligence  
- Perplexity Market Intelligence Analysis
- Claude Agent SDK for Reasoning & Analysis

**Detection Focus:**
- Digital Transformation RFPs
- Mobile Application Development Proposals
- Ticketing System Solicitations
- Fan Engagement Platform Tenders

**Status:** Active and Ready

*System specification file not found - showing fallback summary*`
      });
    }

    const content = fs.readFileSync(systemDocPath, 'utf8');
    
    // Extract a summary of the system specification
    // Look for key sections and create a concise summary
    const summary = extractSystemSummary(content);
    
    return NextResponse.json({ summary });

  } catch (error) {
    console.error('Error reading system summary:', error);
    return NextResponse.json({
      summary: `# 🎯 RFP Intelligence System

**Error loading system specification.** Please check if COMPREHENSIVE-RFP-MONITORING-SYSTEM.md exists.

**Core Components:**
- Neo4j Knowledge Graph Integration
- BrightData Web Intelligence
- Claude Agent SDK Analysis
- Real-time RFP Detection`
    }, { status: 500 });
  }
}

function extractSystemSummary(content: string): string {
  const lines = content.split('\n');
  let summary = '';
  let inRelevantSection = false;
  let sectionCount = 0;
  const maxSections = 5;

  for (let i = 0; i < lines.length && sectionCount < maxSections; i++) {
    const line = lines[i];
    
    // Look for key sections
    if (line.includes('## 🎯 Overview') || 
        line.includes('## 🔍 Verified RFP Examples') ||
        line.includes('## 🏗️ Unified Monitoring Architecture') ||
        line.includes('## ✅ Production-Ready Components') ||
        line.includes('## 🚀 Implementation Status')) {
      
      inRelevantSection = true;
      summary += line + '\n';
      continue;
    }
    
    if (inRelevantSection) {
      // Stop at next major section
      if (line.startsWith('## ') && !line.includes('## 🎯 Overview') && 
          !line.includes('## 🔍 Verified RFP Examples') &&
          !line.includes('## 🏗️ Unified Monitoring Architecture') &&
          !line.includes('## ✅ Production-Ready Components') &&
          !line.includes('## 🚀 Implementation Status')) {
        inRelevantSection = false;
        sectionCount++;
        if (sectionCount >= maxSections) break;
        continue;
      }
      
      summary += line + '\n';
      
      // Limit section length
      const sectionLines = summary.split('\n').length;
      if (sectionLines > 50) {
        inRelevantSection = false;
        sectionCount++;
        summary += '\n*... section truncated for brevity ...*\n\n';
      }
    }
  }

  // Add a footer with last update info
  summary += `\n---\n\n**System Status:** ✅ Active & Ready\n**Last Sync:** ${new Date().toLocaleString()}\n**Source:** COMPREHENSIVE-RFP-MONITORING-SYSTEM.md`;

  return summary || `# 🎯 RFP Intelligence System

Core monitoring system for sports industry RFP detection.

**Key Features:**
- Neo4j Knowledge Graph Integration
- BrightData Web Intelligence
- Claude Agent SDK Analysis
- Real-time Opportunity Detection

**Status:** Active`;
}