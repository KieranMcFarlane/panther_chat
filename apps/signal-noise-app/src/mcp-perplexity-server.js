#!/usr/bin/env node

/**
 * Perplexity MCP Server
 * Provides MCP tools for AI-powered search and RFP discovery using Perplexity API
 */

const { Server } = require('@modelcontextprotocol/sdk/server/index.js');
const { StdioServerTransport } = require('@modelcontextprotocol/sdk/server/stdio.js');
const {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} = require('@modelcontextprotocol/sdk/types.js');

class PerplexityMCPServer {
  constructor() {
    this.server = new Server(
      {
        name: 'perplexity-mcp-server',
        version: '0.1.0',
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
    // List available tools
    this.server.setRequestHandler(ListToolsRequestSchema, async () => ({
      tools: [
        {
          name: 'chat_completion',
          description: 'Generate chat completions using Perplexity AI for RFP intelligence gathering',
          inputSchema: {
            type: 'object',
            properties: {
              messages: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    role: {
                      type: 'string',
                      enum: ['system', 'user', 'assistant']
                    },
                    content: {
                      type: 'string'
                    }
                  },
                  required: ['role', 'content']
                },
                description: 'Array of messages for the conversation',
              },
              prompt_template: {
                type: 'string',
                enum: ['technical_docs', 'security_practices', 'code_review', 'api_docs'],
                description: 'Predefined prompt template for RFP analysis',
                default: 'technical_docs'
              },
              custom_template: {
                type: 'object',
                properties: {
                  system: {
                    type: 'string',
                    description: 'Custom system message for RFP analysis',
                  },
                  format: {
                    type: 'string',
                    enum: ['text', 'markdown', 'json'],
                    description: 'Response format',
                    default: 'markdown'
                  },
                  include_sources: {
                    type: 'boolean',
                    description: 'Include source URLs in response',
                    default: true
                  }
                },
                description: 'Custom prompt template configuration'
              },
              format: {
                type: 'string',
                enum: ['text', 'markdown', 'json'],
                description: 'Response format for RFP results',
                default: 'markdown'
              },
              include_sources: {
                type: 'boolean',
                description: 'Include source URLs in RFP search results',
                default: true
              },
              model: {
                type: 'string',
                enum: ['sonar-pro', 'sonar', 'llama-3.1-sonar-small-128k-online', 'llama-3.1-sonar-large-128k-online', 'llama-3.1-sonar-huge-128k-online'],
                description: 'Model to use for RFP analysis',
                default: 'sonar-pro'
              },
              temperature: {
                type: 'number',
                minimum: 0,
                maximum: 1,
                description: 'Controls randomness in output',
                default: 0.7
              },
              max_tokens: {
                type: 'number',
                minimum: 1,
                maximum: 4096,
                description: 'Maximum tokens in response',
                default: 1024
              }
            },
            required: ['messages'],
          },
        }
      ],
    }));

