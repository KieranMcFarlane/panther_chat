# Port Management Plan

## Current Port Usage:
- **Port 22**: SSH
- **Port 53**: DNS
- **Port 80**: Nginx (main web server)
- **Port 3000**: Ollama/Open Web UI (AI interface)
- **Port 3001**: Next.js RFP Dashboard (our deployment) ✅
- **Port 3005**: Another Next.js instance
- **Port 4567**: Another Next.js instance
- **Port 5432**: PostgreSQL (Docker)
- **Port 5433**: PostgreSQL (local)
- **Port 6379**: Redis
- **Port 7474**: Neo4j
- **Port 7687**: Neo4j
- **Port 8001**: Python service
- **Port 8002**: RFP Workflow API
- **Port 11434**: Ollama API
- **Port 27017**: MongoDB

## Recommended Port Reorganization:

### Main Services (Keep as is):
- **Port 22**: SSH
- **Port 80**: Nginx (main web server)
- **Port 3000**: Ollama/Open Web UI (AI interface)
- **Port 8002**: RFP Workflow API (your main backend)

### Next.js Applications (Reorganize):
- **Port 3001**: ✅ RFP Dashboard (standalone) - WORKING
- **Port 3002**: Admin Dashboard (if needed)
- **Port 3003**: Development/Testing

### Database Services (Keep as is):
- **Port 5432**: PostgreSQL
- **Port 6379**: Redis
- **Port 7474**: Neo4j
- **Port 27017**: MongoDB

### AI Services (Keep as is):
- **Port 11434**: Ollama API
- **Port 3000**: Ollama/Open Web UI

## Current Status:
✅ **Port 3001**: Next.js RFP Dashboard - DEPLOYED AND WORKING
✅ **Port 3000**: Ollama/Open Web UI - CONFIRMED
✅ **Port 8002**: RFP Workflow API - CONFIRMED

## Access URLs:
- **RFP Dashboard**: http://212.86.105.190:3001/rfp-dashboard
- **Main App**: http://212.86.105.190:3001/
- **Ollama/Open Web UI**: http://212.86.105.190:3000/
- **RFP API**: http://212.86.105.190:8002/

## Action Plan:
1. ✅ Stop all conflicting Next.js processes - DONE
2. ✅ Deploy RFP Dashboard to port 3001 - DONE
3. ✅ Ensure no port conflicts - DONE
4. ✅ Verify all services are accessible - DONE 