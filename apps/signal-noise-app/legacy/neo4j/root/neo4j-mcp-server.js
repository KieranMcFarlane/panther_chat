#!/usr/bin/env node

const { Server } = require('@modelcontextprotocol/sdk/server/index.js');
const { StdioServerTransport } = require('@modelcontextprotocol/sdk/server/stdio.js');
const { 
  CallToolRequestSchema,
  ListToolsRequestSchema,
} = require('@modelcontextprotocol/sdk/types.js');
const neo4j = require('neo4j-driver');

class Neo4jMCPServer {
  constructor() {
    this.server = new Server(
      {
        name: 'neo4j-mcp-server',
        version: '0.1.0',
      },
      {
        capabilities: {
          tools: {},
        },
      }
    );

    this.driver = null;
    this.setupToolHandlers();
  }

  async connectToNeo4j() {
    if (!this.driver) {
      const uri = process.env.NEO4J_URI || 'neo4j+s://cce1f84b.databases.neo4j.io';
      const username = process.env.NEO4J_USERNAME || 'neo4j';
      const password = process.env.NEO4J_PASSWORD || 'llNASCzMWGT-nTt-JkD9Qk_4W6PpJrv39X0PuYAIKV0';
      
      console.error(`🔗 Connecting to Neo4j: ${uri}`);
      this.driver = neo4j.driver(uri, neo4j.auth.basic(username, password));
      
      // Test the connection
      const testSession = this.driver.session();
      try {
        await testSession.run('RETURN 1 as test');
        console.error('✅ Neo4j connection successful');
      } catch (error) {
        console.error('❌ Neo4j connection failed:', error.message);
        throw error;
      } finally {
        await testSession.close();
      }
    }
    return this.driver;
  }

  setupToolHandlers() {
    this.server.setRequestHandler(ListToolsRequestSchema, async () => {
      console.error('📋 Listing Neo4j MCP tools...');
      return {
        tools: [
          {
            name: 'execute_query',
            description: 'Execute a Cypher query on the Neo4j database',
            inputSchema: {
              type: 'object',
              properties: {
                query: {
                  type: 'string',
                  description: 'The Cypher query to execute',
                },
                params: {
                  type: 'object',
                  description: 'Parameters for the Cypher query',
                  additionalProperties: true,
                },
              },
              required: ['query'],
            },
          },
          {
            name: 'search_sports_entities',
            description: 'Search for sports entities by name, sport, country, or level',
            inputSchema: {
              type: 'object',
              properties: {
                entityName: {
                  type: 'string',
                  description: 'Name of the entity to search for',
                },
                sport: {
                  type: 'string',
                  description: 'Sport to filter by',
                },
                country: {
                  type: 'string',
                  description: 'Country to filter by',
                },
                level: {
                  type: 'string',
                  description: 'Level to filter by',
                },
              },
            },
          },
          {
            name: 'get_entity_details',
            description: 'Get detailed information about a specific sports entity',
            inputSchema: {
              type: 'object',
              properties: {
                entityName: {
                  type: 'string',
                  description: 'Name of the entity to get details for',
                },
              },
              required: ['entityName'],
            },
          },
        ],
      };
    });

    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args } = request.params;
      console.error(`🔧 Tool called: ${name} with args:`, args);

