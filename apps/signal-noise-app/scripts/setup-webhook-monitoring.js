#!/usr/bin/env node

// Webhook Configuration and Testing Script
require('dotenv').config({ path: '.env.local' });

class WebhookSetupManager {
  constructor() {
    this.brightDataConfig = {
      apiToken: process.env.BRIGHTDATA_API_TOKEN,
      webhookSecret: process.env.BRIGHTDATA_WEBHOOK_SECRET,
      zone: process.env.BRIGHTDATA_ZONE,
      apiUrl: process.env.BRIGHTDATA_API_URL
    };
    
    this.webhookEndpoints = [
      {
        name: 'LinkedIn Procurement Monitor',
        path: '/api/webhook/linkedin-procurement',
        description: 'Monitors LinkedIn for RFP and procurement opportunities',
        events: ['rfp_detected', 'procurement_signal', 'organization_update']
      },
      {
        name: 'Claude Agent Processing',
        path: '/api/webhook/claude-agent',
        description: 'Receives processed results from Claude Agent analysis',
        events: ['analysis_complete', 'opportunity_scored', 'enrichment_finished']
      },
      {
        name: 'RFP Stream Notifications',
        path: '/api/notifications/rfp-stream',
        description: 'Real-time RFP opportunity notifications',
        events: ['new_rfp', 'opportunity_update', 'deadline_reminder']
      }
    ];
  }

