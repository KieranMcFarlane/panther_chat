#!/usr/bin/env python3
"""
Working Example: International Canoe Federation (ICF) Multi-Pass Discovery

This script demonstrates the complete multi-layered RFP discovery system:
- Dossier generation
- Hypothesis generation (matched to YP capabilities)
- Multi-pass discovery with EIG-based hop selection
- Adaptive scraping
- Evidence evaluation
- Final opportunity report

Usage:
    # With real API keys (requires .env file):
    python working_example_icf.py

    # In mock mode (no API keys needed):
    python working_example_icf.py --mock
"""

import asyncio
import json
import logging
import os
import sys
from datetime import datetime, timezone
from pathlib import Path

# Load environment variables from .env
from dotenv import load_dotenv
load_dotenv()

# Try to import anthropic for real Claude evaluation
try:
    import anthropic
    ANTHROPIC_AVAILABLE = True
except ImportError:
    ANTHROPIC_AVAILABLE = False
    logger.warning("⚠️ anthropic package not available - will use fallback evaluation")

# Setup logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# =============================================================================
# CLIENT SELECTION (Real or Mock based on API keys)
# =============================================================================

# Check for required API keys
HAS_BRIGHTDATA_KEY = bool(os.getenv("BRIGHTDATA_API_TOKEN"))
HAS_CLAUDE_KEY = bool(os.getenv("ANTHROPIC_API_KEY"))
USE_REAL_CLIENTS = HAS_BRIGHTDATA_KEY and HAS_CLAUDE_KEY and "--mock" not in sys.argv

if USE_REAL_CLIENTS:
    logger.info("✅ Using REAL API clients (BrightData SDK + Claude)")
    from backend.brightdata_sdk_client import BrightDataSDKClient
    # Import with a different name to avoid recursion
    from backend.claude_client import ClaudeClient as RealClaudeClient

    # Create a wrapper to adapt ClaudeClient to our expected interface
    class ClaudeClientWrapper:
        """Wrapper to adapt ClaudeClient to evaluate_evidence interface"""

        def __init__(self):
            # Use RealClaudeClient imported above, not the wrapper class itself
            # Note: We're not using RealClaudeClient directly, just using Anthropic API
            logger.info("✅ ClaudeClient wrapper initialized (using Anthropic API directly)")

        async def evaluate_evidence(self, content, hypothesis, hop_type):
            """
            Evaluate evidence using Claude client

            Adapts the real ClaudeClient.synthesize_signals to our evaluate_evidence interface
            """
            import anthropic
            from datetime import datetime

            logger.info(f"🧠 Evaluating evidence with Claude (model: haiku)")

            # Create a prompt for evidence evaluation
            system_prompt = """You are an expert RFP detection analyst. Evaluate whether the provided content contains evidence supporting or contradicting the hypothesis.

Decisions:
- ACCEPT: Strong evidence of procurement intent (+0.06 confidence)
- WEAK_ACCEPT: Capability present but intent unclear (+0.02 confidence)
- REJECT: Evidence contradicts hypothesis (0.00 confidence)
- NO_PROGRESS: No relevant information (0.00 confidence)

Respond in JSON format:
{
    "decision": "ACCEPT|WEAK_ACCEPT|REJECT|NO_PROGRESS",
    "confidence_delta": 0.06,
    "reasoning": "Brief explanation",
    "evidence_strength": "HIGH|MEDIUM|LOW",
    "quotes": ["relevant quote 1", "relevant quote 2"]
}"""

            user_prompt = f"""Hypothesis: {hypothesis['statement']}
Category: {hypothesis['category']}
Current Confidence: {hypothesis['confidence']}

Hop Type: {hop_type}

Content to evaluate:
{content[:4000]}

Evaluate this content and determine if it provides evidence for the hypothesis."""

            try:
                # Use the Anthropic API directly (haiku for fast evaluation)
                api_key = os.getenv("ANTHROPIC_API_KEY")
                if not api_key:
                    raise ValueError("ANTHROPIC_API_KEY not found")

                client = anthropic.Anthropic(api_key=api_key)

                response = client.messages.create(
                    model="claude-3-5-haiku-20241022",
                    max_tokens=1024,
                    system=system_prompt,
                    messages=[
                        {"role": "user", "content": user_prompt}
                    ]
                )

                # Parse response
                import json
                result_text = response.content[0].text

                # Try to extract JSON from response
                if "```json" in result_text:
                    result_text = result_text.split("```json")[1].split("```")[0].strip()
                elif "```" in result_text:
                    result_text = result_text.split("```")[1].split("```")[0].strip()

                result = json.loads(result_text)

                logger.info(f"✅ Claude evaluation: {result['decision']} ({result.get('confidence_delta', 0.0):+.2f})")

                return result

            except Exception as e:
                logger.error(f"❌ Claude evaluation failed: {e}")
                # Fallback to simple keyword matching
                return self._fallback_evaluation(content, hypothesis, hop_type)

        def _fallback_evaluation(self, content, hypothesis, hop_type):
            """Fallback evaluation using keyword matching"""
            content_lower = content.lower()
            category = hypothesis["category"].lower()

            # Simple keyword-based decision
            if hop_type == "CAREERS_PAGE":
                if "digital transformation" in content_lower and "manager" in content_lower:
                    return {
                        "decision": "ACCEPT",
                        "confidence_delta": 0.06,
                        "reasoning": "Found senior digital transformation role (keyword match)",
                        "evidence_strength": "HIGH",
                        "quotes": ["Digital transformation role found"]
                    }
                elif "react" in content_lower and "developer" in content_lower:
                    return {
                        "decision": "ACCEPT",
                        "confidence_delta": 0.06,
                        "reasoning": "Found React developer role (keyword match)",
                        "evidence_strength": "HIGH",
                        "quotes": ["React developer"]
                    }

            return {
                "decision": "NO_PROGRESS",
                "confidence_delta": 0.00,
                "reasoning": "No clear evidence found (fallback keyword matching)",
                "evidence_strength": "LOW",
                "quotes": []
            }

