#!/usr/bin/env python3

import os
import sys
from dotenv import load_dotenv
from neo4j import GraphDatabase
from neo4j.exceptions import ServiceUnavailable, AuthError

# Load environment variables
load_dotenv('./shared-config.env')

class Neo4jConnection:
    def __init__(self):
        self.driver = None
        self.session = None
        
    def connect(self):
        """Connect to Neo4j database"""
        try:
            print('🔌 Connecting to Neo4j...')
            
            # Get configuration from environment or use defaults
            uri = os.getenv('NEO4J_URI', 'bolt://212.86.105.190:7687')
            user = os.getenv('NEO4J_USER', 'neo4j')
            password = os.getenv('NEO4J_PASSWORD', 'pantherpassword')
            database = os.getenv('NEO4J_DATABASE', 'neo4j')
            
            print(f'📍 URI: {uri}')
            print(f'👤 User: {user}')
            print(f'🗄️  Database: {database}')
            
            # Create driver
            self.driver = GraphDatabase.driver(uri, auth=(user, password))
            
            # Test connection
            self.session = self.driver.session(database=database)
            result = self.session.run('RETURN 1 as test')
            record = result.single()
            
            if record and record['test'] == 1:
                print('✅ Successfully connected to Neo4j!')
                return True
                
        except ServiceUnavailable as e:
            print(f'❌ Service unavailable: {e}')
            return False
        except AuthError as e:
            print(f'❌ Authentication failed: {e}')
            return False
        except Exception as e:
            print(f'❌ Failed to connect to Neo4j: {e}')
            return False
    
    def run_query(self, query, parameters=None):
        """Run a Cypher query"""
        try:
            if not self.session:
                raise Exception('No active session. Please connect first.')
            
            print(f'🔍 Running query: {query}')
            if parameters:
                print(f'📝 Parameters: {parameters}')
            
            result = self.session.run(query, parameters or {})
            records = list(result)
            print(f'✅ Query executed successfully. Records returned: {len(records)}')
            
            return records
            
        except Exception as e:
            print(f'❌ Query failed: {e}')
            raise e
    
    def get_database_info(self):
        """Get database component information"""
        try:
            result = self.run_query('CALL dbms.components() YIELD name, versions, edition')
            print('\n📊 Database Components:')
            for record in result:
                name = record['name']
                version = record['versions'][0] if record['versions'] else 'Unknown'
                edition = record['edition']
                print(f'   {name}: {version} ({edition})')
            return result
        except Exception as e:
            print(f'Failed to get database info: {e}')
    
    def get_node_count(self):
        """Get total node count"""
        try:
            result = self.run_query('MATCH (n) RETURN count(n) as nodeCount')
            count = result[0]['nodeCount']
            print(f'\n🔢 Total nodes in database: {count}')
            return count
        except Exception as e:
            print(f'Failed to get node count: {e}')
    
    def get_relationship_count(self):
        """Get total relationship count"""
        try:
            result = self.run_query('MATCH ()-[r]->() RETURN count(r) as relCount')
            count = result[0]['relCount']
            print(f'🔗 Total relationships in database: {count}')
            return count
        except Exception as e:
            print(f'Failed to get relationship count: {e}')
    
    def get_node_labels(self):
        """Get all node labels"""
        try:
            result = self.run_query('CALL db.labels() YIELD label RETURN label ORDER BY label')
            print('\n🏷️  Node labels in database:')
            for record in result:
                print(f'   - {record["label"]}')
            return result
        except Exception as e:
            print(f'Failed to get node labels: {e}')
    
    def get_relationship_types(self):
        """Get all relationship types"""
        try:
            result = self.run_query('CALL db.relationshipTypes() YIELD relationshipType RETURN relationshipType ORDER BY relationshipType')
            print('\n🔗 Relationship types in database:')
            for record in result:
                print(f'   - {record["relationshipType"]}')
            return result
        except Exception as e:
            print(f'Failed to get relationship types: {e}')
    
    def close(self):
        """Close the connection"""
        try:
            if self.session:
                self.session.close()
                print('🔒 Session closed')
            if self.driver:
                self.driver.close()
                print('🔌 Driver closed')
        except Exception as e:
            print(f'Error closing connection: {e}')

def main():
    """Main execution function"""
    neo4j_conn = Neo4jConnection()
    
    try:
        # Connect to database
        connected = neo4j_conn.connect()
        if not connected:
            print('❌ Could not connect to Neo4j. Exiting...')
            return
        
        # Get database information
        neo4j_conn.get_database_info()
        
        # Get basic statistics
        neo4j_conn.get_node_count()
        neo4j_conn.get_relationship_count()
        
        # Get schema information
        neo4j_conn.get_node_labels()
        neo4j_conn.get_relationship_types()
        
        # Example: Run a custom query
        print('\n🔍 Example: Getting some sample data...')
        sample_result = neo4j_conn.run_query(
            'MATCH (n) RETURN labels(n) as labels, count(n) as count ORDER BY count DESC LIMIT 5'
        )
        
        print('\n📊 Sample data distribution:')
        for record in sample_result:
            labels = record['labels']
            count = record['count']
            label_str = ':'.join(labels) if labels else 'unlabeled'
            print(f'   {label_str}: {count} nodes')
            
    except Exception as e:
        print(f'❌ Error in main execution: {e}')
    finally:
        # Always close the connection
        neo4j_conn.close()

if __name__ == '__main__':
    main()
