# Entity Dossier System - Quick Start Guide

## 🚀 Quick Start (5 Minutes)

### 1. Verify Installation

```bash
cd /Users/kieranmcfarlane/Downloads/panther_chat/apps/signal-noise-app/backend

# Run synchronous tests (no API required)
python test_dossier_sync.py
```

**Expected Output**: All tests should pass ✅

### 2. Check Environment

```bash
cd backend

# Check if .env file exists
ls -la .env

# Verify required variables
grep -E "ANTHROPIC_API_KEY|SUPABASE_URL|FALKORDB_URI" .env
```

**Required Variables**:
- `ANTHROPIC_API_KEY` - Claude API access
- `SUPABASE_URL` - Database cache
- `SUPABASE_ACCESS_TOKEN` - Database access
- `FALKORDB_URI` - Graph database (optional for testing)

### 3. Test Claude API Connection

```bash
cd backend

# Run integration test
python test_real_dossier_generation.py
```

**Possible Outcomes**:
- ✅ **PASS**: All tests passed → System ready
- ❌ **401 Unauthorized**: API key not configured → See "Configuration" below
- ❌ **Connection Error**: Network issue → Check internet connection

---

## ⚙️ Configuration (10 Minutes)

### Option A: Direct Anthropic API

1. Get API key from: https://console.anthropic.com/

2. Add to `.env`:
```bash
ANTHROPIC_API_KEY=sk-ant-xxxxx
ANTHROPIC_BASE_URL=https://api.anthropic.com
```

### Option B: Z.AI Proxy (Recommended for Production)

1. Get Z.AI token from your Z.AI account

2. Add to `.env`:
```bash
ANTHROPIC_BASE_URL=https://api.z.ai/api/anthropic
ANTHROPIC_AUTH_TOKEN=your-zai-token
```

### Verify Configuration

```bash
cd backend

# Simple API test
python -c "
import asyncio
from claude_client import ClaudeClient

async def test():
    client = ClaudeClient()
    response = await client.query(
        prompt='Say \"API works!\"',
        model='haiku',
        max_tokens=50
    )
    print(response.get('content', 'ERROR'))

asyncio.run(test())
"
```

**Expected Output**: `API works!`

---

## 🧪 Run Full Test Suite

### Step 1: Schema Tests (No API)
```bash
cd backend
python test_dossier_sync.py
```

### Step 2: Real API Tests (Requires API Key)
```bash
cd backend
python test_real_dossier_generation.py
```

### Step 3: Generate Test Dossier
```bash
cd backend

# Generate dossier for Arsenal FC
python -c "
import asyncio
from dossier_generator import EntityDossierGenerator
from claude_client import ClaudeClient

async def generate():
    client = ClaudeClient()
    generator = EntityDossierGenerator(client)
    
    dossier = await generator.generate_dossier(
        entity_id='arsenal-fc-test',
        entity_name='Arsenal FC',
        entity_type='CLUB',
        priority_score=99  # Premium tier
    )
    
    print(f'✅ Generated {dossier.tier} dossier')
    print(f'   Sections: {len(dossier.sections)}')
    print(f'   Cost: \${dossier.total_cost_usd:.4f}')
    print(f'   Time: {dossier.generation_time_seconds:.2f}s')

asyncio.run(generate())
"
```

---

## 📊 Expected Results

### Basic Tier (priority_score=15)
- Sections: 3
- Cost: ~$0.0015
- Time: ~5-8 seconds
- Models: Haiku only

### Standard Tier (priority_score=35)
- Sections: 7
- Cost: ~$0.0105
- Time: ~12-18 seconds
- Models: Haiku + Sonnet

### Premium Tier (priority_score=99)
- Sections: 11
- Cost: ~$0.0315
- Time: ~25-35 seconds
- Models: Haiku + Sonnet + Opus

---

## 🔧 Troubleshooting

### "Module not found: claude_client"