    // Handle tool calls
    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args } = request.params;

      try {
        switch (name) {
          case 'chat_completion':
            return await this.handleChatCompletion(args);
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

  async handleChatCompletion(args) {
    const {
      messages,
      prompt_template = 'technical_docs',
      custom_template,
      format = 'markdown',
      include_sources = true,
      model = 'sonar-pro',
      temperature = 0.7,
      max_tokens = 1024
    } = args;

    if (!process.env.PERPLEXITY_API_KEY) {
      throw new Error('Perplexity API key not configured. Please set PERPLEXITY_API_KEY environment variable.');
    }

    // Validate messages
    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      throw new Error('Messages array is required and must not be empty');
    }

    // Build the request payload
    const payload = {
      model,
      messages,
      temperature,
      max_tokens,
    };

    // Handle template configurations
    if (custom_template) {
      if (custom_template.system) {
        payload.system = custom_template.system;
      }
      if (custom_template.format !== undefined) {
        format = custom_template.format;
      }
      if (custom_template.include_sources !== undefined) {
        include_sources = custom_template.include_sources;
      }
    } else if (prompt_template) {
      // Apply predefined templates for RFP analysis
      switch (prompt_template) {
        case 'technical_docs':
          payload.system = `You are an expert RFP intelligence analyst specializing in sports industry procurement. Your task is to search for and analyze Request for Proposals (RFPs), tenders, and procurement opportunities.

Focus on:
- Sports technology and digital transformation projects
- Stadium modernization and venue management systems
- Sports analytics and data platform implementations
- Fan engagement and mobile application development
- Sports club management software solutions

For each RFP found, provide:
1. Project title and organization
2. Technical requirements and scope
3. Estimated value and timeline
4. Submission deadline and contact information
5. Opportunity assessment and fit analysis

Return structured analysis with confidence scores for each opportunity.`;
          break;
        case 'security_practices':
          payload.system = `You are an RFP security compliance analyst focusing on sports industry procurement. Analyze security requirements and compliance standards in RFPs.

Focus on:
- Data protection and privacy requirements
- Security standards and certifications needed
- Risk assessment methodologies
- Compliance frameworks (GDPR, CCPA, etc.)
- Security architecture requirements

Provide security compliance analysis for each RFP opportunity.`;
          break;
        case 'code_review':
          payload.system = `You are a technical RFP reviewer specializing in software development requirements. Analyze technical specifications and implementation requirements.

Focus on:
- Technology stack compatibility
- Integration requirements
- Development methodologies
- Performance and scalability requirements
- Maintenance and support obligations

Provide technical feasibility analysis for each RFP.`;
          break;
        case 'api_docs':
          payload.system = `You are an API and integration specialist for RFP analysis. Focus on system integration requirements and API specifications.

Focus on:
- Third-party integration requirements
- API documentation standards
- Data exchange formats
- Authentication and authorization
- Integration timeline and complexity

Provide integration complexity analysis for each RFP.`;
          break;
      }
    }

    try {
      console.log(`Calling Perplexity API with model: ${model}`);
      
      const response = await fetch('https://api.perplexity.ai/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${process.env.PERPLEXITY_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('Perplexity API error:', response.status, errorText);
        throw new Error(`Perplexity API error: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      
      // Extract response content
      let responseContent = '';
      if (data.choices && data.choices.length > 0 && data.choices[0].message) {
        responseContent = data.choices[0].message.content;
      }

      // Format the response with additional RFP metadata
      let formattedResponse = `RFP Intelligence Analysis\n`;
      formattedResponse += `===========================\n\n`;
      formattedResponse += `Model: ${data.model}\n`;
      formattedResponse += `Tokens Used: ${data.usage?.total_tokens || 'N/A'}\n`;
      formattedResponse += `Analysis Time: ${new Date().toISOString()}\n\n`;
      formattedResponse += `${responseContent}\n\n`;

      // Include sources if available and requested
      if (include_sources && data.citations && data.citations.length > 0) {
        formattedResponse += `Sources:\n`;
        formattedResponse += `--------\n`;
        data.citations.forEach((citation, index) => {
          formattedResponse += `${index + 1}. ${citation}\n`;
        });
      }

      // Add RFP-specific metadata if this is an RFP analysis
      if (responseContent.toLowerCase().includes('rfp') || 
          responseContent.toLowerCase().includes('tender') ||
          responseContent.toLowerCase().includes('procurement')) {
        
        formattedResponse += `\n\nRFP Analysis Summary:\n`;
        formattedResponse += `===================\n`;
        
        // Extract potential opportunities (simple keyword matching)
        const opportunityKeywords = ['opportunity', 'deadline', 'submission', 'bid', 'contract'];
        let opportunityCount = 0;
        
        opportunityKeywords.forEach(keyword => {
          const regex = new RegExp(`\\b${keyword}\\b`, 'gi');
          const matches = responseContent.match(regex);
          if (matches) {
            opportunityCount += matches.length;
          }
        });
        
        formattedResponse += `Estimated Opportunities Found: ${opportunityCount}\n`;
        formattedResponse += `Analysis Confidence: High\n`;
      }

      return {
        content: [
          {
            type: 'text',
            text: formattedResponse,
          },
        ],
      };
    } catch (error) {
      console.error('Perplexity API error:', error);
      throw new Error(`Chat completion failed: ${error.message}`);
    }
  }

  async run() {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    console.error('Perplexity MCP server running on stdio');
  }
}

// Run the server
const server = new PerplexityMCPServer();
server.run().catch(console.error);