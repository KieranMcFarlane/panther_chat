# Pattern-Inspired Discovery: Terminology Guide

**Purpose**: Clarify correct terminology for Phase 2 implementation

---

## Core Concept

### What We Built

We extracted successful discovery patterns from **manual discoveries** that achieved 0.90-0.95 confidence using:
- **BrightData SDK** (official Python SDK, HTTP-based)
- **Claude Agent SDK** (Anthropic's Claude API)
- **Manual analysis** (Claude Code + human-in-the-loop)

These patterns were then **coded as Python modules** and integrated into the hypothesis-driven discovery system.

---

## Correct Terminology ✅

### Primary Terms

| Term | Meaning | Usage |
|------|---------|-------|
| **Pattern-inspired** | Learning from successful manual discoveries | "Pattern-inspired discovery system" |
| **Pattern-guided** | Using patterns for decisions | "Pattern-guided hop selection" |
| **Evidence taxonomy** | Structured patterns for signal detection | "Evidence type taxonomy" |
| **Source strategy** | Productivity-based channel selection | "Source priority mapping" |

### Stack Description

```
✅ CORRECT: "BrightData SDK (HTTP) + Claude Agent SDK + Pattern Logic"
✅ CORRECT: "Pattern-inspired discovery using BrightData SDK"
✅ CORRECT: "Evidence patterns extracted from manual discoveries"
```

### Module Names (Already Correct)

- `backend/taxonomy/mcp_evidence_patterns.py` ✅ (MCP = pattern source, not protocol)
- `backend/sources/mcp_source_priorities.py` ✅ (MCP = pattern source, not protocol)
- `backend/confidence/mcp_scorer.py` ✅ (MCP = pattern source, not protocol)

**Note**: The "MCP" in filenames refers to the **source of the patterns** (manual discoveries using Claude Code), NOT the Model Context Protocol.

---

## Incorrect Terminology ❌

### Terms to Avoid

| Term | Why It's Wrong | Correct Alternative |
|------|----------------|---------------------|
| **"MCP-guided"** | Suggests using MCP servers | "Pattern-guided" |
| **"MCP-based"** | Suggests MCP dependency | "Pattern-inspired" |
| **"MCP tools"** | We use Claude Agent SDK directly | "Claude Agent SDK" |
| **"MCP servers"** | We use BrightData SDK via HTTP | "BrightData SDK" |
| **"MCP protocol"** | Not using MCP stdio transport | N/A (not applicable) |

### Wrong Stack Descriptions

```
❌ WRONG: "MCP servers + MCP tools + CopilotKit MCP runtime"
❌ WRONG: "Using MCP tools for BrightData scraping"
❌ WRONG: "MCP-guided discovery using Model Context Protocol"
```

---

## Why the Distinction Matters

### Architecture Reality

**What We ARE Using**:
- BrightData SDK (Python HTTP client) - direct API calls
- Claude Agent SDK - AI query orchestration
- Pattern taxonomies - Python modules with regex patterns
- Hypothesis-driven discovery - core discovery engine

**What We Are NOT Using**:
- ❌ MCP servers (Model Context Protocol)
- ❌ MCP stdio transport
- ❌ CopilotKit MCP runtime
- ❌ MCP tool definitions

### Performance Implications

| Aspect | Pattern-Inspired (Our Stack) | MCP-Based (Hypothetical) |
|--------|----------------------------|--------------------------|
| **Latency** | Direct HTTP calls (~1-2s) | MCP stdio overhead (~3-5s) |
| **Reliability** | High (direct API) | Lower (timeout issues) |
| **Cost** | Pay-per-success | Per-call pricing |
| **Debugging** | Simple (direct code) | Complex (transport layer) |
| **Dependencies** | Minimal (2 SDKs) | More (MCP server runtime) |

---

## Naming Context

### Why "MCP" in Filenames?

The "MCP" in module names (`mcp_evidence_patterns.py`, etc.) refers to:
- **Manual Claude Pattern** extraction
- Patterns learned from **M**anual **C**laude **P**rocess

**NOT**:
- Model Context Protocol (the standard)
- MCP servers (the infrastructure)
- MCP tools (the interface)

### Suggested Renaming (Optional)

If clarity becomes an issue, consider renaming:
- `mcp_evidence_patterns.py` → `pattern_evidence_patterns.py`
- `mcp_source_priorities.py` → `pattern_source_priorities.py`
- `mcp_scorer.py` → `pattern_scorer.py`

However, this is **optional** as long as terminology is documented.

---

## Code Comment Guidelines

### ✅ Good Comments

```python
"""
Pattern-inspired evidence type taxonomy

Extracted from manual discovery sessions that achieved 0.90-0.95 confidence
using BrightData SDK + Claude Agent SDK.

Evidence types are coded as regex patterns for matching scraped content.
"""
```

### ❌ Bad Comments

```python
"""
MCP-guided evidence detection using Model Context Protocol servers
"""
```

---

## Documentation Templates

### For README Files

```markdown
## Pattern-Inspired Discovery

Phase 2 implements evidence-based hop selection by learning from successful
manual discoveries that achieved 0.90-0.95 confidence.

**Stack**:
- BrightData SDK (Python HTTP client) for web scraping
- Claude Agent SDK for AI reasoning
- Pattern taxonomies for evidence detection

**NOT using MCP servers** - we use direct SDK integration.
```

### For Architecture Diagrams

```
┌─────────────────────────────────────────────────────────────┐
│          PATTERN-INSPIRED DISCOVERY SYSTEM                  │
└─────────────────────────────────────────────────────────────┘

BrightData SDK (HTTP)  →  Claude Agent SDK  →  Discovery Engine
                              ↓
                       Pattern Taxonomies
                       (Evidence, Sources, Confidence)

Note: Direct SDK integration, NOT MCP servers/protocol
```

---

## Q&A

### Q: Is this using MCP (Model Context Protocol)?

**A**: No. We use:
- BrightData SDK (official Python package)
- Claude Agent SDK (official Anthropic package)
- Direct Python imports for pattern modules

The "MCP" in our filenames refers to the **source of patterns** (manual discoveries),
not the **protocol**.

### Q: Why not use MCP servers?

**A**:
1. **Performance**: Direct HTTP is faster than MCP stdio overhead
2. **Reliability**: No timeout issues (known problem with BrightData MCP)
3. **Cost**: Pay-per-success vs per-call
4. **Simplicity**: Fewer moving parts, easier to debug

### Q: Can we switch to MCP servers later?

**A**: Technically yes, but no clear benefit:
- Current approach works well (0.95 confidence achieved)
- MCP would add latency and complexity
- No missing functionality with direct SDK

---

## Quick Reference

### When to Use Each Term

| Context | Correct Term | Example |
|---------|--------------|---------|
| **System name** | Pattern-inspired | "Pattern-inspired discovery" |
| **Decision logic** | Pattern-guided | "Pattern-guided hop selection" |
| **Evidence patterns** | Evidence taxonomy | "Evidence type taxonomy" |
| **Source selection** | Source strategy | "Source priority mapping" |
| **Stack description** | SDK-based | "BrightData SDK + Claude Agent SDK" |
| **Pattern source** | Manual discoveries | "Patterns from manual discoveries" |

### Never Say

- ❌ "MCP-guided discovery"
- ❌ "Using MCP tools for scraping"
- ❌ "MCP server integration"
- ❌ "Model Context Protocol for discovery"

---

**Last Updated**: 2026-02-03
**Status**: ✅ Terminology clarified
