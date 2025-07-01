"""
FastAPI Service with Ollama Integration for Global Sports Intelligence System
Query the unified Neo4j knowledge graph using any Ollama model (e.g., o3-mini)
"""

import asyncio
import logging
import json
import os
from typing import Dict, List, Any, Optional
from datetime import datetime
import httpx
from fastapi import FastAPI, HTTPException, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field
import uvicorn
from neo4j import GraphDatabase

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# FastAPI app
app = FastAPI(
    title="Global Sports Intelligence API with Ollama",
    description="Query the global sports knowledge graph using Ollama models",
    version="1.0.0"
)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Configuration
NEO4J_URI = os.getenv("NEO4J_URI", "bolt://localhost:7687")
NEO4J_USER = os.getenv("NEO4J_USER", "neo4j")
NEO4J_PASSWORD = os.getenv("NEO4J_PASSWORD", "pantherpassword")
OLLAMA_HOST = os.getenv("OLLAMA_HOST", "http://localhost:11434")
DEFAULT_OLLAMA_MODEL = os.getenv("OLLAMA_MODEL", "o3-mini")

# Global variables
neo4j_driver = None
ollama_client = None

# Pydantic models
class OllamaQueryRequest(BaseModel):
    query: str = Field(..., description="Natural language query about sports intelligence")
    model: str = Field(default=DEFAULT_OLLAMA_MODEL, description="Ollama model to use")
    include_context: bool = Field(default=True, description="Include knowledge graph context")
    max_tokens: int = Field(default=1000, description="Maximum tokens for response")
    temperature: float = Field(default=0.1, description="Temperature for response generation")

class SportsIntelligenceQuery(BaseModel):
    organization: Optional[str] = Field(None, description="Filter by sports organization")
    query_type: str = Field(..., description="Type of intelligence query")
    parameters: Dict[str, Any] = Field(default_factory=dict, description="Additional parameters")

class SignalCreateRequest(BaseModel):
    organization: str
    signal_type: str
    headline: str
    summary: str
    score: float = Field(ge=0, le=10)
    repository: Optional[str] = None

# Startup and shutdown events
@app.on_event("startup")
async def startup_event():
    global neo4j_driver, ollama_client
    
    # Initialize Neo4j driver
    neo4j_driver = GraphDatabase.driver(
        NEO4J_URI,
        auth=(NEO4J_USER, NEO4J_PASSWORD)
    )
    
    # Initialize Ollama client
    ollama_client = httpx.AsyncClient(base_url=OLLAMA_HOST, timeout=60.0)
    
    # Check Ollama connection
    try:
        response = await ollama_client.get("/api/tags")
        if response.status_code == 200:
            models = response.json().get("models", [])
            logger.info(f"Connected to Ollama. Available models: {[m['name'] for m in models]}")
        else:
            logger.warning("Ollama connection check failed")
    except Exception as e:
        logger.error(f"Failed to connect to Ollama: {e}")
    
    logger.info("Global Sports Intelligence API started successfully")

@app.on_event("shutdown")
async def shutdown_event():
    global neo4j_driver, ollama_client
    
    if neo4j_driver:
        neo4j_driver.close()
    
    if ollama_client:
        await ollama_client.aclose()
    
    logger.info("Global Sports Intelligence API shutdown complete")

# Health check endpoint
@app.get("/health")
async def health_check():
    health_status = {
        "status": "healthy",
        "service": "Global Sports Intelligence API with Ollama",
        "timestamp": datetime.now().isoformat(),
        "components": {}
    }
    
    # Check Neo4j
    try:
        with neo4j_driver.session() as session:
            result = session.run("RETURN 1 as test")
            record = result.single()
            if record:
                health_status["components"]["neo4j"] = "healthy"
            else:
                health_status["components"]["neo4j"] = "unhealthy"
    except Exception as e:
        health_status["components"]["neo4j"] = f"error: {str(e)}"
    
    # Check Ollama
    try:
        response = await ollama_client.get("/api/tags")
        if response.status_code == 200:
            health_status["components"]["ollama"] = "healthy"
            health_status["components"]["ollama_models"] = [
                model["name"] for model in response.json().get("models", [])
            ]
        else:
            health_status["components"]["ollama"] = "unhealthy"
    except Exception as e:
        health_status["components"]["ollama"] = f"error: {str(e)}"
    
    return JSONResponse(health_status)