else:
    logger.info("🎭 Using MOCK clients (no API keys or --mock flag specified)")
    logger.info("   To use real APIs: Set BRIGHTDATA_API_TOKEN and ANTHROPIC_API_KEY in .env")


# =============================================================================
# MOCK IMPLEMENTATIONS (fallback when no API keys)
# =============================================================================

class MockBrightDataClient:
    """
    Mock BrightData client for demonstration

    In production, BrightDataSDKClient provides:
    - HTTP-based search (no AI, just web scraping)
    - Google/Bing/Yandex SERP results
    - Markdown content extraction
    - Automatic proxy rotation and anti-bot protection
    """

    async def search_engine(self, query, engine="google", num_results=1):
        """
        Mock search that returns realistic ICF results

        Production behavior:
        1. POST request to BrightData servers with query
        2. BrightData executes search via proxy network
        3. Returns SERP with position, title, URL, snippet
        """

        logger.info(f"🔍 [MOCK] Searching: {query} (would use BrightData SDK HTTP API in production)")

        # Simulate search results based on query
        if "official website" in query.lower():
            return {
                "status": "success",
                "query": query,
                "results": [{
                    "position": 1,
                    "title": "International Canoe Federation (ICF) - Official Site",
                    "url": "https://www.canoeicf.com",
                    "snippet": "The International Canoe Federation (ICF) is the world governing body for canoe sport..."
                }]
            }
        elif "careers" in query.lower() or "jobs" in query.lower():
            return {
                "status": "success",
                "query": query,
                "results": [{
                    "position": 1,
                    "title": "Careers & Opportunities - ICF",
                    "url": "https://www.canoeicf.com/careers",
                    "snippet": "Join our team... Digital Transformation Manager..."
                }]
            }
        elif "news" in query.lower() or "press" in query.lower():
            return {
                "status": "success",
                "query": query,
                "results": [{
                    "position": 1,
                    "title": "ICF Announces Digital Transformation Initiative",
                    "url": "https://www.sports-tech-news.com/icf-digital-transformation",
                    "snippet": "The International Canoe Federation announces a major digital transformation..."
                }]
            }
        elif "partnership" in query.lower():
            return {
                "status": "success",
                "query": query,
                "results": [{
                    "position": 1,
                    "title": "ICF Partners with Tech Giants for Fan Platform",
                    "url": "https://www.partnership-hub.com/icf-fan-platform",
                    "snippet": "The International Canoe Federation partners with React Mobile for..."
                }]
            }
        else:
            return {
                "status": "error",
                "error": "No results found",
                "query": query
            }

    async def scrape_as_markdown(self, url):
        """
        Mock scraping that returns realistic ICF content

        Production behavior:
        1. POST request to BrightData servers with URL
        2. BrightData fetches content via proxy (handles anti-bot)
        3. Returns cleaned markdown (not raw HTML)
        """

        logger.info(f"🌐 [MOCK] Scraping: {url} (would use BrightData SDK HTTP API in production)")

        # Simulate scraped content based on URL
        if "canoeicf.com" in url:
            if "/careers" in url:
                return {
                    "status": "success",
                    "url": url,
                    "content": """# Careers at ICF

## Open Positions

### Digital Transformation Manager
- **Location**: Lausanne, Switzerland (HQ)
- **Type**: Full-time
- **Posted**: November 2024 (2 months ago)

**Requirements:**
- 5+ years experience in digital transformation
- Experience with sports federation operations
- Knowledge of CRM platforms (Salesforce, SAP preferred)
- Project management certification (PMP, PRINCE2)

**Responsibilities:**
- Lead ICF's digital transformation initiative
- Manage CRM platform migration and optimization
- Coordinate with 138 national federations
- Oversee fan engagement platform development

**Salary:** Competitive (CHF 120,000-150,000)

### React Native Developer
- **Location**: Remote / Lausanne
- **Type**: Full-time
- **Posted**: December 2024 (1 month ago)

**Requirements:**
- 3+ years React Native experience
- Experience with mobile app development
- Knowledge of sports industry preferred

**Responsibilities:**
- Develop ICF mobile application for fans and athletes
- Work with design team to implement UI/UX
- Collaborate with backend team on API integration

## About ICF
The International Canoe Federation (ICF) is the world governing body for canoe sport, representing 138 national federations across 5 continents.
"""
                }
            else:
                return {
                    "status": "success",
                    "url": url,
                    "content": """# International Canoe Federation (ICF)

## Official Website of the World Governing Body for Canoe Sport

## About Us
The International Canoe Federation (ICF) is the world governing body for canoe sport, representing 138 national federations across 5 continents.

## Our Mission
- Develop and promote canoe sport worldwide
- Organize world championships and Olympic events
- Support national federations with governance and resources

## Digital Initiatives
ICF is currently undertaking a major digital transformation to:
- Modernize our CRM platform (currently using legacy systems)
- Launch a comprehensive mobile app for fans and athletes
- Enhance our digital presence across all platforms
- Improve data analytics and reporting capabilities

## Technology Stack
- Current: Legacy on-premise CRM (outdated)
- Target: Salesforce or SAP cloud-based CRM
- Mobile: React Native for cross-platform apps
- Analytics: Tableau for dashboards and reporting

## Partners
We work closely with:
- International Olympic Committee (IOC)
- National federations (138 worldwide)
- Technology partners for digital initiatives
"""
                }

        elif "sports-tech-news.com" in url:
            return {
                "status": "success",
                "url": url,
                "content": """# ICF Announces Digital Transformation Initiative

**Lausanne, Switzerland - December 15, 2024**

The International Canoe Federation (ICF) announced today a major digital transformation initiative to modernize its technology infrastructure and enhance digital services for its 138 national federations worldwide.

## Key Initiatives

### 1. CRM Platform Migration
"We are currently evaluating cloud-based CRM platforms to replace our legacy on-premise system," said Albert Schmidt, CTO of ICF. "Our goal is to improve data management and reporting capabilities across all federations."

### 2. Mobile App Development
ICF plans to launch a comprehensive mobile application in 2025 to serve:
- Fans (live streaming, results, athlete profiles)
- Athletes (training schedules, performance data)
- National federations (resources, governance documents)

### 3. Enhanced Analytics
The federation will implement advanced analytics dashboards using Tableau to provide:
- Real-time event tracking
- Athlete performance analytics
- Engagement metrics across digital platforms

## Timeline
- Q1 2025: CRM platform selection
- Q2 2025: Mobile app development kickoff
- Q3 2025: Analytics dashboard launch
- Q4 2025: Full digital transformation completion

## Partners
ICF has selected React Mobile as the primary development partner for the mobile app initiative.
"""
            }

        elif "partnership-hub.com" in url:
            return {
                "status": "success",
                "url": url,
                "content": """# ICF Partners with React Mobile for Fan Platform

**Lausanne, Switzerland - January 10, 2025**

The International Canoe Federation (ICF) today announced a strategic partnership with React Mobile, a leading cross-platform mobile development company, to build a comprehensive fan and athlete engagement platform.

## Partnership Details

### Scope
- **Multi-year contract**: 3-year partnership agreement
- **Platform**: Native mobile apps for iOS and Android
- **Features**: Live streaming, real-time results, athlete profiles, training resources

### Technology
React Mobile will use React Native to ensure consistent experience across platforms, with planned features including:
- Push notifications for event results
- Integration with ICF's existing timing systems
- Social media integration and sharing capabilities

### Investment
While specific terms were not disclosed, industry sources estimate the partnership value at CHF 2-3 million over the 3-year period.

### Strategic Importance
"This partnership represents a significant step in our digital transformation journey," said Albert Schmidt, CTO of ICF. "The mobile platform will be central to our engagement strategy for the 2028 Olympic cycle."

## Expected Launch
The mobile app is expected to launch in Q2 2025, with continuous updates and enhancements planned through 2027.
"""
            }

        else:
            return {
                "status": "error",
                "error": "URL not found in mock database",
                "url": url
            }

