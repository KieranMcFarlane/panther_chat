# Signal Noise App - Legacy Documentation Archive

**Purpose**: Historical documentation, deprecated approaches, and experiments
**Status**: 📚 **NOT CURRENT** - Preserved for reference only

---

## ⚠️ Important Notice

**Everything in this document is LEGACY**. For the current production system, see **CURRENT-SYSTEM.md**.

---

## 📂 Categories of Legacy Content

1. **Deprecated** - Approaches replaced by better solutions
2. **Experimental** - Tests and experiments that informed current system
3. **Historical** - Early development documentation
4. **Superseded** - Features removed or never implemented
5. **Reference** - Architecture docs kept for context

---

## 🗑️ Deprecated Documentation

### BrightData MCP Server (DEPRECATED)

**Status**: ❌ **REPLACED** by BrightData SDK

**What it was**:
- MCP server for web scraping
- `mcp__brightdata__*` tools
- `mcp__brightdata-mcp__*` tools

**Replaced by**:
- **Current**: `backend/brightdata_sdk_client.py` (official Python SDK)
- **Why**: Direct Python integration (no MCP overhead), automatic proxy rotation, better error handling

**Migration**:
```python
# OLD (Don't use)
from mcp import brightdata
result = await mcp__brightdata__search_engine(...)

# NEW (Use this)
from backend.brightdata_sdk_client import BrightDataSDKClient
brightdata = BrightDataSDKClient()
result = await brightdata.search_engine(...)
```

---

### Neo4j & Neo4j Aura (REMOVED)

**Status**: ❌ **REMOVED** - No longer used in system

**What it was**:
- Neo4j Aura - Cloud backup database
- Neo4j MCP server (`mcp__neo4j__*` tools)
- 593+ references in codebase

**Why removed**:
- FalkorDB is now the primary and only database
- No longer need for cloud backup
- Simplified infrastructure

**Migration**:
```python
# OLD (Don't use)
from mcp import neo4j
result = await mcp__neo4j__execute_query(...)

# NEW (Use FalkorDB)
from backend.falkordb_mcp_server_fastmcp import FalkorDBMCPClient
falkordb = FalkorDBMCPClient()
result = await falkordb.execute_query(...)
```

---

**What it was**:
- MCP server for web scraping
- `mcp__brightdata__*` tools
- `mcp__brightdata-mcp__*` tools

**Replaced by**:
- **Current**: `backend/brightdata_sdk_client.py` (official Python SDK)
- **Why**: Direct Python integration (no MCP overhead), automatic proxy rotation, better error handling

**Migration**:
```python
# OLD (Don't use)
from mcp import brightdata  # ❌

# NEW (Use this)
from backend.brightdata_sdk_client import BrightDataSDKClient  # ✅
```

---

### glm-4.5v MCP Server (REMOVED)

**Status**: ❌ **REMOVED** from mcp-config.json

**What it was**:
- Visual reasoning for images (Z.AI)
- Image analysis for RFP detection

**Why removed**:
- Not actively used in production workflows
- Can be re-added if needed

**Reference**: See `ZAI-PROXY-VERIFICATION.md` for historical usage

---

### headless-verifier MCP Server (REMOVED)

**Status**: ❌ **REMOVED** from mcp-config.json

**What it was**:
- RFP verification using Puppeteer
- Headless browser automation

**Why removed**:
- Maintenance overhead
- Alternative approaches more cost-effective

---

## 🧪 Experimental Documentation

### Calibration Experiments

**Files**:
- `backend/calibration_experiment.py`
- `QUICK-START-CALIBRATION.md`

**Purpose**: Run 150 iterations to gather REAL data on optimal exploration parameters

**What it tested**:
- Fixed iteration limits vs dynamic stopping
- Confidence saturation thresholds
- Category multipliers

**Outcome**: Informed **state-aware Ralph Loop** refactor

**Status**: ✅ **Complete** - Results integrated into current system

---

### KNVB Case Study

**Files**:
- `scripts/simulate_state_aware_ralph.py`
- `scripts/generate_investor_diagram.py`

**Purpose**: Simulation of Netherlands Football Association exploration

**What it demonstrated**:
- Old model: 30 iterations, $0.63 cost, 0.80 confidence (inflated)
- New model: ~14 iterations, $0.38 cost, 0.70 confidence (realistic)

**Outcome**: Led to **WEAK_ACCEPT confidence ceiling** and **actionable status gate**

**Status**: ✅ **Validated** - Improvements deployed to production

---

### Template System Experiments

