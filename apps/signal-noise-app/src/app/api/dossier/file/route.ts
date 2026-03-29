/**
 * Dossier File API
 *
 * Serves pre-generated PREMIUM dossier JSON files from backend/data/dossiers/premium/
 */

import { NextRequest, NextResponse } from 'next/server';
import { readFile } from 'fs/promises';
import { existsSync } from 'fs';
import path from 'path';
import { findDossierByNamePattern, findDossierFile, getDossierRoots } from '@/lib/dossier-paths';

export const dynamic = 'force-dynamic';

const DOSSIERS_DIR = getDossierRoots()[0] ?? path.join(process.cwd(), 'backend', 'data', 'dossiers')

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
