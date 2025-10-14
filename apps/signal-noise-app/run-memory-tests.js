#!/usr/bin/env node

/**
 * 🧪 Memory-Optimized Batch Processing Test Runner
 * 
 * Simple command-line runner for testing the memory-optimized batch processing system
 */

const { MemoryOptimizedBatchTester } = require('./tests/test-memory-optimized-batch');

async function runTests() {
  console.log('🚀 Starting Memory-Optimized Batch Processing Tests');
  console.log('Make sure your development server is running on http://localhost:3005');
  console.log('');

  // Wait for user confirmation
  if (process.platform !== 'linux') { // Skip in CI environments
    const readline = require('readline');
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });

    await new Promise(resolve => {
      rl.question('Press Enter to start tests...', resolve);
    });
    rl.close();
  }

  const tester = new MemoryOptimizedBatchTester();
  await tester.runTestSuite();
}

// Handle errors gracefully
process.on('unhandledRejection', (reason, promise) => {
  console.error('❌ Unhandled Rejection at:', promise, 'reason:', reason);
  process.exit(1);
});

process.on('uncaughtException', (error) => {
  console.error('❌ Uncaught Exception:', error);
  process.exit(1);
});

// Run the tests
runTests().catch(error => {
  console.error('❌ Test runner failed:', error);
  process.exit(1);
});