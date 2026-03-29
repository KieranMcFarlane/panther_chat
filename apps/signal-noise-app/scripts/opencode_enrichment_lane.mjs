import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { LeadIqClient } from '../src/lib/discovery-lanes/leadiq-client.ts';
import {
  buildOpenCodeEnrichmentArtifact,
  writeOpenCodeEnrichmentArtifact,
} from '../src/lib/discovery-lanes/opencode-enrichment.ts';

function parseArgs(argv) {
  const args = {
    outputDir: 'backend/data/discovery_lanes',
    scoutFile: null,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const value = argv[index];
    if (value === '--output-dir') {
      args.outputDir = argv[++index];
    } else if (value === '--scout-file') {
      args.scoutFile = argv[++index];
    }
  }

  return args;
}

async function loadScoutArtifact(args) {
  if (args.scoutFile) {
    const raw = await readFile(args.scoutFile, 'utf8');
    return JSON.parse(raw);
  }

  return {
    id: 'scout-unknown',
    objective: {
      objective: 'Find broad sports RFP opportunities',
    },
    accepted_candidates: [],
  };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const scoutArtifact = await loadScoutArtifact(args);
  const client = new LeadIqClient();
  const artifact = await buildOpenCodeEnrichmentArtifact({
    scoutArtifact,
    leadIqClient: client,
  });

  await mkdir(args.outputDir, { recursive: true });
  const fileInfo = await writeOpenCodeEnrichmentArtifact({
    outputDir: args.outputDir,
    artifact,
  });

  const rollupPath = join(args.outputDir, `opencode_enrichment_${artifact.id}_rollup.json`);
  const rollup = {
    id: artifact.id,
    lane: 'enrichment',
    system: 'opencode',
    graph_write: false,
    status: artifact.status,
    summary: artifact.summary,
    artifact_path: fileInfo.filePath,
  };
  await writeFile(rollupPath, `${JSON.stringify(rollup, null, 2)}\n`, 'utf8');

  console.log(JSON.stringify({ artifact: fileInfo.filePath, rollup: rollupPath }, null, 2));
}

const isMain = fileURLToPath(import.meta.url) === process.argv[1];

if (isMain) {
  main().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}
