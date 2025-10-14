#!/usr/bin/env node

/**
 * Parallel Enrichment Launch Script
 * 
 * Launches multiple Claude Code instances for parallel entity enrichment
 * based on the orchestration system defined in PARALLEL_ENRICHMENT_ORCHESTRATION.md
 */

const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

class ParallelEnrichmentOrchestrator {
  constructor(options = {}) {
    this.options = {
      batchSize: {
        entities: options.entities?.batchSize || 50,
        persons: options.persons?.batchSize || 25,
        leagues: options.leagues?.batchSize || 15
      },
      instances: options.instances || [1, 2, 3], // Which instances to run
      debug: options.debug || false,
      outputDir: options.outputDir || `./dossiers/parallel_batch_${Date.now()}/`,
      ...options
    };
    
    this.results = {
      instance1: { status: 'pending', startTime: null, endTime: null, entities: [] },
      instance2: { status: 'pending', startTime: null, endTime: null, entities: [] },
      instance3: { status: 'pending', startTime: null, endTime: null, entities: [] }
    };
    
    this.setupDirectories();
  }

  setupDirectories() {
    // Create output directories
    const dirs = [
      path.join(this.options.outputDir, 'entities'),
      path.join(this.options.outputDir, 'persons'),
      path.join(this.options.outputDir, 'leagues'),
      path.join(this.options.outputDir, 'logs')
    ];
    
    dirs.forEach(dir => {
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
    });
  }

  async launchParallelEnrichment() {
    console.log('🚀 Launching Parallel Enrichment System');
    console.log(`📁 Output Directory: ${this.options.outputDir}`);
    console.log(`📊 Batch Sizes: Entities=${this.options.batchSize.entities}, Persons=${this.options.batchSize.persons}, Leagues=${this.options.batchSize.leagues}`);
    console.log('');

    const instances = [];
    
    // Launch Instance 1: Entity Dossiers
    if (this.options.instances.includes(1)) {
      instances.push(this.launchInstance1());
    }
    
    // Launch Instance 2: POI Enrichment
    if (this.options.instances.includes(2)) {
      instances.push(this.launchInstance2());
    }
    
    // Launch Instance 3: League Analysis
    if (this.options.instances.includes(3)) {
      instances.push(this.launchInstance3());
    }

    // Wait for all instances to complete
    console.log('⏳ All instances launched. Waiting for completion...');
    const results = await Promise.allSettled(instances);
    
    // Process results
    await this.processResults(results);
    
    console.log('✅ Parallel enrichment completed!');
    console.log(`📂 Results saved to: ${this.options.outputDir}`);
    
    return this.results;
  }

  launchInstance1() {
    console.log('🔵 Launching Instance 1: Entity Dossier Enrichment');
    
    this.results.instance1.startTime = new Date();
    this.results.instance1.status = 'running';
    
    const config = {
      instanceId: 1,
      type: 'entities',
      batchSize: this.options.batchSize.entities,
      configFile: 'instance_1_entity_dossiers.md',
      outputDir: path.join(this.options.outputDir, 'entities'),
      logFile: path.join(this.options.outputDir, 'logs', 'instance_1.log')
    };

    return this.executeClaudeCodeInstance(config);
  }

  launchInstance2() {
    console.log('🟡 Launching Instance 2: POI Enrichment');
    
    this.results.instance2.startTime = new Date();
    this.results.instance2.status = 'running';
    
    const config = {
      instanceId: 2,
      type: 'persons',
      batchSize: this.options.batchSize.persons,
      configFile: 'instance_2_poi_enrichment.md',
      outputDir: path.join(this.options.outputDir, 'persons'),
      logFile: path.join(this.options.outputDir, 'logs', 'instance_2.log')
    };

    return this.executeClaudeCodeInstance(config);
  }

