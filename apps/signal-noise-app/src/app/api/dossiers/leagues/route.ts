import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

const DOSSIERS_DIR = path.join(process.cwd(), 'dossiers', 'leagues');

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const specificDossier = searchParams.get('dossier');

    // Check if dossiers directory exists
    if (!fs.existsSync(DOSSIERS_DIR)) {
      return NextResponse.json(
        { error: 'Dossiers directory not found' },
        { status: 404 }
      );
    }

    // If specific dossier requested
    if (specificDossier) {
      const dossierPath = path.join(DOSSIERS_DIR, `${specificDossier}.md`);
      
      if (!fs.existsSync(dossierPath)) {
        return NextResponse.json(
          { error: `Dossier '${specificDossier}' not found` },
          { status: 404 }
        );
      }

      const dossierContent = fs.readFileSync(dossierPath, 'utf-8');
      return NextResponse.json({
        name: specificDossier,
        content: dossierContent,
        type: 'markdown',
        lastModified: fs.statSync(dossierPath).mtime.toISOString()
      });
    }

    // List all available dossiers
    const files = fs.readdirSync(DOSSIERS_DIR)
      .filter(file => file.endsWith('.md'))
      .map(file => {
        const filePath = path.join(DOSSIERS_DIR, file);
        const stats = fs.statSync(filePath);
        return {
          name: file.replace('.md', ''),
          filename: file,
          size: stats.size,
          lastModified: stats.mtime.toISOString(),
          type: file.includes('summary') ? 'summary' : 'dossier'
        };
      })
      .sort((a, b) => new Date(b.lastModified).getTime() - new Date(a.lastModified).getTime());

    return NextResponse.json({
      dossiers: files,
      totalFiles: files.length,
      lastUpdated: files.length > 0 ? files[0].lastModified : null
    });

  } catch (error) {
    console.error('Error accessing dossiers:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to access dossiers' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { dossierName, content } = body;

    if (!dossierName || !content) {
      return NextResponse.json(
        { error: 'Dossier name and content are required' },
        { status: 400 }
      );
    }

    // Ensure dossiers directory exists
    if (!fs.existsSync(DOSSIERS_DIR)) {
      fs.mkdirSync(DOSSIERS_DIR, { recursive: true });
    }

    const dossierPath = path.join(DOSSIERS_DIR, `${dossierName}.md`);
    fs.writeFileSync(dossierPath, content, 'utf-8');

    return NextResponse.json({
      success: true,
      message: `Dossier '${dossierName}' saved successfully`,
      path: dossierPath
    });

  } catch (error) {
    console.error('Error saving dossier:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to save dossier' },
      { status: 500 }
    );
  }
}