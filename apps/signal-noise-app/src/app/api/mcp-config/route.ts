import { NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';

export async function GET() {
  try {
    const mcpConfigPath = path.join(process.cwd(), '.mcp.json');
    
    // Check if file exists
    try {
      await fs.access(mcpConfigPath);
    } catch {
      return NextResponse.json({ mcpServers: {} });
    }

    const mcpConfig = JSON.parse(await fs.readFile(mcpConfigPath, 'utf-8'));
    return NextResponse.json({ mcpServers: mcpConfig.mcpServers || {} });
  } catch (error) {
    console.warn('Failed to load MCP config:', error);
    return NextResponse.json({ mcpServers: {} });
  }
}