  launchInstance3() {
    console.log('🟢 Launching Instance 3: League Analysis');
    
    this.results.instance3.startTime = new Date();
    this.results.instance3.status = 'running';
    
    const config = {
      instanceId: 3,
      type: 'leagues',
      batchSize: this.options.batchSize.leagues,
      configFile: 'instance_3_league_analysis.md',
      outputDir: path.join(this.options.outputDir, 'leagues'),
      logFile: path.join(this.options.outputDir, 'logs', 'instance_3.log')
    };

    return this.executeClaudeCodeInstance(config);
  }

  async executeClaudeCodeInstance(config) {
    return new Promise((resolve, reject) => {
      const args = [
        '--config', config.configFile,
        '--batch-size', config.batchSize.toString(),
        '--output-dir', config.outputDir,
        '--instance-id', config.instanceId.toString()
      ];

      if (this.options.debug) {
        args.push('--debug', '--verbose');
      }

      // Claude Code execution
      const claudeCode = spawn('claude-code', args, {
        stdio: ['pipe', 'pipe', 'pipe'],
        cwd: process.cwd()
      });

      let stdout = '';
      let stderr = '';

      claudeCode.stdout.on('data', (data) => {
        const output = data.toString();
        stdout += output;
        this.logProgress(config.instanceId, output);
      });

      claudeCode.stderr.on('data', (data) => {
        const output = data.toString();
        stderr += output;
        this.logError(config.instanceId, output);
      });

      claudeCode.on('close', (code) => {
        this.results[`instance${config.instanceId}`].endTime = new Date();
        this.results[`instance${config.instanceId}`].status = code === 0 ? 'completed' : 'failed';
        
        // Write log file
        fs.writeFileSync(config.logFile, `Instance ${config.instanceId} Log\n` +
          `Start Time: ${this.results[`instance${config.instanceId}`].startTime}\n` +
          `End Time: ${this.results[`instance${config.instanceId}`].endTime}\n` +
          `Exit Code: ${code}\n\n` +
          `STDOUT:\n${stdout}\n\n` +
          `STDERR:\n${stderr}\n`);

        if (code === 0) {
          console.log(`✅ Instance ${config.instanceId} completed successfully`);
          resolve({ config, stdout, stderr });
        } else {
          console.log(`❌ Instance ${config.instanceId} failed with exit code ${code}`);
          reject(new Error(`Instance ${config.instanceId} failed: ${stderr}`));
        }
      });

      claudeCode.on('error', (error) => {
        console.log(`💥 Instance ${config.instanceId} error: ${error.message}`);
        reject(error);
      });

      // Handle timeout (4 hours max)
      const timeout = setTimeout(() => {
        claudeCode.kill();
        reject(new Error(`Instance ${config.instanceId} timed out after 4 hours`));
      }, 4 * 60 * 60 * 1000);

      claudeCode.on('close', () => {
        clearTimeout(timeout);
      });
    });
  }

  logProgress(instanceId, output) {
    // Parse progress from Claude Code output
    const lines = output.split('\n');
    lines.forEach(line => {
      if (line.includes('Processing entity') || line.includes('Completed')) {
        console.log(`[Instance ${instanceId}] ${line.trim()}`);
      }
    });
  }

  logError(instanceId, output) {
    if (this.options.debug) {
      console.error(`[Instance ${instanceId} ERROR] ${output.trim()}`);
    }
  }

