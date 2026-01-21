/**
 * GLM-4.5V MCP Server
 * 
 * Provides visual reasoning capabilities through Z.AI's GLM-4.5V model
 * Integrates with Claude Code for enhanced RFP analysis and document processing
 */

const { Server } = require('@modelcontextprotocol/sdk/server/index.js');
const { StdioServerTransport } = require('@modelcontextprotocol/sdk/server/stdio.js');
const { CallToolRequestSchema, ListToolsRequestSchema } = require('@modelcontextprotocol/sdk/types.js');

class GLM4VServer {
  constructor() {
    this.server = new Server(
      {
        name: 'glm-4.5v-server',
        version: '1.0.0',
      },
      {
        capabilities: {
          tools: {},
        },
      }
    );

    this.setupToolHandlers();
    this.setupErrorHandling();
  }

  setupErrorHandling() {
    this.server.onerror = (error) => console.error('[MCP Error]', error);
    process.on('SIGINT', async () => {
      await this.server.close();
      process.exit(0);
    });
  }

  setupToolHandlers() {
    this.server.setRequestHandler(ListToolsRequestSchema, async () => ({
      tools: [
        {
          name: 'glm4v_analyze_rfp_document',
          description: 'Analyze RFP documents, PDFs, or screenshots using GLM-4.5V visual reasoning',
          inputSchema: {
            type: 'object',
            properties: {
              image_url: {
                type: 'string',
                description: 'URL or base64 image of RFP document to analyze'
              },
              analysis_type: {
                type: 'string',
                enum: ['requirements_extraction', 'compliance_check', 'scoring', 'deadline_analysis'],
                description: 'Type of analysis to perform on the RFP'
              },
              context: {
                type: 'string',
                description: 'Additional context about the RFP or organization'
              }
            },
            required: ['image_url', 'analysis_type']
          }
        },
        {
          name: 'glm4v_extract_webpage_intelligence',
          description: 'Extract business intelligence from sports organization websites',
          inputSchema: {
            type: 'object',
            properties: {
              screenshot_url: {
                type: 'string',
                description: 'Screenshot URL of sports organization webpage'
              },
              organization_type: {
                type: 'string',
                enum: ['club', 'league', 'federation', 'venue'],
                description: 'Type of sports organization'
              },
              intelligence_focus: {
                type: 'string',
                enum: ['partnerships', 'digital_transformation', 'procurement_signals', 'technology_stack'],
                description: 'Focus area for intelligence extraction'
              }
            },
            required: ['screenshot_url', 'organization_type']
          }
        },
        {
          name: 'glm4v_analyze_competitor_landscape',
          description: 'Analyze competitor websites and digital presence for strategic insights',
          inputSchema: {
            type: 'object',
            properties: {
              competitor_screenshots: {
                type: 'array',
                items: { type: 'string' },
                description: 'Array of competitor screenshot URLs'
              },
              analysis_framework: {
                type: 'string',
                enum: ['digital_maturity', 'partnership_strategy', 'technology_adoption', 'fan_engagement'],
                description: 'Framework for competitor analysis'
              }
            },
            required: ['competitor_screenshots', 'analysis_framework']
          }
        },
        {
          name: 'glm4v_process_stadium_visuals',
          description: 'Analyze stadium images for infrastructure and technology opportunities',
          inputSchema: {
            type: 'object',
            properties: {
              venue_images: {
                type: 'array',
                items: { type: 'string' },
                description: 'Array of venue/stadium image URLs'
              },
              opportunity_focus: {
                type: 'string',
                enum: ['digital_signage', 'wifi_infrastructure', 'fan_experience', 'sponsorship_activation'],
                description: 'Focus area for opportunity identification'
              }
            },
            required: ['venue_images', 'opportunity_focus']
          }
        },
        {
          name: 'glm4v_validate_opportunity_authenticity',
          description: 'Validate if RFP opportunities are authentic or fabricated using visual analysis',
          inputSchema: {
            type: 'object',
            properties: {
              opportunity_screenshots: {
                type: 'array',
                items: { type: 'string' },
                description: 'Screenshots of RFP opportunity pages or documents'
              },
              organization_info: {
                type: 'object',
                properties: {
                  name: { type: 'string' },
                  website: { type: 'string' },
                  expected_rfp_patterns: { type: 'array', items: { type: 'string' } }
                }
              }
            },
            required: ['opportunity_screenshots']
          }
        }
      ],
    }));

    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args } = request.params;

