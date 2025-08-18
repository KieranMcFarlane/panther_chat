#!/usr/bin/env node

const neo4j = require('neo4j-driver');

async function testNeoConverseConnection() {
    console.log('🔍 Testing NeoConverse Connection Configuration...\n');
    
    // Read NeoConverse .env file
    const fs = require('fs');
    const path = require('path');
    
    let envConfig = {};
    try {
        const envPath = path.join(__dirname, 'neoconverse', '.env');
        const envContent = fs.readFileSync(envPath, 'utf8');
        
        envContent.split('\n').forEach(line => {
            const [key, value] = line.split('=');
            if (key && value) {
                envConfig[key.trim()] = value.trim();
            }
        });
        
        console.log('📄 NeoConverse .env Configuration:');
        console.log(`   NEXT_PUBLIC_BACKEND_HOST: ${envConfig.NEXT_PUBLIC_BACKEND_HOST}`);
        console.log(`   NEXT_PUBLIC_BACKEND_UNAME: ${envConfig.NEXT_PUBLIC_BACKEND_UNAME}`);
        console.log(`   NEXT_PUBLIC_BACKEND_PWD: ${envConfig.NEXT_PUBLIC_BACKEND_PWD}`);
        console.log(`   NEXT_PUBLIC_BACKEND_DATABASE: ${envConfig.NEXT_PUBLIC_BACKEND_DATABASE}`);
        console.log(`   OPENAI_MODEL: ${envConfig.OPENAI_MODEL}`);
        console.log(`   OPENAI_API_KEY: ${envConfig.OPENAI_API_KEY ? '***SET***' : 'NOT SET'}\n`);
        
    } catch (error) {
        console.log('❌ Could not read NeoConverse .env file:', error.message);
        return;
    }
    
    // Test connection using NeoConverse settings
    const host = envConfig.NEXT_PUBLIC_BACKEND_HOST;
    const username = envConfig.NEXT_PUBLIC_BACKEND_UNAME;
    const password = envConfig.NEXT_PUBLIC_BACKEND_PWD;
    const database = envConfig.NEXT_PUBLIC_BACKEND_DATABASE;
    
    if (!host || !username || !password) {
        console.log('❌ Missing required connection parameters in .env file');
        return;
    }
    
    console.log('🔌 Testing NeoConverse Connection Settings:');
    console.log(`   URI: ${host}`);
    console.log(`   Username: ${username}`);
    console.log(`   Database: ${database}\n`);
    
    // Test different encryption settings
    const connectionConfigs = [
        {
            name: 'No Encryption (ENCRYPTION_OFF)',
            config: { encrypted: 'ENCRYPTION_OFF' }
        },
        {
            name: 'Default Encryption',
            config: {}
        },
        {
            name: 'Trust All Certificates',
            config: { trust: 'TRUST_ALL_CERTIFICATES' }
        }
    ];
    
    let workingDriver = null;
    let workingConfig = null;
    
    for (const config of connectionConfigs) {
        console.log(`   Testing: ${config.name}`);
        
        const driver = neo4j.driver(
            host,
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
        console.log('❌ No working connection found with NeoConverse settings');
        return;
    }
    
    console.log(`🎉 NeoConverse connection working with: ${workingConfig.name}\n`);
    
    // Test some queries that NeoConverse might use
    console.log('🧪 Testing NeoConverse-style Queries:');
    
    const session = workingDriver.session({ database });
    
    try {
        // Basic connectivity test
        console.log('   1. Basic connectivity test:');
        const basicResult = await session.run('RETURN 1 as result');
        console.log(`      ✅ Basic query successful: ${basicResult.records[0].get('result')}`);
        
        // Node count
        console.log('   2. Total node count:');
        const countResult = await session.run('MATCH (n) RETURN count(n) as totalNodes');
        const totalNodes = countResult.records[0].get('totalNodes').toNumber();
        console.log(`      ✅ Total nodes: ${totalNodes}`);
        
        // Available labels
        console.log('   3. Available node labels:');
        const labelsResult = await session.run('CALL db.labels() YIELD label RETURN collect(label) as labels');
        const labels = labelsResult.records[0].get('labels');
        console.log(`      ✅ Labels: ${labels.join(', ')}`);
        
        // Sample query for each label (what NeoConverse might ask)
        console.log('   4. Sample data queries:');
        for (const label of labels.slice(0, 3)) {
            try {
                const sampleResult = await session.run(`MATCH (n:\`${label}\`) RETURN n LIMIT 1`);
                if (sampleResult.records.length > 0) {
                    const node = sampleResult.records[0].get('n');
                    const propertyCount = Object.keys(node.properties).length;
                    console.log(`      ✅ ${label}: Found nodes with ${propertyCount} properties`);
                } else {
                    console.log(`      ⚠️  ${label}: No nodes found`);
                }
            } catch (error) {
                console.log(`      ❌ ${label}: Query failed - ${error.message}`);
            }
        }
        
        // Test relationship queries
        console.log('   5. Relationship queries:');
        const relTypesResult = await session.run('CALL db.relationshipTypes() YIELD relationshipType RETURN collect(relationshipType) as types');
        const relTypes = relTypesResult.records[0].get('types');
        console.log(`      ✅ Relationship types: ${relTypes.join(', ')}`);
        
        // Test a complex query (what a user might ask NeoConverse)
        console.log('   6. Complex query test:');
        try {
            const complexResult = await session.run(`
                MATCH (n)
                RETURN labels(n)[0] as nodeType, count(n) as count
                ORDER BY count DESC
                LIMIT 5
            `);
            
            console.log('      ✅ Node type distribution:');
            complexResult.records.forEach(record => {
                const nodeType = record.get('nodeType');
                const count = record.get('count').toNumber();
                console.log(`         ${nodeType}: ${count} nodes`);
            });
        } catch (error) {
            console.log(`      ❌ Complex query failed: ${error.message}`);
        }
        
    } catch (error) {
        console.log(`❌ Query testing failed: ${error.message}`);
    } finally {
        await session.close();
        await workingDriver.close();
    }
    
    console.log('\n✅ NeoConverse Connection Test Complete!');
    console.log('   Your NeoConverse should be able to connect and query the database.');
    console.log('   If NeoConverse still shows generic responses, the issue is likely:');
    console.log('   1. Agent not configured in browser Local Storage');
    console.log('   2. OpenAI API key issues');
    console.log('   3. Model selection problems');
    console.log('\n💡 Next step: Visit http://localhost:3001/auto-configure.html');
}

// Run the test
testNeoConverseConnection().catch(console.error);





