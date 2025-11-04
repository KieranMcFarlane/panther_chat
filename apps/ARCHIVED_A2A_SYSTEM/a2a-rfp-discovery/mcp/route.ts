import { NextRequest, NextResponse } from 'next/server'
import { realMCPA2ASystem } from '@/lib/real-mcp-a2a-system'

// Real MCP System with live Claude Agent SDK integration
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const action = searchParams.get('action')

  try {
    switch (action) {
      case 'mcp-status':
        const systemStatus = realMCPA2ASystem.getSystemStatus()
        return NextResponse.json(systemStatus)
        
      case 'mcp-start':
        // Start real MCP discovery with Claude Agent SDK
        await realMCPA2ASystem.startRealDiscovery()
        return NextResponse.json({
          success: true,
          message: 'Real MCP-Enabled A2A Discovery started with Claude Agent SDK',
          entitiesProcessed: realMCPA2ASystem.getSystemStatus().totalEntitiesProcessed,
          mcpSystemStatus: {
            isRunning: true,
            mcpSessions: 4,
            agents: realMCPA2ASystem.getSystemStatus().agents.length
          }
        })
        
      case 'mcp-stop':
        // Stop real MCP discovery
        await realMCPA2ASystem.stopRealDiscovery()
        return NextResponse.json({
          success: true,
          message: 'Real MCP-Enabled A2A Discovery stopped',
          mcpSystemStatus: {
            isRunning: false,
            mcpSessions: 0
          }
        })
        
      case 'mcp-rfps':
        // Get real discovered RFPs
        const discoveredRFPs = realMCPA2ASystem.getDiscoveredRFPs()
        return NextResponse.json({
          rfps: discoveredRFPs,
          total: discoveredRFPs.length,
          mcpGenerated: true,
          entitiesProcessed: realMCPA2ASystem.getSystemStatus().totalEntitiesProcessed
        })
        
      case 'mcp-cards':
        // Get real processing cards
        const processingCards = realMCPA2ASystem.getProcessingCards()
        return NextResponse.json({
          cards: processingCards,
          total: processingCards.length,
          mcpGenerated: true,
          rfpsAnalyzed: processingCards.length
        })
        
      default:
        return NextResponse.json({ error: 'Invalid MCP action' }, { status: 400 })
    }
  } catch (error) {
    console.error('❌ MCP API Error:', error)
    return NextResponse.json(
      { error: 'MCP server error', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  const { action, data } = await request.json()

  try {
    switch (action) {
      case 'mcp-analyze':
        // Real RFP analysis using Claude Agent SDK and MCP tools
        const analysisResult = await realMCPA2ASystem.analyzeRFP(data.rfpId)
        return NextResponse.json(analysisResult)
        
      case 'mcp-verify':
        // Real verification of MCP findings
        const verificationResult = await realMCPA2ASystem.verifyFinding(data.cardId, data.verification)
        return NextResponse.json(verificationResult)
        
      default:
        return NextResponse.json({ error: 'Invalid MCP action' }, { status: 400 })
    }
  } catch (error) {
    console.error('❌ MCP POST Error:', error)
    return NextResponse.json(
      { error: 'MCP server error', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}