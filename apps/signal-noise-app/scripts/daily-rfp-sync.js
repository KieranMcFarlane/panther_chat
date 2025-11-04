#!/usr/bin/env node

/**
🏆 DAILY SPORTS RFP INTELLIGENCE CRON JOB
Automated daily population of sports RFP opportunities
**/

const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

// Configuration
const SCRIPT_DIR = __dirname;
const RETROSPECTIVE_SCRIPT = path.join(SCRIPT_DIR, 'retrospective-rfp-scraper.js');
const LOG_DIR = path.join(SCRIPT_DIR, 'logs');
const LOG_FILE = path.join(LOG_DIR, `daily-rfp-cron-${new Date().toISOString().split('T')[0]}.log`);

// Ensure log directory exists
if (!fs.existsSync(LOG_DIR)) {
  fs.mkdirSync(LOG_DIR, { recursive: true });
}

/**
* Logging function with timestamp
*/
function log(message) {
  const timestamp = new Date().toISOString();
  const logMessage = `[${timestamp}] ${message}`;
  console.log(logMessage);
  
  // Write to log file
  fs.appendFileSync(LOG_FILE, logMessage + '\n');
}

/**
* Execute the retrospective scraper with proper error handling
*/
async function runDailyRFPSync() {
  log('🏆 STARTING DAILY SPORTS RFP INTELLIGENCE SYNC');
  log('='.repeat(60));
  
  return new Promise((resolve, reject) => {
    const startTime = Date.now();
    
    // Run the retrospective scraper
    const scraperProcess = spawn('node', [RETROSPECTIVE_SCRIPT], {
      stdio: ['inherit', 'pipe', 'pipe'],
      cwd: SCRIPT_DIR,
      env: { ...process.env, NODE_ENV: 'production' }
    });
    
    let stdout = '';
    let stderr = '';
    
    scraperProcess.stdout.on('data', (data) => {
      const output = data.toString();
      stdout += output;
      log(`📤 ${output.trim()}`);
    });
    
    scraperProcess.stderr.on('data', (data) => {
      const output = data.toString();
      stderr += output;
      log(`⚠️  ${output.trim()}`);
    });
    
    scraperProcess.on('close', (code) => {
      const duration = (Date.now() - startTime) / 1000;
      
      if (code === 0) {
        log(`✅ DAILY SYNC COMPLETED SUCCESSFULLY`);
        log(`⏱️  Duration: ${duration.toFixed(2)} seconds`);
        log(`📄 Log saved to: ${LOG_FILE}`);
        
        // Parse results from stdout
        const results = parseResults(stdout);
        log(`📊 Results: ${results.summary}`);
        
        resolve({
          success: true,
          duration,
          results,
          logFile: LOG_FILE
        });
      } else {
        log(`❌ DAILY SYNC FAILED with exit code: ${code}`);
        log(`📄 Error details saved to: ${LOG_FILE}`);
        
        reject(new Error(`Process failed with exit code ${code}`));
      }
    });
    
    scraperProcess.on('error', (error) => {
      log(`💥 PROCESS ERROR: ${error.message}`);
      reject(error);
    });
    
    // Timeout after 10 minutes
    setTimeout(() => {
      scraperProcess.kill('SIGTERM');
      reject(new Error('Process timed out after 10 minutes'));
    }, 10 * 60 * 1000);
  });
}

/**
* Parse results from scraper output
*/
function parseResults(output) {
  const lines = output.split('\n');
  const results = {
    totalProcessed: 0,
    successful: 0,
    failed: 0,
    totalValue: '£0',
    avgFitScore: '0%'
  };
  
  lines.forEach(line => {
    if (line.includes('Successfully processed:')) {
      const match = line.match(/Successfully processed: (\d+)\/(\d+)/);
      if (match) {
        results.successful = parseInt(match[1]);
        results.totalProcessed = parseInt(match[2]);
        results.failed = results.totalProcessed - results.successful;
      }
    }
    
    if (line.includes('Total estimated value:')) {
      const match = line.match(/Total estimated value: ([£\d.]+M)/);
      if (match) {
        results.totalValue = match[1];
      }
    }
    
    if (line.includes('Average Yellow Panther fit:')) {
      const match = line.match(/Average Yellow Panther fit: ([\d.%]+)/);
      if (match) {
        results.avgFitScore = match[1];
      }
    }
  });
  
  results.summary = `${results.successful}/${results.totalProcessed} processed, ${results.totalValue} total value, ${results.avgFitScore} avg fit`;
  
  return results;
}

/**
* Send notification (optional - can be extended)
*/
async function sendNotification(results) {
  try {
    // You could extend this to send emails, Slack notifications, etc.
    if (results.success && results.results.successful > 0) {
      log(`🔔 NOTIFICATION: Daily RFP sync completed with ${results.results.successful} new opportunities`);
    }
  } catch (error) {
    log(`⚠️  Notification failed: ${error.message}`);
  }
}

/**
* Cleanup old log files (keep last 7 days)
*/
function cleanupOldLogs() {
  try {
    const files = fs.readdirSync(LOG_DIR);
    const now = Date.now();
    const sevenDaysAgo = now - (7 * 24 * 60 * 60 * 1000);
    
    files.forEach(file => {
      const filePath = path.join(LOG_DIR, file);
      const stats = fs.statSync(filePath);
      
      if (stats.mtime.getTime() < sevenDaysAgo) {
        fs.unlinkSync(filePath);
        log(`🗑️  Cleaned up old log file: ${file}`);
      }
    });
  } catch (error) {
    log(`⚠️  Log cleanup failed: ${error.message}`);
  }
}

/**
* Main execution
*/
async function main() {
  try {
    await runDailyRFPSync();
    await sendNotification({ success: true });
    cleanupOldLogs();
    
    log('🎉 DAILY SPORTS RFP INTELLIGENCE SYNC COMPLETE');
    process.exit(0);
    
  } catch (error) {
    log(`💥 DAILY SYNC FAILED: ${error.message}`);
    await sendNotification({ success: false, error: error.message });
    process.exit(1);
  }
}

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  log(`💥 UNCAUGHT EXCEPTION: ${error.message}`);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  log(`💥 UNHANDLED REJECTION: ${reason}`);
  process.exit(1);
});

// Run the daily sync
if (require.main === module) {
  main();
}

module.exports = { runDailyRFPSync };