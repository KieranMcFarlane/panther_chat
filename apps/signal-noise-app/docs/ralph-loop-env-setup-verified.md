# Ralph Loop Environment Setup - VERIFIED ✅

## Environment Variable Configuration - CORRECTED

### ✅ All Environment Variables in Main `.env` File

**Location:** `/Users/kieranmcfarlane/Downloads/panther_chat/apps/signal-noise-app/.env`

**Ralph Loop Configuration:**
```bash
# Ralph Loop API endpoint (port 8001)
RALPH_LOOP_API_URL=http://localhost:8001
NEXT_PUBLIC_RALPH_LOOP_API_URL=http://localhost:8001
```

**Required Credentials (already in .env):**
```bash
# Anthropic Claude API (Pass 2 validation)
ANTHROPIC_API_KEY=c4b860075e254d219887557d13477116.e8Gtsb5sXuDggh2c
ANTHROPIC_AUTH_TOKEN=0e978aa432bf416991b4f00fcfaa49f5.AtIKDj9a7SxqQei3
ANTHROPIC_BASE_URL=https://api.z.ai/api/anthropic

# Graphiti Service (storage)
NEO4J_URI=neo4j+s://cce1f84b.databases.neo4j.io
NEO4J_USERNAME=neo4j
NEO4J_PASSWORD=llNASCzMWGT-nTt-JkD9Qk_4W6PpJrv39X0PuYAIKV0

# FalkorDB (alternative graph database)
FALKORDB_URI=rediss://r-6jissuruar.instance-vnsu2asxb.hc-srom4rolb.eu-west-1.aws.f2e0a955bb84.cloud:50743
FALKORDB_USER=falkordb
FALKORDB_PASSWORD=N!HH@CBC9QDesFdS
FALKORDB_DATABASE=sports_intelligence
```

## Startup Script Changes

### ✅ Updated to Load from Main `.env` File

**File:** `scripts/start-ralph-loop.sh`

**Before:**
```bash
# Change to backend directory
cd "$(dirname "$0")/.."
BACKEND_DIR="$(pwd)/backend"
cd "$BACKEND_DIR"

# Load environment variables if .env exists
if [ -f .env ]; then
  source .env
fi
```

**After:**
```bash
# Change to project root directory
cd "$(dirname "$0")/.."
PROJECT_ROOT="$(pwd)"

# Load environment variables from main .env file
echo "🔐 Loading environment variables from .env..."
set -a  # Automatically export all variables
source "$PROJECT_ROOT/.env"
set +a

# Change to backend directory for running the service
BACKEND_DIR="$PROJECT_ROOT/backend"
cd "$BACKEND_DIR"
```

**Benefits:**
- ✅ Loads from main `.env` file (not `backend/.env`)
- ✅ All credentials in one place
- ✅ Consistent with project structure
- ✅ No duplicate environment files

## Frontend Client Configuration

### ✅ Uses Correct Environment Variable

**File:** `src/lib/ralph-loop-client.ts`

**Lines 68, 158:**
```typescript
const RALPH_LOOP_API = process.env.NEXT_PUBLIC_RALPH_LOOP_API_URL || 'http://localhost:8001';
```

**Environment Variable in `.env`:**
```bash
NEXT_PUBLIC_RALPH_LOOP_API_URL=http://localhost:8001
```

**Benefits:**
- ✅ Uses `NEXT_PUBLIC_` prefix (required for client-side access)
- ✅ Defaults to port 8001 if not set
- ✅ Can be overridden for production

## Verification Checklist

### ✅ Environment Variables
- [x] `RALPH_LOOP_API_URL=http://localhost:8001` in `.env`
- [x] `NEXT_PUBLIC_RALPH_LOOP_API_URL=http://localhost:8001` in `.env`
- [x] `ANTHROPIC_AUTH_TOKEN` set in `.env`
- [x] `NEO4J_URI` set in `.env`
- [x] `FALKORDB_URI` set in `.env`
- [x] All variables loaded from main `.env` file
- [x] No `backend/.env` file needed

### ✅ Startup Script
- [x] Loads from main `.env` file
- [x] Changes to backend directory after loading
- [x] Checks for required credentials
- [x] Provides clear error messages

### ✅ Frontend Client
- [x] Uses `NEXT_PUBLIC_RALPH_LOOP_API_URL`
- [x] Defaults to port 8001
- [x] Can be overridden for production

## Quick Start

### 1. Start Ralph Loop

```bash
./scripts/start-ralph-loop.sh
```

**Expected Output:**
```
🔐 Loading environment variables from .env...
🔄 Ralph Loop Validation Service (Iteration 08 Compliant)
══════════════════════════════════════════════════════════

📊 Iteration 08 Invariants:
   • min_evidence = 3
   • min_confidence = 0.7
   • max_passes = 3

✅ Starting Ralph Loop service...
INFO:     Uvicorn running on http://0.0.0.0:8001
```

### 2. Verify Environment Variables

```bash
# Check Ralph Loop API URL
echo $RALPH_LOOP_API_URL
# Expected: http://localhost:8001

# Check Anthropic credentials
echo $ANTHROPIC_AUTH_TOKEN
# Expected: 0e978aa432bf416991b4f00fcfaa49f5.AtIKDj9a7SxqQei3

# Check Neo4j connection
echo $NEO4J_URI
# Expected: neo4j+s://cce1f84b.databases.neo4j.io
```

### 3. Run Integration Tests

```bash
./scripts/test-ralph-loop.sh
```

## Summary

✅ **Environment Setup Complete**

**Changes Made:**
1. ✅ Added `RALPH_LOOP_API_URL=http://localhost:8001` to main `.env`
2. ✅ Added `NEXT_PUBLIC_RALPH_LOOP_API_URL=http://localhost:8001` to main `.env`
3. ✅ Updated startup script to load from main `.env` file
4. ✅ Verified frontend client uses correct environment variable
5. ✅ No duplicate `backend/.env` file needed

**Result:**
- All credentials in one place (main `.env`)
- Consistent with project structure
- Startup script loads from correct location
- Frontend client uses `NEXT_PUBLIC_` prefix
- Ready to run Ralph Loop service

**Next Steps:**
1. Run `./scripts/start-ralph-loop.sh` to start the service
2. Run `./scripts/test-ralph-loop.sh` to verify integration
3. Submit signals to `/api/signals/validate` for validation

---

**Status:** ✅ Environment configuration verified and corrected
**Date:** 2026-01-27
**File:** `.env` (project root)