**Files**:
- `backend/template_discovery.py`
- `backend/template_enrichment_agent.py`
- `backend/template_expansion_agent.py`
- `backend/template_validation.py`

**Purpose**: Automated discovery, enrichment, expansion, and validation of patterns

**What it tested**:
- Pattern discovery across entities
- Cross-entity validation
- Template fidelity testing

**Status**: ✅ **Complete** - Informed current template-based discovery

---

### Multi-Agent System Experiments

**File**: `backend/test_multi_agent_system.py`

**Purpose**: Test parallel agent orchestration

**What it tested**:
- Claude Agent SDK multi-agent coordination
- Task distribution and result aggregation

**Status**: ✅ **Complete** - Architecture validated, not production-required

---

## 📚 Historical Documentation

### Original Dossier Generator (BEFORE Optimization)

**File**: `backend/dossier_generator.py` (original)

**Characteristics**:
- Signal-to-noise: ~20%
- Generic insights: "undergo digital transformation"
- Decision makers: "Commercial Director" (no names)
- Technology: All "Unknown"

**Replaced by**: `backend/enhanced_dossier_generator.py`

**Improvements**: See **DOSSIER-OPTIMIZATION-PROTOTYPE-RESULTS.md**

**Status**: ❌ **Superseded** - Use enhanced version only

---

### Original Ralph Loop (BEFORE State-Aware)

**File**: `backend/ralph_loop.py` (pre-refactor)

**Characteristics**:
- Fixed 30 iterations per entity
- No category saturation detection
- No WEAK_ACCEPT confidence ceiling
- No hypothesis tracking

**Replaced by**: State-aware refactor with 7 new schema classes

**Improvements**: See **RALPH-LOOP-REFACTORING-COMPLETE.md**

**Status**: ❌ **Superseded** - Use state-aware version only

---

### Early Hypothesis System (BEFORE EIG)

**Characteristics**:
- Random hypothesis selection
- No Expected Information Gain scoring
- No cost control

**Replaced by**: `backend/hypothesis_driven_discovery.py`

**Status**: ❌ **Superseded** - Use EIG-based version only

---

## 🏗️ Reference Architecture Docs

### new-arch-docs/ (Planning Phase)

**Status**: 📋 **Planning** - Not implemented, kept for context

**What it contains**:
- 28 architectural planning documents
- Module breakdowns
- Technology selection discussions
- Integration strategies

**Why kept**: Shows system evolution and decision history

**Key Documents**:
- `plan-new-infra-01-section.md` - System overview
- `plan-new-infra-part-03.md` - What CopilotKit does critically
- `plan-new-infra-theme-01-architecture-overview.md` - High-level architecture
- `plan-new-infra-12-final-architecture-production-grade.md` - Production requirements

**Note**: These are PLANNING documents, not implementation guides. See **CURRENT-SYSTEM.md** for actual system.

---

### docs/ (Historical Reference)

**Status**: 📚 **Reference** - Keep for context

**What it contains**:
- Implementation guides for deprecated features
- Historical integration patterns
- Obsolete testing procedures

**Examples**:
- `docs/copilotkit-diagnostics-2026-01-24.md` - Old diagnostics
- `docs/iteration-08-alignment-2026-01-27.md` - Old alignment docs
- `docs/production-template-discovery-implementation.md` - Old template approach

**Note**: Use **CURRENT-SYSTEM.md** for current implementation.

---

## 🧪 Deprecated MCP Tools

### brightData Tools (DO NOT USE)

**Deprecated Pattern**:
```python
# ❌ DON'T USE THIS
from mcp import brightdata
result = await mcp__brightdata__search_engine(...)
```

**Correct Pattern**:
```python
# ✅ USE THIS INSTEAD
from backend.brightdata_sdk_client import BrightDataSDKClient
brightdata = BrightDataSDKClient()
result = await brightdata.search_engine(...)
```

---

### glm-4.5v Tools (REMOVED)

**Deprecated Pattern**:
```python
# ❌ DON'T USE (server removed)
from mcp import glm_4_5v
result = await mcp__4_5v__analyze_image(...)
```

**Alternative**: Use Z.AI directly if needed (not in mcp-config.json)

---

## 📅 Superseded Features

### Mastra Integration

**Status**: ❌ **Minimal usage** - Basic setup only

**What it was**:
- `@mastra/ui` components
- `@mastra/*` packages

**Why minimal**:
- Not actively used in core workflows
- Can be expanded if needed

**Current state**: Installed but not primary

---

### Qdrant (Vector Database)

**Status**: ❌ **TODO** - Code exists but not implemented

