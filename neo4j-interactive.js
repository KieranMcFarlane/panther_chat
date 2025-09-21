#!/usr/bin/env node

const neo4j = require('neo4j-driver');
const readline = require('readline');
require('dotenv').config({ path: './shared-config.env' });

class InteractiveNeo4j {
    constructor() {
        this.driver = null;
        this.session = null;
        this.rl = readline.createInterface({
            input: process.stdin,
            output: process.stdout
        });
    }

    async connect() {
        try {
            console.log('🔌 Connecting to Neo4j...');
            
            const uri = process.env.NEO4J_URI || 'bolt://212.86.105.190:7687';
            const user = process.env.NEO4J_USER || 'neo4j';
            const password = process.env.NEO4J_PASSWORD || 'pantherpassword';
            const database = process.env.NEO4J_DATABASE || 'neo4j';

            console.log(`📍 URI: ${uri}`);
            console.log(`👤 User: ${user}`);
            console.log(`🗄️  Database: ${database}`);

            this.driver = neo4j.driver(
                uri,
                neo4j.auth.basic(user, password),
                {
                    encrypted: 'ENCRYPTION_OFF',
                    trust: 'TRUST_ALL_CERTIFICATES'
                }
            );

            this.session = this.driver.session({ database });
            const result = await this.session.run('RETURN 1 as test');
            
            if (result.records[0].get('test') === 1) {
                console.log('✅ Successfully connected to Neo4j!');
                return true;
            }
        } catch (error) {
            console.error('❌ Failed to connect to Neo4j:', error.message);
            return false;
        }
    }

    async runQuery(query) {
        try {
            console.log(`\n🔍 Executing: ${query}`);
            const result = await this.session.run(query);
            
            console.log(`\n✅ Query executed successfully!`);
            console.log(`📊 Records returned: ${result.records.length}`);
            
            if (result.records.length > 0) {
                console.log('\n📋 Results:');
                console.log('─'.repeat(80));
                
                // Display column headers
                const keys = result.records[0].keys;
                const headers = keys.map(key => key.padEnd(20)).join(' | ');
                console.log(headers);
                console.log('─'.repeat(80));
                
                // Display data (limit to first 10 records for readability)
                const displayRecords = result.records.slice(0, 10);
                displayRecords.forEach(record => {
                    const row = keys.map(key => {
                        const value = record.get(key);
                        return String(value).substring(0, 18).padEnd(20);
                    }).join(' | ');
                    console.log(row);
                });
                
                if (result.records.length > 10) {
                    console.log(`... and ${result.records.length - 10} more records`);
                }
            }
            
            return result;
        } catch (error) {
            console.error(`❌ Query failed: ${error.message}`);
            throw error;
        }
    }

    async showHelp() {
        console.log('\n📚 Available Commands:');
        console.log('─'.repeat(50));
        console.log('help                    - Show this help message');
        console.log('info                    - Show database information');
        console.log('stats                   - Show database statistics');
        console.log('schema                  - Show database schema');
        console.log('clear                   - Clear the screen');
        console.log('quit, exit, q           - Exit the application');
        console.log('\n📝 Or enter any Cypher query to execute it');
        console.log('─'.repeat(50));
    }

    async showDatabaseInfo() {
        try {
            console.log('\n📊 Database Information:');
            console.log('─'.repeat(50));
            
            const components = await this.session.run('CALL dbms.components() YIELD name, versions, edition');
            components.records.forEach(record => {
                const name = record.get('name');
                const version = record.get('versions')[0];
                const edition = record.get('edition');
                console.log(`${name}: ${version} (${edition})`);
            });
            
            const nodeCount = await this.session.run('MATCH (n) RETURN count(n) as count');
            const relCount = await this.session.run('MATCH ()-[r]->() RETURN count(r) as count');
            
            console.log(`\n📈 Statistics:`);
            console.log(`Total Nodes: ${nodeCount.records[0].get('count')}`);
            console.log(`Total Relationships: ${relCount.records[0].get('count')}`);
            
        } catch (error) {
            console.error('Failed to get database info:', error.message);
        }
    }

    async showSchema() {
        try {
            console.log('\n🏷️  Database Schema:');
            console.log('─'.repeat(50));
            
            const labels = await this.session.run('CALL db.labels() YIELD label RETURN label ORDER BY label');
            console.log('Node Labels:');
            labels.records.forEach(record => {
                console.log(`  • ${record.get('label')}`);
            });
            
            const relTypes = await this.session.run('CALL db.relationshipTypes() YIELD relationshipType RETURN relationshipType ORDER BY relationshipType');
            console.log('\nRelationship Types:');
            relTypes.records.forEach(record => {
                console.log(`  • ${record.get('relationshipType')}`);
            });
            
        } catch (error) {
            console.error('Failed to get schema:', error.message);
        }
    }

    async start() {
        const connected = await this.connect();
        if (!connected) {
            console.log('❌ Could not connect to Neo4j. Exiting...');
            this.rl.close();
            return;
        }

        console.log('\n🎉 Welcome to Interactive Neo4j!');
        console.log('Type "help" for available commands, or enter Cypher queries directly.');
        console.log('─'.repeat(60));

        this.rl.on('line', async (input) => {
            const command = input.trim().toLowerCase();
            
            try {
                if (command === 'quit' || command === 'exit' || command === 'q') {
                    console.log('👋 Goodbye!');
                    await this.close();
                    this.rl.close();
                    process.exit(0);
                } else if (command === 'help') {
                    await this.showHelp();
                } else if (command === 'info') {
                    await this.showDatabaseInfo();
                } else if (command === 'stats') {
                    await this.showDatabaseInfo();
                } else if (command === 'schema') {
                    await this.showSchema();
                } else if (command === 'clear') {
                    console.clear();
                } else if (command === '') {
                    // Do nothing for empty input
                } else {
                    // Treat as Cypher query
                    await this.runQuery(input.trim());
                }
            } catch (error) {
                console.error('❌ Error:', error.message);
            }
            
            console.log('\n🔍 Enter a query or command:');
        });

        console.log('🔍 Enter a query or command:');
    }

    async close() {
        try {
            if (this.session) {
                await this.session.close();
            }
            if (this.driver) {
                await this.driver.close();
            }
        } catch (error) {
            console.error('Error closing connection:', error.message);
        }
    }
}

// Start the interactive session
const interactive = new InteractiveNeo4j();
interactive.start().catch(console.error);