class MockClaudeClient:
    """
    Mock Claude client for demonstration

    In production, this would use ClaudeClient with model cascade:
    - Haiku ($0.25/M tokens): Fast data extraction (80% of calls)
    - Sonnet ($3.00/M tokens): Balanced analysis (15% of calls)
    - Opus ($15.00/M tokens): Deep strategic reasoning (5% of calls)
    """

    async def evaluate_evidence(self, content, hypothesis, hop_type):
        """
        Mock evaluation that simulates Claude reasoning

        Production behavior:
        1. Haiku extracts keywords and patterns from content
        2. Sonnet evaluates evidence strength and relevance
        3. Opus provides deep strategic analysis for high-value signals
        """

        logger.info(f"🧠 [MOCK] Evaluating evidence (model: haiku → would use real Claude in production)")

        content_lower = content.lower()

        # Simulate Claude's decision-making
        if hop_type == "CAREERS_PAGE":
            if "digital transformation manager" in content_lower:
                return {
                    "decision": "ACCEPT",
                    "confidence_delta": 0.06,
                    "reasoning": "Found senior 'Digital Transformation Manager' role with CRM requirements, directly indicating digital transformation procurement",
                    "evidence_strength": "HIGH",
                    "quotes": ["Digital Transformation Manager", "CRM platforms", "Salesforce, SAP"]
                }
            elif "react native developer" in content_lower:
                return {
                    "decision": "ACCEPT",
                    "confidence_delta": 0.06,
                    "reasoning": "Found 'React Native Developer' role, confirming mobile app development procurement",
                    "evidence_strength": "HIGH",
                    "quotes": ["React Native", "mobile app"]
                }
            else:
                return {
                    "decision": "NO_PROGRESS",
                    "confidence_delta": 0.00,
                    "reasoning": "Found job postings but not directly related to hypothesis category",
                    "evidence_strength": "LOW"
                }

        elif hop_type == "OFFICIAL_SITE":
            if "digital transformation" in content_lower and "crm" in content_lower:
                return {
                    "decision": "ACCEPT",
                    "confidence_delta": 0.04,
                    "reasoning": "Official site mentions digital transformation initiative with CRM migration plans",
                    "evidence_strength": "MEDIUM",
                    "quotes": ["digital transformation", "CRM platform migration", "Salesforce or SAP"]
                }
            elif "mobile app" in content_lower:
                return {
                    "decision": "WEAK_ACCEPT",
                    "confidence_delta": 0.02,
                    "reasoning": "Official site mentions mobile app plans but less specific than job postings",
                    "evidence_strength": "MEDIUM",
                    "quotes": ["mobile application", "React Native"]
                }
            else:
                return {
                    "decision": "NO_PROGRESS",
                    "confidence_delta": 0.00,
                    "reasoning": "Official site content is general information, no specific procurement signals",
                    "evidence_strength": "LOW"
                }

        elif hop_type == "PRESS_RELEASE" or "TECH_NEWS":
            if "digital transformation initiative" in content_lower:
                return {
                    "decision": "ACCEPT",
                    "confidence_delta": 0.06,
                    "reasoning": "Press release officially announces digital transformation initiative with timeline and budget",
                    "evidence_strength": "HIGH",
                    "quotes": ["digital transformation initiative", "Q1 2025: CRM platform selection"]
                }
            elif "partnership" in content_lower and "react mobile" in content_lower:
                return {
                    "decision": "ACCEPT",
                    "confidence_delta": 0.06,
                    "reasoning": "Partnership announcement confirms mobile app development with multi-year contract",
                    "evidence_strength": "HIGH",
                    "quotes": ["multi-year contract", "CHF 2-3 million", "3-year partnership"]
                }
            else:
                return {
                    "decision": "NO_PROGRESS",
                    "confidence_delta": 0.00,
                    "reasoning": "Press release exists but doesn't contain strong procurement signals",
                    "evidence_strength": "LOW"
                }

        else:
            return {
                "decision": "NO_PROGRESS",
                "confidence_delta": 0.00,
                "reasoning": "Content type not relevant to hypothesis evaluation",
                "evidence_strength": "LOW"
            }


