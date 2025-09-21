from fastapi import FastAPI, HTTPException, Body
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional, List, Dict, Any
import json
from pathlib import Path
from .claude_client import synthesize_signals
from .neo4j_client import upsert_signals, Neo4jMCPClient
from .brightdata_client import fetch_company_data
from .perplexity_client import fetch_perplexity_summary
import uvicorn
from .db import create_task, get_task
from .worker import enrich_dossier

app = FastAPI(title="Signal Noise App", description="AI-powered dossier enrichment system")

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Allows all origins
    allow_credentials=True,
    allow_methods=["*"],  # Allows all methods
    allow_headers=["*"],  # Allows all headers
)

class DossierRequest(BaseModel):
    entity_type: str
    entity_name: str
    priority: str = "normal"

class DossierResponse(BaseModel):
    status: str
    task_id: str
    message: str

class DirectDossierRequest(BaseModel):
    entity_name: str
    entity_type: str = "company"
    use_mock: bool = False

class DirectDossierResponse(BaseModel):
    entity: str
    summary: str
    cypher_updates: list
    neo4j_results: dict

@app.post("/dossier/request", response_model=DossierResponse)
async def request_dossier(req: DossierRequest):
    """Request dossier enrichment for an entity"""
    try:
        task_id = create_task(req.entity_type, req.entity_name, req.priority)
        # Enqueue the enrichment task
        enrich_dossier.delay(task_id, req.entity_type, req.entity_name, req.priority)
        return DossierResponse(
            status="accepted",
            task_id=task_id,
            message=f"Dossier enrichment started for {req.entity_name}"
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to create task: {str(e)}")

@app.get("/dossier/{task_id}")
async def get_dossier(task_id: str):
    """Get dossier status and results"""
    try:
        task = get_task(task_id)
        if task.get("status") == "not_found":
            raise HTTPException(status_code=404, detail="Task not found")
        return task
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to retrieve task: {str(e)}")

@app.get("/health")
async def health_check():
    """Health check endpoint"""
    return {"status": "healthy", "service": "signal-noise-app"}

@app.get("/")
async def root():
    """Root endpoint with API information"""
    return {
        "service": "Signal Noise App",
        "version": "1.0.0",
        "endpoints": {
            "POST /dossier/request": "Request dossier enrichment",
            "GET /dossier/{task_id}": "Get dossier status and results",
            "POST /dossier/direct": "Direct dossier processing (optional mocks)",
            "GET /health": "Health check"
        }
    }

# New endpoint for direct processing (bypassing Celery)
@app.post("/dossier/direct")
async def dossier_direct(
    entity_name: str = Body(...),
    entity_type: str = Body("company")
):
    """
    Process a dossier request directly without using Celery.
    Automatically uses real APIs when available, falls back to mocks.
    """
    try:
        # Fetch real data (clients will auto-fallback to mocks if APIs unavailable)
        signals = {}
        signals["brightdata"] = fetch_company_data(entity_name, entity_type)
        signals["perplexity"] = fetch_perplexity_summary(entity_name, entity_type)
        
        print(f"Fetched data for {entity_name} - Bright Data: {signals['brightdata']['data'].get('status', 'unknown')}, Perplexity: {signals['perplexity']['data'].get('status', 'unknown')}")

        summary, cypher_updates = synthesize_signals(entity_name, entity_type, signals)
        neo4j_res = upsert_signals(entity_name, entity_type, cypher_updates)

        return {
            "entity": entity_name,
            "summary": summary,
            "cypher_updates": cypher_updates,
            "neo4j_results": neo4j_res,
            "data_sources": {
                "brightdata": signals["brightdata"]["data"].get("status", "unknown"),
                "perplexity": signals["perplexity"]["data"].get("status", "unknown")
            }
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Processing failed: {str(e)}")

@app.get("/sports-entities")
async def get_sports_entities():
    """Get all sports entities with enrichment data"""
    try:
        from .neo4j_client import Neo4jMCPClient # Import locally to avoid circular dependency if needed
        
        client = Neo4jMCPClient()
        
        # Get total count
        total_result = client.execute_cypher_query(
            "MATCH (e:Entity) RETURN count(e) as total"
        )
        
        # Get sports entities with enrichment data
        sports_result = client.execute_cypher_query(
            """MATCH (e:Entity)
            RETURN e.name, e.sport, e.country, e.level, e.website, e.linkedin,
                   e.type, e.tier, e.priorityScore, e.estimatedValue, e.mobileApp,
                   e.digitalWeakness, e.opportunityType, e.description, e.source,
                   COALESCE(e.enriched, false) as enriched,
                   e.enrichment_summary, e.company_info, e.tenders_rfps, e.key_contacts, e.data_sources
            ORDER BY e.name"""
        )
        
        # Get enrichment status
        enriched_query = "MATCH (e:Entity) WHERE e.enriched = true RETURN count(e) as enriched_count"
        enriched_result = client.execute_cypher_query(enriched_query, {})
        
        total_entities = total_result.get('results', [{}])[0].get('total', 0) if total_result.get('results') else 0
        sports_entities = sports_result.get('results', []) if sports_result.get('results') else []
        enriched_count = enriched_result.get('results', [{}])[0].get('enriched_count', 0) if enriched_result.get('results') else 0
        
        # Process entities to include enrichment data
        processed_entities = []
        for entity in sports_entities:
            processed_entity = {
                "name": entity.get('e.name', ''),
                "sport": entity.get('e.sport', ''),
                "country": entity.get('e.country', ''),
                "level": entity.get('e.level', ''),
                "website": entity.get('e.website', ''),
                "linkedin": entity.get('e.linkedin', ''),
                "type": entity.get('e.type', ''),
                "tier": entity.get('e.tier', ''),
                "priorityScore": entity.get('e.priorityScore', 0),
                "estimatedValue": entity.get('e.estimatedValue', ''),
                "mobileApp": entity.get('e.mobileApp', False),
                "digitalWeakness": entity.get('e.digitalWeakness', ''),
                "opportunityType": entity.get('e.opportunityType', ''),
                "description": entity.get('e.description', ''),
                "source": entity.get('e.source', ''),
                "enriched": entity.get('enriched', False),
                "enrichment_summary": entity.get('e.enrichment_summary'),
                "company_info": entity.get('e.company_info'),
                "tenders_rfps": entity.get('e.tenders_rfps'),
                "key_contacts": entity.get('e.key_contacts'),
                "data_sources": entity.get('e.data_sources')
            }
            
            # Parse JSON strings if they exist
            if processed_entity['company_info']:
                try:
                    # Handle escaped Unicode characters
                    company_info_str = processed_entity['company_info'].replace('\\u00f6', 'ö').replace('\\u00e4', 'ä').replace('\\u00fc', 'ü')
                    processed_entity['company_info'] = json.loads(company_info_str)
                except Exception as e:
                    print(f"Error parsing company_info for {processed_entity['name']}: {e}")
                    processed_entity['company_info'] = None
                    
            if processed_entity['tenders_rfps']:
                try:
                    # Handle escaped Unicode characters
                    tenders_str = processed_entity['tenders_rfps'].replace('\\u00f6', 'ö').replace('\\u00e4', 'ä').replace('\\u00fc', 'ü')
                    processed_entity['tenders_rfps'] = json.loads(tenders_str)
                except Exception as e:
                    print(f"Error parsing tenders_rfps for {processed_entity['name']}: {e}")
                    processed_entity['tenders_rfps'] = None
                    
            if processed_entity['key_contacts']:
                try:
                    # Handle escaped Unicode characters
                    contacts_str = processed_entity['key_contacts'].replace('\\u00f6', 'ö').replace('\\u00e4', 'ä').replace('\\u00fc', 'ü')
                    processed_entity['key_contacts'] = json.loads(contacts_str)
                except Exception as e:
                    print(f"Error parsing key_contacts for {processed_entity['name']}: {e}")
                    processed_entity['key_contacts'] = None
                    
            if processed_entity['data_sources']:
                try:
                    # Handle escaped Unicode characters
                    sources_str = processed_entity['data_sources'].replace('\\u00f6', 'ö').replace('\\u00e4', 'ä').replace('\\u00fc', 'ü')
                    processed_entity['data_sources'] = json.loads(sources_str)
                except Exception as e:
                    print(f"Error parsing data_sources for {processed_entity['name']}: {e}")
                    processed_entity['data_sources'] = None
            
            processed_entities.append(processed_entity)
        
        return {
            "status": "success",
            "database_overview": {
                "total_entities": total_entities,
                "sports_entities_count": len(processed_entities),
                "enriched_count": enriched_count,
                "success_rate": f"{(enriched_count/len(processed_entities)*100):.1f}%" if processed_entities else "N/A"
            },
            "sports_entities": processed_entities,
            "schema": {
                "entity_properties": [
                    "name", "type", "sport", "sportCategory", "country", "level", 
                    "website", "linkedin", "notes", "source", "created_at",
                    "enrichment_summary", "enriched_at", "data_sources",
                    "company_info", "tenders_rfps", "key_contacts"
                ],
                "node_labels": ["Entity"],
                "relationships": ["CONNECTED_TO", "PLAYS_IN", "BASED_IN", "HAS_TENDER"]
            }
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get sports entities: {str(e)}")

@app.get("/api/tenders/enhanced")
async def get_enhanced_tenders():
    """Get enhanced tender data from Neo4j including Bright Data MCP collected tenders"""
    try:
        client = Neo4jMCPClient()
        
        # Get all tenders from the knowledge graph
        tenders_result = client.execute_cypher_query(
            """MATCH (t:Tender)
            RETURN t.title, t.type, t.value, t.deadline, t.description, 
                   t.status, t.url, t.source, t.publishedDate, t.organization,
                   t.location, t.category, t.estimatedValue, t.contractType,
                   t.opportunityType, t.suitableForSME, t.cpvCode
            ORDER BY t.publishedDate DESC"""
        )
        
        # Get tender statistics
        stats_result = client.execute_cypher_query(
            """MATCH (t:Tender)
            RETURN count(t) as total_tenders,
                   count(CASE WHEN t.status = 'Open' THEN 1 END) as open_tenders,
                   count(CASE WHEN t.source = 'LinkedIn' THEN 1 END) as linkedin_tenders,
                   count(CASE WHEN t.source = 'iSportConnect' THEN 1 END) as isportconnect_tenders"""
        )
        
        tenders = []
        if tenders_result.get('results'):
            for tender in tenders_result['results']:
                tender_data = {
                    "title": tender.get('t.title', ''),
                    "type": tender.get('t.type', 'RFP'),
                    "value": tender.get('t.value', ''),
                    "deadline": tender.get('t.deadline', ''),
                    "description": tender.get('t.description', ''),
                    "status": tender.get('t.status', 'Open'),
                    "url": tender.get('t.url', ''),
                    "source": tender.get('t.source', 'Unknown'),
                    "publishedDate": tender.get('t.publishedDate', ''),
                    "organization": tender.get('t.organization', ''),
                    "location": tender.get('t.location', ''),
                    "category": tender.get('t.category', ''),
                    "estimatedValue": tender.get('t.estimatedValue', 0),
                    "contractType": tender.get('t.contractType', ''),
                    "opportunityType": tender.get('t.opportunityType', 'other'),
                    "suitableForSME": tender.get('t.suitableForSME', True),
                    "cpvCode": tender.get('t.cpvCode', '')
                }
                tenders.append(tender_data)
        
        stats = {}
        if stats_result.get('results'):
            stats = stats_result['results'][0]
        
        return {
            "status": "success",
            "tenders": tenders,
            "statistics": {
                "total_tenders": stats.get('total_tenders', 0),
                "open_tenders": stats.get('open_tenders', 0),
                "linkedin_tenders": stats.get('linkedin_tenders', 0),
                "isportconnect_tenders": stats.get('isportconnect_tenders', 0)
            },
            "data_source": "Neo4j Knowledge Graph",
            "last_updated": "2025-01-20"
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get enhanced tenders: {str(e)}")

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8000)
