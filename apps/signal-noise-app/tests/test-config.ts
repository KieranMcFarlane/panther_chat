// Test Configuration for AG-UI + Claude Code SDK Integration

export const TEST_CONFIG = {
  // Mock data for testing
  mockPersonProfile: {
    id: 'test_person_001',
    neo4j_id: 'test_neo4j_001',
    labels: ['Person'],
    properties: {
      name: 'Test User',
      role: 'Director of Innovation',
      affiliation: 'Test Sports Club',
      email: 'test.user@testsports.com',
      phone: '+44 123 456 7890',
      location: 'London, UK',
      bio: 'Test user for AI email agent integration',
      expertise: ['Digital Transformation', 'Sports Technology', 'Innovation'],
      interests: ['Football', 'Technology', 'Data Analytics'],
      relationshipScore: 85,
      opportunityScore: 90,
      aiAgentConfig: {
        enabled: true,
        autoReply: true,
        responseStyle: 'professional',
        responseDelay: 15,
        classificationRules: [
          {
            id: 'test_rule_001',
            type: 'partnership',
            keywords: ['partnership', 'collaboration', 'opportunity'],
            action: 'auto_reply',
            priority: 8,
            enabled: true,
            responseTemplate: 'Thank you for your partnership interest...'
          }
        ],
        customPrompts: [
          {
            id: 'test_prompt_001',
            name: 'Partnership Response',
            trigger: 'partnership_inquiry',
            template: 'Dear {name}, thank you for your interest...',
            variables: ['name', 'company'],
            enabled: true
          }
        ],
        workingHours: {
          start: '09:00',
          end: '17:00',
          timezone: 'GMT',
          weekends: false
        },
        escalationRules: []
      }
    }
  },

  // Test email data
  testEmails: [
    {
      id: 'test_email_001',
      subject: 'Partnership Opportunity - Sports Technology',
      body: 'I am interested in discussing a potential partnership opportunity with your club regarding sports technology solutions.',
      sender: { name: 'John Smith', email: 'john.smith@techcompany.com' },
      recipient: { name: 'Test User', email: 'test.user@testsports.com' },
      direction: 'inbound' as const,
      status: 'delivered' as const,
      aiGenerated: false,
      classification: 'partnership',
      sentiment: 'positive'
    }
  ],

  // Test campaigns
  testCampaigns: [
    {
      id: 'test_campaign_001',
      goal: 'Test partnership outreach',
      criteria: {
        industry: 'sports',
        relationshipScore: 70,
        location: 'UK'
      },
      targetCount: 5,
      expectedResults: {
        sentCount: 5,
        openRate: 80,
        responseRate: 40
      }
    }
  ],

  // Claude Code SDK test configuration
  claudeAgentConfig: {
    system_prompt: `You are a test AI agent for relationship management and email automation. 
    Your purpose is to demonstrate autonomous capabilities for:
    - Analyzing relationship health
    - Generating email strategies
    - Executing campaigns
    - Learning from interactions
    
    For testing, you should:
    - Use mock data when external APIs are not available
    - Simulate tool calls and responses
    - Provide detailed reasoning about your actions
    - Test all major workflows`,
    
    allowed_tools: [
      "Read", "Write", "Grep", "Glob", "Bash", "WebFetch",
      "mcp__email__analyze_relationship_health",
      "mcp__email__generate_email_strategy",
      "mcp__email__execute_email_campaign"
    ],
    
    permission_mode: "acceptEdits",
    max_turns: 10,
    timeout: 300000,
    enable_caching: true,
    
    // Test mode flags
    test_mode: true,
    mock_apis: true,
    simulate_responses: true
  },

  // AG-UI test configuration
  aguiTestConfig: {
    mockResponses: true,
    simulateProcessing: true,
    testScenarios: [
      {
        name: 'basic_relationship_analysis',
        description: 'Test basic relationship health analysis',
        input: 'Analyze relationship health for test_user_001',
        expectedActions: ['mcp__email__analyze_relationship_health'],
        expectedResponse: /health score|response rate|recommendations/
      },
      {
        name: 'strategy_generation',
        description: 'Test email strategy generation',
        input: 'Generate a partnership email strategy for John Smith',
        expectedActions: ['mcp__email__generate_email_strategy'],
        expectedResponse: /strategy|approach|timing|template/
      },
      {
        name: 'campaign_execution',
        description: 'Test autonomous campaign execution',
        input: 'Launch a test campaign for high-value contacts',
        expectedActions: ['mcp__email__execute_email_campaign'],
        expectedResponse: /campaign|contacts|execution|results/
      }
    ]
  },

  // API endpoints for testing
  testEndpoints: {
    initialize: '/api/claude-agent/initialize',
    process: '/api/claude-agent/process',
    execute: '/api/claude-agent/execute',
    autonomousCampaign: '/api/claude-agent/autonomous-campaign',
    personProfile: '/api/person/test_person_001'
  },

  // Performance thresholds
  performanceThresholds: {
    maxResponseTime: 5000, // 5 seconds
    minSuccessRate: 0.95, // 95% success rate
    maxMemoryUsage: 512 * 1024 * 1024, // 512MB
    maxCpuUsage: 80 // 80% CPU
  }
};

export default TEST_CONFIG;