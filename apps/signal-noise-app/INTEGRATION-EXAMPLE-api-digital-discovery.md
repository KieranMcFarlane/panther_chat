# Example: Updating `backend/api_digital_discovery.py`

This shows the exact code changes needed to integrate the multi-agent system.

---

## Current File Structure (Lines 1-50)

```python
"""
Digital Discovery API Routes

FastAPI endpoints for automated digital transformation discovery.
Integrates with DigitalDiscoveryAgent for scalable entity analysis.

API Endpoints:
- POST /api/digital-discovery/single - Discover single entity
- POST /api/digital-discovery/batch - Discover multiple entities
- GET /api/digital-discovery/status - Get discovery service status
"""

import asyncio
import logging
from typing import List, Dict, Any, Optional
from datetime import datetime

from fastapi import APIRouter, HTTPException, BackgroundTasks
from pydantic import BaseModel, Field

from backend.digital_discovery_agent import (
    DigitalDiscoveryAgent,
    BatchDigitalDiscovery,
    DiscoveryResult,
    DiscoverySignal,
    Stakeholder,
    TechnologyStack
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/digital-discovery")

# Global agent instance
discovery_agent: Optional[DigitalDiscoveryAgent] = None
batch_discovery: Optional[BatchDigitalDiscovery] = None
```

---

## UPDATED File (Changes in **bold**)

### Option 1: Drop-in Replacement (Recommended)

```python
"""
Digital Discovery API Routes

FastAPI endpoints for automated digital transformation discovery.
Integrates with Multi-Agent System for scalable entity analysis.

API Endpoints:
- POST /api/digital-discovery/single - Discover single entity
- POST /api/digital-discovery/batch - Discover multiple entities
- GET /api/digital-discovery/status - Get discovery service status
"""

import asyncio
import logging
from typing import List, Dict, Any, Optional
from datetime import datetime

from fastapi import APIRouter, HTTPException, BackgroundTasks
from pydantic import BaseModel, Field

# *** CHANGE: Import multi-agent adapter ***
from backend.agents.legacy_adapter import DigitalDiscoveryAgentAdapter as DigitalDiscoveryAgent

# *** CHANGE: Import remaining classes from original location ***
from backend.digital_discovery_agent import (
    BatchDigitalDiscovery,  # Keep if still using
    DiscoveryResult,
    DiscoverySignal,
    Stakeholder,
    TechnologyStack
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/digital-discovery")

# Global agent instance
discovery_agent: Optional[DigitalDiscoveryAgent] = None
batch_discovery: Optional[BatchDigitalDiscovery] = None
```

**Only 2 lines changed!**
1. Import changed: `from backend.agents.legacy_adapter import DigitalDiscoveryAgentAdapter as DigitalDiscoveryAgent`
2. Comment out old import or remove it

---

### Option 2: Simple Function Call (Even Simpler)

```python
"""
Digital Discovery API Routes

FastAPI endpoints for automated digital transformation discovery.
Integrates with Multi-Agent System for scalable entity analysis.
"""

import asyncio
import logging
from typing import List, Dict, Any, Optional
from datetime import datetime

from fastapi import APIRouter, HTTPException, BackgroundTasks
from pydantic import BaseModel, Field

# *** CHANGE: Import convenience function ***
from backend.agents import discover_with_entities

# *** CHANGE: Import schemas ***
from backend.digital_discovery_agent import (
    DiscoveryResult,
    DiscoverySignal,
    Stakeholder,
    TechnologyStack
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/digital-discovery")
```

**Then update the endpoint function:**

```python
@router.post("/single")
async def discover_single_entity(request: SingleDiscoveryRequest):
    """
    Discover single entity using multi-agent system

    Args:
        request: Single discovery request with entity details

    Returns:
        Discovery result with entity profile, signals, and confidence
    """
    try:
        logger.info(f"🚀 Starting discovery for: {request.entity_name}")

        # *** CHANGE: Use multi-agent convenience function ***
        result = await discover_with_entities(
            entity_name=request.entity_name,
            entity_id=request.entity_id,
            max_iterations=request.max_iterations
        )

        # Add metadata (optional)
        result['discovered_at'] = datetime.now().isoformat()
        result['template_id'] = request.template_id

        logger.info(f"✅ Discovery complete: confidence={result['confidence']:.3f}")

        return {
            "status": "success",
            "data": result
        }

    except Exception as e:
        logger.error(f"❌ Discovery failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))
```

---

## Complete Updated File Example

Here's the full updated file with Option 2:

