from pydantic import BaseModel, Field
from typing import Dict, Any, List, Optional, Union
from datetime import datetime
from enum import Enum

class EntityType(str, Enum):
    """Supported entity types for dossier enrichment"""
    COMPANY = "company"
    PERSON = "person"
    RFP = "rfp"
    ORGANIZATION = "organization"
    PRODUCT = "product"

class Priority(str, Enum):
    """Task priority levels"""
    LOW = "low"
    NORMAL = "normal"
    HIGH = "high"
    URGENT = "urgent"

class TaskStatus(str, Enum):
    """Task status values"""
    PENDING = "pending"
    PROCESSING = "processing"
    COMPLETE = "complete"
    FAILED = "failed"
    CANCELLED = "cancelled"

# Request Models
class DossierRequest(BaseModel):
    """Request model for dossier enrichment"""
    entity_type: EntityType = Field(..., description="Type of entity to enrich")
    entity_name: str = Field(..., min_length=1, max_length=500, description="Name of the entity")
    priority: Priority = Field(default=Priority.NORMAL, description="Task priority level")
    metadata: Optional[Dict[str, Any]] = Field(default=None, description="Additional metadata")

class CypherReasoningRequest(BaseModel):
    """Request model for Cypher query reasoning"""
    query: str = Field(..., description="Natural language query to convert to Cypher")
    entity_context: Optional[str] = Field(default=None, description="Entity context for the query")
    limit: int = Field(default=10, ge=1, le=1000, description="Maximum number of results")
    include_explanation: bool = Field(default=True, description="Include reasoning explanation")

# Response Models
class DossierResponse(BaseModel):
    """Response model for dossier request"""
    status: str = Field(..., description="Request status")
    task_id: str = Field(..., description="Unique task identifier")
    message: str = Field(..., description="Human-readable message")
    estimated_completion: Optional[int] = Field(default=None, description="Estimated completion time in seconds")

class TaskProgress(BaseModel):
    """Task progress information"""
    status: TaskStatus = Field(..., description="Current task status")
    progress: str = Field(..., description="Progress percentage")
    current_step: Optional[str] = Field(default=None, description="Current processing step")
    estimated_remaining: Optional[int] = Field(default=None, description="Estimated time remaining in seconds")

class SignalData(BaseModel):
    """Signal data from various sources"""
    source: str = Field(..., description="Data source name")
    timestamp: datetime = Field(default_factory=datetime.utcnow, description="When the signal was captured")
    data: Dict[str, Any] = Field(..., description="Actual signal data")
    confidence: Optional[float] = Field(default=None, ge=0.0, le=1.0, description="Confidence score")
    metadata: Optional[Dict[str, Any]] = Field(default=None, description="Additional metadata")

class GraphUpdate(BaseModel):
    """Neo4j graph update operation"""
    operation: str = Field(..., description="Type of operation (CREATE, MERGE, DELETE, etc.)")
    cypher_query: str = Field(..., description="Cypher query to execute")
    parameters: Optional[Dict[str, Any]] = Field(default=None, description="Query parameters")
    description: Optional[str] = Field(default=None, description="Human-readable description")

class TaskResult(BaseModel):
    """Complete task result"""
    task_id: str = Field(..., description="Task identifier")
    entity_type: EntityType = Field(..., description="Entity type")
    entity_name: str = Field(..., description="Entity name")
    priority: Priority = Field(..., description="Task priority")
    status: TaskStatus = Field(..., description="Final task status")
    progress: str = Field(..., description="Final progress")
    signals: Dict[str, SignalData] = Field(..., description="Collected signals from all sources")
    summary: str = Field(..., description="AI-generated summary")
    graph_updates: List[GraphUpdate] = Field(..., description="Graph update operations")
    graph_result: Optional[Dict[str, Any]] = Field(default=None, description="Neo4j operation results")
    created_at: datetime = Field(..., description="Task creation timestamp")
    updated_at: datetime = Field(..., description="Last update timestamp")
    completed_at: Optional[datetime] = Field(default=None, description="Completion timestamp")
    total_processing_time: Optional[float] = Field(default=None, description="Total processing time in seconds")
    error: Optional[str] = Field(default=None, description="Error message if failed")

class CypherReasoningResponse(BaseModel):
    """Response model for Cypher reasoning"""
    cypher_query: str = Field(..., description="Generated Cypher query")
    explanation: str = Field(..., description="Reasoning explanation")
    confidence: float = Field(..., ge=0.0, le=1.0, description="Confidence in the generated query")
    suggested_parameters: Optional[Dict[str, Any]] = Field(default=None, description="Suggested query parameters")
    alternatives: Optional[List[str]] = Field(default=None, description="Alternative query approaches")

class HealthCheckResponse(BaseModel):
    """Health check response"""
    status: str = Field(..., description="Service health status")
    service: str = Field(..., description="Service name")
    version: str = Field(..., description="Service version")
    timestamp: datetime = Field(default_factory=datetime.utcnow, description="Health check timestamp")
    components: Dict[str, str] = Field(..., description="Component health statuses")

class ErrorResponse(BaseModel):
    """Error response model"""
    error: str = Field(..., description="Error message")
    detail: Optional[str] = Field(default=None, description="Detailed error information")
    timestamp: datetime = Field(default_factory=datetime.utcnow, description="Error timestamp")
    request_id: Optional[str] = Field(default=None, description="Request identifier for tracking")

# Utility Models
class PaginationParams(BaseModel):
    """Pagination parameters"""
    page: int = Field(default=1, ge=1, description="Page number")
    size: int = Field(default=20, ge=1, le=100, description="Page size")
    sort_by: Optional[str] = Field(default="created_at", description="Sort field")
    sort_order: str = Field(default="desc", regex="^(asc|desc)$", description="Sort order")

class TaskListResponse(BaseModel):
    """Paginated task list response"""
    tasks: List[TaskResult] = Field(..., description="List of tasks")
    pagination: Dict[str, Any] = Field(..., description="Pagination information")
    total: int = Field(..., description="Total number of tasks")
    page: int = Field(..., description="Current page")
    size: int = Field(..., description="Page size")