```bash
cd backend
export PYTHONPATH="${PYTHONPATH}:$(pwd)"
python test_dossier_sync.py
```

### "401 Unauthorized"

**Cause**: Invalid or missing API key

**Fix**:
1. Check `.env` file exists in backend directory
2. Verify `ANTHROPIC_API_KEY` or `ANTHROPIC_AUTH_TOKEN` is set
3. Test API key with simple curl command:
```bash
curl https://api.anthropic.com/v1/messages \
  -H "x-api-key: $ANTHROPIC_API_KEY" \
  -H "anthropic-version: 2023-06-01" \
  -H "content-type: application/json" \
  -d '{
    "model": "claude-3-5-haiku-20241022",
    "max_tokens": 50,
    "messages": [{"role": "user", "content": "Hi"}]
  }'
```

### "Column 'tier' does not exist"

**Cause**: Database schema not deployed

**Fix**: Run schema migration
```bash
cd backend

# Using Supabase MCP (if configured)
# Otherwise, run SQL manually in Supabase dashboard
```

### Tests pass but real generation fails

**Cause**: Mock mode being used

**Fix**: Verify ClaudeClient is initialized correctly
```python
# Check that client is not in mock mode
client = ClaudeClient()
print(f"API Key: {'SET' if client.api_key else 'NOT SET'}")
```

---

## 📁 File Structure

```
backend/
├── dossier_generator.py          # Core generator (478 lines)
├── dossier_templates.py          # Prompt templates (275 lines)
├── dossier_data_collector.py     # Data aggregation (198 lines)
├── claude_client.py              # Model cascade client (570 lines)
├── schemas.py                    # Data structures (modified)
├── supabase_dossier_schema.sql   # Database schema (127 lines)
├── test_dossier_generator.py     # Async tests (354 lines)
├── test_dossier_sync.py          # Sync tests (236 lines)
└── test_real_dossier_generation.py # Integration tests (NEW)

src/app/api/dossier/
└── route.ts                      # API endpoints (142 lines)

src/components/entity-dossier/
├── DynamicEntityDossier.tsx      # Main component (198 lines)
├── DossierSkeleton.tsx           # Loading state (89 lines)
└── DossierError.tsx              # Error state (67 lines)
```

---

## 🎯 Next Steps

### Immediate (Today)
1. ✅ Verify installation: `python test_dossier_sync.py`
2. ⏳ Configure API key (Option A or B)
3. ⏳ Test API connection: `python test_real_dossier_generation.py`
4. ⏳ Generate first real dossier

### Short-term (This Week)
1. Connect FalkorDB for entity metadata
2. Integrate HypothesisManager for signals
3. Test with 3-5 real entities
4. Validate cost estimates

### Long-term (This Month)
1. Deploy to production server
2. Set up monitoring and logging
3. Load testing with 100+ entities
4. User acceptance testing

---

## 📞 Support

### Documentation
- `ENTITY-DOSSIER-SYSTEM-COMPLETE.md` - Full implementation details
- `DOSSIER-TEST-RESULTS.md` - Test results with Arsenal FC
- `backend/dossier_generator.py` - Inline code documentation

### Logs
- Generation logs: Check console output
- API logs: Next.js server logs
- Database logs: Supabase dashboard

### Common Issues
See "Troubleshooting" section above

---

## ✅ Checklist

Before using in production:

- [ ] Claude API credentials configured
- [ ] All tests passing (`test_dossier_sync.py`)
- [ ] Real API test passing (`test_real_dossier_generation.py`)
- [ ] Database schema deployed (Supabase)
- [ ] FalkorDB connection configured (optional)
- [ ] Generated at least 3 test dossiers
- [ ] Verified cost estimates match actual costs
- [ ] Tested cache invalidation (`?force=true`)
- [ ] Frontend components rendering correctly
- [ ] API endpoints responding

---

**Status**: ✅ Implementation Complete  
**Next**: Configure API credentials and test  
**Timeline**: Production ready in 1-2 weeks