      try {
        const driver = await this.connectToNeo4j();
        const session = driver.session({
          database: process.env.NEO4J_DATABASE || 'neo4j'
        });

        let result;

        switch (name) {
          case 'execute_query':
            const query = args.query;
            const params = args.params || {};
            
            console.error(`🔍 Executing Cypher query: ${query}`);
            console.error(`📝 Parameters:`, params);
            
            const queryResult = await session.run(query, params);
            
            result = {
              success: true,
              query: query,
              params: params,
              results: queryResult.records.map((record, index) => {
                const obj = {};
                record.keys.forEach(key => {
                  const value = record.get(key);
                  // Handle Neo4j objects properly
                  if (value && typeof value === 'object') {
                    if (value.properties) {
                      obj[key] = value.properties;
                    } else if (value.low !== undefined && value.high !== undefined) {
                      // Handle Neo4j Integer objects
                      obj[key] = value.low;
                    } else {
                      obj[key] = value;
                    }
                  } else {
                    obj[key] = value;
                  }
                });
                return {
                  id: index + 1,
                  data: obj
                };
              }),
              count: queryResult.records.length,
              summary: {
                queryType: queryResult.summary.queryType,
                resultAvailableAfter: queryResult.summary.resultAvailableAfter,
                resultConsumedAfter: queryResult.summary.resultConsumedAfter
              }
            };
            console.error(`✅ Query executed successfully, ${queryResult.records.length} records returned`);
            break;

          case 'search_sports_entities':
            let searchQuery = 'MATCH (e:SportsEntity) WHERE 1=1';
            const searchParams = {};

            if (args.entityName) {
              searchQuery += ' AND toLower(e.name) CONTAINS toLower($entityName)';
              searchParams.entityName = args.entityName;
            }
            if (args.sport) {
              searchQuery += ' AND toLower(e.sport) CONTAINS toLower($sport)';
              searchParams.sport = args.sport;
            }
            if (args.country) {
              searchQuery += ' AND toLower(e.country) CONTAINS toLower($country)';
              searchParams.country = args.country;
            }
            if (args.level) {
              searchQuery += ' AND toLower(e.level) CONTAINS toLower($level)';
              searchParams.level = args.level;
            }

            searchQuery += ' RETURN e.name, e.sport, e.country, e.level, e.entityType LIMIT 50';
            
            console.error(`🔍 Searching sports entities with query: ${searchQuery}`);
            const searchResult = await session.run(searchQuery, searchParams);
            
            result = {
              success: true,
              searchCriteria: args,
              results: searchResult.records.map((record, index) => ({
                id: index + 1,
                name: record.get('e.name'),
                sport: record.get('e.sport'),
                country: record.get('e.country'),
                level: record.get('e.level'),
                entityType: record.get('e.entityType')
              })),
              count: searchResult.records.length
            };
            console.error(`✅ Search completed, ${searchResult.records.length} entities found`);
            break;

          case 'get_entity_details':
            const detailsQuery = `
              MATCH (e:SportsEntity {name: $entityName})
              OPTIONAL MATCH (e)-[:HAS_KEY_PERSON]->(p:Person)
              OPTIONAL MATCH (e)-[:HAS_PARTNERSHIP]->(partner:Organization)
              RETURN e, collect(DISTINCT p.name) as keyPersons, collect(DISTINCT partner.name) as partnerships
            `;
            
            console.error(`🔍 Getting entity details for: ${args.entityName}`);
            const detailsResult = await session.run(detailsQuery, { entityName: args.entityName });
            
            if (detailsResult.records.length === 0) {
              result = {
                success: false,
                error: `Entity "${args.entityName}" not found`
              };
            } else {
              const record = detailsResult.records[0];
              const entity = record.get('e');
              result = {
                success: true,
                entityName: args.entityName,
                entity: entity.properties,
                keyPersons: record.get('keyPersons'),
                partnerships: record.get('partnerships'),
                count: detailsResult.records.length
              };
            }
            console.error(`✅ Entity details retrieved for ${args.entityName}`);
            break;

          default:
            throw new Error(`Unknown tool: ${name}`);
        }

        await session.close();

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(result, null, 2),
            },
          ],
        };

      } catch (error) {
        console.error(`❌ Error executing ${name}:`, error.message);
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({
                success: false,
                error: error.message,
                tool: name,
                arguments: args
              }, null, 2),
            },
          ],
        };
      }
    });
  }

  async run() {
    console.error('🚀 Starting Neo4j MCP server...');
    try {
      const transport = new StdioServerTransport();
      console.error('📡 Transport created');
      await this.server.connect(transport);
      console.error('✅ Server connected to transport');
      console.error('🚀 Neo4j MCP server running on stdio');
    } catch (error) {
      console.error('❌ Server startup error:', error);
      throw error;
    }
  }
}

const server = new Neo4jMCPServer();
server.run().catch(console.error);