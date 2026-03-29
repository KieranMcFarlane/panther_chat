import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import {
  buildMajorLeagueCricketPresetQuestions,
  buildClaudeAgentQuestionPrompt,
  runClaudeAgentPresetBatch,
} from '../scripts/claude-agent-preset-batch.mjs';

function makeFakeQuery({
  structuredOutput = null,
  promptResponse = null,
  rawResultText = null,
} = {}) {
  return async function* fakeQuery() {
    yield {
      type: 'system',
      subtype: 'init',
      session_id: `ses_${Math.random().toString(36).slice(2)}`,
    };
    yield {
      type: 'tool_use',
      name: 'mcp__brightdata__search_engine',
      input: { query: 'Major League Cricket RFP tender procurement' },
    };
    yield {
      type: 'tool_result',
      name: 'mcp__brightdata__search_engine',
      content: [{ type: 'text', text: 'tool result' }],
    };
    if (promptResponse) {
      yield promptResponse;
      return;
    }
    const defaultStructuredOutput = {
      answer: '2023',
      signal_type: 'FOUNDATION',
      confidence: 0.88,
      validation_state: 'validated',
      evidence_url: 'https://example.com',
      recommended_next_query: '',
      notes: 'ok',
    };
    const outputText = rawResultText ?? JSON.stringify(structuredOutput ?? defaultStructuredOutput);
    yield {
      type: 'assistant',
      message: {
        content: [
          {
            type: 'text',
            text: outputText,
          },
        ],
      },
    };
    yield {
      type: 'result',
      subtype: 'success',
      result: outputText,
    };
  };
}

test('buildMajorLeagueCricketPresetQuestions returns the preset bundle in order', () => {
  const questions = buildMajorLeagueCricketPresetQuestions();
  assert.equal(questions.length, 7);
  assert.equal(questions[0].question_id, 'entity_founded_year');
  assert.equal(questions[1].question_type, 'procurement');
  assert.equal(questions[2].question_type, 'poi');
});

test('buildClaudeAgentQuestionPrompt names the BrightData MCP tools explicitly', () => {
  const prompt = buildClaudeAgentQuestionPrompt(buildMajorLeagueCricketPresetQuestions()[1]);
  assert.match(prompt, /brightdata/i);
  assert.match(prompt, /mcp__brightdata__search_engine/i);
  assert.match(prompt, /mcp__brightdata__scrape_as_markdown|mcp__brightdata__scrape_batch/i);
  assert.match(prompt, /Schema keys:/i);
});

test('runClaudeAgentPresetBatch writes a merged meta artifact for the preset', async () => {
  const outputDir = await fs.mkdtemp(path.join(os.tmpdir(), 'claude-agent-batch-'));
  const result = await runClaudeAgentPresetBatch({
    outputDir,
    env: {
      BRIGHTDATA_API_TOKEN: 'test-token',
      ZAI_API_KEY: 'test-zai-token',
      ANTHROPIC_BASE_URL: 'https://api.z.ai/api/anthropic',
    },
    queryFn: makeFakeQuery(),
  });

  assert.equal(result.questions_total, 7);
  assert.equal(result.questions_validated, 7);
  assert.equal(result.questions_no_signal, 0);
  assert.equal(result.questions_provisional, 0);
  assert.equal(result.question_result_paths.length, 7);
  assert.ok(result.meta_result_path.endsWith('_meta.json'));

  const meta = JSON.parse(await fs.readFile(result.meta_result_path, 'utf8'));
  assert.equal(meta.questions.length, 7);
  assert.equal(meta.questions[0].validation_state, 'validated');
  assert.equal(meta.questions[0].tool_use_count, 1);
});

test('runClaudeAgentPresetBatch marks empty structured output after tool use as no_signal', async () => {
  const outputDir = await fs.mkdtemp(path.join(os.tmpdir(), 'claude-agent-batch-empty-'));
  const result = await runClaudeAgentPresetBatch({
    outputDir,
    env: {
      BRIGHTDATA_API_TOKEN: 'test-token',
      ZAI_API_KEY: 'test-zai-token',
      ANTHROPIC_BASE_URL: 'https://api.z.ai/api/anthropic',
    },
    queryFn: makeFakeQuery({ rawResultText: '{}' }),
  });

  assert.equal(result.questions_total, 7);
  assert.equal(result.questions_no_signal, 7);
  const meta = JSON.parse(await fs.readFile(result.meta_result_path, 'utf8'));
  assert.equal(meta.questions[0].validation_state, 'no_signal');
});

test('runClaudeAgentPresetBatch stores the message trace when available', async () => {
  const outputDir = await fs.mkdtemp(path.join(os.tmpdir(), 'claude-agent-batch-trace-'));
  const result = await runClaudeAgentPresetBatch({
    outputDir,
    env: {
      BRIGHTDATA_API_TOKEN: 'test-token',
      ZAI_API_KEY: 'test-zai-token',
      ANTHROPIC_BASE_URL: 'https://api.z.ai/api/anthropic',
    },
    queryFn: makeFakeQuery({
      promptResponse: {
        type: 'assistant',
        result: JSON.stringify({
          answer: '2023',
          signal_type: 'FOUNDATION',
          confidence: 0.88,
          validation_state: 'validated',
          evidence_url: 'https://example.com',
          recommended_next_query: '',
          notes: 'ok',
        }),
      },
    }),
  });

  const meta = JSON.parse(await fs.readFile(result.meta_result_path, 'utf8'));
  assert.ok(Array.isArray(meta.questions[0].message_trace));
  assert.equal(meta.questions[0].tool_use_count, 1);
  assert.equal(meta.questions[0].validation_state, 'validated');
});