**What it was**:
- Vector database for similarity search

**Current state**: Marked TODO in codebase

---

### Redis

**Status**: ❌ **Installed but not actively used**

**What it was**:
- Caching layer
- Queue management

**Current state**: Supabase handles caching needs

---

## 🧪 Historical Deployment Guides

### Hetzner Cloud Deployment

**File**: `deploy-hetzner.sh`

**Status**: 📚 **Historical** - Alternative deployment option

**What it was**:
- Deploy to Hetzner cloud infrastructure

**Current deployment**: See **CURRENT-SYSTEM.md** for active deployment scripts

---

### Vercel Deployment

**Status**: 📚 **Frontend-only mode** mentioned

**What it was**:
- Vercel hosting for frontend

**Current state**: Not primary deployment method

---

## 📊 Test Results (Historical)

### Directory: `backend/tests/`

**Historical test files** (keep for reference):
- `test_ralph_loop_api.py` ✅ (current)
- `test_integration_phases_5_6.py` 📟 (historical)
- `test_mcp_integration.py` 📟 (historical)
- `test_pilot_rollout.py` 📟 (historical)
- `test_simplified_pilot.py` 📟 (historical)

**Status**: Some historical tests may still pass but are not part of current test suite

---

## 🔄 Migration from Legacy

### If You're Using Old Documentation

**Step 1**: Check **CURRENT-SYSTEM.md** for current approach

**Step 2**: If something doesn't exist there, check here:

**Common Legacy Patterns**:

| Legacy Pattern | Current Equivalent |
|---------------|-------------------|
| `mcp__brightdata__*` | `BrightDataSDKClient()` |
| `from mcp import neo4j` | Removed (use FalkorDB native client) |
| `from mcp import glm_4_5v` | Removed (use Z.AI directly if needed) |
| `dossier_generator.py` | `enhanced_dossier_generator.py` |
| Fixed 30 iterations | State-aware with early stopping |
| No decision maker names | LinkedIn scraping integration |
| All "Unknown" vendors | Specific vendor detection |

---

## 🗑️ File Inventory (What's Here)

### Complete Legacy Document List

**Deployment & Infrastructure**:
- `DEPLOYMENT-GUIDE.md` (historical)
- `DOCKERFILE-REFERENCE.md` (historical)
- `EC2-DEPLOYMENT-GUIDE.md` (historical)
- `VPS-DEPLOYMENT-GUIDE.md` (historical)
- `HETZNER-SSH-SETUP.md` (historical)

**System Architecture (Planning)**:
- `new-arch-docs/plan-new-infra.md` (planning)
- `new-arch-docs/plan-new-infra-part-*.md` (28 planning docs)
- `ARCHITECTURE-EXPLAINED.md` (historical)
- `ARCHITECTURE-COMPARISON.md` (historical)
- `SIGNAL-NOISE-ARCHITECTURE.md` (historical)

**Integration Guides**:
- `ENHANCED-PERPLEXITY-RFP-SYSTEM-QUICK-START.md` (historical)
- `PERPLEXITY-MCP-OPTIMIZATION-PLAN.md` (historical)
- `BRIGHTDATA-MCP-INTEGRATION-COMPLETE.md` (deprecated)
- `SUPABASE-ENTITY-INTEGRATION-COMPLETE.md` (current)

**Feature-Specific**:
- `TEMPLATE-DISCOVERY-COMPLETE.md` (experimental)
- `BOOTSTRAP-COMPLETE.md` (experimental)
- `DOSSIER-STRATEGY.md` (pre-optimization)
- `DOSSIER-DATA-INTEGRATION-GUIDE.md` (pre-optimization)
- `DOSSIER-DATA-INTEGRATION-SUMMARY.md` (pre-optimization)

**Testing & Validation**:
- `IMPLEMENTATION-VALIDATION-REPORT.md` (historical)
- `MAX-DEPTH-VALIDATION-COMPARISON.md` (historical)
- `SIMULATION-RESULTS-SUMMARY.md` (historical)
- `CALIBRATION-TEST-RESULTS-ICF-ARSENAL.md` (historical)
- `TEST-RESULTS-FINAL.md` (historical)

**RFP & Dossier**:
- `RFP-DISCOVERY-SCHEMA.md` (reference)
- `RFP-DETECTION-REPORT-Stakeholder-2026-02-05.md` (historical)
- `ENHANCED-DOSSIER-COMPLETE.md` (pre-enhanced)
- `ENHANCED-DOSSIER-IMPLEMENTATION-SUMMARY.md` (pre-enhanced)
- `DOSSIER-OPTIMIZATION-ANALYSIS.md` (pre-prototype)

