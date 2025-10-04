#!/usr/bin/env node

/**
 * Start LinkedIn Procurement Monitor
 * Launches the BrightData monitoring worker and webhook handlers
 */

const { exec, spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

console.log('🚀 Starting Yellow Panther LinkedIn Procurement Monitor\n');

// Configuration
const config = {
  webhookPort: process.env.WEBHOOK_PORT || 8002,
  monitorWorker: path.join(__dirname, '../src/webhooks/linkedin_monitor_worker.py'),
  webhookHandler: path.join(__dirname, '../src/webhooks/linkedin_procurement.py'),
  nextjsApiPath:v '../',
};

// Environment validation
function validateEnvironment() {
  const requiredEnvVars = [
    'BRIGHTDATA_TOKEN',
    'BRIGHTDATA_ZONE',
    'SUPABASE_URL',
    'SUPABASE_ANON_KEY',
    'RESEND_API_KEY'
  ];

  const missingVars = requiredEnvVars.filter(varName => !process.env[varName]);
  
  if (missingVars.length > 0) {
    console.error('❌ Missing required environment variables:');
    missingVars.forEach(varName => console.error(`   - ${varName}`));
    console.error('\nPlease set these in your .env.local file');
    process.exit(1);
  }

  console.log('✅ Environment validation passed');
}

// Check Python dependencies
async function checkPythonDependencies() {
  return new Promise((resolve, reject) => {
    exec('python3 -c "import fastapi, aiohttp, pydantic, uvicorn, asyncio"', (error, stdout, stderr) => {
      if (error) {
        console.error('❌ Missing Python dependencies:');
        console.error('Please install: pip install fastapi aiohttp pydantic uvicorn');
        reject(error);
      } else {
        console.log('✅ Python dependencies verified');
        resolve();
      }
    });
  });
}

// Start webhook handler
function startWebhookHandler() {
  return new Promise((resolve, reject) => {
    console.log(`🌐 Starting webhook handler on port ${config.webhookPort}...`);
    
    const webhookProcess = spawn('python3', [
      config.webhookHandler,
      '--host', '0.0.0.0',
      '--port', config.webhookPort.toString()
    ], {
      stdio: ['pipe', 'pipe', 'pipe'],
      env: { ...process.env }
    });

    webhookProcess.stdout.on('data', (data) => {
      console.log(`[Webhook] ${data.toString().trim()}`);
    });

    webhookProcess.stderr.on('data', (data) => {
      const output = data.toString().trim();
      if (output.includes('Uvicorn running')) {
        console.log('✅ Webhook handler started successfully');
        resolve(webhookProcess);
      } else if (output.includes('ERROR')) {
        console.error(`❌ Webhook error: ${output}`);
        reject(new Error(output));
      } else {
        console.log(`[Webhook Error] ${output}`);
      }
    });

    webhookProcess.on('error', (error) => {
      console.error(`❌ Failed to start webhook handler: ${error.message}`);
      reject(error);
    });
  });
}

// Start monitoring worker
function startMonitoringWorker() {
  return new Promise((resolve, reject) => {
    console.log('📡 Starting LinkedIn monitoring worker...');
    
    const monitorProcess = spawn('python3', [config.monitorWorker], {
      stdio: ['pipe', 'pipe', 'pipe'],
      env: { ...process.env }
    });

    monitorProcess.stdout.on('data', (data) => {
      console.log(`[Monitor] ${data.toString().trim()}`);
    });

    monitorProcess.stderr.on('data', (data) => {
      const output = data.toString().trim();
      if (output.includes('LinkedIn Procurement Monitor started')) {
        console.log('✅ Monitoring worker started successfully');
        resolve(monitorProcess);
      } else if (output.includes('ERROR')) {
        console.error(`❌ Monitor error: ${output}`);
        reject(new Error(output));
      } else {
        console.log(`[Monitor Error] ${output}`);
      }
    });

    monitorProcess.on('error', (error) => {
      console.error(`❌ Failed to start monitoring worker: ${error.message}`);
      reject(error);
    });
  });
}

// Health check
async function performHealthCheck(webhookPort) {
  try {
    const response = await fetch(`http://localhost:${webhookPort}/webhook/health`);
    if (response.ok) {
      const health = await response.json();
      console.log('✅ Health check passed');
      return true;
    }
  } catch (error) {
    console.log('⏳ Waiting for webhook service to be ready...');
  }
  return false;
}

// Cleanup handler
function setupCleanupHandlers(processes) {
  function cleanup() {
    console.log('\n🛑 Shutting down LinkedIn procurement monitor...');
    
    processes.forEach(process => {
      if (process && process.kill) {
        process.kill('SIGTERM');
      }
    });
    
    console.log('✅ Cleanup completed');
    process.exit(0);
  }

  process.on('SIGINT', cleanup);
  process.on('SIGTERM', cleanup);
  process.on('exit', cleanup);
}

// Main startup sequence
async function main() {
  try {
    console.log('🔍 Validating configuration...');
    validateEnvironment();
    await checkPythonDependencies();
    
    console.log('\n🚀 Starting services...');
    
    // Start webhook handler
    const webhookProcess = await startWebhookHandler();
    
    // Wait for webhook service to be ready
    let healthOk = false;
    let attempts = 0;
    const maxAttempts = 30; // 30 seconds
    
    while (!healthOk && attempts < maxAttempts) {
      healthOk = await performHealthCheck(config.webhookPort);
      if (!healthOk) {
        await new Promise(resolve => setTimeout(resolve, 1000));
        attempts++;
      }
    }
    
    if (!healthOk) {
      throw new Error('Webhook service failed to start within timeout');
    }
    
    // Start monitoring worker
    const monitorProcess = await startMonitoringWorker();
    
    console.log('\n✅ LinkedIn Procurement Monitor is fully operational!');
    console.log('\n📋 Service Status:');
    console.log(`   🌐 Webhook Handler: http://localhost:${config.webhookPort}`);
    console.log('   📡 Monitoring Worker: Active');
    console.log('   🔔 Notification System: Ready');
    
    console.log('\n📖 BrightData Configuration Required:');
    console.log('   • Create LinkedIn monitoring zone');
    console.log('   • Configure webhook URL: http://your-domain:${config.webhookPort}/webhook/brightdata/linkedin');
    console.log('   • Set webhook secret in BRIGHTDATA_WEBHOOK_SECRET');
    
    console.log('\n🎯 Monitoring Active For:');
    console.log('   • LinkedIn posts with procurement keywords');
    console.log('   • Sports industry content');
    console.log('   • Author role analysis');
    console.log('   • Engagement metrics');
    
    console.log('\n💡 Tips:');
    console.log('   • Use Ctrl+C to stop the monitor');
    console.log('   • Check logs for detected opportunities');
    console.log('   • High-priority RFPs trigger immediate notifications');
    
    // Setup cleanup handlers
    setupCleanupHandlers([webhookProcess, monitorProcess]);
    
    // Keep process alive
    await new Promise<void>((resolve) => {
      setInterval(() => {
        // Health check every 5 minutes
        performHealthCheck(config.webhookPort).catch(() => {
          console.warn('⚠️ Health check failed, but continuing...');
        });
      }, 5 * 60 * 1000);
      
      // Keep alive indefinitely
      process.on('beforeExit', () => resolve());
    });
    
  } catch (error) {
    console.error(`\n❌ Startup failed: ${error.message}`);
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  main().catch(error => {
    console.error('💥 Unexpected error:', error);
    process.exit(1);
  });
}

module.exports = { main, validateEnvironment, startWebhookHandler, startMonitoringWorker };
