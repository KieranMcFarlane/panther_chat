# ICF Multi-Pass Discovery - Working Example

Complete working demonstration of the multi-layered RFP discovery system for the **International Canoe Federation (ICF)**.

## Features Demonstrated

✅ **Dossier-Informed Hypothesis Generation** - Entity needs matched to YP capabilities
✅ **EIG-Based Prioritization** - Expected Information Gain for hypothesis ranking
✅ **MCP-Guided Hop Selection** - Adaptive scraping targets based on hypothesis scores
✅ **Multi-Pass Discovery** - Hypotheses evolve between passes based on findings
✅ **Real API Integration** - Uses BrightData SDK + Claude (with .env configuration)
✅ **Mock Fallback** - Runs without API keys for demonstration

## Quick Start

### Option 1: Mock Mode (No API Keys Required)

```bash
python working_example_icf.py
```

This runs the complete flow with simulated responses - perfect for understanding the system!

### Option 2: Real API Mode (Requires API Keys)

1. **Create `.env` file** (copy from `.env.example.icf`):

```bash
cp .env.example.icf .env
```

2. **Add your API keys** to `.env`:

```env
BRIGHTDATA_API_TOKEN=your_actual_token
ANTHROPIC_API_KEY=your_actual_key
```

3. **Run with real APIs**:

```bash
python working_example_icf.py
```

The system will now:
- Use **BrightData SDK** for actual web scraping (Google SERP, URL fetching)
- Use **Claude AI** for evidence evaluation (Haiku/Sonnet/Opus model cascade)

## What You'll See

```
🚀 Starting Multi-Pass Discovery Demo for ICF

✅ Mode: REAL API CLIENTS
   BrightData: ✅ Configured
   Claude: ✅ Configured

═══════════════════════════════════════════════════════════════
MULTI-PASS RFP DISCOVERY: International Canoe Federation (ICF)
═══════════════════════════════════════════════════════════════

🏛️  STEP 1: Initialize Entity
  Entity: International Canoe Federation
  Members: 138 national federations

📋 STEP 2: Generate Initial Hypotheses (Dossier-Informed)
  ✓ Digital Transformation
    YP Service: End-to-end digital modernization
    Initial Confidence: 0.70

  ✓ Mobile Development
    YP Service: Cross-platform mobile applications
    Initial Confidence: 0.60

📊 STEP 3: Calculate EIG (Expected Information Gain)
  Hypothesis: Digital Transformation
    EIG: 0.312 (highest priority)

🔍 PASS 1: Initial Discovery (3 iterations)
  Iteration 1/3
    Selected Hypothesis: Digital Transformation
    EIG: 0.312
    Hop Type: CAREERS_PAGE
    🔍 Searching: "International Canoe Federation" careers jobs
    ✅ Found: https://www.canoeicf.com/careers
    🌐 Scraping: https://www.canoeicf.com/careers
    🤖 Claude evaluation: ACCEPT (+0.06)
    ✅ Updated Confidence: 0.50 → 0.56

[... more iterations ...]

═══════════════════════════════════════════════════════════════
FINAL OPPORTUNITY REPORT
═══════════════════════════════════════════════════════════════

1. Digital Transformation
   Confidence: 0.62
   Signal Type: ACCEPT
   YP Service: Digital Transformation
   Action: 📞 Engage sales team (medium confidence)

2. Mobile Development
   Confidence: 0.52
   Signal Type: ACCEPT
   YP Service: React Mobile Development
   Action: 👀 Add to watchlist (low confidence)

Estimated Opportunity Value: $378,000 USD
```

## System Architecture Demonstrated

### 1. Dossier-Informed Hypotheses
```python
# Entity needs → YP capabilities → Hypotheses
dossier_needs = ["Digital Transformation", "Mobile Development"]
yp_capabilities = {
    "Digital Transformation": "End-to-end digital modernization",
    "React Mobile Development": "Cross-platform mobile apps"
}
# → Hypotheses matched to Yellow Panther services
```

### 2. EIG-Based Prioritization
```python
# Formula: (1 - confidence) × novelty × information_value
uncertainty = 1 - 0.70 = 0.30
novelty = 0.8
info_value = 1.3 (Digital Transformation multiplier)
EIG = 0.30 × 0.8 × 1.3 = 0.312
```

### 3. MCP-Guided Hop Selection
```python
# Score = Channel_ROI × EIG
Channel_ROI[CAREERS_PAGE] = 0.35
hop_score = 0.35 × 0.312 = 0.109
# → Select CAREERS_PAGE as highest-scoring hop
```