# =============================================================================
# WORKING EXAMPLE: ICF MULTI-PASS DISCOVERY
# =============================================================================

async def run_icf_discovery_example():
    """
    Complete working example of multi-pass discovery for International Canoe Federation
    """

    print("\n" + "="*80)
    print("MULTI-PASS RFP DISCOVERY: International Canoe Federation (ICF)")
    print("="*80 + "\n")

    # Initialize clients (real or mock)
    if USE_REAL_CLIENTS:
        try:
            brightdata = BrightDataSDKClient()
            claude = ClaudeClientWrapper()  # Use the wrapper class explicitly
            logger.info("✅ Real clients initialized successfully")
        except Exception as e:
            logger.error(f"❌ Failed to initialize real clients: {e}")
            logger.info("🎭 Falling back to mock clients")
            brightdata = MockBrightDataClient()
            claude = MockClaudeClient()
    else:
        brightdata = MockBrightDataClient()
        claude = MockClaudeClient()

    # =============================================================================
    # STEP 1: INITIALIZE ENTITY
    # =============================================================================

    print("🏛️  STEP 1: Initialize Entity\n")

    entity = {
        "entity_id": "international-canoe-federation",
        "entity_name": "International Canoe Federation",
        "entity_type": "SPORTS_FEDERATION",
        "metadata": {
            "founded": "1946",
            "headquarters": "Lausanne, Switzerland",
            "members": 138,
            "continents": 5
        }
    }

    print(f"  Entity: {entity['entity_name']}")
    print(f"  Type: {entity['entity_type']}")
    print(f"  Members: {entity['metadata']['members']} national federations")
    print(f"  HQ: {entity['metadata']['headquarters']}\n")

    # =============================================================================
    # STEP 2: GENERATE INITIAL HYPOTHESES (Dossier-Informed)
    # =============================================================================

    print("📋 STEP 2: Generate Initial Hypotheses (Dossier-Informed)\n")

    # Simulating dossier analysis
    dossier_needs = [
        {
            "category": "Digital Transformation",
            "description": "ICF announces digital transformation initiative with CRM migration",
            "evidence": "Press release December 2024",
            "confidence": 0.70
        },
        {
            "category": "Mobile Development",
            "description": "ICF plans mobile app for fans and athletes",
            "evidence": "Official website mentions mobile app plans",
            "confidence": 0.60
        }
    ]

    # Yellow Panther capabilities (for matching)
    yp_capabilities = {
        "Digital Transformation": "End-to-end digital modernization",
        "Mobile Development": "Cross-platform mobile applications (React Native)",
        "React Web Development": "Modern React.js web applications",
        "React Mobile Development": "Cross-platform mobile applications",
        "CRM Implementation": "Salesforce, SAP, Microsoft Dynamics"
    }

    # Generate hypotheses matched to YP capabilities
    initial_hypotheses = []

    for need in dossier_needs:
        yp_match = yp_capabilities.get(need["category"])
        if yp_match:
            hypothesis = {
                "hypothesis_id": f"icf_{need['category'].lower().replace(' ', '_')}",
                "entity_id": entity["entity_id"],
                "category": need["category"],
                "statement": f"International Canoe Federation seeking {yp_match}",
                "prior_probability": need["confidence"],
                "confidence": need["confidence"],
                "status": "ACTIVE",
                "iterations_attempted": 0,
                "expected_information_gain": 0.0,  # Will be calculated
                "metadata": {
                    "yp_capability": yp_match,
                    "dossier_derived": True,
                    "evidence": need["evidence"]
                }
            }
            initial_hypotheses.append(hypothesis)

            print(f"  ✓ {hypothesis['category']}")
            print(f"    Statement: {hypothesis['statement']}")
            print(f"    YP Service: {yp_match}")
            print(f"    Initial Confidence: {hypothesis['confidence']:.2f}\n")

    # =============================================================================
    # STEP 3: CALCULATE EIG (Expected Information Gain)
    # =============================================================================

    print("📊 STEP 3: Calculate EIG (Expected Information Gain)\n")

    # EIG formula: (1 - confidence) × novelty × information_value
    category_multipliers = {
        "Digital Transformation": 1.3,  # High value
        "Mobile Development": 1.2,     # Medium-high value
        "CRM Implementation": 1.2        # Medium-high value
    }

    for hyp in initial_hypotheses:
        # Calculate EIG
        uncertainty = 1 - hyp["confidence"]
        novelty = 0.8  # Assume moderate novelty (not seen frequently)
        info_value = category_multipliers.get(hyp["category"], 1.0)

        eig = uncertainty * novelty * info_value
        hyp["expected_information_gain"] = eig

        print(f"  Hypothesis: {hyp['category']}")
        print(f"    Uncertainty: {uncertainty:.2f} (1 - {hyp['confidence']:.2f})")
        print(f"    Novelty: {novelty:.2f}")
        print(f"    Info Value: {info_value:.2f} (category multiplier)")
        print(f"    EIG: {eig:.3f}\n")

    # Sort hypotheses by EIG
    initial_hypotheses.sort(key=lambda h: h["expected_information_gain"], reverse=True)

    # =============================================================================
    # STEP 4: PASS 1 - Initial Discovery
    # =============================================================================

    print("🔍 PASS 1: Initial Discovery (3 iterations)")
    print("-" * 80 + "\n")

    pass_1_results = []

    for iteration in range(3):
        print(f"\nIteration {iteration + 1}/3")

        # Re-sort hypotheses by EIG and select top one
        # (EIG changes as confidence gets updated)
        initial_hypotheses.sort(key=lambda h: h["expected_information_gain"], reverse=True)
        top_hypothesis = initial_hypotheses[0]

        print(f"  Selected Hypothesis: {top_hypothesis['category']}")
        print(f"  EIG: {top_hypothesis['expected_information_gain']:.3f}")

        # MCP-guided hop selection (simplified)
        hop_type = select_hop_type(top_hypothesis, iteration)

        print(f"  Hop Type: {hop_type}")

        # Get URL (via search)
        query = generate_search_query(entity["entity_name"], hop_type)
        print(f"  Search Query: {query}")

        search_result = await brightdata.search_engine(query, engine="google", num_results=1)

        if search_result["status"] == "success":
            url = search_result["results"][0]["url"]
            print(f"  Found URL: {url}")

            # Scrape content
            scrape_result = await brightdata.scrape_as_markdown(url)

            if scrape_result["status"] == "success":
                content = scrape_result["content"]
                print(f"  Scraped {len(content)} characters")

                # Evaluate with Claude
                evaluation = await claude.evaluate_evidence(
                    content=content,
                    hypothesis=top_hypothesis,
                    hop_type=hop_type
                )

                print(f"  Decision: {evaluation['decision']}")
                print(f"  Confidence Delta: {evaluation['confidence_delta']:+.2f}")
                print(f"  Reasoning: {evaluation['reasoning'][:100]}...")

                # Update hypothesis
                old_confidence = top_hypothesis["confidence"]
                top_hypothesis["confidence"] += evaluation["confidence_delta"]
                top_hypothesis["iterations_attempted"] += 1

                if evaluation["decision"] == "ACCEPT":
                    top_hypothesis["iterations_accepted"] = top_hypothesis.get("iterations_accepted", 0) + 1
                elif evaluation["decision"] == "REJECT":
                    top_hypothesis["iterations_rejected"] = top_hypothesis.get("iterations_rejected", 0) + 1
                else:
                    top_hypothesis["iterations_no_progress"] = top_hypothesis.get("iterations_no_progress", 0) + 1

                print(f"  Updated Confidence: {old_confidence:.2f} → {top_hypothesis['confidence']:.2f}")

                # Recalculate EIG with updated confidence
                category_multipliers = {
                    "Digital Transformation": 1.3,
                    "Mobile Development": 1.2,
                    "CRM Implementation": 1.2
                }
                uncertainty = 1 - top_hypothesis["confidence"]
                novelty = 0.8
                info_value = category_multipliers.get(top_hypothesis["category"], 1.0)
                top_hypothesis["expected_information_gain"] = uncertainty * novelty * info_value

                # Store result
                pass_1_results.append({
                    "iteration": iteration + 1,
                    "hypothesis": top_hypothesis["category"],
                    "hop_type": hop_type,
                    "url": url,
                    "decision": evaluation["decision"],
                    "confidence_delta": evaluation["confidence_delta"],
                    "reasoning": evaluation["reasoning"]
                })
        else:
            print(f"  ❌ Search failed: {search_result.get('error')}")

    # =============================================================================
    # STEP 5: PASS 2 - Network Context (Evolved Hypotheses)
    # =============================================================================

    print("\n" + "="*80)
    print("🔍 PASS 2: Network Context (Evolved Hypotheses)")
    print("="*80 + "\n")

    # Generate evolved hypotheses from Pass 1 discoveries
    evolved_hypotheses = generate_evolved_hypotheses(pass_1_results, entity["entity_id"])

    print(f"Generated {len(evolved_hypotheses)} evolved hypotheses:\n")

    for hyp in evolved_hypotheses:
        print(f"  ✓ {hyp['category']}")
        print(f"    Statement: {hyp['statement']}")
        print(f"    Prior Confidence: {hyp['prior_probability']:.2f}")
        print(f"    Derived From: {hyp['metadata']['derived_from_signal']}\n")

    # Select top evolved hypothesis
    if evolved_hypotheses:
        top_evolved = evolved_hypotheses[0]

        print(f"Selected: {top_evolved['category']}")
        print(f"EIG: {top_evolved['expected_information_gain']:.3f}\n")

        # Execute hop
        hop_type = "PARTNERSHIP"  # Based on evolved hypothesis

        print(f"Hop Type: {hop_type}")

        query = generate_search_query(entity["entity_name"], hop_type)
        print(f"Search Query: {query}")

        search_result = await brightdata.search_engine(query, engine="google", num_results=1)

        if search_result["status"] == "success":
            url = search_result["results"][0]["url"]
            print(f"Found URL: {url}")

            scrape_result = await brightdata.scrape_as_markdown(url)

            if scrape_result["status"] == "success":
                content = scrape_result["content"]
                print(f"Scraped {len(content)} characters")

                evaluation = await claude.evaluate_evidence(
                    content=content,
                    hypothesis=top_evolved,
                    hop_type=hop_type
                )

                print(f"Decision: {evaluation['decision']}")
                print(f"Confidence Delta: {evaluation['confidence_delta']:+.2f}")
                print(f"Reasoning: {evaluation['reasoning'][:100]}...")

                # Update hypothesis
                top_evolved["confidence"] += evaluation["confidence_delta"]

                print(f"Updated Confidence: {top_evolved['confidence']:.2f}\n")

    # =============================================================================
    # STEP 6: GENERATE FINAL OPPORTUNITY REPORT
    # =============================================================================

    print("\n" + "="*80)
    print("📋 FINAL OPPORTUNITY REPORT")
    print("="*80 + "\n")

    # Collect all validated signals
    all_signals = []

    for result in pass_1_results:
        if result["decision"] in ["ACCEPT", "WEAK_ACCEPT"]:
            all_signals.append({
                "pass": 1,
                "category": result["hypothesis"],
                "signal_type": result["decision"],
                "confidence": result.get("final_confidence", 0.6),
                "url": result["url"],
                "evidence": result["reasoning"][:200],
                "yp_service": match_to_yp_service(result["hypothesis"])
            })

    if evolved_hypotheses and evolved_hypotheses[0].get("confidence_delta", 0) > 0:
        all_signals.append({
            "pass": 2,
            "category": top_evolved["category"],
            "signal_type": "ACCEPT",
            "confidence": top_evolved["confidence"],
            "evidence": "Partnership announcement confirms mobile app development",
            "yp_service": "React Mobile Development"
        })

    # Generate report
    print(f"Total Opportunities: {len(all_signals)}\n")

    for i, signal in enumerate(all_signals, 1):
        print(f"{i}. {signal['category']}")
        print(f"   Confidence: {signal['confidence']:.2f}")
        print(f"   Signal Type: {signal['signal_type']}")
        print(f"   YP Service: {signal['yp_service']}")
        print(f"   Evidence: {signal['evidence'][:150]}...")

        # Recommended action
        if signal["confidence"] >= 0.70:
            action = "🎯 Immediate outreach (high confidence)"
        elif signal["confidence"] >= 0.60:
            action = "📞 Engage sales team (medium confidence)"
        else:
            action = "👀 Add to watchlist (low confidence)"

        print(f"   Action: {action}")
        print()

    # =============================================================================
    # STEP 7: SUMMARY STATISTICS
    # =============================================================================

    print("="*80)
    print("SUMMARY STATISTICS")
    print("="*80 + "\n")

    # Calculate metrics
    total_iterations = sum(r.get("iteration", 1) for r in pass_1_results)
    accept_count = sum(1 for r in pass_1_results if r["decision"] == "ACCEPT")
    weak_accept_count = sum(1 for r in pass_1_results if r["decision"] == "WEAK_ACCEPT")
    reject_count = sum(1 for r in pass_1_results if r["decision"] == "REJECT")
    no_progress_count = sum(1 for r in pass_1_results if r["decision"] == "NO_PROGRESS")

    print(f"Total Iterations: {total_iterations}")
    print(f"ACCEPT: {accept_count}")
    print(f"WEAK_ACCEPT: {weak_accept_count}")
    print(f"REJECT: {reject_count}")
    print(f"NO_PROGRESS: {no_progress_count}")
    print()

    # Success rate
    success_rate = (accept_count + weak_accept_count) / total_iterations * 100 if total_iterations > 0 else 0
    print(f"Success Rate: {success_rate:.1f}%")
    print()

    # High-confidence opportunities
    high_confidence = [s for s in all_signals if s["confidence"] >= 0.70]
    print(f"High-Confidence Opportunities (≥0.70): {len(high_confidence)}")
    for sig in high_confidence:
        print(f"  - {sig['category']}: {sig['confidence']:.2f} ({sig['yp_service']})")

    print()

    # Estimated value
    total_value = sum(
        estimate_opportunity_value(sig["category"], sig["confidence"])
        for sig in all_signals
    )
    print(f"Estimated Opportunity Value: ${total_value:,.0f} USD")


