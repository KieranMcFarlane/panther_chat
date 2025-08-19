from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from typing import Optional
import uvicorn
from db import create_task, get_task
from worker import enrich_dossier

app = FastAPI(title="Signal Noise App", description="AI-powered dossier enrichment system")

class DossierRequest(BaseModel):
    entity_type: str
    entity_name: str
    priority: str = "normal"

class DossierResponse(BaseModel):
    status: str
    task_id: str
    message: str

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
            "GET /health": "Health check"
        }
    }

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=3000)