# Helper functions
async def get_knowledge_graph_context(query: str, limit: int = 10) -> Dict[str, Any]:
    """Get relevant context from the knowledge graph based on the query"""
    context = {
        "organizations": [],
        "signals": [],
        "premier_league_data": {},
        "agencies": []
    }
    
    try:
        with neo4j_driver.session() as session:
            # Search for relevant organizations
            org_query = """
            MATCH (org:SportingOrganization)
            WHERE org.name CONTAINS $search_term 
               OR org.description CONTAINS $search_term
            RETURN org
            LIMIT $limit
            """
            search_terms = query.lower().split()
            for term in search_terms[:3]:  # Search with first 3 terms
                result = session.run(org_query, search_term=term, limit=limit)
                context["organizations"].extend([dict(record["org"]) for record in result])
            
            # Get Premier League specific data if mentioned
            if "premier league" in query.lower():
                pl_query = """
                MATCH (pl:SportingOrganization {name: 'Premier League'})
                OPTIONAL MATCH (pl)-[:contains_club]->(club:PremierLeagueClub)
                OPTIONAL MATCH (pl)-[:has_agency_relationship]->(agency:Agency)
                OPTIONAL MATCH (pl)-[:emits]->(signal:Signal)
                WHERE signal.date > date() - duration('P30D')
                RETURN pl, collect(DISTINCT club) as clubs, 
                       collect(DISTINCT agency) as agencies,
                       collect(signal) as recent_signals
                """
                result = session.run(pl_query)
                record = result.single()
                if record:
                    context["premier_league_data"] = {
                        "organization": dict(record["pl"]) if record["pl"] else {},
                        "clubs": [dict(club) for club in record["clubs"] if club],
                        "agencies": [dict(agency) for agency in record["agencies"] if agency],
                        "recent_signals": [dict(signal) for signal in record["recent_signals"] if signal]
                    }
            
            # Get recent high-score signals
            signals_query = """
            MATCH (signal:Signal)
            WHERE signal.score > 7.0
              AND signal.date > date() - duration('P7D')
            OPTIONAL MATCH (org:SportingOrganization)-[:emits]->(signal)
            RETURN signal, org
            ORDER BY signal.score DESC
            LIMIT $limit
            """
            result = session.run(signals_query, limit=limit)
            context["signals"] = [
                {
                    "signal": dict(record["signal"]),
                    "organization": dict(record["org"]) if record["org"] else None
                }
                for record in result
            ]
    
    except Exception as e:
        logger.error(f"Error getting knowledge graph context: {e}")
    
    return context

async def query_ollama(model: str, prompt: str, max_tokens: int = 1000, temperature: float = 0.1) -> Dict[str, Any]:
    """Query Ollama with the given model and prompt"""
    try:
        payload = {
            "model": model,
            "prompt": prompt,
            "options": {
                "num_predict": max_tokens,
                "temperature": temperature
            },
            "stream": False
        }
        
        response = await ollama_client.post("/api/generate", json=payload)
        response.raise_for_status()
        
        result = response.json()
        return {
            "response": result.get("response", ""),
            "model": model,
            "total_duration": result.get("total_duration", 0),
            "eval_count": result.get("eval_count", 0)
        }
    
    except Exception as e:
        logger.error(f"Error querying Ollama: {e}")
        raise HTTPException(status_code=500, detail=f"Ollama query failed: {str(e)}")