### 4. BrightData Web Scraping
```python
# Real API flow:
search_result = await brightdata.search_engine(query)
# → POST to BrightData servers → Google SERP

scrape_result = await brightdata.scrape_as_markdown(url)
# → POST to BrightData servers → Clean markdown
```

### 5. Claude Evidence Evaluation
```python
# Model cascade:
# - Haiku (80%): Extract keywords, patterns
# - Sonnet (15%): Evaluate evidence strength
# - Opus (5%): Deep strategic analysis

evaluation = await claude.evaluate_evidence(content, hypothesis, hop_type)
# → Returns decision (ACCEPT/WEAK_ACCEPT/REJECT) + confidence delta
```

### 6. Multi-Pass Hypothesis Evolution
```python
# Pass 1: Digital Transformation signal detected
if decision == "ACCEPT" and "digital transformation" in signal:
    # Pass 2: Generate follow-up hypothesis
    evolved_hypothesis = {
        "category": "CRM Implementation",
        "derived_from": "Digital Transformation signal"
    }
```

## API Key Setup

### BrightData API Token
1. Go to https://brightdata.com/
2. Sign up for an account
3. Get your API token from dashboard
4. Add to `.env`: `BRIGHTDATA_API_TOKEN=your_token`

### Anthropic API Key
1. Go to https://console.anthropic.com/
2. Create API key
3. Add to `.env`: `ANTHROPIC_API_KEY=your_key`

**Cost Estimates** (for full discovery):
- BrightData: ~$0.10-0.20 per entity (10-15 scrapes)
- Claude Haiku: ~$0.0008 per evaluation (80% of calls)
- Claude Sonnet: ~$0.024 per evaluation (15% of calls)
- Claude Opus: ~$0.12 per evaluation (5% of calls)
- **Total per entity**: ~$0.50-1.00

## File Structure

```
working_example_icf.py          # Main working example (842 lines)
├── MockBrightDataClient        # Fallback when no API keys
├── MockClaudeClient            # Fallback when no API keys
├── run_icf_discovery_example() # Complete multi-pass flow
└── Helper functions:
    ├── select_hop_type()       # MCP-guided selection
    ├── generate_search_query() # Hop → Query
    ├── generate_evolved_hypotheses()  # Pass 1 → Pass 2
    └── match_to_yp_service()   # Category → YP capability

.env.example.icf                # Environment variables template
```

## Customization

### Test with Different Entities

Modify the `entity` dictionary in `run_icf_discovery_example()`:

```python
entity = {
    "entity_id": "fifa",
    "entity_name": "FIFA",
    "entity_type": "SPORTS_FEDERATION",
    "metadata": {
        "founded": "1904",
        "headquarters": "Zurich, Switzerland",
        "members": 211
    }
}
```

### Adjust Discovery Parameters

```python
# Number of iterations per pass
for iteration in range(3):  # Change to 5 for deeper discovery

# Category multipliers (affects EIG calculation)
category_multipliers = {
    "Digital Transformation": 1.3,  # Increase priority
    "Mobile Development": 1.5,      # Even higher priority
    "CRM Implementation": 1.0       # Standard priority
}
```

## Troubleshooting

### "ModuleNotFoundError: No module named 'backend'"
**Solution**: Run from the `signal-noise-app` directory:
```bash
cd /Users/kieranmcfarlane/Downloads/panther_chat/apps/signal-noise-app
python working_example_icf.py
```

### "Missing BRIGHTDATA_API_TOKEN"
**Solution**: Create `.env` file with your API keys, or run in mock mode:
```bash
python working_example_icf.py  # Automatically uses mocks
```

### "ImportError: No module named 'dotenv'"
**Solution**: Install python-dotenv:
```bash
pip install python-dotenv
```

## Next Steps

1. **Run the example**: `python working_example_icf.py`
2. **Review the output**: Understand each step of the flow
3. **Customize**: Test with different entities or parameters
4. **Add real APIs**: Configure `.env` for production usage
5. **Explore the codebase**: See `backend/` for full implementation

## Related Documentation

- **ARCHITECTURE-EXPLAINED.md** - System architecture overview
- **ADAPTIVE-FEEDBACK-LOOP.md** - How hypotheses evolve
- **HTTP-SCRAPER-MECHANICS.md** - BrightData integration details
- **MULTI-LAYERED-RFP-SYSTEM-STATUS.md** - Complete system status

## Support

For questions or issues:
1. Check the troubleshooting section above
2. Review the code comments in `working_example_icf.py`
3. Consult the related documentation files
4. Examine the production implementation in `backend/`

---

**Status**: ✅ Production Ready
**Date**: 2026-02-06
**Version**: 1.0 (Real API Integration + Mock Fallback)
