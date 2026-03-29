import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  normalizeManusScoutObjective,
  buildManusScoutArtifact,
  buildDefaultManusCandidates,
  writeManusScoutArtifact,
} from '../src/lib/discovery-lanes/manus-scout.ts';

function parseArgs(argv) {
  const args = {
    outputDir: 'backend/data/discovery_lanes',
    objectiveFile: null,
    objective: null,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const value = argv[index];
    if (value === '--output-dir') {
      args.outputDir = argv[++index];
    } else if (value === '--objective-file') {
      args.objectiveFile = argv[++index];
    } else if (value === '--objective') {
      args.objective = argv[++index];
    }
  }

  return args;
}

async function loadObjective(args) {
  if (args.objectiveFile) {
    const raw = await readFile(args.objectiveFile, 'utf8');
    return JSON.parse(raw);
  }

  if (args.objective) {
    return {
      objective: args.objective,
      seed_query: args.objective,
      sport_scope: 'sports-universe',
    };
  }

  return {
    objective: 'Find broad sports RFP opportunities',
    seed_query: 'sports rfp procurement tender',
    sport_scope: 'sports-universe',
  };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const rawObjective = await loadObjective(args);
  const objective = normalizeManusScoutObjective(rawObjective);
  const artifact = buildManusScoutArtifact({
    objective,
    candidates: buildDefaultManusCandidates(objective),
  });

  await mkdir(args.outputDir, { recursive: true });
  const fileInfo = await writeManusScoutArtifact({
    outputDir: args.outputDir,
    artifact,
  });

  const rollupPath = join(args.outputDir, `manus_scout_${objective.id}_rollup.json`);
  const rollup = {
    id: objective.id,
    lane: 'scout',
    system: 'manus',
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
