import { NextRequest, NextResponse } from 'next/server';
import neo4j from 'neo4j-driver';

export async function POST(request: NextRequest) {
  let driver = null;
  let session = null;
  
  try {
    const { query, params = {} } = await request.json();
    
    if (!query) {
      return NextResponse.json({ error: 'Query is required' }, { status: 400 });
    }

    // Initialize Neo4j connection
    driver = neo4j.driver(
      process.env.NEO4J_URI || 'neo4j+s://cce1f84b.databases.neo4j.io',
      neo4j.auth.basic(
        process.env.NEO4J_USERNAME || 'neo4j',
        process.env.NEO4J_PASSWORD || 'llNASCzMWGT-nTt-JkD9Qk_4W6PpJrv39X0PuYAIKV0'
      )
    );
    
    session = driver.session({
      database: 'neo4j',
      defaultAccessMode: neo4j.session.READ
    });
    
    // Ensure all numeric parameters are integers for Neo4j compatibility
    const cleanParams = {};
    for (const [key, value] of Object.entries(params)) {
      if (typeof value === 'number') {
        cleanParams[key] = Math.floor(value);
        console.log(`Neo4j Debug: Converting param ${key} from ${value} to ${cleanParams[key]} (type: ${typeof cleanParams[key]})`);
      } else {
        cleanParams[key] = value;
      }
    }
    
    console.log('Neo4j Debug: Final params:', cleanParams);
    
    // Execute the query
    const result = await session.run(query, cleanParams);
    
    // Transform the records into a more usable format
    const data = result.records.map(record => {
      const obj = {};
      record.keys.forEach(key => {
        obj[key] = record.get(key);
      });
      return obj;
    });
    
    return NextResponse.json({ data });
    
  } catch (error) {
    console.error('Neo4j query API error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  } finally {
    if (session) {
      await session.close();
    }
    if (driver) {
      await driver.close();
    }
  }
}