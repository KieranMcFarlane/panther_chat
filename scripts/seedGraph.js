const neo4j = require('neo4j-driver');
require('dotenv').config({ path: '.env.local' });

const driver = neo4j.driver(
  process.env.NEO4J_URI,
  neo4j.auth.basic(process.env.NEO4J_USER, process.env.NEO4J_PASSWORD)
);

async function seedYellowPantherGraph() {
  const session = driver.session();
  
  try {
    console.log('🟡 Seeding Yellow Panther Knowledge Graph...');
    
    // Clear existing data
    await session.run('MATCH (n) DETACH DELETE n');
    console.log('✅ Cleared existing graph data');
    
    // Create Yellow Panther organization
    await session.run(`
      CREATE (yp:Company {
        name: 'Yellow Panther',
        type: 'Mobile App Development',
        founded: 2020,
        location: 'London, UK',
        specialties: ['Mobile Apps', 'React Native', 'iOS', 'Android', 'App Maintenance'],
        clients: ['Team GB', 'Premier Padel', 'Various Sports Organizations']
      })
    `);
    
    // Create client organizations
    await session.run(`
      CREATE (pl:Client {
        name: 'Premier League',
        type: 'Sports League',
        location: 'London, UK',
        needsAppSupport: true,
        currentApps: ['Premier League Official App', 'Fantasy Premier League'],
        potentialValue: 'High'
      }),
      (teamgb:Client {
        name: 'Team GB',
        type: 'Olympic Team',
        location: 'London, UK',
        hasActiveProject: true,
        currentApps: ['Team GB Official App', 'Olympics Tracker'],
        contractStatus: 'Active'
      }),
      (pp:Client {
        name: 'Premier Padel',
        type: 'Sports Tour',
        location: 'Madrid, Spain',
        hasActiveProject: true,
        currentApps: ['Premier Padel Tour App'],
        contractStatus: 'Active'
      })
    `);
    
    // Create key contacts
    await session.run(`
      CREATE (rm:Contact {
        name: 'Richard Masters',
        title: 'Chief Executive',
        company: 'Premier League',
        email: 'richard.masters@premierleague.com',
        linkedinUrl: 'https://linkedin.com/in/richard-masters-pl',
        influence: 'High',
        decisionMaker: true,
        interests: ['Digital Transformation', 'Mobile Apps', 'Fan Engagement']
      }),
      (dj:Contact {
        name: 'Dan Johnson',
        title: 'Director of Digital',
        company: 'Premier League',
        email: 'dan.johnson@premierleague.com',
        linkedinUrl: 'https://linkedin.com/in/dan-johnson-pl-digital',
        influence: 'High',
        decisionMaker: true,
        interests: ['Mobile Strategy', 'App Development', 'Technology Partnerships']
      }),
      (sw:Contact {
        name: 'Sarah Williams',
        title: 'Head of Technology',
        company: 'Team GB',
        email: 'sarah.williams@teamgb.com',
        linkedinUrl: 'https://linkedin.com/in/sarah-williams-teamgb',
        influence: 'Medium',
        decisionMaker: true,
        interests: ['Olympic Apps', 'Athlete Engagement', 'Digital Innovation']
      }),
      (mr:Contact {
        name: 'Miguel Rodriguez',
        title: 'Digital Director',
        company: 'Premier Padel',
        email: 'miguel.rodriguez@premierpadel.com',
        linkedinUrl: 'https://linkedin.com/in/miguel-rodriguez-premier-padel',
        influence: 'Medium',
        decisionMaker: true,
        interests: ['Global App Strategy', 'Tournament Apps', 'Fan Experience']
      })
    `);
    
    // Create Yellow Panther team members
    await session.run(`
      CREATE (ceo:TeamMember {
        name: 'Alex Thompson',
        title: 'CEO',
        company: 'Yellow Panther',
        email: 'alex@yellowpanther.co.uk',
        specializes: ['Business Development', 'Client Relations', 'Strategy'],
        manages: ['Team GB Account', 'Premier Padel Account']
      }),
      (cto:TeamMember {
        name: 'Jamie Chen',
        title: 'CTO',
        company: 'Yellow Panther',
        email: 'jamie@yellowpanther.co.uk',
        specializes: ['Technical Architecture', 'Mobile Development', 'Team Leadership'],
        manages: ['Development Team', 'Technical Delivery']
      }),
      (pm1:TeamMember {
        name: 'Emma Davis',
        title: 'Project Manager',
        company: 'Yellow Panther',
        email: 'emma@yellowpanther.co.uk',
        specializes: ['Project Management', 'Client Communication', 'Agile Development'],
        manages: ['Team GB App Project']
      }),
      (pm2:TeamMember {
        name: 'Carlos Silva',
        title: 'Project Manager',
        company: 'Yellow Panther',
        email: 'carlos@yellowpanther.co.uk',
        specializes: ['International Projects', 'Sports Apps', 'Multi-language Support'],
        manages: ['Premier Padel App Project']
      })
    `);
    
    // Create app projects
    await session.run(`
      CREATE (tgbApp:Project {
        name: 'Team GB Mobile App',
        type: 'Mobile Application',
        platform: ['iOS', 'Android'],
        status: 'Active Development',
        features: ['Athlete Profiles', 'Event Schedules', 'Live Updates', 'Medal Tracker'],
        launchDate: '2024-06-01',
        maintenanceContract: true
      }),
      (ppApp:Project {
        name: 'Premier Padel Tour App',
        type: 'Mobile Application',
        platform: ['iOS', 'Android'],
        status: 'Live + Maintenance',
        features: ['Tournament Brackets', 'Player Rankings', 'Live Scores', 'News'],
        launchDate: '2023-03-15',
        maintenanceContract: true
      }),
      (plApp:Project {
        name: 'Premier League Next-Gen App',
        type: 'Mobile Application Proposal',
        platform: ['iOS', 'Android'],
        status: 'Proposal Stage',
        features: ['Enhanced Stats', 'AR Features', 'Social Integration', 'Personalization'],
        proposedLaunchDate: '2025-08-01',
        estimatedValue: '£2.5M'
      })
    `);
    
    console.log('✅ Created core entities');
    
    // Create relationships between Yellow Panther and clients
    await session.run(`
      MATCH (yp:Company {name: 'Yellow Panther'})
      MATCH (teamgb:Client {name: 'Team GB'})
      MATCH (pp:Client {name: 'Premier Padel'})
      MATCH (pl:Client {name: 'Premier League'})
      
      CREATE (yp)-[:PROVIDES_SERVICES_TO {
        relationship: 'Active Client',
        since: '2023-01-01',
        services: ['App Development', 'Maintenance', 'Support']
      }]->(teamgb)
      
      CREATE (yp)-[:PROVIDES_SERVICES_TO {
        relationship: 'Active Client',
        since: '2022-06-01',
        services: ['App Development', 'Maintenance', 'Updates']
      }]->(pp)
      
      CREATE (yp)-[:TARGETS {
        relationship: 'Potential Client',
        opportunity: 'High',
        estimatedValue: '£2.5M',
        nextAction: 'Schedule Demo'
      }]->(pl)
    `);
    
    // Connect contacts to their companies
    await session.run(`
      MATCH (rm:Contact {name: 'Richard Masters'})
      MATCH (dj:Contact {name: 'Dan Johnson'})
      MATCH (pl:Client {name: 'Premier League'})
      
      MATCH (sw:Contact {name: 'Sarah Williams'})
      MATCH (teamgb:Client {name: 'Team GB'})
      
      MATCH (mr:Contact {name: 'Miguel Rodriguez'})
      MATCH (pp:Client {name: 'Premier Padel'})
      
      CREATE (rm)-[:WORKS_AT {role: 'Chief Executive'}]->(pl)
      CREATE (dj)-[:WORKS_AT {role: 'Director of Digital'}]->(pl)
      CREATE (sw)-[:WORKS_AT {role: 'Head of Technology'}]->(teamgb)
      CREATE (mr)-[:WORKS_AT {role: 'Digital Director'}]->(pp)
    `);
    
    // Connect Yellow Panther team to company and projects
    await session.run(`
      MATCH (yp:Company {name: 'Yellow Panther'})
      MATCH (ceo:TeamMember {name: 'Alex Thompson'})
      MATCH (cto:TeamMember {name: 'Jamie Chen'})
      MATCH (pm1:TeamMember {name: 'Emma Davis'})
      MATCH (pm2:TeamMember {name: 'Carlos Silva'})
      
      MATCH (tgbApp:Project {name: 'Team GB Mobile App'})
      MATCH (ppApp:Project {name: 'Premier Padel Tour App'})
      MATCH (plApp:Project {name: 'Premier League Next-Gen App'})
      
      CREATE (ceo)-[:WORKS_AT {role: 'CEO'}]->(yp)
      CREATE (cto)-[:WORKS_AT {role: 'CTO'}]->(yp)
      CREATE (pm1)-[:WORKS_AT {role: 'Project Manager'}]->(yp)
      CREATE (pm2)-[:WORKS_AT {role: 'Project Manager'}]->(yp)
      
      CREATE (pm1)-[:MANAGES]->(tgbApp)
      CREATE (pm2)-[:MANAGES]->(ppApp)
      CREATE (ceo)-[:LEADS_PROPOSAL]->(plApp)
    `);
    
    // Connect projects to clients
    await session.run(`
      MATCH (tgbApp:Project {name: 'Team GB Mobile App'})
      MATCH (ppApp:Project {name: 'Premier Padel Tour App'})
      MATCH (plApp:Project {name: 'Premier League Next-Gen App'})
      MATCH (teamgb:Client {name: 'Team GB'})
      MATCH (pp:Client {name: 'Premier Padel'})
      MATCH (pl:Client {name: 'Premier League'})
      
      CREATE (tgbApp)-[:DEVELOPED_FOR]->(teamgb)
      CREATE (ppApp)-[:DEVELOPED_FOR]->(pp)
      CREATE (plApp)-[:PROPOSED_FOR]->(pl)
    `);
    
    console.log('✅ Created all relationships');
    console.log('🎉 Successfully seeded Yellow Panther graph!');
    
  } catch (error) {
    console.error('❌ Error seeding graph:', error);
    throw error;
  } finally {
    await session.close();
  }
}

