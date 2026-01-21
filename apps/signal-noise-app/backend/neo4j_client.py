import requests
import json
import logging
from typing import Dict, Any, Optional, List
import os
from datetime import datetime
from neo4j import GraphDatabase
from neo4j.exceptions import ServiceUnavailable, AuthError

logger = logging.getLogger(__name__)

class Neo4jMCPClient:
    """Client for Neo4j/FalkorDB MCP server integration with direct driver fallback"""

    def __init__(self):
        # MCP server configuration
        self.mcp_base_url = os.getenv("NEO4J_MCP_URL", "http://localhost:3004")
        self.mcp_api_key = os.getenv("NEO4J_MCP_API_KEY")
        self.mcp_timeout = int(os.getenv("NEO4J_MCP_TIMEOUT", "30"))

        # Direct Neo4j/FalkorDB connection configuration
        # Priority: FALKORDB_* > NEO4J_* > defaults
        self.neo4j_uri = (
            os.getenv("FALKORDB_URI") or
            os.getenv("NEO4J_URI", "bolt://localhost:7687")
        )
        self.neo4j_user = (
            os.getenv("FALKORDB_USER") or
            os.getenv("NEO4J_USER") or
            os.getenv("NEO4J_USERNAME", "neo4j")
        )
        self.neo4j_password = (
            os.getenv("FALKORDB_PASSWORD") or
            os.getenv("NEO4J_PASSWORD", "")
        )
        self.neo4j_database = (
            os.getenv("FALKORDB_DATABASE") or
            os.getenv("NEO4J_DATABASE", "neo4j")
        )

        # Initialize direct driver as fallback
        self.driver = None
        try:
            self.driver = GraphDatabase.driver(
                self.neo4j_uri,
                auth=(self.neo4j_user, self.neo4j_password)
            )
            # Detect FalkorDB from URI
            db_type = "FalkorDB" if "localhost" in self.neo4j_uri or "falkordb" in self.neo4j_uri.lower() else "Neo4j"
            logger.info(f"{db_type} direct driver initialized successfully")
        except Exception as e:
            logger.warning(f"Failed to initialize Neo4j/FalkorDB direct driver: {str(e)}")
    
    def upsert_signals(self, entity_name: str, entity_type: str, cypher_updates: List[Dict[str, Any]]) -> Dict[str, Any]:
        """
        Upsert signals to Neo4j using MCP server or direct driver
        
        Args:
            entity_name: Name of the entity
            entity_type: Type of entity (company, person, etc.)
            cypher_updates: List of Cypher update operations
            
        Returns:
            Dict containing operation results and metadata
        """
        try:
            # Try MCP server first
            if self.mcp_api_key:
                return self._upsert_via_mcp(entity_name, entity_type, cypher_updates)
            else:
                # Fallback to direct driver
                return self._upsert_via_driver(entity_name, entity_type, cypher_updates)
                
        except Exception as e:
            logger.error(f"Error upserting signals for {entity_name}: {str(e)}")
            return {"status": "failed", "error": str(e)}
    
    def _upsert_via_mcp(self, entity_name: str, entity_type: str, cypher_updates: List[Dict[str, Any]]) -> Dict[str, Any]:
        """Upsert signals via Neo4j MCP server"""
        try:
            # Prepare the MCP request
            mcp_request = {
                "jsonrpc": "2.0",
                "id": f"neo4j_{datetime.now().timestamp()}",
                "method": "neo4j.upsert_signals",
                "params": {
                    "entity_name": entity_name,
                    "entity_type": entity_type,
                    "cypher_updates": cypher_updates,
                    "options": {
                        "batch_size": 100,
                        "transaction_timeout": 30,
                        "return_results": True
                    }
                }
            }
            
            # Make the MCP call
            headers = {
                "Content-Type": "application/json",
                "Authorization": f"Bearer {self.mcp_api_key}"
            }
            
            response = requests.post(
                f"{self.mcp_base_url}/mcp",
                json=mcp_request,
                headers=headers,
                timeout=self.mcp_timeout
            )
            
            if response.status_code == 200:
                result = response.json()
                if result.get("result"):
                    return self._process_mcp_response(result["result"], entity_name)
                else:
                    logger.error(f"Neo4j MCP call failed: {result}")
                    return {"status": "failed", "error": "MCP call failed"}
            else:
                logger.error(f"Neo4j MCP HTTP error: {response.status_code}")
                return {"status": "failed", "error": f"HTTP {response.status_code}"}
                
        except requests.exceptions.RequestException as e:
            logger.error(f"Neo4j MCP request failed: {str(e)}")
            return {"status": "failed", "error": str(e)}
    
    def _upsert_via_driver(self, entity_name: str, entity_type: str, cypher_updates: List[Dict[str, Any]]) -> Dict[str, Any]:
        """Upsert signals via direct Neo4j driver"""
        if not self.driver:
            return {"status": "failed", "error": "Neo4j driver not available"}
        
        try:
            results = []
            with self.driver.session(database=self.neo4j_database) as session:
                # Execute each Cypher update
                for update in cypher_updates:
                    try:
                        cypher_query = update.get("cypher_query", "")
                        parameters = update.get("parameters", {})
                        
                        if not cypher_query:
                            logger.warning(f"Skipping update with empty Cypher query: {update}")
                            continue
                        
                        # Execute the query
                        result = session.run(cypher_query, parameters)
                        
                        # Collect results
                        records = []
                        for record in result:
                            # Convert Neo4j objects to serializable format
                            serializable_record = {}
                            for key, value in record.items():
                                if hasattr(value, '__dict__'):
                                    # Handle Neo4j Node objects
                                    if hasattr(value, 'labels') and hasattr(value, 'properties'):
                                        serializable_record[key] = {
                                            'labels': list(value.labels),
                                            'properties': dict(value.properties)
                                        }
                                    # Handle Neo4j Relationship objects
                                    elif hasattr(value, 'type') and hasattr(value, 'properties'):
                                        serializable_record[key] = {
                                            'type': value.type,
                                            'properties': dict(value.properties)
                                        }
                                    else:
                                        serializable_record[key] = str(value)
                                else:
                                    serializable_record[key] = value
                            records.append(serializable_record)
                        
                        results.append({
                            "operation": update.get("operation", "unknown"),
                            "cypher_query": cypher_query,
                            "parameters": parameters,
                            "description": update.get("description", ""),
                            "result": records,
                            "status": "success"
                        })
                        
                        logger.info(f"Successfully executed: {update.get('description', 'Cypher operation')}")
                        
                    except Exception as e:
                        logger.error(f"Failed to execute Cypher update: {str(e)}")
                        results.append({
                            "operation": update.get("operation", "unknown"),
                            "cypher_query": update.get("cypher_query", ""),
                            "parameters": update.get("parameters", {}),
                            "description": update.get("description", ""),
                            "error": str(e),
                            "status": "failed"
                        })
            
            return {
                "status": "complete",
                "entity_name": entity_name,
                "entity_type": entity_type,
                "operations_executed": len(results),
                "successful_operations": len([r for r in results if r["status"] == "success"]),
                "failed_operations": len([r for r in results if r["status"] == "failed"]),
                "results": results,
                "timestamp": datetime.now().isoformat()
            }
            
        except Exception as e:
            logger.error(f"Error in Neo4j driver upsert: {str(e)}")
            return {"status": "failed", "error": str(e)}
    
    def _process_mcp_response(self, result: Dict[str, Any], entity_name: str) -> Dict[str, Any]:
        """Process and structure the MCP response"""
        try:
            return {
                "status": result.get("status", "unknown"),
                "entity_name": entity_name,
                "operations_executed": result.get("operations_executed", 0),
                "successful_operations": result.get("successful_operations", 0),
                "failed_operations": result.get("failed_operations", 0),
                "results": result.get("results", []),
                "metadata": {
                    "processing_time": result.get("processing_time"),
                    "transaction_id": result.get("transaction_id"),
                    "mcp_server": self.mcp_base_url
                },
                "timestamp": datetime.now().isoformat()
            }
            
        except Exception as e:
            logger.error(f"Error processing Neo4j MCP response: {str(e)}")
            return {"status": "failed", "error": f"Response processing error: {str(e)}"}
    
    def execute_cypher_query(self, cypher_query: str, parameters: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
        """
        Execute a single Cypher query via direct driver
        
        Args:
            cypher_query: Cypher query to execute
            parameters: Query parameters
            
        Returns:
            Dict containing query results
        """
        if not self.driver:
            return {"status": "failed", "error": "Neo4j driver not available"}
        
        try:
            with self.driver.session(database=self.neo4j_database) as session:
                result = session.run(cypher_query, parameters or {})
                
                records = []
                for record in result:
                    # Convert Neo4j objects to serializable format
                    serializable_record = {}
                    for key, value in record.items():
                        if hasattr(value, '__dict__'):
                            # Handle Neo4j Node objects
                            if hasattr(value, 'labels') and hasattr(value, 'properties'):
                                serializable_record[key] = {
                                    'labels': list(value.labels),
                                    'properties': dict(value.properties)
                                }
                            # Handle Neo4j Relationship objects
                            elif hasattr(value, 'type') and hasattr(value, 'properties'):
                                serializable_record[key] = {
                                    'type': value.type,
                                    'properties': dict(value.properties)
                                }
                            else:
                                serializable_record[key] = str(value)
                        else:
                            serializable_record[key] = value
                    records.append(serializable_record)
                
                return {
                    "status": "success",
                    "cypher_query": cypher_query,
                    "parameters": parameters or {},
                    "result_count": len(records),
                    "results": records,
                    "timestamp": datetime.now().isoformat()
                }
                
        except Exception as e:
            logger.error(f"Error executing Cypher query: {str(e)}")
            return {"status": "failed", "error": str(e)}
    
    def health_check(self) -> Dict[str, Any]:
        """Check Neo4j connection health"""
        try:
            if self.driver:
                # Test connection
                with self.driver.session(database=self.neo4j_database) as session:
                    result = session.run("RETURN 1 as test")
                    record = result.single()
                    
                    if record and record["test"] == 1:
                        return {
                            "status": "healthy",
                            "connection": "direct_driver",
                            "database": self.neo4j_database,
                            "timestamp": datetime.now().isoformat()
                        }
            
            return {
                "status": "unhealthy",
                "connection": "none",
                "error": "No valid connection available",
                "timestamp": datetime.now().isoformat()
            }
            
        except Exception as e:
            return {
                "status": "unhealthy",
                "connection": "error",
                "error": str(e),
                "timestamp": datetime.now().isoformat()
            }
    
    def close(self):
        """Close the Neo4j driver connection"""
        if self.driver:
            self.driver.close()
            logger.info("Neo4j driver connection closed")

# Convenience function for direct usage
def upsert_signals(entity_name: str, entity_type: str, cypher_updates: List[Dict[str, Any]]) -> Dict[str, Any]:
    """Convenience function to upsert signals"""
    client = Neo4jMCPClient()
    try:
        return client.upsert_signals(entity_name, entity_type, cypher_updates)
    finally:
        client.close()

if __name__ == "__main__":
    # Test the client
    client = Neo4jMCPClient()
    
    # Test health check
    health = client.health_check()
    print("Health Check:", json.dumps(health, indent=2))
    
    # Test signal upsert
    test_updates = [
        {
            "operation": "MERGE",
            "cypher_query": "MERGE (e:Company {name: $entity_name}) SET e.last_updated = datetime() RETURN e",
            "parameters": {"entity_name": "Test Company"},
            "description": "Test company creation"
        }
    ]
    
    result = client.upsert_signals("Test Company", "company", test_updates)
    print("Upsert Result:", json.dumps(result, indent=2))
    
    client.close()
