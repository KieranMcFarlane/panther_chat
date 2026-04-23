import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';

test('question-first dossier merge threads commercial signal fields into merged questions', () => {
  const source = readFileSync(
    new URL('../src/lib/question-first-dossier.ts', import.meta.url),
    'utf8',
  );

  assert.match(source, /evidence_grade:\s*answer\.evidence_grade/);
  assert.match(source, /structured_signal:\s*answer\.structured_signal/);
  assert.match(source, /procurement_model:\s*answer\.procurement_model/);
  assert.match(source, /commercial_implication:\s*answer\.commercial_implication/);
  assert.match(source, /signal_density:\s*answer\.signal_density/);
});
