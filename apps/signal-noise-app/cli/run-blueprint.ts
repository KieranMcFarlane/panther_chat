#!/usr/bin/env node

/**
 * CLI RFP Intelligence Batch Runner
 * 
 * Compatible with both Claude's Anthropic API and GLM 4.6 via Zhipu proxy
 * Preserves full reasoning capabilities of interactive Claude Code sessions
 * 
 * Environment Setup:
 *   export ANTHROPIC_API_KEY=your-key-here
 *   export ANTHROPIC_BASE_URL=https://api.z.ai/api/anthropic  # Optional proxy
 *   
 * Usage:
 *   node cli/run-blueprint.ts
 *   node cli/run-blueprint.ts --model glm-4-6
 *   node cli/run-blueprint.ts --test-connection
 */

import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";
import Anthropic from "@anthropic-ai/sdk";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Parse command line arguments
const args = process.argv.slice(2);
const useGlm = args.includes('--model') && args[args.indexOf('--model') + 1] === 'glm-4-6';
const testConnection = args.includes('--test-connection');

class RFPBatchRunner {
  private anthropic: Anthropic;
  private runDir: string;
  private model: string;

  constructor() {
    // Initialize with GLM 4.6 compatibility
    this.anthropic = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY || "sk-ant-example",
      baseURL: process.env.ANTHROPIC_BASE_URL || "https://api.anthropic.com",
    });

    // Model selection based on args or environment
    this.model = useGlm ? "glm-4-6" : "claude-3-5-sonnet-latest";
    
    // Ensure RUN_LOGS directory exists
    this.runDir = path.join(process.cwd(), "RUN_LOGS");
  }

  async initialize(): Promise<void> {
    await fs.mkdir(this.runDir, { recursive: true });
    console.log(`✅ RFP Batch Runner initialized`);
    console.log(`📁 Logs directory: ${this.runDir}`);
    console.log(`🤖 Model: ${this.model}`);
    console.log(`🔗 API Endpoint: ${process.env.ANTHROPIC_BASE_URL || "https://api.anthropic.com"}`);
  }

  async testConnection(): Promise<boolean> {
    console.log(`🧪 Testing connection to ${this.model}...`);
    
    try {
      const response = await this.anthropic.messages.create({
        model: this.model,
        max_tokens: 50,
        messages: [{
          role: "user",
          content: "Respond with: Connection successful from [model name]"
        }]
      });

      const text = response.content[0]?.type === 'text' ? response.content[0].text : '';
      console.log(`✅ Connection test successful:`);
      console.log(`   ${text}`);
      return true;

    } catch (error: any) {
      console.error(`❌ Connection test failed:`);
      console.error(`   Status: ${error.status || 'Unknown'}`);
      console.error(`   Message: ${error.message}`);
      return false;
    }
  }

  async loadBlueprint(): Promise<string> {
    const blueprintPath = path.join(
      process.cwd(),
      "COMPLETE-RFP-MONITORING-SYSTEM.md"
    );
    
    try {
      const blueprint = await fs.readFile(blueprintPath, "utf8");
      console.log(`✅ Loaded blueprint (${blueprint.length} chars)`);
      return blueprint;
    } catch (error: any) {
      console.error(`❌ Failed to load blueprint: ${error.message}`);
      throw error;
    }
  }

  async gatherContext(): Promise<string[]> {
    const context: string[] = [];
    
    // 1. Neo4j Context
    try {
      console.log(`🧩 Gathering Neo4j context...`);
      const neo4j = require("neo4j-driver");
      const driver = neo4j.driver(
        process.env.NEO4J_URI || "",
        neo4j.auth.basic(
          process.env.NEO4J_USER || "neo4j", 
          process.env.NEO4J_PASS || ""
        )
      );
      
      const session = driver.session();
      const result = await session.run(
        `MATCH (e:Entity) 
         WHERE e:Club OR e:League OR e:Person
         RETURN e.name AS name, e.sport AS sport, e.type AS type, e.country AS country 
         LIMIT 15`
      );
      
      const entities = result.records.map((r: any) => r.toObject());
      await session.close();
      await driver.close();
      
      context.push(`### 🧩 Neo4j Entities Context\n\`\`\`json\n${JSON.stringify(entities, null, 2)}\n\`\`\``);
      console.log(`✅ Gathered ${entities.length} Neo4j entities`);
      
    } catch (error: any) {
      context.push(`### 🧩 Neo4j Status\n❌ Neo4j unavailable: ${error.message}`);
      console.log(`⚠️ Neo4j unavailable: ${error.message}`);
    }

    // 2. BrightData Status
    try {
      console.log(`🌐 Checking BrightData status...`);
      const response = await fetch("https://api.brightdata.com/serp/v1/test", {
        headers: { 
          Authorization: `Bearer ${process.env.BRIGHTDATA_API_TOKEN || ""}`,
          "Content-Type": "application/json"
        },
      });

      if (response.ok) {
        context.push(`### 🌐 BrightData Status\n✅ BrightData API connection verified`);
        console.log(`✅ BrightData connection verified`);
      } else {
        context.push(`### 🌐 BrightData Status\n⚠️ API responded with status: ${response.status}`);
        console.log(`⚠️ BrightData API status: ${response.status}`);
      }
      
    } catch (error: any) {
      context.push(`### 🌐 BrightData Status\n❌ BrightData not reachable: ${error.message}`);
      console.log(`⚠️ BrightData not reachable: ${error.message}`);
    }

    // 3. Previous Run Context
    try {
      console.log(`📋 Loading previous run context...`);
      const files = await fs.readdir(this.runDir);
      const rfpFiles = files
        .filter((f) => f.startsWith("RFP_RUN_"))
        .sort()
        .reverse();

      if (rfpFiles.length > 0) {
        const lastFile = rfpFiles[0];
        const lastPath = path.join(this.runDir, lastFile);
        const prevContent = await fs.readFile(lastPath, "utf8");
        
        // Extract key insights from previous run (first 2000 chars)
        const preview = prevContent.slice(0, 2000);
        context.push(`### 📋 Previous Run Summary (${lastFile})\n\`\`\`markdown\n${preview}\n\`\`\``);
        console.log(`✅ Loaded context from ${lastFile}`);
      } else {
        context.push(`### 📋 Previous Run Summary\nℹ️ No previous runs found`);
        console.log(`ℹ️ No previous run context found`);
      }
      
    } catch (error: any) {
      context.push(`### 📋 Previous Run Summary\n❌ Could not load previous context: ${error.message}`);
      console.log(`⚠️ Could not load previous context: ${error.message}`);
    }

    return context;
  }

  async executeBlueprint(blueprint: string, context: string[]): Promise<string> {
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    const outputPath = path.join(this.runDir, `RFP_RUN_${timestamp}.md`);
    
    // Initialize log file
    const logHeader = `# 🎯 RFP Intelligence Run - ${timestamp}
**Model:** ${this.model}  
**Started:** ${new Date().toISOString()}  
**Environment:** ${process.env.NODE_ENV || 'development'}

---

## 📋 Execution Context

${context.join('\n\n')}

---

## 🚀 Blueprint Execution

*Running RFP Monitoring Blueprint...*

`;

    await fs.writeFile(outputPath, logHeader);
    console.log(`📝 Log initialized: ${path.basename(outputPath)}`);

    // Compose the full prompt for Claude
    const systemPrompt = `You are the Yellow Panther RFP Intelligence Agent, an expert AI system for sports industry procurement opportunity analysis.

Execute the provided RFP Monitoring Blueprint faithfully, using the real entity data and context supplied. Your task is to:

1. **Analyze the Sports Entity Landscape**: Review the Neo4j entities data to understand current sports clubs, leagues, and personnel
2. **Detect RFP Opportunities**: Search for procurement signals, hiring needs, and expansion opportunities 
3. **Apply Intelligence**: Use your reasoning capabilities to identify high-value opportunities
4. **Generate Structured Output**: Produce clear, actionable intelligence in Markdown format

**CRITICAL REQUIREMENTS:**
- Use the real entity data provided in context
- Apply the blueprint methodology systematically  
- Generate specific, actionable opportunities
- Include confidence scores and reasoning
- Format output as structured Markdown
- Be thorough but focus on high-value opportunities

**OUTPUT FORMAT:**
- Use Markdown headings and structured lists
- Include entity names, opportunity types, and recommended actions
- Add confidence levels and priority scores
- Provide specific next steps for each opportunity

Execute the complete blueprint workflow now. Do not provide preamble - start directly with analysis.`;

    const userPrompt = `
# LIVE INTELLIGENCE CONTEXT

${context.join('\n\n')}

# RFP MONITORING BLUEPRINT

${blueprint}

# EXECUTION INSTRUCTIONS

Execute the complete RFP Monitoring Blueprint using the live context provided above. Generate actionable intelligence for Yellow Panther's sports business development.
`;

    console.log(`🚀 Sending prompt to ${this.model} (this may take 30-60 seconds)...`);
    console.log(`📊 Context size: ${userPrompt.length} characters`);

    const startTime = Date.now();

    try {
      const completion = await this.anthropic.messages.create({
        model: this.model,
        max_tokens: 6000,
        temperature: 0.7,
        system: systemPrompt,
        messages: [
          {
            role: "user",
            content: userPrompt,
          },
        ],
      });

      const duration = Date.now() - startTime;
      const output = completion.content
        .map((c) => (c.type === "text" ? c.text : ""))
        .join("\n");

      // Save results
      const logFooter = `

---

## ✅ Execution Complete

**Finished:** ${new Date().toISOString()}  
**Duration:** ${(duration / 1000).toFixed(1)} seconds  
**Tokens Generated:** ~${Math.ceil(output.length / 4)}

---

## 🧠 Generated Intelligence

${output}

---

*This report was generated automatically by the Yellow Panther RFP Intelligence System*
`;

      await fs.appendFile(outputPath, logFooter);
      
      console.log(`✅ Execution completed in ${(duration / 1000).toFixed(1)}s`);
      console.log(`📄 Results saved to: ${path.basename(outputPath)}`);
      console.log(`📊 Generated ~${Math.ceil(output.length / 4)} tokens`);

      return outputPath;

    } catch (error: any) {
      const duration = Date.now() - startTime;
      const errorMsg = `

---

## ❌ Execution Failed

**Finished:** ${new Date().toISOString()}  
**Duration:** ${(duration / 1000).toFixed(1)} seconds  
**Error:** ${error.message}  
**Status:** ${error.status || 'Unknown'}

---

**Error Details:**
\`\`\`json
${JSON.stringify({
  message: error.message,
  status: error.status,
  type: error.type,
  headers: error.headers
}, null, 2)}
\`\`\`

*This error occurred during automated execution of the RFP Monitoring Blueprint*
`;

      await fs.appendFile(outputPath, errorMsg);
      
      console.error(`❌ Execution failed after ${(duration / 1000).toFixed(1)}s`);
      console.error(`💥 Error: ${error.message}`);
      console.error(`📄 Error log saved to: ${path.basename(outputPath)}`);
      
      throw error;
    }

  }

  async run(): Promise<string> {
    console.log(`\n🚀 Starting RFP Intelligence Batch Runner`);
    console.log(`=====================================`);

    // Test connection first
    const connectionOk = await this.testConnection();
    if (!connectionOk) {
      throw new Error("API connection test failed");
    }

    // Load blueprint
    const blueprint = await this.loadBlueprint();
    
    // Gather context
    const context = await this.gatherContext();
    
    // Execute blueprint
    const outputPath = await this.executeBlueprint(blueprint, context);
    
    console.log(`\n🎉 RFP Intelligence Run Complete!`);
    console.log(`📁 Full report: ${outputPath}`);
    console.log(`=====================================\n`);

    return outputPath;
  }
}

// Main execution
async function main() {
  const runner = new RFPBatchRunner();
  
  try {
    await runner.initialize();
    
    if (testConnection) {
      await runner.testConnection();
      process.exit(0);
    }
    
    const outputPath = await runner.run();
    process.exit(0);
    
  } catch (error: any) {
    console.error(`\n💥 Fatal error: ${error.message}`);
    if (error.status) {
      console.error(`   API Status: ${error.status}`);
    }
    process.exit(1);
  }
}

// Handle uncaught errors
process.on('unhandledRejection', (reason, promise) => {
  console.error('💥 Unhandled Rejection at:', promise, 'reason:', reason);
  process.exit(1);
});

process.on('uncaughtException', (error) => {
  console.error('💥 Uncaught Exception:', error);
  process.exit(1);
});

// Run main function
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}