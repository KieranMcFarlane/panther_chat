# 🚀 Signal Noise App

AI-powered dossier enrichment system that orchestrates multiple MCP (Model Context Protocol) servers to collect, analyze, and synthesize business intelligence signals.

## 🎯 Overview

The Signal Noise App is a FastAPI-based system that:

- **Collects signals** from Bright Data (web scraping) and Perplexity (AI analysis)
- **Synthesizes insights** using Claude Code reasoning
- **Updates knowledge graphs** via Neo4j MCP integration
- **Processes tasks asynchronously** using Celery workers
- **Provides RESTful API** for dossier requests and retrieval

## 🏗️ Architecture

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   FastAPI App   │    │   Celery Worker │    │   Redis Broker  │
│   (Port 3000)   │◄──►│   (Background)  │◄──►│   (Port 6379)   │
└─────────────────┘    └─────────────────┘    └─────────────────┘
         │                       │
         ▼                       ▼
┌─────────────────┐    ┌─────────────────┐
│   SQLite DB     │    │   Neo4j Graph   │
│   (Tasks)       │    │   (Knowledge)   │
└─────────────────┘    └─────────────────┘
         │                       │
         ▼                       ▼
┌─────────────────┐    ┌─────────────────┐
│   MCP Servers   │    │   Claude Code   │
│   (Bright Data, │    │   (Reasoning)   │
│    Perplexity)  │    └─────────────────┘
└─────────────────┘
```

## 🚀 Quick Start

### Prerequisites

- Python 3.8+
- Docker and Docker Compose
- Neo4j instance (or use included Docker setup)

### 1. Clone and Setup

```bash
git clone <repository-url>
cd signal-noise-app

# Create virtual environment
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt
```

### 2. Start Infrastructure

```bash
# Start Redis (required for Celery)
docker-compose up -d redis

# Optional: Start Neo4j (if not using external instance)
docker-compose up -d neo4j
```

### 3. Configure Environment

Create a `.env` file in the root directory:

```bash
# Neo4j Configuration
NEO4J_URI=bolt://localhost:7687
NEO4J_USER=neo4j
NEO4J_PASSWORD=pantherpassword
NEO4J_DATABASE=neo4j

# MCP Server URLs (optional - will use mock data if not set)
BRIGHTDATA_MCP_URL=http://localhost:3001
PERPLEXITY_MCP_URL=http://localhost:3002
CLAUDE_CODE_URL=http://localhost:3003
NEO4J_MCP_URL=http://localhost:3004

# API Keys (optional - will use mock data if not set)
BRIGHTDATA_API_KEY=your_brightdata_key
PERPLEXITY_API_KEY=your_perplexity_key
CLAUDE_CODE_API_KEY=your_claude_key
NEO4J_MCP_API_KEY=your_neo4j_mcp_key

# Celery Configuration
CELERY_BROKER_URL=redis://localhost:6379/0
CELERY_RESULT_BACKEND=redis://localhost:6379/0
```

### 4. Start the Application

```bash
# Terminal 1: Start FastAPI server
uvicorn backend.main:app --reload --host 0.0.0.0 --port 3000

# Terminal 2: Start Celery worker
celery -A backend.worker worker --loglevel=info

# Terminal 3: Start Celery monitor (optional)
celery -A backend.worker flower --port=5555
```

### 5. Test the API

```bash
# Health check
curl http://localhost:3000/health

# Request dossier enrichment
curl -X POST http://localhost:3000/dossier/request \
  -H "Content-Type: application/json" \
  -d '{
    "entity_type": "company",
    "entity_name": "Tesla Inc",
    "priority": "high"
  }'

