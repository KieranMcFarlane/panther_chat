#!/usr/bin/env node

/**
 * Weekly Intelligence Digest Generator
 * 
 * Analyzes all RFP runs from the past week and generates a comprehensive digest
 * Compatible with both Claude and GLM 4.6 models
 * 
 * Usage:
 *   node cli/generate-weekly-digest.ts
 *   node cli/generate-weekly-digest.ts --days 7
 *   node cli/generate-weekly-digest.ts --model glm-4-6
 */

import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";
import Anthropic from "@anthropic-ai/sdk";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Parse command line arguments
const args = process.argv.slice(2);
const daysToAnalyze = args.includes('--days') ? parseInt(args[args.indexOf('--days') + 1]) || 7 : 7;
const useGlm = args.includes('--model') && args[args.indexOf('--model') + 1] === 'glm-4-6';

class WeeklyDigestGenerator {
  private anthropic: Anthropic;
  private runDir: string;
  private model: string;

  constructor() {
    this.anthropic = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY || "sk-ant-example",
      baseURL: process.env.ANTHROPIC_BASE_URL || "https://api.anthropic.com",
    });

    this.model = useGlm ? "glm-4-6" : "claude-3-5-sonnet-latest";
    this.runDir = path.join(process.cwd(), "RUN_LOGS");
  }

  async initialize(): Promise<void> {
    await fs.mkdir(this.runDir, { recursive: true });
    console.log(`📊 Weekly Digest Generator initialized`);
    console.log(`📁 Analyzing runs from: ${this.runDir}`);
    console.log(`🤖 Model: ${this.model}`);
    console.log(`📅 Period: Last ${daysToAnalyze} days`);
  }

  async collectRunReports(): Promise<string[]> {
    console.log(`🔍 Collecting run reports from last ${daysToAnalyze} days...`);
    
    try {
      const files = await fs.readdir(this.runDir);
      const rfpFiles = files.filter((f) => f.startsWith("RFP_RUN_"));
      
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - daysToAnalyze);
      
      const recentFiles = [];
      
      for (const file of rfpFiles) {
        const filePath = path.join(this.runDir, file);
        const stats = await fs.stat(filePath);
        
        if (stats.mtime >= cutoffDate) {
          recentFiles.push(file);
        }
      }
      
      // Sort by date (newest first)
      recentFiles.sort().reverse();
      
      console.log(`✅ Found ${recentFiles.length} recent reports`);
      return recentFiles;
      
    } catch (error: any) {
      console.error(`❌ Failed to collect reports: ${error.message}`);
      return [];
    }
  }

  async analyzeReports(reportFiles: string[]): Promise<any> {
    console.log(`📊 Analyzing ${reportFiles.length} reports...`);
    
    const analysis = {
      totalRuns: reportFiles.length,
      successfulRuns: 0,
      failedRuns: 0,
      totalOpportunities: 0,
      topEntities: {} as Record<string, number>,
      topSports: {} as Record<string, number>,
      opportunityTypes: {} as Record<string, number>,
      runSummaries: [] as any[],
      totalDuration: 0,
      averageDuration: 0
    };

    for (const file of reportFiles) {
      const filePath = path.join(this.runDir, file);
      const content = await fs.readFile(filePath, "utf8");
      
      // Check if run was successful
      const isSuccessful = content.includes("✅ Execution Complete");
      if (isSuccessful) {
        analysis.successfulRuns++;
      } else {
        analysis.failedRuns++;
      }

      // Extract duration
      const durationMatch = content.match(/Duration:\s*([\d.]+)\s*seconds/);
      if (durationMatch) {
        analysis.totalDuration += parseFloat(durationMatch[1]);
      }

      // Extract opportunities (look for numbered lists, bullet points, etc.)
      const opportunityMatches = content.match(/^[-*]\s+(.*?)(?=\n[-*]|\n\n|$)/gm);
      if (opportunityMatches) {
        analysis.totalOpportunities += opportunityMatches.length;
        
        // Extract entities and sports from opportunities
        for (const opportunity of opportunityMatches) {
          // Simple entity extraction (look for proper nouns, club names, etc.)
          const entityMatch = opportunity.match(/\b([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)\b/g);
          if (entityMatch) {
            for (const entity of entityMatch) {
              if (entity.length > 3) { // Filter out short matches
                analysis.topEntities[entity] = (analysis.topEntities[entity] || 0) + 1;
              }
            }
          }
        }
      }

      // Create a summary for this run
      const runSummary = {
        filename: file,
        success: isSuccessful,
        opportunityCount: opportunityMatches?.length || 0,
        duration: durationMatch ? parseFloat(durationMatch[1]) : 0,
        preview: content.slice(0, 500) + "..."
      };
      
      analysis.runSummaries.push(runSummary);
    }

    // Calculate averages
    analysis.averageDuration = analysis.successfulRuns > 0 ? 
      analysis.totalDuration / analysis.successfulRuns : 0;

    // Sort top entities
    analysis.topEntities = Object.fromEntries(
      Object.entries(analysis.topEntities)
        .sort(([,a], [,b]) => b - a)
        .slice(0, 10)
    );

    console.log(`✅ Analysis complete:`);
    console.log(`   Total runs: ${analysis.totalRuns}`);
    console.log(`   Successful: ${analysis.successfulRuns}`);
    console.log(`   Failed: ${analysis.failedRuns}`);
    console.log(`   Total opportunities: ${analysis.totalOpportunities}`);
    console.log(`   Average duration: ${analysis.averageDuration.toFixed(1)}s`);

    return analysis;
  }

  async generateDigest(analysis: any): Promise<string> {
    console.log(`🤖 Generating weekly digest with ${this.model}...`);

    const systemPrompt = `You are an expert business intelligence analyst for Yellow Panther's sports industry RFP monitoring system.

Your task is to analyze the provided weekly data and generate a comprehensive, actionable intelligence digest that:

1. **Executive Summary**: High-level insights and key takeaways for senior management
2. **Opportunity Analysis**: Breakdown of detected opportunities by type, sport, and entity
3. **Performance Metrics**: System performance, success rates, and trends
4. **Strategic Recommendations**: Data-driven recommendations for the coming week
5. **Action Items**: Specific next steps for the business development team

**OUTPUT REQUIREMENTS:**
- Professional business tone with clear, concise language
- Data-driven insights with specific numbers and percentages
- Actionable recommendations with priority levels
- Structured Markdown format with clear sections
- Focus on business value and strategic implications

Generate a comprehensive weekly intelligence digest now.`;

    const userPrompt = `# Weekly RFP Intelligence Data

## Analysis Period
- **Duration**: Last ${daysToAnalyze} days
- **Total Runs**: ${analysis.totalRuns}
- **Success Rate**: ${analysis.totalRuns > 0 ? ((analysis.successfulRuns / analysis.totalRuns) * 100).toFixed(1) : 0}%

## Performance Metrics
- **Successful Runs**: ${analysis.successfulRuns}
- **Failed Runs**: ${analysis.failedRuns}
- **Average Duration**: ${analysis.averageDuration.toFixed(1)} seconds per run
- **Total Opportunities Detected**: ${analysis.totalOpportunities}

## Top Entities Mentioned
${Object.entries(analysis.topEntities)
  .map(([entity, count]) => `- **${entity}**: ${count} mentions`)
  .join('\n')}

## Individual Run Summaries
${analysis.runSummaries
  .map((run: any, index: number) => `
### Run ${index + 1}: ${run.filename}
- **Status**: ${run.success ? '✅ Success' : '❌ Failed'}
- **Opportunities**: ${run.opportunityCount}
- **Duration**: ${run.duration}s
- **Preview**: ${run.preview.slice(0, 200)}...
`)
  .join('\n')}

---

## Instructions
Generate a comprehensive weekly intelligence digest based on this data. Focus on strategic insights, opportunity trends, and actionable recommendations for Yellow Panther's business development team.`;

    try {
      const completion = await this.anthropic.messages.create({
        model: this.model,
        max_tokens: 4000,
        temperature: 0.3,
        system: systemPrompt,
        messages: [
          {
            role: "user",
            content: userPrompt,
          },
        ],
      });

      const digest = completion.content
        .map((c) => (c.type === "text" ? c.text : ""))
        .join("\n");

      return digest;

    } catch (error: any) {
      console.error(`❌ Failed to generate digest: ${error.message}`);
      
      // Fallback to basic digest
      return this.generateFallbackDigest(analysis);
    }
  }

  private generateFallbackDigest(analysis: any): string {
    return `# Weekly RFP Intelligence Digest

*Note: AI digest generation failed, showing basic analytics*

## Executive Summary
- **Total Runs**: ${analysis.totalRuns} (${analysis.successfulRuns} successful, ${analysis.failedRuns} failed)
- **Opportunities Detected**: ${analysis.totalOpportunities}
- **System Uptime**: ${analysis.totalRuns > 0 ? ((analysis.successfulRuns / analysis.totalRuns) * 100).toFixed(1) : 0}%

## Key Metrics
- **Average Duration**: ${analysis.averageDuration.toFixed(1)} seconds per run
- **Success Rate**: ${analysis.totalRuns > 0 ? ((analysis.successfulRuns / analysis.totalRuns) * 100).toFixed(1) : 0}%

## Top Entities
${Object.entries(analysis.topEntities)
  .slice(0, 5)
  .map(([entity, count]) => `- ${entity}: ${count} mentions`)
  .join('\n')}

## Recommendations
1. Monitor system performance if failure rate > 10%
2. Focus on top entities mentioned frequently
3. Review failed runs for technical issues

---
*Generated on ${new Date().toISOString()}*`;
  }

  async saveDigest(digest: string): Promise<string> {
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    const digestFilename = `WEEKLY_DIGEST_${timestamp}.md`;
    const digestPath = path.join(this.runDir, digestFilename);

    const header = `# Yellow Panther RFP Intelligence Digest
*Generated: ${new Date().toISOString()}*  
*Analysis Period: Last ${daysToAnalyze} days*  
*Model: ${this.model}*

---

`;

    const fullDigest = header + digest;

    await fs.writeFile(digestPath, fullDigest);
    
    console.log(`✅ Weekly digest saved: ${digestFilename}`);
    return digestPath;
  }

  async run(): Promise<string> {
    console.log(`\n📊 Starting Weekly Digest Generation`);
    console.log(`====================================`);

    // Collect recent reports
    const reportFiles = await this.collectRunReports();
    
    if (reportFiles.length === 0) {
      console.log(`ℹ️ No reports found in the last ${daysToAnalyze} days`);
      return "";
    }

    // Analyze reports
    const analysis = await this.analyzeReports(reportFiles);
    
    // Generate digest
    const digest = await this.generateDigest(analysis);
    
    // Save digest
    const digestPath = await this.saveDigest(digest);
    
    console.log(`\n🎉 Weekly Digest Complete!`);
    console.log(`📁 Full digest: ${digestPath}`);
    console.log(`=====================================\n`);

    return digestPath;
  }
}

// Main execution
async function main() {
  const generator = new WeeklyDigestGenerator();
  
  try {
    await generator.initialize();
    const digestPath = await generator.run();
    process.exit(0);
    
  } catch (error: any) {
    console.error(`\n💥 Fatal error: ${error.message}`);
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