#!/usr/bin/env node

const neo4j = require('neo4j-driver');

async function testRemoteNeo4j() {
    console.log('🔍 Testing Remote Neo4j Connection and Data...\n');
    
    const host = '212.86.105.190';
    const boltPort = '7687';
    const httpPort = '7474';
    const username = 'neo4j';
    const password = 'pantherpassword';
    const database = 'neo4j';
    
    // Test 1: HTTP Browser Interface
    console.log('📡 Test 1: HTTP Browser Interface');
    try {
        const response = await fetch(`http://${host}:${httpPort}`);
        const data = await response.json();
        console.log('✅ Neo4j Browser accessible');
        console.log(`   Version: ${data.neo4j_version}`);
        console.log(`   Bolt Direct: ${data.bolt_direct}`);
        console.log(`   Bolt Routing: ${data.bolt_routing}\n`);
    } catch (error) {
        console.log('❌ Neo4j Browser not accessible:', error.message);
        console.log(`   URL: http://${host}:${httpPort}\n`);
    }
    
    // Test 2: Bolt Connection with Different Encryption Settings
    console.log('📡 Test 2: Bolt Connection Tests');
    
    const connectionConfigs = [
        {
            name: 'No Encryption (ENCRYPTION_OFF)',
            uri: `bolt://${host}:${boltPort}`,
            config: { encrypted: 'ENCRYPTION_OFF' }
        },
        {
            name: 'Default Encryption',
            uri: `bolt://${host}:${boltPort}`,
            config: {}
        },
        {
            name: 'Explicit TLS (neo4j+s)',
            uri: `neo4j+s://${host}:${boltPort}`,
            config: { trust: 'TRUST_SYSTEM_CA_SIGNED_CERTIFICATES' }
        },
        {
            name: 'Bolt with TLS (bolt+s)',
            uri: `bolt+s://${host}:${boltPort}`,
            config: { trust: 'TRUST_SYSTEM_CA_SIGNED_CERTIFICATES' }
        }
    ];
    
    let workingDriver = null;
    let workingConfig = null;
    
    for (const config of connectionConfigs) {
        console.log(`   Testing: ${config.name}`);
        console.log(`   URI: ${config.uri}`);
        
        const driver = neo4j.driver(
            config.uri,
            neo4j.auth.basic(username, password),
            config.config
        );
        
        const session = driver.session({ database });
        
        try {
            const result = await session.run('RETURN 1 as test');
            const testValue = result.records[0].get('test');
            
            if (testValue === 1) {
                console.log('   ✅ Connection successful!\n');
                workingDriver = driver;
                workingConfig = config;
                await session.close();
                break;
            }
        } catch (error) {
            console.log(`   ❌ Failed: ${error.message}`);
            console.log(`   Code: ${error.code}\n`);
        } finally {
            await session.close();
            if (driver !== workingDriver) {
                await driver.close();
            }
        }
    }
    
    if (!workingDriver) {
        console.log('❌ No working connection found. Exiting...');
        return;
    }
    
    console.log(`🎉 Using working connection: ${workingConfig.name}`);
    console.log(`   URI: ${workingConfig.uri}\n`);
    
    // Test 3: Database Content Analysis
    console.log('📊 Test 3: Database Content Analysis');
    
    const session = workingDriver.session({ database });
    
    try {
        // Total node count
        console.log('   📈 Total Nodes:');
        const nodeCountResult = await session.run('MATCH (n) RETURN count(n) as totalNodes');
        const totalNodes = nodeCountResult.records[0].get('totalNodes').toNumber();
        console.log(`      Total: ${totalNodes} nodes\n`);
        
        // Node labels and counts
        console.log('   🏷️  Node Labels and Counts:');
        const labelsResult = await session.run(`
            CALL db.labels() YIELD label
            CALL {
                WITH label
                CALL apoc.cypher.run('MATCH (n:' + label + ') RETURN count(n) as count', {})
                YIELD value
                RETURN value.count as count
            }
            RETURN label, count
            ORDER BY count DESC
        `);
        
        labelsResult.records.forEach(record => {
            const label = record.get('label');
            const count = record.get('count').toNumber();
            console.log(`      ${label}: ${count} nodes`);
        });
        console.log('');
        
        // Relationship types and counts
        console.log('   🔗 Relationship Types and Counts:');
        const relsResult = await session.run(`
            CALL db.relationshipTypes() YIELD relationshipType
            CALL {
                WITH relationshipType
                CALL apoc.cypher.run('MATCH ()-[r:' + relationshipType + ']-() RETURN count(r) as count', {})
                YIELD value
                RETURN value.count as count
            }
            RETURN relationshipType, count
            ORDER BY count DESC
        `);
        
        relsResult.records.forEach(record => {
            const relType = record.get('relationshipType');
            const count = record.get('count').toNumber();
            console.log(`      ${relType}: ${count} relationships`);
        });
        console.log('');
        
        // Sample data from each label
        console.log('   📄 Sample Data from Each Label:');
        const allLabels = labelsResult.records.map(r => r.get('label'));
        
        for (const label of allLabels.slice(0, 5)) { // Limit to first 5 labels
            console.log(`      ${label} samples:`);
            const sampleResult = await session.run(`
                MATCH (n:${label})
                RETURN n
                LIMIT 3
            `);
            
            sampleResult.records.forEach((record, index) => {
                const node = record.get('n');
                const props = Object.keys(node.properties).slice(0, 3); // Show first 3 properties
                const propsSummary = props.map(key => `${key}: ${node.properties[key]}`).join(', ');
                console.log(`         ${index + 1}. ${propsSummary}`);
            });
            console.log('');
        }
        
        // Database schema overview
        console.log('   📋 Database Schema Overview:');
        const schemaResult = await session.run(`
            CALL db.schema.visualization()
        `);
        
        if (schemaResult.records.length > 0) {
            const schema = schemaResult.records[0].get('nodes');
            console.log(`      Schema contains ${schema.length} node types with relationships\n`);
        }
        
        // Recent activity (if timestamps exist)
        console.log('   ⏰ Recent Activity Check:');
        try {
            const recentResult = await session.run(`
                MATCH (n)
                WHERE exists(n.created_at) OR exists(n.timestamp) OR exists(n.date)
                RETURN n
                ORDER BY coalesce(n.created_at, n.timestamp, n.date) DESC
                LIMIT 5
            `);
            
            if (recentResult.records.length > 0) {
                console.log('      Recent nodes found:');
                recentResult.records.forEach((record, index) => {
                    const node = record.get('n');
                    const timestamp = node.properties.created_at || node.properties.timestamp || node.properties.date;
                    console.log(`         ${index + 1}. ${Object.values(node.labels)[0]}: ${timestamp}`);
                });
            } else {
                console.log('      No timestamp properties found in nodes');
            }
        } catch (error) {
            console.log('      Could not check recent activity:', error.message);
        }
        
    } catch (error) {
        console.log(`❌ Database analysis failed: ${error.message}`);
        console.log(`   Code: ${error.code}`);
        if (error.message.includes('apoc')) {
            console.log('   Note: APOC plugin may not be installed. Trying alternative queries...\n');
            
            // Alternative without APOC
            console.log('   📊 Alternative Analysis (without APOC):');
            try {
                const simpleLabelsResult = await session.run(`
                    CALL db.labels() YIELD label
                    RETURN collect(label) as labels
                `);
                const labels = simpleLabelsResult.records[0].get('labels');
                console.log(`      Available labels: ${labels.join(', ')}`);
                
                // Manual count for each label
                for (const label of labels.slice(0, 3)) {
                    const countResult = await session.run(`MATCH (n:\`${label}\`) RETURN count(n) as count`);
                    const count = countResult.records[0].get('count').toNumber();
                    console.log(`      ${label}: ${count} nodes`);
                }
            } catch (altError) {
                console.log(`      Alternative analysis also failed: ${altError.message}`);
            }
        }
    } finally {
        await session.close();
        await workingDriver.close();
    }
    
    console.log('\n🎯 Connection Summary:');
    console.log(`   Host: ${host}:${boltPort}`);
    console.log(`   Database: ${database}`);
    console.log(`   Working URI: ${workingConfig.uri}`);
    console.log(`   Encryption: ${workingConfig.name}`);
    console.log(`   Status: ✅ Connected and verified`);
    console.log('\n💡 Use this configuration in your applications!');
}

// Run the test
testRemoteNeo4j().catch(console.error);





