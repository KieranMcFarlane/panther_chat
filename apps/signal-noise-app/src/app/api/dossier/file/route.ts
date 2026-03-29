/**
 * Dossier File API
 *
 * Serves pre-generated PREMIUM dossier JSON files from backend/data/dossiers/premium/
 */

import { NextRequest, NextResponse } from 'next/server';
import { readFile } from 'fs/promises';
import { existsSync } from 'fs';
import path from 'path';

export const dynamic = 'force-dynamic';

// Handle both development scenarios (apps/signal-noise-app vs signal-noise-app)
const getParentDir = (p: string, depth = 1) => {
  for (let i = 0; i < depth; i++) {
    p = path.dirname(p)
  }
  return p
}

// Try different possible paths
const getPossibleDossierDirs = () => {
  const cwd = process.cwd()
  return [
    path.join(cwd, '..', '..', 'backend', 'data', 'dossiers'), // From apps/signal-noise-app
    path.join(cwd, '..', 'backend', 'data', 'dossiers'),     // From signal-noise-app
    path.join(getParentDir(cwd, 2), 'backend', 'data', 'dossiers'), // Alternative
    path.join(cwd, 'backend', 'data', 'dossiers'),            // Same directory
  ]
}

let DOSSIERS_DIR = getPossibleDossierDirs()[0]
for (const dir of getPossibleDossierDirs()) {
  if (existsSync(dir)) {
    DOSSIERS_DIR = dir
    break
  }
}

/**
 * Find the actual dossier file by pattern matching
 * Handles cases where entity_id is a partial match (e.g., "641" -> "liverpool_fc_641.json")
 */
function findDossierFile(entityId: string, tierDir: string): string | null {
  const { readdirSync } = require('fs');
  const decodedEntityId = decodeURIComponent(entityId)

  // Try exact match first
  const exactMatch = path.join(tierDir, `${decodedEntityId}.json`)
  if (existsSync(exactMatch)) {
    return decodedEntityId
  }

  // Try to find by partial match (suffix match for numeric IDs)
  const files = readdirSync(tierDir)
  for (const file of files) {
    if (file.endsWith('.json')) {
      const filename = file.replace('.json', '')
      // Check if entityId matches as suffix (e.g., "641" matches "liverpool_fc_641")
      if (filename.endsWith(decodedEntityId) || filename.endsWith(entityId)) {
        return filename
      }
    }
  }

  return null
}

/**
 * Try to find a dossier file by searching for name patterns
 * This handles cases where we need to match by entity name rather than ID
 */
async function findDossierByNamePattern(entityName: string, tierDir: string): Promise<string | null> {
  const { readdirSync } = require('fs');
  const files = readdirSync(tierDir);

  // Normalize the entity name for matching
  const normalizedName = entityName
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '') // Remove special chars
    .replace(/\s+/g, '_');     // Spaces to underscores

  // Try different patterns
  const patterns = [
    normalizedName,                    // "arsenal"
    `${normalizedName}_fc`,             // "arsenal_fc"
    `${normalizedName.replace('_', '-')}`, // "arsenal-fc" (if name had underscores)
    `${normalizedName}-fc`,              // "arsenal-fc" (always try with dash)
  ];

  for (const file of files) {
    if (file.endsWith('.json')) {
      const filename = file.replace('.json', '').toLowerCase();
      for (const pattern of patterns) {
        if (filename === pattern || filename.endsWith(pattern)) {
          console.log(`  → Matched pattern "${pattern}" to file "${filename}"`)
          return file.replace('.json', '');
        }
      }
    }
  }

  return null;
}

/**
 * Map entity IDs to their dossier filenames
 * Handles special characters and naming conventions
 */
function getDossierFilename(entityId: string, tier: string = 'premium'): string {
  // Known mappings for special characters
  const mappings: Record<string, string> = {
    'brighton_&_hove_albion_fc_1485': 'brighton_&_hove_albion_fc_1485',
    'liverpool_fc_641': 'liverpool_fc_641',
    'arsenal-fc': 'arsenal-fc',
    'arsenal_fc_641': 'arsenal-fc', // Fallback
    '1485': 'brighton_&_hove_albion_fc_1485', // Brighton ID
    '641': 'liverpool_fc_641', // Liverpool ID
  }

  // Also map the encoded version
  mappings['brighton_%26_hove_albion_fc_1485'] = 'brighton_&_hove_albion_fc_1485'

  // Check direct mapping first (try decoded, then encoded)
  const decodedEntityId = decodeURIComponent(entityId)
  if (mappings[decodedEntityId]) {
    return mappings[decodedEntityId]
  }
  if (mappings[entityId]) {
    return mappings[entityId]
  }

  // Use decoded entity_id as filename
  return decodedEntityId
}