  async processResults(results) {
    console.log('\n📊 Processing Results...');
    
    let totalEntities = 0;
    let successful = 0;
    let failed = 0;

    results.forEach((result, index) => {
      const instanceId = index + 1;
      if (result.status === 'fulfilled') {
        successful++;
        // Count entities processed (would be parsed from actual output)
        const entitiesProcessed = this.options.batchSize[`instance${instanceId}`] || 0;
        totalEntities += entitiesProcessed;
        console.log(`✅ Instance ${instanceId}: ${entitiesProcessed} entities processed`);
      } else {
        failed++;
        console.log(`❌ Instance ${instanceId}: Failed - ${result.reason}`);
      }
    });

    // Generate summary report
    const summary = {
      totalEntities,
      successful,
      failed,
      duration: this.calculateTotalDuration(),
      outputDir: this.options.outputDir,
      timestamp: new Date().toISOString()
    };

    const summaryPath = path.join(this.options.outputDir, 'summary.json');
    fs.writeFileSync(summaryPath, JSON.stringify(summary, null, 2));

    console.log(`\n📈 Summary:`);
    console.log(`   Total Entities: ${totalEntities}`);
    console.log(`   Successful Instances: ${successful}`);
    console.log(`   Failed Instances: ${failed}`);
    console.log(`   Total Duration: ${summary.duration}`);
    console.log(`   Summary Report: ${summaryPath}`);

    // Trigger consolidation if all instances succeeded
    if (failed === 0) {
      console.log('\n🔄 All instances completed successfully. Starting consolidation...');
      await this.consolidateResults();
    }
  }

  calculateTotalDuration() {
    const startTime = Math.min(
      this.results.instance1.startTime?.getTime() || Infinity,
      this.results.instance2.startTime?.getTime() || Infinity,
      this.results.instance3.startTime?.getTime() || Infinity
    );
    
    const endTime = Math.max(
      this.results.instance1.endTime?.getTime() || 0,
      this.results.instance2.endTime?.getTime() || 0,
      this.results.instance3.endTime?.getTime() || 0
    );

    if (startTime === Infinity || endTime === 0) return 'Unknown';

    const duration = endTime - startTime;
    const hours = Math.floor(duration / (1000 * 60 * 60));
    const minutes = Math.floor((duration % (1000 * 60 * 60)) / (1000 * 60));
    
    return `${hours}h ${minutes}m`;
  }

  async consolidateResults() {
    // This would trigger the consolidation script
    console.log('🔄 Running consolidation...');
    
    const consolidateScript = spawn('node', ['scripts/consolidate-results.js'], {
      stdio: 'inherit',
      cwd: process.cwd()
    });

    return new Promise((resolve) => {
      consolidateScript.on('close', (code) => {
        if (code === 0) {
          console.log('✅ Consolidation completed successfully');
        } else {
          console.log('⚠️  Consolidation completed with warnings');
        }
        resolve();
      });
    });
  }
}

// CLI Interface
async function main() {
  const args = process.argv.slice(2);
  
  const options = {};
  
  // Parse command line arguments
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    
    switch (arg) {
      case '--entities':
        options.entities = { batchSize: parseInt(args[++i]) };
        break;
      case '--persons':
        options.persons = { batchSize: parseInt(args[++i]) };
        break;
      case '--leagues':
        options.leagues = { batchSize: parseInt(args[++i]) };
        break;
      case '--instances':
        options.instances = args[++i].split(',').map(Number);
        break;
      case '--output-dir':
        options.outputDir = args[++i];
        break;
      case '--debug':
        options.debug = true;
        break;
      case '--help':
        console.log(`
Parallel Enrichment Launch Script

Usage: node launch-parallel-enrichment.js [options]

Options:
  --entities <number>     Batch size for entity dossiers (default: 50)
  --persons <number>      Batch size for POI enrichment (default: 25)
  --leagues <number>      Batch size for league analysis (default: 15)
  --instances <list>      Comma-separated list of instances to run (1,2,3)
  --output-dir <path>     Output directory for results
  --debug                 Enable debug logging
  --help                  Show this help message

Examples:
  node launch-parallel-enrichment.js
  node launch-parallel-enrichment.js --entities 75 --persons 30
  node launch-parallel-enrichment.js --instances 1,2 --debug
  node launch-parallel-enrichment.js --output-dir ./custom-output/
        `);
        process.exit(0);
        break;
    }
  }

  try {
    const orchestrator = new ParallelEnrichmentOrchestrator(options);
    await orchestrator.launchParallelEnrichment();
  } catch (error) {
    console.error('💥 Parallel enrichment failed:', error.message);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

module.exports = ParallelEnrichmentOrchestrator;