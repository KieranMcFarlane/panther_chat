# Agentic RAG with Open WebUI Integration

This guide shows you how to integrate the Agentic RAG with Knowledge Graph system into Open WebUI, giving you a beautiful chat interface powered by Ollama and your local knowledge base.

## 🚀 Quick Start with Docker Compose

The easiest way to get everything running is with our pre-configured Docker Compose setup:

### 1. Clone and Setup

```bash
git clone <your-repo>
cd ottomator-agents/agentic-rag-knowledge-graph
```

### 2. Configure Environment

Create a `.env` file:

```bash
# Copy the example and edit it
cp .env.example .env

# Edit the file with your settings
nano .env
```

Key settings for Ollama integration:
```env
# LLM Configuration (Ollama)
LLM_PROVIDER=ollama
LLM_BASE_URL=http://ollama:11434/v1
LLM_API_KEY=ollama
LLM_CHOICE=qwen2.5:14b-instruct

# Embedding Configuration (Ollama)
EMBEDDING_PROVIDER=ollama
EMBEDDING_BASE_URL=http://ollama:11434/v1
EMBEDDING_API_KEY=ollama
EMBEDDING_MODEL=nomic-embed-text

# Open WebUI Security
BEARER_TOKEN=your-secure-bearer-token-here
```

### 3. Start All Services

```bash
# Start everything with Docker Compose
docker-compose -f docker-compose.ollama.yml up -d

# Wait for services to be ready (especially Ollama model downloads)
docker-compose -f docker-compose.ollama.yml logs -f
```

This will start:
- **PostgreSQL** with pgvector (port 5432)
- **Neo4j** for knowledge graph (ports 7474, 7687)
- **Ollama** for local LLM inference (port 11434)
- **Open WebUI** chat interface (port 3000)
- **Agentic RAG API** (port 8058)

### 4. Download Ollama Models

```bash
# Download the required models
docker exec agentic-rag-ollama ollama pull qwen2.5:14b-instruct
docker exec agentic-rag-ollama ollama pull qwen2.5:7b-instruct
docker exec agentic-rag-ollama ollama pull nomic-embed-text

# Verify models are available
docker exec agentic-rag-ollama ollama list
```

### 5. Ingest Your Documents

```bash
# Copy your documents to the documents folder
cp your-documents/*.md documents/

# Or use the provided big tech examples
cp big_tech_docs/* documents/

# Run ingestion
docker exec agentic-rag-api python -m ingestion.ingest --verbose
```

### 6. Set Up Open WebUI Function

1. **Access Open WebUI**: Go to http://localhost:3000
2. **Create Account**: Set up your admin account
3. **Install Function**: 
   - Go to **Admin Panel → Functions**
   - Click **"+"** to add new function
   - Copy the contents of `openwebui_function.py`
   - Paste it into the function editor
   - Save the function

4. **Configure Function**:
   - Click the **settings icon** on your new function
   - Set the valves:
     - `AGENTIC_RAG_BASE_URL`: `http://agentic-rag-api:8058`
     - `BEARER_TOKEN`: `your-secure-bearer-token-here` (same as in .env)
     - `ENABLE_DEBUG`: `true` (for testing)

5. **Test the Integration**:
   - Start a new chat
   - Ask: "What are Google's AI initiatives?"
   - The system will use both vector search and knowledge graph!

## 🔧 Manual Installation (Without Docker)

If you prefer to run components separately:

### Prerequisites

- Python 3.11+
- PostgreSQL with pgvector
- Neo4j database
- Ollama running locally
- Open WebUI installed

### 1. Install Dependencies

```bash
cd ottomator-agents/agentic-rag-knowledge-graph
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
pip install -r requirements.txt
```

### 2. Configure Environment

```bash
# Database URLs (adjust for your setup)
DATABASE_URL=postgresql://user:pass@localhost:5432/agentic_rag
NEO4J_URI=bolt://localhost:7687
NEO4J_USER=neo4j
NEO4J_PASSWORD=password

# Ollama Configuration
LLM_PROVIDER=ollama
LLM_BASE_URL=http://localhost:11434/v1
LLM_API_KEY=ollama
LLM_CHOICE=qwen2.5:14b-instruct

EMBEDDING_PROVIDER=ollama
EMBEDDING_BASE_URL=http://localhost:11434/v1
EMBEDDING_API_KEY=ollama
EMBEDDING_MODEL=nomic-embed-text

# Security
BEARER_TOKEN=your-secure-bearer-token
```