def select_hop_type(hypothesis, iteration):
    """
    Simplified MCP-guided hop selection

    In production, this uses: Score = Channel_ROI × EIG
    """

    category = hypothesis["category"]

    # Simplified hop type mapping (production uses MCP-guided scoring)
    hop_sequence = {
        0: "CAREERS_PAGE",      # Job postings (high ROI)
        1: "OFFICIAL_SITE",     # Official announcements
        2: "TECH_NEWS",         # News articles
        3: "PRESS_RELEASE"      # Press releases
    }

    return hop_sequence.get(iteration % 4, "OFFICIAL_SITE")


def generate_search_query(entity_name, hop_type):
    """Generate search query from hop type"""

    queries = {
        "CAREERS_PAGE": f'"{entity_name}" careers jobs',
        "OFFICIAL_SITE": f'"{entity_name}" official website',
        "TECH_NEWS": f'"{entity_name}" technology news digital transformation',
        "PRESS_RELEASE": f'"{entity_name}" recent news press release',
        "PARTNERSHIP": f'"{entity_name}" partnership announcement'
    }

    return queries.get(hop_type, f'"{entity_name}" official website')


def generate_evolved_hypotheses(pass_results, entity_id):
    """
    Generate evolved hypotheses from discovery results

    This demonstrates how Pass 1 discoveries inform Pass 2 hypotheses
    """

    evolved = []

    # Look for Digital Transformation signals
    dt_signals = [r for r in pass_results if r["decision"] == "ACCEPT" and "digital" in r["hypothesis"].lower()]

    if dt_signals:
        evolved.append({
            "hypothesis_id": f"{entity_id}_crm_platform",
            "entity_id": entity_id,
            "category": "CRM Implementation",
            "statement": f"International Canoe Federation seeking CRM platform implementation as part of digital transformation",
            "prior_probability": 0.65,
            "confidence": 0.65,
            "status": "ACTIVE",
            "iterations_attempted": 0,
            "expected_information_gain": 0.35,
            "metadata": {
                "derived_from_signal": "digital_transformation_initiative",
                "derived_from_pass": 1,
                "generation_method": "follow_up"
            }
        })

    return evolved


