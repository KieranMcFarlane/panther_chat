from celery_app import celery
from db import update_task
import logging
from typing import Dict, Any
import time

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

@celery.task(bind=True, name="worker.enrich_dossier")
def enrich_dossier(self, task_id: str, entity_type: str, entity_name: str, priority: str = "normal"):
    """
    Main dossier enrichment task that orchestrates all MCP calls
    """
    logger.info(f"Starting dossier enrichment for {entity_name} (type: {entity_type}, priority: {priority})")
    
    try:
        # Update task status to processing
        update_task(task_id, {"status": "processing", "progress": "0%"})
        
        signals = {}
        total_steps = 4
        current_step = 0
        
        # Step 1: Bright Data scraping
        current_step += 1
        progress = f"{int((current_step / total_steps) * 100)}%"
        update_task(task_id, {"status": "processing", "progress": progress, "current_step": "Bright Data scraping"})
        
        try:
            from brightdata_client import fetch_company_data
            signals["brightdata"] = fetch_company_data(entity_name, entity_type)
            logger.info(f"Bright Data data fetched for {entity_name}")
        except Exception as e:
            logger.error(f"Bright Data failed: {str(e)}")
            signals["brightdata"] = {"error": str(e), "status": "failed"}
        
        # Step 2: Perplexity enrichment
        current_step += 1
        progress = f"{int((current_step / total_steps) * 100)}%"
        update_task(task_id, {"status": "processing", "progress": progress, "current_step": "Perplexity enrichment"})
        
        try:
            from perplexity_client import fetch_perplexity_summary
            signals["perplexity"] = fetch_perplexity_summary(entity_name, entity_type)
            logger.info(f"Perplexity data fetched for {entity_name}")
        except Exception as e:
            logger.error(f"Perplexity failed: {str(e)}")
            signals["perplexity"] = {"error": str(e), "status": "failed"}
        
        # Step 3: Claude Code reasoning and signal synthesis
        current_step += 1
        progress = f"{int((current_step / total_steps) * 100)}%"
        update_task(task_id, {"status": "processing", "progress": progress, "current_step": "Claude Code reasoning"})
        
        try:
            from claude_client import synthesize_signals
            summary, cypher_updates = synthesize_signals(entity_name, entity_type, signals)
            logger.info(f"Claude Code reasoning completed for {entity_name}")
        except Exception as e:
            logger.error(f"Claude Code failed: {str(e)}")
            summary = f"Error in reasoning: {str(e)}"
            cypher_updates = []
        
        # Step 4: Neo4j graph updates
        current_step += 1
        progress = f"{int((current_step / total_steps) * 100)}%"
        update_task(task_id, {"status": "processing", "progress": progress, "current_step": "Neo4j graph updates"})
        
        try:
            from neo4j_client import upsert_signals
            graph_result = upsert_signals(entity_name, entity_type, cypher_updates)
            logger.info(f"Neo4j updates completed for {entity_name}")
        except Exception as e:
            logger.error(f"Neo4j failed: {str(e)}")
            graph_result = {"error": str(e), "status": "failed"}
        
        # Compile final result
        result = {
            "status": "complete",
            "entity_type": entity_type,
            "entity_name": entity_name,
            "priority": priority,
            "signals": signals,
            "summary": summary,
            "graph_updates": cypher_updates,
            "graph_result": graph_result,
            "completed_at": time.time(),
            "total_processing_time": time.time() - self.request.timestamp
        }
        
        # Update task with final result
        update_task(task_id, result)
        logger.info(f"Dossier enrichment completed successfully for {entity_name}")
        
        return result
        
    except Exception as e:
        error_result = {
            "status": "failed",
            "error": str(e),
            "entity_type": entity_type,
            "entity_name": entity_name,
            "failed_at": time.time()
        }
        update_task(task_id, error_result)
        logger.error(f"Dossier enrichment failed for {entity_name}: {str(e)}")
        raise

@celery.task(name="worker.health_check")
def health_check():
    """Health check task for worker monitoring"""
    return {"status": "healthy", "worker": "signal-noise-app", "timestamp": time.time()}
