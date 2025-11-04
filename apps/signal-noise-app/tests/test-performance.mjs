/**
 * Performance Testing Suite
 * Tests performance thresholds and system scalability
 */

import { TEST_CONFIG } from './test-config.ts';

class PerformanceTester {
    constructor() {
        this.testResults = [];
        this.thresholds = TEST_CONFIG.performanceThresholds;
        this.baseUrl = 'http://localhost:3005';
    }

    async runTest(testName, testFunction) {
        console.log(`\n⚡ Running performance test: ${testName}`);
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

    async measureResponseTime(endpoint, requestData = {}) {
        const startTime = performance.now();
        
        try {
            const response = await fetch(`${this.baseUrl}${endpoint}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(requestData)
            });

            const responseTime = performance.now() - startTime;

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }

            const data = await response.json();
            return {
                responseTime,
                success: true,
                data,
                status: response.status
            };
        } catch (error) {
            const responseTime = performance.now() - startTime;
            return {
                responseTime,
                success: false,
                error: error.message
            };
        }
    }

    async testAPIResponseTimes() {
        const endpoints = [
            {
                path: '/api/claude-agent/initialize',
                data: { test: true },
                description: 'Agent Initialization'
            },
            {
                path: '/api/claude-agent/process',
                data: { prompt: 'Test performance', context: { test: true } },
                description: 'Agent Processing'
            },
            {
                path: '/api/claude-agent/execute',
                data: { type: 'test_action', parameters: {} },
                description: 'Action Execution'
            },
            {
                path: '/api/email/send',
                data: { to: 'test@example.com', subject: 'Test', body: 'Test body' },
                description: 'Email Sending'
            }
        ];

        const results = [];

        for (const endpoint of endpoints) {
            console.log(`  Testing ${endpoint.description}...`);
            
            // Run multiple iterations for each endpoint
            const iterations = 5;
            const times = [];

            for (let i = 0; i < iterations; i++) {
                const result = await this.measureResponseTime(endpoint.path, endpoint.data);
                times.push(result.responseTime);
                
                // Small delay between requests
                await new Promise(resolve => setTimeout(resolve, 100));
            }

            const avgTime = times.reduce((sum, time) => sum + time, 0) / times.length;
            const minTime = Math.min(...times);
            const maxTime = Math.max(...times);

            results.push({
                endpoint: endpoint.description,
                path: endpoint.path,
                iterations,
                averageTime: Math.round(avgTime),
                minTime: Math.round(minTime),
                maxTime: Math.round(maxTime),
                withinThreshold: avgTime <= this.thresholds.maxResponseTime
            });

            if (avgTime > this.thresholds.maxResponseTime) {
                throw new Error(`${endpoint.description} average response time ${Math.round(avgTime)}ms exceeds threshold ${this.thresholds.maxResponseTime}ms`);
            }
        }

        const overallAvgTime = results.reduce((sum, r) => sum + r.averageTime, 0) / results.length;

        return {
            endpoints: results.length,
            overallAverageTime: Math.round(overallAvgTime),
            threshold: this.thresholds.maxResponseTime,
            results
        };
    }

    async testMemoryUsage() {
        const initialMemory = process.memoryUsage();
        
        // Simulate memory-intensive operations
        const operations = [];
        for (let i = 0; i < 1000; i++) {
            operations.push({
                id: i,
                data: new Array(1000).fill(`test_data_${i}`),
                timestamp: Date.now()
            });
        }

        // Process the operations
        const processedData = operations.map(op => ({
            ...op,
            processed: true,
            dataHash: op.data.length
        }));

        const peakMemory = process.memoryUsage();
        const memoryIncrease = peakMemory.heapUsed - initialMemory.heapUsed;

        // Clean up
        operations.length = 0;
        processedData.length = 0;

        // Force garbage collection if available
        if (global.gc) {
            global.gc();
        }

        const finalMemory = process.memoryUsage();

        const metrics = {
            initialHeapUsed: initialMemory.heapUsed,
            peakHeapUsed: peakMemory.heapUsed,
            finalHeapUsed: finalMemory.heapUsed,
            memoryIncrease: memoryIncrease,
            memoryIncreaseMB: Math.round(memoryIncrease / 1024 / 1024 * 100) / 100,
            withinThreshold: memoryIncrease <= this.thresholds.maxMemoryUsage
        };

        if (memoryIncrease > this.thresholds.maxMemoryUsage) {
            throw new Error(`Memory increase ${metrics.memoryIncreaseMB}MB exceeds threshold ${Math.round(this.thresholds.maxMemoryUsage / 1024 / 1024)}MB`);
        }

        return metrics;
    }

    async testConcurrentLoad() {
        const concurrentUsers = [1, 5, 10, 20];
        const results = [];

        for (const userCount of concurrentUsers) {
            console.log(`  Testing with ${userCount} concurrent users...`);
            
            const startTime = performance.now();
            const requests = [];

            // Create concurrent requests
            for (let i = 0; i < userCount; i++) {
                requests.push(
                    this.measureResponseTime('/api/claude-agent/process', {
                        prompt: `Load test user ${i}`,
                        context: { test: true, userId: i }
                    })
                );
            }

            const requestResults = await Promise.allSettled(requests);
            const totalTime = performance.now() - startTime;

            const successfulRequests = requestResults.filter(r => 
                r.status === 'fulfilled' && r.value.success
            ).length;

            const failedRequests = requestResults.length - successfulRequests;
            const successRate = (successfulRequests / requestResults.length * 100).toFixed(1);
            const avgResponseTime = requestResults
                .filter(r => r.status === 'fulfilled')
                .reduce((sum, r) => sum + r.value.responseTime, 0) / successfulRequests;

            results.push({
                userCount,
                totalRequests: requestResults.length,
                successfulRequests,
                failedRequests,
                successRate: parseFloat(successRate),
                averageResponseTime: Math.round(avgResponseTime),
                totalTime: Math.round(totalTime),
                requestsPerSecond: Math.round(requestResults.length / (totalTime / 1000))
            });

            // Check if success rate falls below threshold
            if (parseFloat(successRate) < (this.thresholds.minSuccessRate * 100)) {
                throw new Error(`Success rate ${successRate}% for ${userCount} users below threshold ${(this.thresholds.minSuccessRate * 100).toFixed(1)}%`);
            }

            // Wait between test runs
            await new Promise(resolve => setTimeout(resolve, 1000));
        }

        return {
            testLevels: concurrentUsers.length,
            results,
            maxUsersSustained: Math.max(...results.filter(r => r.successRate >= 95).map(r => r.userCount))
        };
    }

    async testDatabasePerformance() {
        // Mock database performance tests
        const dbOperations = [
            { type: 'read', count: 100, description: 'Read Operations' },
            { type: 'write', count: 50, description: 'Write Operations' },
            { type: 'query', count: 25, description: 'Complex Queries' }
        ];

        const results = [];

        for (const operation of dbOperations) {
            console.log(`  Testing ${operation.description}...`);
            
            const startTime = performance.now();
            
            // Simulate database operations
            const operationResults = [];
            for (let i = 0; i < operation.count; i++) {
                const opStart = performance.now();
                
                // Simulate database operation
                await new Promise(resolve => setTimeout(resolve, Math.random() * 10 + 5));
                
                const opTime = performance.now() - opStart;
                operationResults.push(opTime);
            }

            const totalTime = performance.now() - startTime;
            const avgOpTime = operationResults.reduce((sum, time) => sum + time, 0) / operationResults.length;

            results.push({
                operation: operation.description,
                type: operation.type,
                count: operation.count,
                totalTime: Math.round(totalTime),
                averageOperationTime: Math.round(avgOpTime),
                operationsPerSecond: Math.round(operation.count / (totalTime / 1000))
            });
        }

        const overallAvgTime = results.reduce((sum, r) => sum + r.averageOperationTime, 0) / results.length;

        return {
            operationTypes: results.length,
            overallAverageOperationTime: Math.round(overallAvgTime),
            results
        };
    }

    async testScalability() {
        // Test system scalability under increasing load
        const loadLevels = [
            { requests: 10, interval: 100 },  // 10 requests per second
            { requests: 50, interval: 20 },   // 50 requests per second
            { requests: 100, interval: 10 }   // 100 requests per second
        ];

        const results = [];

        for (const level of loadLevels) {
            console.log(`  Testing scalability at ${level.requests} requests/second...`);
            
            const startTime = performance.now();
            const requests = [];
            
            // Generate requests at specified interval
            for (let i = 0; i < level.requests; i++) {
                requests.push(
                    new Promise(resolve => {
                        setTimeout(async () => {
                            const result = await this.measureResponseTime('/api/claude-agent/process', {
                                prompt: `Scalability test ${i}`,
                                context: { test: true, loadTest: true }
                            });
                            resolve(result);
                        }, i * level.interval);
                    })
                );
            }

            const requestResults = await Promise.allSettled(requests);
            const totalTime = performance.now() - startTime;

            const successfulRequests = requestResults.filter(r => 
                r.status === 'fulfilled' && r.value.success
            ).length;

            const throughput = successfulRequests / (totalTime / 1000);
            const avgResponseTime = requestResults
                .filter(r => r.status === 'fulfilled')
                .reduce((sum, r) => sum + r.value.responseTime, 0) / successfulRequests;

            results.push({
                targetRequestsPerSecond: 1000 / level.interval,
                actualRequestsPerSecond: Math.round(throughput),
                successRate: (successfulRequests / level.requests * 100).toFixed(1),
                averageResponseTime: Math.round(avgResponseTime),
                totalTime: Math.round(totalTime)
            });

            // Wait between scalability tests
            await new Promise(resolve => setTimeout(resolve, 2000));
        }

        // Determine maximum sustainable throughput
        const sustainableLevel = results.find(r => parseFloat(r.successRate) >= 95);
        const maxThroughput = sustainableLevel ? sustainableLevel.actualRequestsPerSecond : 0;

        return {
            loadLevels: loadLevels.length,
            maxSustainedThroughput: maxThroughput,
            results
        };
    }

    async testResourceUtilization() {
        // Monitor system resource utilization during load
        const initialResources = {
            memory: process.memoryUsage(),
            cpuUsage: process.cpuUsage()
        };

        // Generate load
        const loadTestDuration = 5000; // 5 seconds
        const loadInterval = 50; // Request every 50ms
        const loadRequests = [];

        const loadStartTime = Date.now();
        
        while (Date.now() - loadStartTime < loadTestDuration) {
            loadRequests.push(
                this.measureResponseTime('/api/claude-agent/process', {
                    prompt: 'Resource utilization test',
                    context: { test: true, resourceTest: true }
                })
            );
            
            await new Promise(resolve => setTimeout(resolve, loadInterval));
        }

        const requestResults = await Promise.allSettled(loadRequests);
        const finalResources = {
            memory: process.memoryUsage(),
            cpuUsage: process.cpuUsage(initialResources.cpuUsage)
        };

        const memoryDelta = finalResources.memory.heapUsed - initialResources.memory.heapUsed;
        const cpuUserDelta = finalResources.cpuUsage.user - initialResources.cpuUsage.user;
        const cpuSystemDelta = finalResources.cpuUsage.system - initialResources.cpuUsage.system;

        const successfulRequests = requestResults.filter(r => 
            r.status === 'fulfilled' && r.value.success
        ).length;

        return {
            testDuration: loadTestDuration,
            totalRequests: loadRequests.length,
            successfulRequests,
            successRate: (successfulRequests / loadRequests.length * 100).toFixed(1),
            resources: {
                initialMemoryMB: Math.round(initialResources.memory.heapUsed / 1024 / 1024 * 100) / 100,
                finalMemoryMB: Math.round(finalResources.memory.heapUsed / 1024 / 1024 * 100) / 100,
                memoryDeltaMB: Math.round(memoryDelta / 1024 / 1024 * 100) / 100,
                cpuUserTime: cpuUserDelta,
                cpuSystemTime: cpuSystemDelta,
                totalCpuTime: cpuUserDelta + cpuSystemDelta
            }
        };
    }

    async testStressTest() {
        // Stress test with high volume of requests
        console.log('  Running stress test with high volume requests...');
        
        const stressTestDuration = 10000; // 10 seconds
        const maxConcurrent = 50;
        const requestQueue = [];
        const completedRequests = [];

        const stressStartTime = Date.now();

        // Generate high volume requests
        while (Date.now() - stressStartTime < stressTestDuration) {
            // Maintain max concurrent requests
            while (requestQueue.length < maxConcurrent && Date.now() - stressStartTime < stressTestDuration) {
                const request = this.measureResponseTime('/api/claude-agent/process', {
                    prompt: 'Stress test request',
                    context: { test: true, stressTest: true }
                });
                
                request.then(result => {
                    completedRequests.push(result);
                    requestQueue.shift();
                });
                
                requestQueue.push(request);
                
                // Small delay to prevent overwhelming
                await new Promise(resolve => setTimeout(resolve, 10));
            }
            
            await new Promise(resolve => setTimeout(resolve, 50));
        }

        // Wait for remaining requests to complete
        await Promise.all(requestQueue);

        const totalTime = Date.now() - stressStartTime;
        const successfulRequests = completedRequests.filter(r => r.success).length;
        const failedRequests = completedRequests.length - successfulRequests;

        // Calculate metrics
        const responseTimes = completedRequests.filter(r => r.success).map(r => r.responseTime);
        const avgResponseTime = responseTimes.reduce((sum, time) => sum + time, 0) / responseTimes.length;
        const p95ResponseTime = this.calculatePercentile(responseTimes, 95);
        const p99ResponseTime = this.calculatePercentile(responseTimes, 99);

        const metrics = {
            duration: totalTime,
            totalRequests: completedRequests.length,
            successfulRequests,
            failedRequests,
            successRate: (successfulRequests / completedRequests.length * 100).toFixed(1),
            requestsPerSecond: Math.round(completedRequests.length / (totalTime / 1000)),
            averageResponseTime: Math.round(avgResponseTime),
            p95ResponseTime: Math.round(p95ResponseTime),
            p99ResponseTime: Math.round(p99ResponseTime)
        };

        // Validate stress test results
        if (parseFloat(metrics.successRate) < 90) {
            throw new Error(`Stress test success rate ${metrics.successRate}% below 90% threshold`);
        }

        return metrics;
    }

    calculatePercentile(values, percentile) {
        if (values.length === 0) return 0;
        
        const sorted = values.sort((a, b) => a - b);
        const index = Math.ceil((percentile / 100) * sorted.length) - 1;
        return sorted[index];
    }

    async generatePerformanceReport() {
        const totalTests = this.testResults.length;
        const passedTests = this.testResults.filter(r => r.success).length;
        const failedTests = totalTests - passedTests;
        const successRate = (passedTests / totalTests * 100).toFixed(1);

        const report = {
            testSuite: 'Performance Testing',
            timestamp: new Date().toISOString(),
            thresholds: this.thresholds,
            summary: {
                totalTests,
                passedTests,
                failedTests,
                successRate: `${successRate}%`
            },
            results: this.testResults,
            systemInfo: this.getSystemInfo(),
            recommendations: this.generatePerformanceRecommendations(failedTests)
        };

        return report;
    }

    getSystemInfo() {
        return {
            platform: process.platform,
            arch: process.arch,
            nodeVersion: process.version,
            memory: process.memoryUsage(),
            uptime: process.uptime()
        };
    }

    generatePerformanceRecommendations(failedTests) {
        const recommendations = [];

        if (failedTests > 0) {
            recommendations.push('Review and optimize failed performance tests');
        }

        const responseTimeResults = this.testResults.filter(r => r.result && r.result.overallAverageTime);
        if (responseTimeResults.length > 0) {
            const avgTime = responseTimeResults[0].result.overallAverageTime;
            if (avgTime > 3000) {
                recommendations.push('Consider implementing response caching for faster API responses');
                recommendations.push('Optimize database queries and add appropriate indexes');
            }
        }

        const memoryResults = this.testResults.filter(r => r.result && r.result.memoryIncreaseMB);
        if (memoryResults.length > 0) {
            const memoryIncrease = memoryResults[0].result.memoryIncreaseMB;
            if (memoryIncrease > 100) {
                recommendations.push('Implement memory optimization strategies and garbage collection');
                recommendations.push('Consider using streaming for large data processing');
            }
        }

        const scalabilityResults = this.testResults.filter(r => r.result && r.result.maxSustainedThroughput);
        if (scalabilityResults.length > 0) {
            const maxThroughput = scalabilityResults[0].result.maxSustainedThroughput;
            if (maxThroughput < 50) {
                recommendations.push('Consider implementing connection pooling and load balancing');
                recommendations.push('Optimize async operations and reduce blocking calls');
            }
        }

        if (recommendations.length === 0) {
            recommendations.push('System performance is within acceptable thresholds');
        }

        return recommendations;
    }

    async runAllTests() {
        console.log('⚡ Starting Performance Test Suite');
        console.log('='.repeat(50));
        console.log(`Performance Thresholds:`);
        console.log(`- Max Response Time: ${this.thresholds.maxResponseTime}ms`);
        console.log(`- Min Success Rate: ${(this.thresholds.minSuccessRate * 100).toFixed(1)}%`);
        console.log(`- Max Memory Usage: ${Math.round(this.thresholds.maxMemoryUsage / 1024 / 1024)}MB`);

        // Run all performance tests
        await this.runTest('API Response Times', () => this.testAPIResponseTimes());
        await this.runTest('Memory Usage', () => this.testMemoryUsage());
        await this.runTest('Concurrent Load', () => this.testConcurrentLoad());
        await this.runTest('Database Performance', () => this.testDatabasePerformance());
        await this.runTest('Scalability', () => this.testScalability());
        await this.runTest('Resource Utilization', () => this.testResourceUtilization());
        await this.runTest('Stress Test', () => this.testStressTest());

        // Generate and display report
        const report = await this.generatePerformanceReport();

        console.log('\n' + '='.repeat(50));
        console.log('📊 Performance Test Suite Complete');
        console.log(`Total Tests: ${report.summary.totalTests}`);
        console.log(`Passed: ${report.summary.passedTests}`);
        console.log(`Failed: ${report.summary.failedTests}`);
        console.log(`Success Rate: ${report.summary.successRate}`);

        // Display key performance metrics
        const responseTimeResult = this.testResults.find(r => r.result && r.result.overallAverageTime);
        if (responseTimeResult) {
            console.log(`\n🚀 Performance Metrics:`);
            console.log(`Average Response Time: ${responseTimeResult.result.overallAverageTime}ms`);
            console.log(`Threshold: ${this.thresholds.maxResponseTime}ms`);
        }

        const memoryResult = this.testResults.find(r => r.result && r.result.memoryIncreaseMB);
        if (memoryResult) {
            console.log(`Memory Usage Increase: ${memoryResult.result.memoryIncreaseMB}MB`);
            console.log(`Threshold: ${Math.round(this.thresholds.maxMemoryUsage / 1024 / 1024)}MB`);
        }

        if (report.summary.failedTests > 0) {
            console.log('\n❌ Failed Performance Tests:');
            report.results.filter(r => !r.success).forEach(test => {
                console.log(`  - ${test.name}: ${test.error}`);
            });
        }

        console.log('\n💡 Performance Recommendations:');
        report.recommendations.forEach(rec => {
            console.log(`  - ${rec}`);
        });

        return report.summary.failedTests === 0;
    }
}

// Run tests if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
    const tester = new PerformanceTester();
    tester.runAllTests().then(success => {
        process.exit(success ? 0 : 1);
    }).catch(error => {
        console.error('Performance test suite failed:', error);
        process.exit(1);
    });
}

export { PerformanceTester };