def match_to_yp_service(category):
    """Match signal category to YP service"""

    yp_mapping = {
        "Digital Transformation": "Digital Transformation",
        "Mobile Development": "React Mobile Development",
        "CRM Implementation": "CRM Implementation"
    }

    return yp_mapping.get(category, "General Consulting")


def estimate_opportunity_value(category, confidence):
    """Estimate opportunity value in USD"""

    base_values = {
        "Digital Transformation": 400000,
        "Mobile Development": 250000,
        "CRM Implementation": 300000
    }

    base = base_values.get(category, 100000)
    return base * confidence


# =============================================================================
# MAIN EXECUTION
# =============================================================================

if __name__ == "__main__":
    print("\n🚀 Starting Multi-Pass Discovery Demo for ICF\n")

    # Show API key status
    if USE_REAL_CLIENTS:
        print("✅ Mode: REAL API CLIENTS")
        print(f"   BrightData: {'✅ Configured' if HAS_BRIGHTDATA_KEY else '❌ Missing BRIGHTDATA_API_TOKEN'}")
        print(f"   Claude: {'✅ Configured' if HAS_CLAUDE_KEY else '❌ Missing ANTHROPIC_API_KEY'}")
        print()
    else:
        print("🎭 Mode: MOCK CLIENTS")
        if "--mock" in sys.argv:
            print("   Reason: --mock flag specified")
        else:
            print("   Reason: Missing API keys")
            if not HAS_BRIGHTDATA_KEY:
                print("   ❌ BRIGHTDATA_API_TOKEN not found in .env")
            if not HAS_CLAUDE_KEY:
                print("   ❌ ANTHROPIC_API_KEY not found in .env")
        print()
        print("   To use real APIs:")
        print("   1. Create .env file with:")
        print("      BRIGHTDATA_API_TOKEN=your_token_here")
        print("      ANTHROPIC_API_KEY=your_key_here")
        print("   2. Run: python working_example_icf.py")
        print()

    # Run the example
    asyncio.run(run_icf_discovery_example())

    print("\n" + "="*80)
    print("DEMO COMPLETE")
    print("="*80 + "\n")

    print("What you just saw:")
    print("  ✅ Dossier-informed hypothesis generation")
    print("  ✅ EIG-based hypothesis prioritization")
    print("  ✅ MCP-guided hop selection")
    print("  ✅ BrightData search & scraping")
    print("  ✅ Claude evidence evaluation")
    print("  ✅ Multi-pass hypothesis evolution")
    print("  ✅ Final opportunity report")
    print()
    print("This demonstrates the complete adaptive feedback loop where:")
    print("  1. Evidence collected → 2. Claude evaluates → 3. Hypothesis updated →")
    print("  4. EIG recalculated → 5. Next hop adapted → 6. Repeat")
    print()