# Check dossier status (replace with actual task_id)
curl http://localhost:3000/dossier/{task_id}
```

## 📚 API Documentation

### Endpoints

#### POST `/dossier/request`
Request dossier enrichment for an entity.

**Request Body:**
```json
{
  "entity_type": "company",
  "entity_name": "Tesla Inc",
  "priority": "high",
  "metadata": {
    "source": "manual",
    "notes": "Strategic analysis needed"
  }
}
```

**Response:**
```json
{
  "status": "accepted",
  "task_id": "uuid-1234-5678-90ab",
  "message": "Dossier enrichment started for Tesla Inc"
}
```

#### GET `/dossier/{task_id}`
Get dossier status and results.

**Response:**
```json
{
  "task_id": "uuid-1234-5678-90ab",
  "entity_type": "company",
  "entity_name": "Tesla Inc",
  "status": "complete",
  "progress": "100%",
  "signals": {
    "brightdata": { /* web scraping data */ },
    "perplexity": { /* AI analysis data */ }
  },
  "summary": "Tesla Inc demonstrates strong market position...",
  "graph_updates": [ /* Cypher operations */ ],
  "created_at": "2024-01-15T10:30:00Z",
  "completed_at": "2024-01-15T10:35:00Z"
}
```

#### GET `/health`
Health check endpoint.

**Response:**
```json
{
  "status": "healthy",
  "service": "signal-noise-app"
}
```

## 🔧 Configuration

### Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `NEO4J_URI` | Neo4j connection URI | `bolt://localhost:7687` |
| `NEO4J_USER` | Neo4j username | `neo4j` |
| `NEO4J_PASSWORD` | Neo4j password | `pantherpassword` |
| `CELERY_BROKER_URL` | Redis broker URL | `redis://localhost:6379/0` |
| `CELERY_RESULT_BACKEND` | Redis result backend | `redis://localhost:6379/0` |

### MCP Server Configuration

The system can work with or without MCP servers:

- **With MCP servers**: Full integration with external services
- **Without MCP servers**: Mock data for development and testing

## 🧪 Testing

### Run Tests

```bash
# Install test dependencies
pip install pytest pytest-asyncio httpx

# Run tests
pytest tests/
```

### Test Individual Components

```bash
# Test Bright Data client
python -m backend.brightdata_client

# Test Perplexity client
python -m backend.perplexity_client

# Test Claude Code client
python -m backend.claude_client

# Test Neo4j client
python -m backend.neo4j_client
```

## 📊 Monitoring

### Celery Monitoring

Access Flower (Celery monitoring) at: http://localhost:5555

### Health Checks

- **API Health**: `GET /health`
- **Neo4j Health**: Check logs for connection status
- **Redis Health**: `docker exec signal-noise-redis redis-cli ping`

### Logs

All components use structured logging. Check logs for:
- Task execution status
- MCP server communication
- Database operations
- Error details

## 🚀 Deployment

### Production Considerations

1. **Database**: Use PostgreSQL instead of SQLite
2. **Redis**: Use managed Redis service or cluster
3. **Neo4j**: Use managed Neo4j service
4. **Security**: Implement proper authentication and authorization
5. **Monitoring**: Add Prometheus metrics and Grafana dashboards
6. **Scaling**: Use multiple Celery workers and load balancers

### Docker Deployment

```bash
# Build and run with Docker Compose
docker-compose -f docker-compose.prod.yml up -d

# Scale workers
docker-compose -f docker-compose.prod.yml up -d --scale worker=3
```

### Environment-Specific Configs

- `docker-compose.yml` - Development
- `docker-compose.prod.yml` - Production
- `docker-compose.test.yml` - Testing

## 🔍 Troubleshooting

### Common Issues

1. **Redis Connection Failed**
   - Check if Redis container is running
   - Verify Redis port (6379) is accessible

2. **Neo4j Connection Failed**
   - Check Neo4j credentials
   - Verify Neo4j is running and accessible
   - Check firewall settings

3. **Celery Worker Not Processing Tasks**
   - Check worker logs for errors
   - Verify Redis connection
   - Check task routing configuration

4. **MCP Calls Failing**
   - Check MCP server URLs and API keys
   - Verify MCP servers are running
   - Check network connectivity

### Debug Mode

Enable debug logging by setting environment variable:
```bash
export LOG_LEVEL=DEBUG
```

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests
5. Submit a pull request

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🆘 Support

For support and questions:
- Create an issue in the repository
- Check the documentation
- Review the troubleshooting section

---

**Built with ❤️ using FastAPI, Celery, Neo4j, and Claude Code**
