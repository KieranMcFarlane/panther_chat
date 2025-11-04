/**
 * API Endpoint Testing Suite
 * Tests all API endpoints for AG-UI + Claude Code SDK integration
 */

import { TEST_CONFIG } from './test-config.ts';

class APIEndpointTester {
    constructor() {
        this.testResults = [];
        this.baseUrl = 'http://localhost:3005';
        this.timeout = 10000; // 10 seconds timeout
    }

    async runTest(testName, testFunction) {
        console.log(`\n🧪 Running test: ${testName}`);
        try {
            const result = await testFunction();
            this.testResults.push({ name: testName, success: true, result });
            console.log(`✅ ${testName} - PASSED`);
            return true;
        } catch (error) {
            console.error(`❌ ${testName} - FAILED:`, error.message);
            this.testResults.push({ name: testName, success: false, error: error.message });
            return false;
        }
    }

    async makeRequest(endpoint, options = {}) {
        const url = `${this.baseUrl}${endpoint}`;
        const defaultOptions = {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            timeout: this.timeout
        };

        const mergedOptions = { ...defaultOptions, ...options };

        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), this.timeout);

            const response = await fetch(url, {
                ...mergedOptions,
                signal: controller.signal
            });

            clearTimeout(timeoutId);

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }

            const data = await response.json();
            return { success: true, data, status: response.status };
        } catch (error) {
            if (error.name === 'AbortError') {
                throw new Error(`Request timeout after ${this.timeout}ms`);
            }
            throw error;
        }
    }

    async testClaudeAgentInitialize() {
        const requestData = {
            test: true,
            capabilities: ['analyze_relationship_health', 'generate_email_strategy'],
            config: {
                test_mode: true,
                mock_responses: true
            }
        };

        const response = await this.makeRequest('/api/claude-agent/initialize', {
            method: 'POST',
            body: JSON.stringify(requestData)
        });

        if (!response.success) {
            throw new Error('Failed to initialize Claude agent');
        }

        const { data } = response;
        
        // Validate response structure
        const requiredFields = ['success', 'agentId', 'capabilities', 'status'];
        const missingFields = requiredFields.filter(field => !data[field]);
        
        if (missingFields.length > 0) {
            throw new Error(`Missing required fields: ${missingFields.join(', ')}`);
        }

        if (!Array.isArray(data.capabilities) || data.capabilities.length === 0) {
            throw new Error('Agent capabilities should be a non-empty array');
        }

        return {
            agentId: data.agentId,
            capabilitiesCount: data.capabilities.length,
            status: data.status,
            initializationTime: new Date().toISOString()
        };
    }

    async testClaudeAgentProcess() {
        const testRequests = [
            {
                prompt: 'Analyze relationship health for test_person_001',
                context: { test: true, timeframe: 30 },
                expectedActions: ['analyze_relationship_health']
            },
            {
                prompt: 'Generate a partnership email strategy',
                context: { test: true, goal: 'partnership', personId: 'test_person_001' },
                expectedActions: ['generate_email_strategy']
            },
            {
                prompt: 'Execute email campaign for high-value contacts',
                context: { test: true, criteria: { relationshipScore: 80 } },
                expectedActions: ['execute_email_campaign']
            }
        ];

        const results = [];

        for (const test of testRequests) {
            const response = await this.makeRequest('/api/claude-agent/process', {
                method: 'POST',
                body: JSON.stringify(test)
            });

            if (!response.success) {
                throw new Error(`Failed to process request: ${test.prompt}`);
            }

            const { data } = response;

            if (!data.success) {
                throw new Error(`Agent processing failed for: ${test.prompt}`);
            }

            // Check if expected actions are present
            const hasExpectedAction = test.expectedActions.some(expectedAction => 
                data.actions && data.actions.some(action => 
                    action.type && action.type.includes(expectedAction)
                )
            );

            if (!hasExpectedAction) {
                console.warn(`Warning: Expected action not found for: ${test.prompt}`);
            }

            results.push({
                prompt: test.prompt,
                success: data.success,
                hasReasoning: !!data.reasoning,
                hasActions: Array.isArray(data.actions) && data.actions.length > 0,
                hasResult: !!data.result,
                confidence: data.confidence || 0,
                processingTime: data.processingTime || 0
            });
        }

        const avgConfidence = results.reduce((sum, r) => sum + r.confidence, 0) / results.length;
        const avgProcessingTime = results.reduce((sum, r) => sum + r.processingTime, 0) / results.length;

        return {
            requestsProcessed: results.length,
            averageConfidence: avgConfidence.toFixed(2),
            averageProcessingTime: Math.round(avgProcessingTime),
            results
        };
    }

    async testClaudeAgentExecute() {
        const testActions = [
            {
                type: 'mcp__email__analyze_relationship_health',
                parameters: { person_id: 'test_person_001', timeframe: 30 }
            },
            {
                type: 'mcp__email__generate_email_strategy',
                parameters: { person_id: 'test_person_001', goal: 'partnership' }
            },
            {
                type: 'send_email',
                parameters: { 
                    to: 'test@example.com', 
                    subject: 'Test Email', 
                    body: 'This is a test email' 
                }
            },
            {
                type: 'update_database',
                parameters: { operation: 'update', data: { test: true } }
            }
        ];

        const results = [];

        for (const action of testActions) {
            const response = await this.makeRequest('/api/claude-agent/execute', {
                method: 'POST',
                body: JSON.stringify({
                    id: `test_action_${Date.now()}`,
                    ...action
                })
            });

            if (!response.success) {
                throw new Error(`Failed to execute action: ${action.type}`);
            }

            const { data } = response;

            if (!data.success) {
                throw new Error(`Action execution failed: ${action.type}`);
            }

            results.push({
                actionType: action.type,
                actionId: data.actionId,
                executedAt: data.executedAt,
                hasResult: !!data.result
            });
        }

        return {
            actionsExecuted: results.length,
            successfulExecutions: results.filter(r => r.hasResult).length,
            results
        };
    }

    async testAutonomousCampaign() {
        const campaignRequest = {
            goal: 'Test partnership outreach campaign',
            criteria: {
                priority: 'high',
                daysSinceContact: 30,
                industry: 'sports',
                relationshipScore: 70,
                location: 'UK'
            }
        };

        const response = await this.makeRequest('/api/claude-agent/autonomous-campaign', {
            method: 'POST',
            body: JSON.stringify(campaignRequest)
        });

        if (!response.success) {
            throw new Error('Failed to launch autonomous campaign');
        }

        const { data } = response;

        if (!data.success) {
            throw new Error('Autonomous campaign launch failed');
        }

        // Validate campaign structure
        const { campaign } = data;
        const requiredFields = ['id', 'goal', 'criteria', 'targetCount', 'status'];
        const missingFields = requiredFields.filter(field => !campaign[field]);

        if (missingFields.length > 0) {
            throw new Error(`Missing campaign fields: ${missingFields.join(', ')}`);
        }

        // Validate execution summary
        const { executionSummary } = data;
        if (!executionSummary || typeof executionSummary.stepsCompleted !== 'number') {
            throw new Error('Invalid execution summary');
        }

        return {
            campaign: {
                id: campaign.id,
                goal: campaign.goal,
                targetCount: campaign.targetCount,
                status: campaign.status,
                estimatedTime: campaign.estimatedTime
            },
            executionSummary: {
                stepsCompleted: executionSummary.stepsCompleted,
                hasReasoning: !!executionSummary.reasoning,
                totalProcessingTime: executionSummary.totalProcessingTime
            }
        };
    }

    async testEmailSendAPI() {
        const emailRequest = {
            to: 'test@example.com',
            subject: 'Test Email from API',
            body: 'This is a test email sent via the API endpoint.',
            from: 'test@yellowpanther.ai',
            template: 'test',
            variables: {
                name: 'Test User',
                company: 'Test Company'
            }
        };

        const response = await this.makeRequest('/api/email/send', {
            method: 'POST',
            body: JSON.stringify(emailRequest)
        });

        if (!response.success) {
            throw new Error('Failed to send test email');
        }

        const { data } = response;

        if (!data.success) {
            throw new Error(`Email send failed: ${data.message || 'Unknown error'}`);
        }

        // Validate email response
        if (!data.emailId && !data.messageId) {
            throw new Error('Email response should contain emailId or messageId');
        }

        return {
            emailId: data.emailId,
            messageId: data.messageId,
            status: data.status,
            sentAt: data.sentAt,
            provider: 'Inbound Email SDK'
        };
    }

    async testEndpointPerformance() {
        const endpoints = [
            '/api/claude-agent/initialize',
            '/api/claude-agent/process',
            '/api/claude-agent/execute',
            '/api/email/send'
        ];

        const performanceResults = [];

        for (const endpoint of endpoints) {
            const startTime = Date.now();
            
            try {
                let requestBody = {};
                
                switch (endpoint) {
                    case '/api/claude-agent/initialize':
                        requestBody = { test: true };
                        break;
                    case '/api/claude-agent/process':
                        requestBody = { prompt: 'Test performance', context: { test: true } };
                        break;
                    case '/api/claude-agent/execute':
                        requestBody = { type: 'test_action', parameters: {} };
                        break;
                    case '/api/email/send':
                        requestBody = { to: 'test@example.com', subject: 'Test', body: 'Test' };
                        break;
                }

                const response = await this.makeRequest(endpoint, {
                    method: 'POST',
                    body: JSON.stringify(requestBody)
                });

                const responseTime = Date.now() - startTime;

                performanceResults.push({
                    endpoint,
                    responseTime,
                    success: response.success,
                    status: response.status
                });

            } catch (error) {
                const responseTime = Date.now() - startTime;
                performanceResults.push({
                    endpoint,
                    responseTime,
                    success: false,
                    error: error.message
                });
            }
        }

        const successfulRequests = performanceResults.filter(r => r.success);
        const avgResponseTime = successfulRequests.length > 0 
            ? successfulRequests.reduce((sum, r) => sum + r.responseTime, 0) / successfulRequests.length 
            : 0;

        const maxResponseTime = Math.max(...performanceResults.map(r => r.responseTime));
        const performanceThresholds = TEST_CONFIG.performanceThresholds;

        if (avgResponseTime > performanceThresholds.maxResponseTime) {
            throw new Error(`Average response time ${avgResponseTime}ms exceeds threshold ${performanceThresholds.maxResponseTime}ms`);
        }

        return {
            totalEndpoints: endpoints.length,
            successfulRequests: successfulRequests.length,
            averageResponseTime: Math.round(avgResponseTime),
            maxResponseTime,
            performanceThreshold: performanceThresholds.maxResponseTime,
            results: performanceResults
        };
    }

    async testErrorHandling() {
        const errorScenarios = [
            {
                name: 'Invalid JSON',
                endpoint: '/api/claude-agent/process',
                body: 'invalid json',
                expectedStatus: 400
            },
            {
                name: 'Missing Required Fields',
                endpoint: '/api/claude-agent/process',
                body: JSON.stringify({}),
                expectedStatus: 400
            },
            {
                name: 'Invalid Action Type',
                endpoint: '/api/claude-agent/execute',
                body: JSON.stringify({ type: 'invalid_action', parameters: {} }),
                expectedStatus: 500
            },
            {
                name: 'Invalid Email Format',
                endpoint: '/api/email/send',
                body: JSON.stringify({ to: 'invalid-email', subject: 'Test', body: 'Test' }),
                expectedStatus: 400
            }
        ];

        const errorResults = [];

        for (const scenario of errorScenarios) {
            try {
                const response = await fetch(`${this.baseUrl}${scenario.endpoint}`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: scenario.body
                });

                errorResults.push({
                    scenario: scenario.name,
                    status: response.status,
                    handled: response.status >= 400 && response.status < 600,
                    expectedStatus: scenario.expectedStatus
                });

            } catch (error) {
                errorResults.push({
                    scenario: scenario.name,
                    error: error.message,
                    handled: false
                });
            }
        }

        const handledErrors = errorResults.filter(r => r.handled).length;
        const errorHandlingRate = (handledErrors / errorScenarios.length * 100).toFixed(1);

        if (parseFloat(errorHandlingRate) < 80) {
            throw new Error(`Error handling rate insufficient: ${errorHandlingRate}%`);
        }

        return {
            totalScenarios: errorScenarios.length,
            handledErrors,
            errorHandlingRate: `${errorHandlingRate}%`,
            results: errorResults
        };
    }

    async testConcurrentRequests() {
        const concurrentRequests = [];
        const requestCount = 10;

        // Create concurrent requests
        for (let i = 0; i < requestCount; i++) {
            concurrentRequests.push(
                this.makeRequest('/api/claude-agent/process', {
                    method: 'POST',
                    body: JSON.stringify({
                        prompt: `Concurrent test request ${i}`,
                        context: { test: true, requestId: i }
                    })
                })
            );
        }

        const startTime = Date.now();
        const results = await Promise.allSettled(concurrentRequests);
        const totalTime = Date.now() - startTime;

        const successfulRequests = results.filter(r => r.status === 'fulfilled').length;
        const failedRequests = results.filter(r => r.status === 'rejected').length;
        const successRate = (successfulRequests / requestCount * 100).toFixed(1);

        if (parseFloat(successRate) < 90) {
            throw new Error(`Concurrent request success rate too low: ${successRate}%`);
        }

        return {
            totalRequests: requestCount,
            successfulRequests,
            failedRequests,
            successRate: `${successRate}%`,
            totalTime,
            averageTime: Math.round(totalTime / requestCount)
        };
    }

    async generateTestReport() {
        const totalTests = this.testResults.length;
        const passedTests = this.testResults.filter(r => r.success).length;
        const failedTests = totalTests - passedTests;
        const successRate = (passedTests / totalTests * 100).toFixed(1);

        const report = {
            testSuite: 'API Endpoint Testing',
            timestamp: new Date().toISOString(),
            baseUrl: this.baseUrl,
            summary: {
                totalTests,
                passedTests,
                failedTests,
                successRate: `${successRate}%`
            },
            results: this.testResults,
            recommendations: this.generateRecommendations(failedTests)
        };

        return report;
    }

    generateRecommendations(failedTests) {
        const recommendations = [];

        if (failedTests > 0) {
            recommendations.push('Review and fix failed API endpoint tests');
            recommendations.push('Check API implementation and error handling');
        }

        const performanceResults = this.testResults.filter(r => r.result && r.result.averageResponseTime);
        if (performanceResults.length > 0) {
            const avgResponseTime = performanceResults[0].result.averageResponseTime;
            if (avgResponseTime > 2000) {
                recommendations.push('Optimize API response times - current average is above 2 seconds');
            }
        }

        const concurrentResults = this.testResults.filter(r => r.result && r.result.successRate);
        if (concurrentResults.length > 0) {
            const successRate = parseFloat(concurrentResults[0].result.successRate);
            if (successRate < 95) {
                recommendations.push('Improve concurrent request handling');
            }
        }

        if (recommendations.length === 0) {
            recommendations.push('All API endpoints are functioning correctly');
        }

        return recommendations;
    }

    async runAllTests() {
        console.log('🔌 Starting API Endpoint Test Suite');
        console.log('='.repeat(50));
        console.log(`Base URL: ${this.baseUrl}`);
        console.log(`Timeout: ${this.timeout}ms`);

        // Check if server is running
        try {
            await this.makeRequest('/api/health', { method: 'GET' });
        } catch (error) {
            console.warn('⚠️  Warning: Could not reach health endpoint. Make sure the server is running on port 3005.');
        }

        // Run all test cases
        await this.runTest('Claude Agent Initialize', () => this.testClaudeAgentInitialize());
        await this.runTest('Claude Agent Process', () => this.testClaudeAgentProcess());
        await this.runTest('Claude Agent Execute', () => this.testClaudeAgentExecute());
        await this.runTest('Autonomous Campaign', () => this.testAutonomousCampaign());
        await this.runTest('Email Send API', () => this.testEmailSendAPI());
        await this.runTest('Endpoint Performance', () => this.testEndpointPerformance());
        await this.runTest('Error Handling', () => this.testErrorHandling());
        await this.runTest('Concurrent Requests', () => this.testConcurrentRequests());

        // Generate and display report
        const report = await this.generateTestReport();

        console.log('\n' + '='.repeat(50));
        console.log('📊 API Endpoint Test Suite Complete');
        console.log(`Total Tests: ${report.summary.totalTests}`);
        console.log(`Passed: ${report.summary.passedTests}`);
        console.log(`Failed: ${report.summary.failedTests}`);
        console.log(`Success Rate: ${report.summary.successRate}`);

        if (report.summary.failedTests > 0) {
            console.log('\n❌ Failed Tests:');
            report.results.filter(r => !r.success).forEach(test => {
                console.log(`  - ${test.name}: ${test.error}`);
            });
        }

        console.log('\n💡 Recommendations:');
        report.recommendations.forEach(rec => {
            console.log(`  - ${rec}`);
        });

        return report.summary.failedTests === 0;
    }
}

// Run tests if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
    const tester = new APIEndpointTester();
    tester.runAllTests().then(success => {
        process.exit(success ? 0 : 1);
    }).catch(error => {
        console.error('Test suite failed:', error);
        process.exit(1);
    });
}

export { APIEndpointTester };