def create_enhanced_prompt(query: str, context: Dict[str, Any]) -> str:
    """Create an enhanced prompt with knowledge graph context"""
    
    prompt = f"""You are an expert sports business intelligence analyst with access to a comprehensive global sports knowledge graph. Answer the following query using the provided context and your expertise.

QUERY: {query}

KNOWLEDGE GRAPH CONTEXT:
"""
    
    # Add organizations context
    if context["organizations"]:
        prompt += "\nRELEVANT SPORTS ORGANIZATIONS:\n"
        for org in context["organizations"][:5]:
            prompt += f"- {org.get('name', 'Unknown')}: {org.get('description', 'No description')}\n"
    
    # Add Premier League context
    if context["premier_league_data"]:
        pl_data = context["premier_league_data"]
        prompt += "\nPREMIER LEAGUE INTELLIGENCE:\n"
        if pl_data["clubs"]:
            prompt += f"- Clubs tracked: {len(pl_data['clubs'])}\n"
            prompt += f"- Top clubs: {', '.join([club.get('name', '') for club in pl_data['clubs'][:5]])}\n"
        if pl_data["agencies"]:
            prompt += f"- Partner agencies: {', '.join([agency.get('name', '') for agency in pl_data['agencies']])}\n"
        if pl_data["recent_signals"]:
            prompt += f"- Recent signals: {len(pl_data['recent_signals'])}\n"
    
    # Add signals context
    if context["signals"]:
        prompt += "\nRECENT HIGH-PRIORITY SIGNALS:\n"
        for signal_data in context["signals"][:3]:
            signal = signal_data["signal"]
            org = signal_data["organization"]
            org_name = org.get("name", "Unknown") if org else "Unknown"
            prompt += f"- {org_name}: {signal.get('headline', '')} (Score: {signal.get('score', 0)})\n"
    
    prompt += """
INSTRUCTIONS:
1. Provide a comprehensive answer based on the knowledge graph context
2. Include specific data points and insights from the context
3. If asking about partnerships, reference the agency relationships
4. If asking about Premier League, use the enhanced Premier League data
5. For technical queries, consider both business and technical intelligence
6. Be specific and actionable in your recommendations
7. If the context doesn't contain enough information, state what additional data would be helpful

ANSWER:"""
    
    return prompt

# API Endpoints

@app.post("/query-ollama")
async def query_ollama_endpoint(request: OllamaQueryRequest):
    """Query the sports intelligence system using Ollama"""
    
    try:
        # Get knowledge graph context if requested
        context = {}
        if request.include_context:
            context = await get_knowledge_graph_context(request.query)
        
        # Create enhanced prompt with context
        if request.include_context and context:
            enhanced_prompt = create_enhanced_prompt(request.query, context)
        else:
            enhanced_prompt = request.query
        
        # Query Ollama
        ollama_response = await query_ollama(
            model=request.model,
            prompt=enhanced_prompt,
            max_tokens=request.max_tokens,
            temperature=request.temperature
        )
        
        return JSONResponse({
            "query": request.query,
            "model": request.model,
            "response": ollama_response["response"],
            "context_included": request.include_context,
            "knowledge_graph_context": context if request.include_context else None,
            "metadata": {
                "total_duration_ms": ollama_response.get("total_duration", 0) // 1000000,
                "eval_count": ollama_response.get("eval_count", 0),
                "timestamp": datetime.now().isoformat()
            }
        })
    
    except Exception as e:
        logger.error(f"Error in query_ollama_endpoint: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/sports-intelligence")
async def query_sports_intelligence(request: SportsIntelligenceQuery):
    """Direct query to the sports intelligence knowledge graph"""
    
    try:
        with neo4j_driver.session() as session:
            
            if request.query_type == "organization_overview":
                query = """
                MATCH (org:SportingOrganization {name: $org_name})
                OPTIONAL MATCH (org)-[:has_agency_relationship]->(a:Agency)
                OPTIONAL MATCH (org)-[:contains_club]->(c:PremierLeagueClub)
                OPTIONAL MATCH (org)-[:emits]->(s:Signal)
                WHERE s.date > date() - duration('P30D')
                RETURN org, collect(DISTINCT a) as agencies,
                       collect(DISTINCT c) as clubs,
                       collect(s) as signals
                """
                result = session.run(query, org_name=request.organization)
                records = [dict(record) for record in result]
                return JSONResponse({"query_type": request.query_type, "results": records})
            
            elif request.query_type == "top_opportunities":
                query = """
                MATCH (org:SportingOrganization)
                OPTIONAL MATCH (org)-[:emits]->(s:Signal)
                WHERE s.intelType IN ['Partnership Opportunity', 'Digital Transformation', 'Tech Investment']
                  AND s.score > 7.0
                  AND s.date > date() - duration('P30D')
                WITH org, collect(s) as opportunity_signals, avg(s.score) as avg_score
                WHERE size(opportunity_signals) > 0
                RETURN org, opportunity_signals, avg_score
                ORDER BY avg_score DESC, size(opportunity_signals) DESC
                LIMIT 10
                """
                result = session.run(query)
                records = [dict(record) for record in result]
                return JSONResponse({"query_type": request.query_type, "results": records})
            
            elif request.query_type == "premier_league_intelligence":
                query = """
                MATCH (pl:SportingOrganization {name: 'Premier League'})
                OPTIONAL MATCH (pl)-[:contains_club]->(c:PremierLeagueClub)
                OPTIONAL MATCH (c)-[:emits]->(s:Signal)
                WHERE s.date > date() - duration('P30D')
                OPTIONAL MATCH (pl)-[:has_agency_relationship]->(a:Agency)
                RETURN pl, collect(DISTINCT c) as clubs,
                       collect(s) as recent_signals,
                       collect(DISTINCT a) as agencies
                """
                result = session.run(query)
                record = result.single()
                return JSONResponse({"query_type": request.query_type, "results": dict(record) if record else {}})
            
            else:
                raise HTTPException(status_code=400, detail=f"Unknown query type: {request.query_type}")
    
    except Exception as e:
        logger.error(f"Error in sports intelligence query: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/create-signal")
