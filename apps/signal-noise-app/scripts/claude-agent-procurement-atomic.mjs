import 'dotenv/config';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { query } from '@anthropic-ai/claude-agent-sdk';

const DEFAULT_MODEL =
  process.env.CLAUDE_AGENT_MODEL ||
  process.env.ZAI_MODEL ||
  'claude-3-5-haiku-20241022';

export function buildAtomicProcurementPlan({ entityName, question }) {
  if (!entityName) {
    throw new Error('entityName is required');
  }
  if (!question) {
    throw new Error('question is required');
  }

  return {
    query: `${entityName} RFP tender procurement`,
    searchEngine: 'google',
    model: DEFAULT_MODEL,
    systemPrompt: `You are an agentic procurement discovery assistant.
Use BrightData MCP as the only retrieval transport.
Search broadly on Google first, score the raw SERP yourself, and prefer LinkedIn, official site, press, PDF, and clearly entity-specific procurement evidence.
If the first pass is noisy, perform one recovery query before scraping the best result or top-K.
Judge evidence strictly and return JSON only.
DeepSeek is the judge.`,
    question,
    entityName
  };
}

export function buildAtomicProcurementRuntimeConfig({ entityName, question, env = process.env, timeoutMs = Number(env.AGENT_SDK_TIMEOUT_MS || env.API_TIMEOUT_MS || 60000) }) {
  const plan = buildAtomicProcurementPlan({ entityName, question });
  const brightDataToken = env.BRIGHTDATA_API_TOKEN || env.BRIGHTDATA_TOKEN || '';
  const brightDataZone = env.BRIGHTDATA_ZONE || 'linkedin_posts_monitor';

  if (!brightDataToken.trim()) {
    throw new Error('BRIGHTDATA_API_TOKEN is required for the BrightData MCP transport');
  }

  return {
    ...plan,
    model: plan.model,
    mcpServers: {
      'brightdata-mcp': {
        command: 'node',
        args: ['src/mcp-brightdata-server.js'],
        env: {
          API_TOKEN: brightDataToken,
          BRIGHTDATA_API_TOKEN: brightDataToken,
          BRIGHTDATA_TOKEN: brightDataToken,
          PRO_MODE: 'true',
          BRIGHTDATA_ZONE: brightDataZone
        }
      }
    },
    allowedTools: [
      'mcp__brightdata-mcp__search_engine',
      'mcp__brightdata-mcp__scrape_as_markdown',
      'mcp__brightdata-mcp__scrape_batch'
    ],
    permissionMode: 'default',
    maxTurns: 8,
    includePartialMessages: true,
    systemPrompt: {
      type: 'preset',
      preset: 'claude_code',
      append: plan.systemPrompt
        .concat('\n\n')
        .concat('First action: call mcp__brightdata-mcp__search_engine with the canonical query.')
        .concat('\n')
        .concat('If the first SERP is noisy or missing the entity, do one recovery query.')
        .concat('\n')
        .concat('Then scrape the best candidate or top-K and return JSON only.')
    },
    timeoutMs
  };
}

function extractResultText(message) {
  if (message?.type !== 'result') {
    return null;
  }
  return typeof message.result === 'string' ? message.result : null;
}

export async function runAtomicProcurementQuestion({ entityName, question, outputPath }) {
  const runtime = buildAtomicProcurementRuntimeConfig({ entityName, question });
  const abortController = new AbortController();
  const timeoutMs = Number(process.env.AGENT_SDK_TIMEOUT_MS || process.env.API_TIMEOUT_MS || 60000);
  const timeout = setTimeout(() => abortController.abort(new Error(`Agent SDK timed out after ${timeoutMs}ms`)), timeoutMs);
  const messages = [];
  let finalResult = null;

  console.error(`[atomic-rfp] query=${runtime.query}`);

  for await (const message of query({
    prompt: `${runtime.query}\n\nQuestion: ${question}`,
    options: {
      model: runtime.model,
      abortController,
      mcpServers: runtime.mcpServers,
      allowedTools: runtime.allowedTools,
      permissionMode: runtime.permissionMode,
      maxTurns: runtime.maxTurns,
      includePartialMessages: runtime.includePartialMessages,
      systemPrompt: runtime.systemPrompt
    }
  })) {
    messages.push(message);
    if (message.type === 'assistant') {
      console.error(`[atomic-rfp] assistant`);
    } else if (message.type === 'tool_use') {
      console.error(`[atomic-rfp] tool_use ${message.name}`);
    } else if (message.type === 'tool_result') {
      console.error(`[atomic-rfp] tool_result`);
    } else if (message.type === 'result') {
      console.error(`[atomic-rfp] result ${message.subtype || 'unknown'}`);
    } else {
      console.error(`[atomic-rfp] ${message.type}`);
    }
    const resultText = extractResultText(message);
    if (resultText) {
      finalResult = resultText;
    }
  }

  clearTimeout(timeout);

  const artifact = {
    entityName,
    question,
    query: runtime.query,
    searchEngine: runtime.searchEngine,
    finalResult,
    messages
  };

  if (outputPath) {
    await fs.mkdir(path.dirname(outputPath), { recursive: true });
    await fs.writeFile(outputPath, `${JSON.stringify(artifact, null, 2)}\n`, 'utf8');
  }

  return artifact;
}

async function main() {
  const args = process.argv.slice(2);
  const getArg = (flag) => {
    const idx = args.indexOf(flag);
    return idx === -1 ? null : args[idx + 1] || null;
  };

  if (args.includes('--help') || args.includes('-h')) {
    console.log(
      'Usage: node scripts/claude-agent-procurement-atomic.mjs --entity-name "Major League Cricket" --question "Is there an RFP or tender for Major League Cricket?" [--output path]'
    );
    process.exit(0);
  }

  const entityName = getArg('--entity-name');
  const question = getArg('--question');
  const outputPath = getArg('--output');

  if (!entityName || !question) {
    throw new Error('Both --entity-name and --question are required');
  }

  const artifact = await runAtomicProcurementQuestion({ entityName, question, outputPath });
  process.stdout.write(`${JSON.stringify(artifact, null, 2)}\n`);
}

const isMain = fileURLToPath(import.meta.url) === path.resolve(process.argv[1] || '');
if (isMain) {
  main().catch((error) => {
    console.error(error.stack || error.message);
    process.exit(1);
  });
}