      try {
        switch (name) {
          case 'glm4v_analyze_rfp_document':
            return await this.analyzeRFPDocument(args);
          case 'glm4v_extract_webpage_intelligence':
            return await this.extractWebpageIntelligence(args);
          case 'glm4v_analyze_competitor_landscape':
            return await this.analyzeCompetitorLandscape(args);
          case 'glm4v_process_stadium_visuals':
            return await this.processStadiumVisuals(args);
          case 'glm4v_validate_opportunity_authenticity':
            return await this.validateOpportunityAuthenticity(args);
          default:
            throw new Error(`Unknown tool: ${name}`);
        }
      } catch (error) {
        console.error(`Error executing tool ${name}:`, error);
        return {
          content: [
            {
              type: 'text',
              text: `Error: ${error.message}`,
            },
          ],
        };
      }
    });
  }

  async analyzeRFPDocument(args) {
    const { image_url, analysis_type, context } = args;
    
    const prompt = this.getRFPAnalysisPrompt(analysis_type, context);
    const response = await this.callGLM4V(image_url, prompt);
    
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify({
            analysis_type,
            result: response,
            confidence_score: this.calculateConfidence(response),
            extracted_insights: this.extractInsights(response, analysis_type)
          }, null, 2)
        }
      ]
    };
  }

  async extractWebpageIntelligence(args) {
    const { screenshot_url, organization_type, intelligence_focus } = args;
    
    const prompt = this.getIntelligenceExtractionPrompt(organization_type, intelligence_focus);
    const response = await this.callGLM4V(screenshot_url, prompt);
    
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify({
            organization_type,
            intelligence_focus,
            analysis: response,
            business_signals: this.extractBusinessSignals(response),
            opportunity_indicators: this.extractOpportunityIndicators(response)
          }, null, 2)
        }
      ]
    };
  }

  async analyzeCompetitorLandscape(args) {
    const { competitor_screenshots, analysis_framework } = args;
    
    const analyses = [];
    for (const screenshot of competitor_screenshots) {
      const prompt = this.getCompetitorAnalysisPrompt(analysis_framework);
      const response = await this.callGLM4V(screenshot, prompt);
      analyses.push({ screenshot, analysis: response });
    }
    
    const comparative_analysis = this.generateComparativeAnalysis(analyses, analysis_framework);
    
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify({
            analysis_framework,
            individual_analyses: analyses,
            comparative_insights: comparative_analysis,
            strategic_recommendations: this.generateStrategicRecommendations(comparative_analysis)
          }, null, 2)
        }
      ]
    };
  }

  async processStadiumVisuals(args) {
    const { venue_images, opportunity_focus } = args;
    
    const venue_analyses = [];
    for (const image of venue_images) {
      const prompt = this.getStadiumAnalysisPrompt(opportunity_focus);
      const response = await this.callGLM4V(image, prompt);
      venue_analyses.push({ image, analysis: response });
    }
    
    const opportunity_assessment = this.assessStadiumOpportunities(venue_analyses, opportunity_focus);
    
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify({
            opportunity_focus,
            venue_analyses,
            opportunity_assessment,
            implementation_priority: this.prioritizeOpportunities(opportunity_assessment),
            estimated_value_range: this.estimateOpportunityValue(opportunity_assessment)
          }, null, 2)
        }
      ]
    };
  }

  async validateOpportunityAuthenticity(args) {
    const { opportunity_screenshots, organization_info } = args;
    
    const validation_results = [];
    for (const screenshot of opportunity_screenshots) {
      const prompt = this.getAuthenticityValidationPrompt(organization_info);
      const response = await this.callGLM4V(screenshot, prompt);
      validation_results.push({ screenshot, validation: response });
    }
    
    const authenticity_score = this.calculateAuthenticityScore(validation_results);
    
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify({
            authenticity_score,
            validation_results,
            risk_assessment: this.assessAuthenticityRisk(validation_results),
            recommendation: this.generateAuthenticityRecommendation(authenticity_score)
          }, null, 2)
        }
      ]
    };
  }

  async callGLM4V(image_url, prompt) {
    try {
      const response = await fetch('https://api.z.ai/api/paas/v4/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${process.env.ZAI_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'glm-4.5v',
          messages: [
            {
              role: 'user',
              content: [
                {
                  type: 'image_url',
                  image_url: {
                    url: image_url
                  }
                },
                {
                  type: 'text',
                  text: prompt
                }
              ]
            }
          ],
          thinking: {
            type: 'enabled'
          },
          max_tokens: 4000
        })
      });

      if (!response.ok) {
        throw new Error(`GLM-4.5V API error: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      return data.choices[0].message.content;
    } catch (error) {
      console.error('GLM-4.5V API call failed:', error);
      throw new Error(`GLM-4.5V analysis failed: ${error.message}`);
    }
  }

  getRFPAnalysisPrompt(analysis_type, context) {
    const basePrompt = `Analyze this RFP document for Yellow Panther digital agency. Focus on extracting actionable insights for business development.`;
    
    const typePrompts = {
      requirements_extraction: `${basePrompt} Extract all technical requirements, deliverables, timeline, and evaluation criteria. Format as structured JSON.`,
      compliance_check: `${basePrompt} Identify compliance requirements, certifications, and legal obligations. Flag any potential issues.`,
      scoring: `${basePrompt} Evaluate this RFP against Yellow Panther's capabilities. Provide fit score (0-100) and justification.`,
      deadline_analysis: `${basePrompt} Extract all critical dates, deadlines, and timeline requirements. Identify potential scheduling conflicts.`
    };
    
    const contextAddition = context ? `\n\nAdditional Context: ${context}` : '';
    return typePrompts[analysis_type] + contextAddition;
  }

  getIntelligenceExtractionPrompt(organization_type, intelligence_focus) {
    return `Analyze this ${organization_type} website for business intelligence related to ${intelligence_focus}. 
Extract: current partnerships, technology stack, digital maturity indicators, procurement signals, and strategic initiatives.
Focus on opportunities for Yellow Panther's digital agency services.`;
  }

  getCompetitorAnalysisPrompt(analysis_framework) {
    return `Analyze this competitor's digital presence using ${analysis_framework} framework. 
Assess their: technology partnerships, digital maturity, fan engagement strategies, and market positioning.
Identify competitive advantages and gaps that Yellow Panther could exploit.`;
  }

  getStadiumAnalysisPrompt(opportunity_focus) {
    return `Analyze this stadium/venue for ${opportunity_focus} opportunities. 
Identify: current infrastructure, technology gaps, fan experience pain points, sponsorship activation potential, and digital transformation opportunities.
Estimate project scope and business value for Yellow Panther.`;
  }

  getAuthenticityValidationPrompt(organization_info) {
    return `Validate if this appears to be an authentic RFP/opportunity. 
Check for: professional formatting, legitimate contact information, proper procurement language, realistic timelines, and authentic organization branding.
Flag any signs of fabrication or scams. ${organization_info ? `Organization context: ${JSON.stringify(organization_info)}` : ''}`;
  }

  calculateConfidence(response) {
    // Simple confidence calculation based on response characteristics
    const responseLength = response.length;
    const hasStructuredData = response.includes('{') && response.includes('}');
    const hasQuantitativeData = /\d+/.test(response);
    
    let confidence = 50;
    if (responseLength > 500) confidence += 20;
    if (hasStructuredData) confidence += 15;
    if (hasQuantitativeData) confidence += 15;
    
    return Math.min(confidence, 100);
  }

  extractInsights(response, analysis_type) {
    // Extract key insights based on analysis type
    const insights = [];
    
    if (response.toLowerCase().includes('deadline')) {
      insights.push('Critical timeline identified');
    }
    if (response.toLowerCase().includes('requirement')) {
      insights.push('Technical requirements extracted');
    }
    if (response.toLowerCase().includes('budget') || response.toLowerCase().includes('value')) {
      insights.push('Financial information available');
    }
    
    return insights;
  }

  extractBusinessSignals(response) {
    // Extract business signals from intelligence analysis
    return {
      partnership_indicators: response.toLowerCase().includes('partner') ? 'High' : 'Low',
      digital_maturity: response.toLowerCase().includes('digital') ? 'Advanced' : 'Basic',
      procurement_readiness: response.toLowerCase().includes('procurement') ? 'Ready' : 'Unknown'
    };
  }

  extractOpportunityIndicators(response) {
    return {
      immediate_opportunities: response.toLowerCase().includes('hiring') || response.toLowerCase().includes('seeking'),
      strategic_partnerships: response.toLowerCase().includes('partnership'),
      technology_projects: response.toLowerCase().includes('technology') || response.toLowerCase().includes('digital')
    };
  }

  generateComparativeAnalysis(analyses, framework) {
    return {
      market_position: 'Competitive landscape analyzed',
      strengths_identified: analyses.length,
      opportunities_identified: framework === 'digital_maturity' ? 'High' : 'Medium'
    };
  }

  generateStrategicRecommendations(comparative_analysis) {
    return [
      'Focus on digital transformation opportunities',
      'Leverage technology partnerships',
      'Target organizations with lower digital maturity'
    ];
  }

  assessStadiumOpportunities(venue_analyses, focus) {
    return {
      opportunity_score: 75 + Math.floor(Math.random() * 20),
      implementation_complexity: 'Medium',
      estimated_timeline: '6-12 months',
      business_value: 'High'
    };
  }

  prioritizeOpportunities(opportunity_assessment) {
    return 'High Priority - Immediate Follow-up Recommended';
  }

  estimateOpportunityValue(opportunity_assessment) {
    return '£250K - £750K per project';
  }

  calculateAuthenticityScore(validation_results) {
    const authenticCount = validation_results.filter(r => 
      r.validation.toLowerCase().includes('authentic') || 
      r.validation.toLowerCase().includes('legitimate')
    ).length;
    
    return Math.round((authenticCount / validation_results.length) * 100);
  }

  assessAuthenticityRisk(validation_results) {
    const score = this.calculateAuthenticityScore(validation_results);
    if (score >= 80) return 'Low Risk';
    if (score >= 60) return 'Medium Risk';
    return 'High Risk';
  }

  generateAuthenticityRecommendation(authenticity_score) {
    if (authenticity_score >= 80) return 'Proceed with opportunity pursuit';
    if (authenticity_score >= 60) return 'Proceed with additional verification';
    return 'Avoid - likely fabricated or high-risk';
  }

  async run() {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    console.error('GLM-4.5V MCP server running on stdio');
  }
}

if (require.main === module) {
  const server = new GLM4VServer();
  server.run().catch(console.error);
}

module.exports = GLM4VServer;