async def create_signal(request: SignalCreateRequest):
    """Create a new business intelligence signal"""
    
    try:
        with neo4j_driver.session() as session:
            # Create the signal
            signal_query = """
            CREATE (s:Signal {
                id: randomUUID(),
                headline: $headline,
                summary: $summary,
                score: $score,
                intelType: $signal_type,
                organization: $organization,
                repository: $repository,
                source: 'FastAPI',
                date: date(),
                created_at: datetime()
            })
            RETURN s
            """
            result = session.run(signal_query, {
                "headline": request.headline,
                "summary": request.summary,
                "score": request.score,
                "signal_type": request.signal_type,
                "organization": request.organization,
                "repository": request.repository
            })
            
            signal = result.single()
            
            # Link to organization
            link_query = """
            MATCH (s:Signal {headline: $headline})
            MATCH (org:SportingOrganization {name: $organization})
            MERGE (org)-[:emits]->(s)
            """
            session.run(link_query, {
                "headline": request.headline,
                "organization": request.organization
            })
            
            return JSONResponse({
                "status": "success",
                "message": "Signal created successfully",
                "signal_id": signal["s"]["id"] if signal else None
            })
    
    except Exception as e:
        logger.error(f"Error creating signal: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/ollama/models")
async def get_ollama_models():
    """Get available Ollama models"""
    
    try:
        response = await ollama_client.get("/api/tags")
        response.raise_for_status()
        
        models_data = response.json()
        models = [
            {
                "name": model["name"],
                "size": model.get("size", 0),
                "modified_at": model.get("modified_at", "")
            }
            for model in models_data.get("models", [])
        ]
        
        return JSONResponse({
            "available_models": models,
            "default_model": DEFAULT_OLLAMA_MODEL,
            "ollama_host": OLLAMA_HOST
        })
    
    except Exception as e:
        logger.error(f"Error getting Ollama models: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/knowledge-graph/stats")
async def get_knowledge_graph_stats():
    """Get statistics about the knowledge graph"""
    
    try:
        with neo4j_driver.session() as session:
            stats_query = """
            MATCH (n)
            RETURN labels(n) as label, count(n) as count
            ORDER BY count DESC
            """
            result = session.run(stats_query)
            node_counts = [{"label": record["label"], "count": record["count"]} for record in result]
            
            # Get relationship counts
            rel_query = """
            MATCH ()-[r]->()
            RETURN type(r) as relationship_type, count(r) as count
            ORDER BY count DESC
            """
            result = session.run(rel_query)
            relationship_counts = [{"type": record["relationship_type"], "count": record["count"]} for record in result]
            
            # Get signal counts by type
            signal_query = """
            MATCH (s:Signal)
            RETURN s.intelType as signal_type, count(s) as count
            ORDER BY count DESC
            """
            result = session.run(signal_query)
            signal_counts = [{"type": record["signal_type"], "count": record["count"]} for record in result]
            
            return JSONResponse({
                "node_counts": node_counts,
                "relationship_counts": relationship_counts,
                "signal_counts": signal_counts,
                "total_nodes": sum([item["count"] for item in node_counts]),
                "total_relationships": sum([item["count"] for item in relationship_counts])
            })
    
    except Exception as e:
        logger.error(f"Error getting knowledge graph stats: {e}")
        raise HTTPException(status_code=500, detail=str(e))

# Main entry point
if __name__ == "__main__":
    uvicorn.run(
        "ollama_fastapi_service:app",
        host=os.getenv("FASTAPI_HOST", "0.0.0.0"),
        port=int(os.getenv("FASTAPI_PORT", 8000)),
        reload=False
    ) 