```python
"""
Digital Discovery API Routes

FastAPI endpoints for automated digital transformation discovery.
Integrates with Multi-Agent System for scalable entity analysis.

API Endpoints:
- POST /api/digital-discovery/single - Discover single entity
- POST /api/digital-discovery/batch - Discover multiple entities
- GET /api/digital-discovery/status - Get discovery service status
"""

import asyncio
import logging
from typing import List, Dict, Any, Optional
from datetime import datetime

from fastapi import APIRouter, HTTPException, BackgroundTasks
from pydantic import BaseModel, Field

# Multi-agent system
from backend.agents import discover_with_entities

# Schemas (keep using existing)
from backend.digital_discovery_agent import (
    DiscoveryResult,
    DiscoverySignal,
    Stakeholder,
    TechnologyStack
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/digital-discovery")

# =============================================================================
# Request Models
# =============================================================================

class SingleDiscoveryRequest(BaseModel):
    """Request model for single entity discovery"""
    entity_name: str = Field(..., description="Entity display name")
    entity_id: str = Field(..., description="Unique entity ID")
    template_id: Optional[str] = Field(None, description="Discovery template")
    max_iterations: int = Field(5, ge=1, le=10, description="Max iterations")
    depth: str = Field("standard", description="Discovery depth")


class BatchDiscoveryRequest(BaseModel):
    """Request model for batch discovery"""
    entities: List[Dict[str, str]] = Field(
        ...,
        description="List of entities with 'entity_name' and 'entity_id'"
    )
    max_iterations: int = Field(3, ge=1, le=5, description="Max iterations per entity")
    parallel: bool = Field(True, description="Process entities in parallel")


# =============================================================================
# API Endpoints
# =============================================================================

@router.post("/single")
async def discover_single_entity(request: SingleDiscoveryRequest):
    """Discover single entity using multi-agent system"""
    try:
        logger.info(f"🚀 Starting discovery for: {request.entity_name}")

        # Use multi-agent system
        result = await discover_with_entities(
            entity_name=request.entity_name,
            entity_id=request.entity_id,
            max_iterations=request.max_iterations
        )

        # Add metadata
        result['discovered_at'] = datetime.now().isoformat()
        result['template_id'] = request.template_id

        logger.info(f"✅ Discovery complete: confidence={result['confidence']:.3f}")

        return {
            "status": "success",
            "data": result
        }

    except Exception as e:
        logger.error(f"❌ Discovery failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/batch")
async def discover_batch_entities(request: BatchDiscoveryRequest):
    """Discover multiple entities in batch"""
    try:
        logger.info(f"🚀 Starting batch discovery for {len(request.entities)} entities")

        if request.parallel:
            # Parallel processing (fast)
            tasks = [
                discover_with_entities(
                    entity_name=e['entity_name'],
                    entity_id=e['entity_id'],
                    max_iterations=request.max_iterations
                )
                for e in request.entities
            ]
            results = await asyncio.gather(*tasks, return_exceptions=True)
        else:
            # Sequential processing (safer)
            results = []
            for e in request.entities:
                result = await discover_with_entities(
                    entity_name=e['entity_name'],
                    entity_id=e['entity_id'],
                    max_iterations=request.max_iterations
                )
                results.append(result)

        # Filter successful results
        successful = [
            r for r in results
            if not isinstance(r, Exception)
        ]

        logger.info(f"✅ Batch discovery complete: {len(successful)}/{len(request.entities)} successful")

        return {
            "status": "success",
            "total_entities": len(request.entities),
            "successful": len(successful),
            "failed": len(request.entities) - len(successful),
            "results": successful
        }

    except Exception as e:
        logger.error(f"❌ Batch discovery failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/status")
async def get_discovery_status():
    """Get discovery service status"""
    return {
        "status": "operational",
        "system": "multi-agent",
        "version": "1.0.0",
        "features": {
            "single_discovery": True,
            "batch_discovery": True,
            "parallel_processing": True,
            "max_iterations": 10,
            "target_confidence": 0.80
        },
        "last_updated": datetime.now().isoformat()
    }
```

---

## Summary of Changes

### What Changed

1. **Import** (Line 22):
   - OLD: `from backend.digital_discovery_agent import DigitalDiscoveryAgent`
   - NEW: `from backend.agents import discover_with_entities`

2. **Usage** (in endpoint):
   - OLD: `agent = DigitalDiscoveryAgent()`
   - NEW: `result = await discover_with_entities(...)`

### What Stayed the Same

- ✅ Request models (SingleDiscoveryRequest, BatchDiscoveryRequest)
- ✅ Schemas (DiscoveryResult, DiscoverySignal, etc.)
- ✅ API endpoint structure
- ✅ Error handling
- ✅ Logging

### Benefits

- ✅ **No breaking changes** to API interface
- ✅ **Better performance** through multi-agent coordination
- ✅ **Same response format** - frontend doesn't need changes
- ✅ **More features** - automatic confidence calculation, signal scoring

---

## Testing the Updated Endpoint

```bash
# Test the endpoint
curl -X POST "http://localhost:3005/api/digital-discovery/single" \
  -H "Content-Type: application/json" \
  -d '{
    "entity_name": "Arsenal FC",
    "entity_id": "arsenal-fc",
    "max_iterations": 3
  }'
```

**Expected Response:**
```json
{
  "status": "success",
  "data": {
    "entity_id": "arsenal-fc",
    "entity_name": "Arsenal FC",
    "primary_domain": "arsenal.com",
    "confidence": 0.520,
    "confidence_band": "INFORMED",
    "discovery_method": "multi-agent",
    ...
  }
}
```

---

**That's it!** Just 2 line changes and your API is using the multi-agent system! 🎉