/**
 * GET /api/dossier/file?entity_id={id}&tier={premium|standard|basic}
 *
 * Retrieve pre-generated dossier JSON file
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const entityId = searchParams.get('entity_id');
  const tier = searchParams.get('tier') || 'premium';

  if (!entityId) {
    return NextResponse.json(
      { error: 'entity_id is required' },
      { status: 400 }
    );
  }

  try {
    const tierDir = path.join(DOSSIERS_DIR, tier.toLowerCase())

    // First try to find the file by pattern matching (for partial entity IDs like "641")
    let foundFilename = findDossierFile(entityId, tierDir)

    // If not found by ID, try fetching entity name and searching by name pattern
    if (!foundFilename) {
      try {
        // Try to get the entity from our API to find its name
        const entityResponse = await fetch(`http://localhost:3005/api/entities/${entityId}`);
        if (entityResponse.ok) {
          const entityData = await entityResponse.json();
          const entityName = entityData.entity?.properties?.name;
          if (entityName) {
            console.log(`🔍 Trying to find dossier by name: ${entityName}`)
            foundFilename = await findDossierByNamePattern(entityName, tierDir);
            if (foundFilename) {
              console.log(`✅ Found dossier by name pattern: ${foundFilename}`)
            }
          }
        }
      } catch (e) {
        console.log('⚠️ Could not fetch entity for name-based search:', e)
      }
    }

    if (!foundFilename) {
      return NextResponse.json(
        {
          error: 'Dossier file not found',
          entity_id: entityId,
          tier,
          searched_dir: tierDir,
          available_files: existsSync(tierDir) ? require('fs').readdirSync(tierDir).filter((f: string) => f.endsWith('.json')) : [],
          message: `No ${tier.toUpperCase()} dossier found for entity ${entityId}. Generate one first using the batch dossier generator.`
        },
        { status: 404 }
      );
    }

    const filePath = path.join(tierDir, `${foundFilename}.json`);

    console.log(`📂 Loading dossier: ${filePath}`);

    // Check if file exists
    if (!existsSync(filePath)) {
      return NextResponse.json(
        {
          error: 'Dossier file not found',
          entity_id: entityId,
          tier,
          searched_path: filePath,
          message: `No ${tier.toUpperCase()} dossier found for entity ${entityId}. Generate one first using the batch dossier generator.`
        },
        { status: 404 }
      );
    }

    // Read and parse the dossier
    const fileContent = await readFile(filePath, 'utf-8');
    const dossier = JSON.parse(fileContent);

    console.log(`✅ Loaded ${tier.toUpperCase()} dossier for ${dossier.metadata?.entity_id || entityId}`);

    return NextResponse.json({
      success: true,
      entity_id: entityId,
      tier: tier.toUpperCase(),
      dossier: dossier,
      source: 'file',
      loaded_at: new Date().toISOString()
    });

  } catch (error) {
    console.error('Dossier file read error:', error);

    return NextResponse.json(
      {
        error: 'Failed to read dossier file',
        entity_id: entityId,
        tier,
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

/**
 * GET /api/dossier/file/list
 *
 * List all available dossier files
 */
export async function LIST() {
  try {
    const { readdir } = require('fs/promises');
    const tiers = ['premium', 'standard', 'basic'];
    const result: Record<string, string[]> = {};

    for (const tier of tiers) {
      const tierDir = path.join(DOSSIERS_DIR, tier);
      if (existsSync(tierDir)) {
        const files = await readdir(tierDir);
        result[tier] = files.filter(f => f.endsWith('.json')).map(f => f.replace('.json', ''));
      } else {
        result[tier] = [];
      }
    }

    return NextResponse.json({
      success: true,
      dossiers: result,
      total_count: Object.values(result).reduce((sum, arr) => sum + arr.length, 0)
    });

  } catch (error) {
    return NextResponse.json(
      {
        error: 'Failed to list dossiers',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