### 3. Set Up Databases

```bash
# Create PostgreSQL database and run schema
psql -d "$DATABASE_URL" -f sql/schema.sql

# Neo4j will auto-configure when the app connects
```

### 4. Run Services

```bash
# Start the Agentic RAG API
python -m agent.api

# In another terminal, ingest documents
python -m ingestion.ingest --verbose
```

### 5. Configure Open WebUI

Follow steps 6 from the Docker setup above, but use:
- `AGENTIC_RAG_BASE_URL`: `http://localhost:8058`

## 🎯 Usage Examples

Once everything is set up, you can ask sophisticated questions that leverage both vector search and knowledge graphs:

### Vector Search Queries
- "What AI research is Google working on?"
- "Tell me about Microsoft's cloud strategy"
- "How is Apple approaching AI development?"

### Knowledge Graph Queries  
- "How are Microsoft and OpenAI connected?"
- "What partnerships does NVIDIA have?"
- "Show me the relationship between Meta and AI startups"

### Hybrid Queries
- "Compare Google and Microsoft's AI strategies"
- "What are the competitive dynamics in the AI chip market?"
- "How has the AI funding landscape changed over time?"

## 🔍 How It Works

The integration works through these components:

1. **Open WebUI Function**: Acts as a bridge between Open WebUI and the Agentic RAG API
2. **Agentic RAG API**: Processes requests using Pydantic AI agent with multiple tools
3. **Tool Selection**: Agent automatically chooses between:
   - Vector search for semantic content
   - Knowledge graph for relationships
   - Hybrid search for comprehensive results
4. **Response Generation**: Combines insights from multiple sources

## 🛠 Troubleshooting

### Common Issues

**Connection Errors**:
```bash
# Check if services are running
docker-compose -f docker-compose.ollama.yml ps

# Check logs
docker-compose -f docker-compose.ollama.yml logs agentic-rag-api
```

**Model Download Issues**:
```bash
# Check Ollama status
docker exec agentic-rag-ollama ollama list

# Manually download models
docker exec agentic-rag-ollama ollama pull qwen2.5:14b-instruct
```

**Authentication Errors**:
- Verify `BEARER_TOKEN` matches in both `.env` and Open WebUI function settings
- Check that the token doesn't have quotes or extra spaces

**No Search Results**:
- Ensure documents are ingested: `docker exec agentic-rag-api python -m ingestion.ingest --verbose`
- Check database connections in the API logs

### Debug Mode

Enable debug mode in the Open WebUI function to see detailed logs:
- Set `ENABLE_DEBUG` to `true` in function settings
- Check browser console and container logs for detailed information

## 🚀 Advanced Configuration

### Custom Models

You can use different Ollama models by updating the environment:

```env
# For larger, more capable models
LLM_CHOICE=qwen2.5:32b-instruct

# For faster, smaller models  
LLM_CHOICE=qwen2.5:7b-instruct

# For different embedding models
EMBEDDING_MODEL=mxbai-embed-large
```

### Performance Tuning

For better performance:

1. **Use GPU acceleration** (if available):
   ```yaml
   # In docker-compose.ollama.yml
   deploy:
     resources:
       reservations:
         devices:
           - driver: nvidia
             count: all
             capabilities: [gpu]
   ```

2. **Adjust chunk sizes** for your content:
   ```bash
   python -m ingestion.ingest --chunk-size 1500 --chunk-overlap 300
   ```

3. **Use faster models** for ingestion:
   ```env
   INGESTION_LLM_CHOICE=qwen2.5:7b-instruct
   ```

## 📊 Monitoring

Monitor your system with:

```bash
# Check API health
curl http://localhost:8058/health

# Monitor resource usage
docker stats

# Check database connections
docker exec agentic-rag-api python -c "
from agent.db_utils import test_connection
from agent.graph_utils import test_graph_connection
import asyncio
asyncio.run(test_connection())
asyncio.run(test_graph_connection())
"
```

## 🎉 What's Next?

With your Agentic RAG system running in Open WebUI, you can:

1. **Add Your Own Documents**: Drop markdown files in the `documents/` folder and re-run ingestion
2. **Customize the Agent**: Modify `agent/prompts.py` to change behavior
3. **Add New Tools**: Extend the agent with additional capabilities
4. **Scale Up**: Use more powerful models or add multiple API instances

Enjoy your powerful, local, privacy-focused AI assistant with advanced RAG capabilities! 🚀 