async function verifyData() {
  const session = driver.session();
  
  try {
    console.log('\n📊 Verifying graph data...');
    
    // Count nodes by type
    const nodeResult = await session.run(`
      MATCH (n) 
      RETURN labels(n)[0] as nodeType, count(n) as count
      ORDER BY count DESC
    `);
    
    console.log('Nodes created:');
    nodeResult.records.forEach(record => {
      console.log(`  - ${record.get('nodeType')}: ${record.get('count')}`);
    });
    
    // Count relationships
    const relResult = await session.run('MATCH ()-[r]->() RETURN count(r) as total');
    console.log(`\nTotal relationships: ${relResult.records[0].get('total')}`);
    
    // Show Yellow Panther connections
    const connectionsResult = await session.run(`
      MATCH (yp:Company {name: 'Yellow Panther'})-[r]->(target)
      RETURN type(r) as relationship, target.name as target, labels(target)[0] as targetType
    `);
    
    console.log('\nYellow Panther connections:');
    connectionsResult.records.forEach(record => {
      console.log(`  - ${record.get('relationship')} → ${record.get('target')} (${record.get('targetType')})`);
    });
    
  } finally {
    await session.close();
  }
}

async function main() {
  try {
    await seedYellowPantherGraph();
    await verifyData();
    console.log('\n🟡 Yellow Panther AI graph is ready for business intelligence!');
  } finally {
    await driver.close();
  }
}

if (require.main === module) {
  main().catch(console.error);
}

module.exports = { seedYellowPantherGraph, verifyData }; 