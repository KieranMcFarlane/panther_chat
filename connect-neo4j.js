#!/usr/bin/env node

const neo4j = require('neo4j-driver');
require('dotenv').config({ path: './shared-config.env' });

class Neo4jConnection {
    constructor() {
        this.driver = null;
        this.session = null;
    }

    async connect() {
        try {
            console.log('🔌 Connecting to Neo4j...');
            
            // Get configuration from environment or use defaults
            const uri = process.env.NEO4J_URI || 'bolt://212.86.105.190:7687';
            const user = process.env.NEO4J_USER || 'neo4j';
            const password = process.env.NEO4J_PASSWORD || 'pantherpassword';
            const database = process.env.NEO4J_DATABASE || 'neo4j';

            console.log(`📍 URI: ${uri}`);
            console.log(`👤 User: ${user}`);
            console.log(`🗄️  Database: ${database}`);

            // Create driver with encryption disabled for remote connections
            this.driver = neo4j.driver(
                uri,
                neo4j.auth.basic(user, password),
                {
                    encrypted: 'ENCRYPTION_OFF',
                    trust: 'TRUST_ALL_CERTIFICATES'
                }
            );

            // Test connection
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

    async runQuery(query, params = {}) {
        try {
            if (!this.session) {
                throw new Error('No active session. Please connect first.');
            }

            console.log(`🔍 Running query: ${query}`);
            if (Object.keys(params).length > 0) {
                console.log(`📝 Parameters:`, params);
            }

            const result = await this.session.run(query, params);
            console.log(`✅ Query executed successfully. Records returned: ${result.records.length}`);
            
            return result;
        } catch (error) {
            console.error('❌ Query failed:', error.message);
            throw error;
        }
    }

    async getDatabaseInfo() {
        try {
            const result = await this.runQuery('CALL dbms.components() YIELD name, versions, edition');
            console.log('\n📊 Database Components:');
            result.records.forEach(record => {
                console.log(`   ${record.get('name')}: ${record.get('versions')[0]} (${record.get('edition')})`);
            });
            return result;
        } catch (error) {
            console.error('Failed to get database info:', error.message);
        }
    }

    async getNodeCount() {
        try {
            const result = await this.runQuery('MATCH (n) RETURN count(n) as nodeCount');
            const count = result.records[0].get('nodeCount');
            console.log(`\n🔢 Total nodes in database: ${count}`);
            return count;
        } catch (error) {
            console.error('Failed to get node count:', error.message);
        }
    }

    async getRelationshipCount() {
        try {
            const result = await this.runQuery('MATCH ()-[r]->() RETURN count(r) as relCount');
            const count = result.records[0].get('relCount');
            console.log(`🔗 Total relationships in database: ${count}`);
            return count;
        } catch (error) {
            console.error('Failed to get relationship count:', error.message);
        }
    }

    async getNodeLabels() {
        try {
            const result = await this.runQuery('CALL db.labels() YIELD label RETURN label ORDER BY label');
            console.log('\n🏷️  Node labels in database:');
            result.records.forEach(record => {
                console.log(`   - ${record.get('label')}`);
            });
            return result;
        } catch (error) {
            console.error('Failed to get node labels:', error.message);
        }
    }

    async getRelationshipTypes() {
        try {
            const result = await this.runQuery('CALL db.relationshipTypes() YIELD relationshipType RETURN relationshipType ORDER BY relationshipType');
            console.log('\n🔗 Relationship types in database:');
            result.records.forEach(record => {
                console.log(`   - ${record.get('relationshipType')}`);
            });
            return result;
        } catch (error) {
            console.error('Failed to get relationship types:', error.message);
        }
    }

    async close() {
        try {
            if (this.session) {
                await this.session.close();
                console.log('🔒 Session closed');
            }
            if (this.driver) {
                await this.driver.close();
                console.log('🔌 Driver closed');
            }
        } catch (error) {
            console.error('Error closing connection:', error.message);
        }
    }
}

// Main execution function
async function main() {
    const neo4jConn = new Neo4jConnection();
    
    try {
        // Connect to database
        const connected = await neo4jConn.connect();
        if (!connected) {
            console.log('❌ Could not connect to Neo4j. Exiting...');
            return;
        }

        // Get database information
        await neo4jConn.getDatabaseInfo();
        
        // Get basic statistics
        await neo4jConn.getNodeCount();
        await neo4jConn.getRelationshipCount();
        
        // Get schema information
        await neo4jConn.getNodeLabels();
        await neo4jConn.getRelationshipTypes();

        // Example: Run a custom query
        console.log('\n🔍 Example: Getting some sample data...');
        const sampleResult = await neo4jConn.runQuery(
            'MATCH (n) RETURN labels(n) as labels, count(n) as count ORDER BY count DESC LIMIT 5'
        );
        
        console.log('\n📊 Sample data distribution:');
        sampleResult.records.forEach(record => {
            const labels = record.get('labels');
            const count = record.get('count');
            console.log(`   ${labels.join(':')}: ${count} nodes`);
        });

    } catch (error) {
        console.error('❌ Error in main execution:', error.message);
    } finally {
        // Always close the connection
        await neo4jConn.close();
    }
}

// Run if this file is executed directly
if (require.main === module) {
    main().catch(console.error);
}

module.exports = Neo4jConnection;
