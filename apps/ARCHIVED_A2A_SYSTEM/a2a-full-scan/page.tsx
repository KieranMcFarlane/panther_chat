/**
 * A2A Full Neo4j Scan Control Page
 * Triggers comprehensive scan of all Neo4j entities with RFP detection
 * Updated to use enhanced real-time progress tracking system
 */

'use client';

import React from 'react';
import { RealtimeA2ADashboard } from '@/components/RealtimeA2ADashboard';

export default function A2AFullScanPage() {
  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold tracking-tight">A2A Full Neo4j Entity Scan</h1>
          <p className="text-muted-foreground">
            Comprehensive RFP opportunity detection across 1,040+ high-priority sports entities
          </p>
        </div>
        
        {/* Real-time Dashboard */}
        <RealtimeA2ADashboard />
        
        {/* Additional Information */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-muted/50 rounded-lg p-6">
            <h2 className="text-lg font-semibold mb-4">How This Works</h2>
            <div className="space-y-3 text-sm text-muted-foreground">
              <div className="flex items-start gap-3">
                <div className="w-6 h-6 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 font-bold text-xs mt-0.5">
                  1
                </div>
                <div>
                  <span className="font-medium">Entity Selection</span>
                  <p className="text-muted-foreground">Queries Neo4j for entities with yellowPantherPriority ≤ 5 and digitalTransformationScore ≥ 60</p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <div className="w-6 h-6 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 font-bold text-xs mt-0.5">
                  2
                </div>
                <div>
                  <span className="font-medium">Batch Processing</span>
                  <p className="text-muted-foreground">Processes entities in economical 3-entity batches using BrightData MCP tools</p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <div className="w-6 h-6 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 font-bold text-xs mt-0.5">
                  3
                </div>
                <div>
                  <span className="font-medium">RFP Detection</span>
                  <p className="text-muted-foreground">Uses BrightData MCP tools to search for procurement signals, tenders, and RFP opportunities</p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <div className="w-6 h-6 rounded-full bg-green-100 flex items-center justify-center text-green-600 font-bold text-xs mt-0.5">
                  4
                </div>
                <div>
                  <span className="font-medium">Results Storage</span>
                  <p className="text-muted-foreground">Discovered opportunities automatically stored to database and displayed on /tenders page</p>
                </div>
              </div>
            </div>
          </div>
          
          <div className="bg-muted/50 rounded-lg p-6">
            <h2 className="text-lg font-semibold mb-4">Enhanced Real-Time Features</h2>
            <div className="space-y-3 text-sm text-muted-foreground">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                <span><strong>Multi-Session Support:</strong> Handles concurrent A2A scans without conflicts</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-blue-500 animate-pulse" />
                <span><strong>Live Progress Updates:</strong> Entity counts update every 2 seconds</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-purple-500 animate-pulse" />
                <span><strong>Batch Tracking:</strong> Real-time batch completion status</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-orange-500 animate-pulse" />
                <span><strong>RFP Discovery:</strong> Live opportunity counting and analysis</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                <span><strong>Time Tracking:</strong> Accurate elapsed time counter</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-yellow-500 animate-pulse" />
                <span><strong>Error Handling:</strong> Session cleanup and error recovery</span>
              </div>
            </div>
          </div>
        </div>
        
        {/* Quick Links */}
        <div className="bg-muted/30 rounded-lg p-4">
          <div className="flex items-center justify-between">
            <div className="text-sm text-muted-foreground">
              <strong>Quick Access:</strong> 
              <a href="/tenders" className="ml-2 text-blue-600 hover:underline">View Tenders</a> •
              <a href="/a2a-progress" className="ml-2 text-blue-600 hover:underline">Progress Dashboard</a> •
              <a href="/claude-agent-demo" className="ml-2 text-blue-600 hover:underline">Agent Demo</a>
            </div>
            <div className="text-xs text-muted-foreground">
              Enhanced with multi-session progress tracking • Real-time updates every 2 seconds
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}