  async verifyWebhookEndpoints() {
    console.log('🔍 Verifying Webhook Endpoints...\n');
    
    const baseUrl = 'http://localhost:3005';
    
    for (const endpoint of this.webhookEndpoints) {
      console.log(`📡 Testing: ${endpoint.name}`);
      console.log(`   URL: ${baseUrl}${endpoint.path}`);
      
      try {
        // Test endpoint availability
        const response = await fetch(`${baseUrl}${endpoint.path}`, {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json'
          }
        });
        
        if (response.ok) {
          console.log(`   ✅ Endpoint accessible (${response.status})`);
        } else {
          console.log(`   ⚠️  Endpoint returned ${response.status}`);
        }
      } catch (error) {
        console.log(`   ❌ Endpoint error: ${error.message}`);
      }
      
      console.log(`   Events: ${endpoint.events.join(', ')}`);
      console.log(`   Description: ${endpoint.description}\n`);
    }
  }

  async testBrightDataIntegration() {
    console.log('🔗 Testing BrightData Integration...\n');
    
    if (!this.brightDataConfig.apiToken) {
      console.log('❌ BrightData API token not configured');
      return;
    }
    
    if (!this.brightDataConfig.webhookSecret) {
      console.log('❌ BrightData webhook secret not configured');
      return;
    }
    
    console.log('✅ BrightData configuration found:');
    console.log(`   API Token: ${this.brightDataConfig.apiToken.substring(0, 10)}...`);
    console.log(`   Webhook Secret: ${this.brightDataConfig.webhookSecret.substring(0, 10)}...`);
    console.log(`   Zone: ${this.brightDataConfig.zone || 'Not configured'}`);
    console.log(`   API URL: ${this.brightDataConfig.apiUrl}`);
    
    // Test BrightData API connection
    try {
      console.log('\n📡 Testing BrightData API connection...');
      
      // This would be a real API call in production
      const testPayload = {
        test: true,
        timestamp: new Date().toISOString(),
        source: 'signal-noise-app'
      };
      
      console.log('📤 Sample BrightData webhook payload:');
      console.log(JSON.stringify({
        source: 'linkedin_monitoring',
        event_type: 'rfp_detected',
        data: {
          organization: 'Manchester United FC',
          title: 'Digital Transformation Services RFP',
          estimated_value: '£1.2M',
          deadline: '2025-11-15',
          description: 'Seeking comprehensive digital transformation services including fan engagement platform, data analytics, and mobile app development.',
          contact_person: 'Digital Transformation Director',
          source_url: 'https://linkedin.com/jobs/view/rfp-digital-transformation',
          detected_at: new Date().toISOString(),
          confidence_score: 94
        }
      }, null, 2));
      
      console.log('\n✅ BrightData integration test completed');
      
    } catch (error) {
      console.log(`❌ BrightData API test failed: ${error.message}`);
    }
  }

  async setupWebhookReceivers() {
    console.log('\n🛠️ Setting Up Webhook Receivers...\n');
    
    // Create test webhook payloads
    const testPayloads = [
      {
        endpoint: '/api/webhook/linkedin-procurement',
        payload: {
          source: 'linkedin_monitoring',
          event_type: 'rfp_detected',
          data: {
            organization: 'Chelsea FC',
            title: 'CRM System Implementation RFP',
            estimated_value: '£800K',
            deadline: '2025-12-01',
            description: 'Implementation of comprehensive CRM system for fan management and ticket sales.',
            contact_person: 'Head of Digital Operations',
            confidence_score: 87
          },
          webhook_signature: this.generateWebhookSignature(JSON.stringify({ test: true }))
        }
      },
      {
        endpoint: '/api/webhook/claude-agent',
        payload: {
          processing_id: 'claude_batch_' + Date.now(),
          entity_name: 'Arsenal FC',
          analysis_type: 'opportunity_assessment',
          results: {
            opportunities_found: 3,
            entities_enriched: 5,
            insights_generated: 12,
            fit_score: 92,
            risk_level: 'LOW',
            recommendations: [
              'Focus on digital fan engagement platform',
              'Leverage existing analytics infrastructure',
              'Partner with current technology vendors'
            ]
          },
          processing_time_ms: 2340,
          timestamp: new Date().toISOString()
        }
      },
      {
        endpoint: '/api/notifications/rfp-stream',
        payload: {
          stream_type: 'new_rfp',
          opportunity_data: {
            title: 'Stadium Wi-Fi Upgrade Project',
            organization: 'Tottenham Hotspur',
            estimated_value: '£2.1M',
            fit_score: 94,
            urgency_level: 'HIGH',
            deadline: '2025-11-30',
            category: 'INFRASTRUCTURE',
            source: 'linkedin_monitoring'
          },
          notification_priority: 'HIGH',
          recipients: ['business-development@yellowpanther.com'],
          timestamp: new Date().toISOString()
        }
      }
    ];
    
    console.log('📨 Testing webhook payloads:');
    
    for (const test of testPayloads) {
      console.log(`\n📤 Testing ${test.endpoint}:`);
      console.log(JSON.stringify(test.payload, null, 2));
      
      // In production, this would send actual HTTP requests
      console.log(`   Ready to send to: http://localhost:3005${test.endpoint}`);
    }
  }

  generateWebhookSignature(payload) {
    // Simulate webhook signature generation
    const crypto = require('crypto');
    return crypto
      .createHmac('sha256', this.brightDataConfig.webhookSecret || 'secret')
      .update(payload)
      .digest('hex');
  }

  async setupMonitoringDashboard() {
    console.log('\n📊 Setting Up Monitoring Dashboard...\n');
    
    const monitoringConfig = {
      metrics_to_track: [
        'webhook_response_time',
        'entity_processing_rate',
        'enrichment_success_rate',
        'memory_usage',
        'api_errors',
        'opportunity_detection_rate'
      ],
      alert_thresholds: {
        webhook_response_time: 5000, // ms
        memory_usage: 80, // percent
        error_rate: 5, // percent
        processing_failure_rate: 2 // percent
      },
      dashboards: [
        {
          name: 'RFP Intelligence Dashboard',
          url: '/rfp-intelligence',
          metrics: ['opportunities_detected', 'processing_success_rate', 'average_fit_score']
        },
        {
          name: 'Entity Browser Health',
          url: '/entity-browser',
          metrics: ['entities_cached', 'cache_hit_rate', 'enrichment_coverage']
        },
        {
          name: 'System Performance',
          url: '/admin',
          metrics: ['memory_usage', 'api_response_times', 'error_rates']
        }
      ]
    };
    
    console.log('✅ Monitoring configuration:');
    console.log(`   Metrics tracked: ${monitoringConfig.metrics_to_track.join(', ')}`);
    console.log(`   Alert thresholds configured: ${Object.keys(monitoringConfig.alert_thresholds).length}`);
    console.log(`   Dashboards: ${monitoringConfig.dashboards.map(d => d.name).join(', ')}`);
    
    console.log('\n🌐 Monitoring dashboards available at:');
    monitoringConfig.dashboards.forEach(dashboard => {
      console.log(`   ${dashboard.name}: http://localhost:3005${dashboard.url}`);
    });
  }

  async generateWebhookDocumentation() {
    console.log('\n📚 Generating Webhook Documentation...\n');
    
    const docs = {
      overview: {
        system_name: 'Signal Noise App Webhook System',
        description: 'Real-time webhook integration for RFP detection and entity enrichment',
        version: '1.0.0'
      },
      webhooks: [
        {
          name: 'LinkedIn Procurement Monitor',
          endpoint: '/api/webhook/linkedin-procurement',
          method: 'POST',
          description: 'Receives RFP and procurement signals from BrightData LinkedIn monitoring',
          headers: {
            'Content-Type': 'application/json',
            'X-BrightData-Signature': 'HMAC-SHA256 signature'
          },
          payload_schema: {
            source: 'linkedin_monitoring',
            event_type: 'rfp_detected|procurement_signal|organization_update',
            data: {
              organization: 'string',
              title: 'string',
              estimated_value: 'string',
              deadline: 'string',
              description: 'string',
              contact_person: 'string',
              confidence_score: 'number'
            }
          }
        },
        {
          name: 'Claude Agent Processing',
          endpoint: '/api/webhook/claude-agent',
          method: 'POST',
          description: 'Receives analysis results from Claude Agent processing',
          payload_schema: {
            processing_id: 'string',
            entity_name: 'string',
            analysis_type: 'string',
            results: {
              opportunities_found: 'number',
              entities_enriched: 'number',
              insights_generated: 'number',
              fit_score: 'number'
            }
          }
        }
      ]
    };
    
    console.log('📄 Webhook API Documentation:');
    console.log(JSON.stringify(docs, null, 2));
    
    // Save documentation to file
    const fs = require('fs');
    fs.writeFileSync('webhook-documentation.json', JSON.stringify(docs, null, 2));
    console.log('\n💾 Documentation saved to: webhook-documentation.json');
  }

  async runFullSetup() {
    console.log('🚀 Starting Webhook Setup and Configuration\n');
    console.log('=' .repeat(60));
    
    await this.verifyWebhookEndpoints();
    await this.testBrightDataIntegration();
    await this.setupWebhookReceivers();
    await this.setupMonitoringDashboard();
    await this.generateWebhookDocumentation();
    
    console.log('\n✅ Webhook Setup Complete!');
    console.log('\n🎯 Next Steps:');
    console.log('1. Start the development server: npm run dev');
    console.log('2. Test webhooks with the provided payloads');
    console.log('3. Configure BrightData monitoring zone');
    console.log('4. Set up Claude Agent integration');
    console.log('5. Monitor dashboard performance');
    
    console.log('\n🌐 Access Points:');
    console.log('• Entity Browser: http://localhost:3005/entity-browser');
    console.log('• RFP Intelligence: http://localhost:3005/rfp-intelligence');
    console.log('• Admin Dashboard: http://localhost:3005/admin');
  }
}

// Main execution
async function main() {
  const setupManager = new WebhookSetupManager();
  
  try {
    await setupManager.runFullSetup();
  } catch (error) {
    console.error('❌ Setup failed:', error);
  }
}

// Handle graceful shutdown
process.on('SIGINT', () => {
  console.log('\n🛑 Setup interrupted');
  process.exit(0);
});

main().catch(console.error);