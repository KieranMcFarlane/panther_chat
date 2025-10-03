"use client"

import { useCopilotAction } from "@copilotkit/react-core"
import { useRouter } from "next/navigation"

interface DossierGenerationParams {
  entityId: string
  entityName: string
  includeSignals?: boolean
  includeConnections?: boolean
  deepResearch?: boolean
}

export function useDossierCopilotActions() {
  const router = useRouter()

  useCopilotAction({
    name: "generateEntityDossier",
    description: "Generate comprehensive intelligence dossier for an entity",
    parameters: [
      {
        name: "entityId",
        type: "string",
        description: "The Neo4j ID of the entity",
        required: true
      },
      {
        name: "entityName", 
        type: "string",
        description: "The name of the entity for context",
        required: true
      },
      {
        name: "includeSignals",
        type: "boolean", 
        description: "Include opportunity signals in the dossier",
        required: false
      },
      {
        name: "includeConnections",
        type: "boolean",
        description: "Include connection paths analysis",
        required: false
      },
      {
        name: "deepResearch",
        type: "boolean",
        description: "Perform deep research with extended analysis",
        required: false
      }
    ],
    handler: async (args: DossierGenerationParams) => {
      const { entityId, entityName, includeSignals = true, includeConnections = true, deepResearch = false } = args
      
      console.log(`🎯 Generating dossier for ${entityName} (ID: ${entityId})`)
      console.log(`Options: Signals=${includeSignals}, Connections=${includeConnections}, Deep Research=${deepResearch}`)
      
      // Navigate to dossier page with generation parameters
      const params = new URLSearchParams({
        generate: 'true',
        includeSignals: includeSignals.toString(),
        includeConnections: includeConnections.toString(), 
        deepResearch: deepResearch.toString()
      })
      
      router.push(`/entity-browser/${entityId}/dossier?${params.toString()}`)
      
      return `📋 Generating intelligence dossier for ${entityName}...\n\nThe dossier will include:\n• Entity analysis and opportunity scoring\n• Persons of interest with connection paths\n• Recent signals and events${includeConnections ? '\n• Connection path analysis' : ''}${deepResearch ? '\n• Deep research and extended analysis' : ''}\n\nRedirecting to dossier view...`
    }
  })

  useCopilotAction({
    name: "navigateToDossier",
    description: "Navigate to an existing entity dossier",
    parameters: [
      {
        name: "entityId",
        type: "string", 
        description: "The Neo4j ID of the entity",
        required: true
      },
      {
        name: "entityName",
        type: "string",
        description: "The name of the entity for context",
        required: true
      }
    ],
    handler: async (args: { entityId: string, entityName: string }) => {
      const { entityId, entityName } = args
      
      console.log(`📍 Navigating to dossier for ${entityName} (ID: ${entityId})`)
      
      router.push(`/entity-browser/${entityId}/dossier`)
      
      return `📄 Opening intelligence dossier for ${entityName}...`
    }
  })

  useCopilotAction({
    name: "analyzeEntityOpportunities",
    description: "Quick analysis of entity opportunities and connections",
    parameters: [
      {
        name: "entityId",
        type: "string",
        description: "The Neo4j ID of the entity", 
        required: true
      },
      {
        name: "entityName",
        type: "string",
        description: "The name of the entity for context",
        required: true
      }
    ],
    handler: async (args: { entityId: string, entityName: string }) => {
      const { entityId, entityName } = args
      
      console.log(`🔍 Analyzing opportunities for ${entityName} (ID: ${entityId})`)
      
      try {
        // Call the dossier API for quick analysis
        const response = await fetch(`/api/entities/${entityId}/dossier?includeSignals=true&includeConnections=true&includePOIs=true`, {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json'
          }
        })
        
        if (!response.ok) {
          throw new Error(`Failed to analyze entity: ${response.statusText}`)
        }
        
        const data = await response.json()
        const dossier = data.dossier
        
        const analysis = `🎯 **Opportunity Analysis for ${entityName}**

**Overall Score:** ${dossier.scores.finalScore}/100 (${dossier.status.toUpperCase()})

📊 **Key Metrics:**
• **Opportunity Score:** ${dossier.scores.opportunityScore}/100
• **Connection Score:** ${dossier.scores.connectionScore}/100

👥 **Top Persons of Interest:**${dossier.topPOIs.slice(0, 3).map((poi: any, index: number) => 
  `\n${index + 1}. **${poi.name}** - ${poi.role}${poi.emailGuess ? ` (${poi.emailGuess})` : ''}`
).join('')}

🚨 **Recent Signals:**${dossier.signals.slice(0, 3).map((signal: any) => 
  `\n• **${signal.type}** - ${signal.details} (${signal.date})`
).join('')}

📋 **Recommended Actions:**${dossier.recommendedActions.slice(0, 3).map((action: any) => 
  `\n• **${action.action}** (${action.priority} priority)`
).join('')}

---
💡 *For complete dossier with detailed analysis, generate full intelligence dossier.*`

        return analysis
        
      } catch (error) {
        console.error('Error analyzing entity opportunities:', error)
        return `❌ Failed to analyze opportunities for ${entityName}. Please try again or generate full dossier.`
      }
    }
  })
}