**Technical Implementation**:
- `FALKORDB-CONNECTION-STATUS.md` (current)
- `FALKORDB-INTEGRATION-STATUS.md` (current)
- `NETWORK-ACCESS-SOLUTION.md` (current)
- `RAPH-LOOP-IMPLEMENTATION-COMPLETE.md` (pre-state-aware)
- `RAPH-LOOP-SETUP.md` (pre-state-aware)

**Business & Strategy**:
- `PRODUCTION-ENHANCEMENTS-COMPLETE.md` (current)
- `PRODUCTION-TEMPLATE-BOOTSTRAP-QUICK-START.md` (current)
- `FINAL-SUMMARY.md` (historical)
- `PROJECT-DELIVERABLES-SUMMARY.md` (historical)

**Agent & AI Systems**:
- `MULTI-AGENT-IMPLEMENTATION-COMPLETE.md` (experimental)
- `MULTI-AGENT-QUICK-START.md` (experimental)
- `COPILOTKIT-TEST-QUICK-REFERENCE.md` (reference)

**Case Studies**:
- `ARSENAL-FC-DOSSIER-SUCCESS.md` (historical)
- `BARCELONA-FC-DOSSIER-SUCCESS.md` (historical)
- `FULHAM-FC-DOSSIER-SUCCESS.md` (historical)
- `ASTON-VILLA-DISCOVERY-SUMMARY.md` (historical)

**Workflow & Process**:
- `PRODUCTION-DAILY-CRON-WORKFLOW.md` (current)
- `DAILY-CRON-IMPLEMENTATION-GUIDE.md` (historical)
- `PRODUCTION-TEMPLATE-DISCOVERY-IMPLEMENTATION.md` (current)

---

## 🔄 Quick Reference: Is This Current?

### ✅ CURRENT (Use These)
- **CURRENT-SYSTEM.md** - ← **START HERE**
- `FALKORDB-INTEGRATION-STATUS.md`
- `SUPABASE-ENTITY-INTEGRATION-COMPLETE.md`
- `RALPH-LOOP-REFACTORING-COMPLETE.md`
- `DOSSIER-OPTIMIZATION-PROTOTYPE-RESULTS.md`
- `YELLOW-PANTHER-TESTING-SUMMARY.md` (if using Yellow Panther)
- `PRODUCTION-ENHANCEMENTS-COMPLETE.md`
- `WHAT-WE-JUST-BUILT.md`

### 📟 PLANNING (Reference Only)
- `new-arch-docs/` - All 28 documents
- `ARCHITECTURE-EXPLAINED.md`
- `ARCHITECTURE-COMPARISON.md`

### ❌ DEPRECATED (Don't Use)
- `BRIGHTDATA-MCP-INTEGRATION-COMPLETE.md` - Use SDK instead
- `ENHANCED-PERPLEXITY-RFP-SYSTEM.md` - System changed
- `ENHANCED-DOSSIER-COMPLETE.md` - Use enhanced version
- `TEMPLATE-DISCOVERY-COMPLETE.md` - Experimental only

### 🧪 EXPERIMENTAL (Learned From)
- `CALIBRATION-EXPERIMENT.py` - Informed state-aware Ralph Loop
- `test_multi_agent_system.py` - Validated architecture
- `scripts/simulate_state_aware_ralph.py` - Proved improvements

---

## 📖 Summary

This **LEGACY-ARCHIVE.md** contains:

**Deprecated** (replaced by better solutions):
- ❌ BrightData MCP server → Use BrightData SDK
- ❌ glm-4.5v MCP server → Removed from config
- ❌ headless-verifier → Removed from config
- ❌ Original dossier generator → Use enhanced version
- ❌ Original Ralph Loop → Use state-aware version

**Experimental** (informed current system):
- ✅ Calibration experiments
- ✅ KNVB case study
- ✅ Template system experiments
- ✅ Multi-agent coordination

**Historical** (kept for context):
- 📂 Original implementations
- 📂 Early development docs
- 📂 Planning phase documents
- 📂 Obsolete test files

**Reference** (architecture history):
- 📂 new-arch-docs/ planning docs
- 📂 Historical integration guides
- 📂 Obsolete deployment procedures

---

## 🎯 For Current System

**See**: **CURRENT-SYSTEM.md** ← Everything you need today

---

*Last Updated*: February 12, 2026
*Maintained By**: Split from active system documentation
*Purpose*: Preserve historical context while keeping current docs clean
