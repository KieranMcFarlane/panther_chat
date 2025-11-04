# 🚀 Dynamic Model Selection Setup Guide

Use your Yellow Panther RAG system with different underlying LLM models while keeping all knowledge base tools and capabilities!

## 🎯 What This Enables

Instead of being locked to GPT-4o-mini, you can now:
- Ask strategic questions using **o3-mini** for advanced reasoning
- Use **Llama 3** for local/private analysis  
- Try **Mistral** for creative insights
- Compare **GPT-4o** vs **GPT-4o-mini** performance
- All while maintaining access to:
  - Premier League intelligence
  - LinkedIn network analysis
  - Neo4j knowledge graph
  - Sports industry RAG search

## 🔧 Setup Instructions

### 1. Start Your Services

```bash
# Terminal 1: Start Next.js backend
cd yellow-panther-ai
npm run dev  # Runs on port 3000

# Terminal 2: Start Ollama (for local models)
ollama serve  # Runs on port 11434

# Terminal 3: Start dynamic proxy
python openwebui-rag-proxy-dynamic.py  # Runs on port 8001
```

### 2. Pull Ollama Models (Optional)

```bash
# Get some popular models for testing
ollama pull llama3
ollama pull llama3.1
ollama pull mistral
ollama pull codellama
ollama pull qwen2.5
```

### 3. Configure Open WebUI

1. Open your Open WebUI instance
2. Go to **Settings** → **Models**
3. Add Custom Model Provider:
   - **API Base URL**: `http://localhost:8001/v1`
   - **API Key**: `anything` (not validated)
   - **Model Name**: Leave blank (auto-detected)

### 4. Select Your Model Combination

You'll see models like:
- `🐆 Yellow Panther RAG + ⚡ o3-mini`
- `⚽ Premier League Intelligence + 🦙 Llama 3`
- `🔗 LinkedIn Network Analyzer + 🧠 GPT-4o`
- `🕸️ Sports Knowledge Graph + 🌪️ Mistral`

## 🤖 Available Model Combinations

### RAG Agents (4 specialists)
1. **🐆 Yellow Panther RAG** - Full capabilities
2. **⚽ Premier League Intelligence** - Club analysis specialist  
3. **🔗 LinkedIn Network Analyzer** - Contact discovery specialist
4. **🕸️ Sports Knowledge Graph** - Relationship mapping specialist

### Underlying LLM Models (8+ options)
- **⚡ o3-mini** - Advanced reasoning
- **🧠 GPT-4o** - Premium capabilities
- **🤖 GPT-4o Mini** - Fast and cost-effective
- **🦙 Llama 3/3.1** - Local and private
- **🌪️ Mistral** - Creative and multilingual
- **💻 Code Llama** - Code-focused
- **🔮 Qwen 2.5** - Emerging capabilities

**Total**: 4 agents × 8 models = **32 combinations!**

## 💡 Usage Examples

### Strategic Analysis with o3-mini
```
Model: 🐆 Yellow Panther RAG + ⚡ o3-mini
Query: "Develop a 3-year partnership strategy for targeting Premier League clubs. Consider digital maturity, budget cycles, and competitive landscape."
```

### Quick Research with Llama 3
```
Model: ⚽ Premier League Intelligence + 🦙 Llama 3  
Query: "Who are the key IT decision makers at Arsenal and Chelsea for mobile app projects?"
```

### Creative Insights with Mistral
```
Model: 🔗 LinkedIn Network Analyzer + 🌪️ Mistral
Query: "Design a creative networking approach to connect with sports technology leaders in London."
```

## 🧪 Testing Your Setup

```bash
# Test all model combinations
python test-dynamic-models.py

# Quick health check
curl http://localhost:8001/health

# List available models
curl http://localhost:8001/v1/models | jq .
```

## 🎨 Model Selection Strategy

### When to Use Each Model:

**🧠 GPT-4o**
- Complex strategic analysis
- Multi-step reasoning tasks
- High-stakes recommendations

**⚡ o3-mini** 
- Advanced reasoning challenges
- Strategic planning
- Competitive analysis

**🤖 GPT-4o Mini**
- Quick queries
- Cost-sensitive operations
- High-volume processing

**🦙 Llama 3/3.1**
- Local/private analysis
- When avoiding cloud APIs
- Experimental capabilities

**🌪️ Mistral**
- Creative approaches
- European data preferences
- Multilingual analysis

**💻 Code Llama**
- Technical implementation
- API integration questions
- Development guidance

## 📊 Performance Comparison

| Model | Speed | Cost | Reasoning | Privacy | Creativity |
|-------|-------|------|-----------|---------|------------|
| o3-mini | ⭐⭐⭐ | ⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ | ⭐⭐⭐ | ⭐⭐⭐⭐ |
| GPT-4o | ⭐⭐⭐ | ⭐⭐ | ⭐⭐⭐⭐⭐ | ⭐⭐⭐ | ⭐⭐⭐⭐⭐ |
| GPT-4o Mini | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐ | ⭐⭐⭐ | ⭐⭐⭐ |
| Llama 3 | ⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ | ⭐⭐⭐ | ⭐⭐⭐⭐⭐ | ⭐⭐⭐ |
| Mistral | ⭐⭐⭐⭐ | ⭐⭐⭐⭐ | ⭐⭐⭐ | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ |

## 🔧 Advanced Configuration

### Environment Variables
```bash
# Backend URLs
export RAG_BACKEND_URL="http://localhost:3000"
export OLLAMA_BASE_URL="http://localhost:11434"
export OPENWEBUI_PROXY_PORT="8001"

# OpenAI API (for non-Ollama models)
export OPENAI_API_KEY="your-api-key"
```

### Custom Model Additions
Edit `openwebui-rag-proxy-dynamic.py`:

```python
UNDERLYING_MODELS = {
    # Add your custom models here
    "custom-model": {"type": "custom", "display": "Custom Model", "icon": "🎯"},
    # ... existing models
}
```

## 🚨 Troubleshooting

### Common Issues:

**❌ "Model not found" error**
- Check if model is in `UNDERLYING_MODELS` dict
- Verify Ollama model is pulled: `ollama list`

**❌ Connection errors**
- Ensure all services are running (Next.js, Ollama, Proxy)
- Check health endpoint: `curl http://localhost:8001/health`

**❌ Slow responses**
- Large models (GPT-4o) are slower than mini versions
- Local Ollama models depend on your hardware
- Consider using GPT-4o-mini for faster responses

**❌ RAG tools not working**
- Backend must be running on port 3000
- Check Neo4j and database connections
- Verify MCP tools are properly configured

### Performance Tips:

1. **Use appropriate models for task complexity**
2. **Cache frequently used queries** 
3. **Start with mini models for testing**
4. **Monitor response times and adjust**

## 🎉 What's Next?

With dynamic model selection, you can:
1. **A/B test different models** for your use cases
2. **Optimize cost vs performance** per query type
3. **Use local models for sensitive data**
4. **Leverage specialized models** for specific tasks
5. **Compare reasoning capabilities** across providers

Your Yellow Panther RAG system is now **model-agnostic** while keeping all its sports industry intelligence! 🏆

---

**Need help?** Check the test results from `test-dynamic-models.py` to see which models work best for your queries. 