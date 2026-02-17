"""
Search Result Validator using Claude

Validates BrightData search results to ensure relevance before displaying.
Uses Claude Haiku for fast, cost-effective validation.
"""

import logging
import asyncio
from typing import Dict, List, Any, Optional
from datetime import datetime

logger = logging.getLogger(__name__)


class SearchResultValidator:
    """
    Validates search results using Claude to filter out false positives

    Uses Haiku for fast validation (~$0.00025 per 1K tokens)
    """

    def __init__(self, claude_client=None):
        """
        Initialize validator

        Args:
            claude_client: Optional ClaudeClient instance. If None, imports default.
        """
        if claude_client is None:
            from claude_client import ClaudeClient
            claude_client = ClaudeClient()

        self.claude = claude_client
        self.validation_cache = {}  # Simple LRU cache

    async def validate_search_results(
        self,
        results: List[Dict[str, Any]],
        entity_name: str,
        entity_type: str,
        search_query: str,
        hypothesis_context: Optional[str] = None
    ) -> tuple[List[Dict[str, Any]], List[Dict[str, Any]]]:
        """
        Validate search results using Claude

        Args:
            results: List of search results with 'title', 'url', 'snippet'
            entity_name: Name of the entity (e.g., "International Canoe Federation")
            entity_type: Type of entity (e.g., "SPORT_FEDERATION")
            search_query: The original search query
            hypothesis_context: Optional context about what hypothesis we're testing

        Returns:
            Tuple of (valid_results, rejected_results) with validation reasons
        """
        if not results:
            return [], []

        # Batch validate all results at once (more efficient)
        valid_results = []
        rejected_results = []

        # Prepare validation prompt
        results_text = self._format_results_for_validation(results, entity_name, entity_type)

        prompt = f"""You are a search result validator. Your job is to determine which search results are actually relevant to the entity.

Entity: {entity_name} ({entity_type})
Search Query: {search_query}

Hypothesis Context: {hypothesis_context or "Looking for procurement opportunities, job postings, or digital initiatives related to this entity."}

Here are the search results to validate:

{results_text}

For each result, respond with VALID or INVALID followed by a brief reason.
Format: Result 1: VALID/INVALID - reason
Result 2: VALID/INVALID - reason
etc.

Validation criteria:
- VALID: Results from the entity's official websites, verified news sources, or official partners
- VALID: Job postings that are actually from this entity (not similar-sounding entities)
- VALID: RFP/tender documents that mention this specific entity
- INVALID: Results from wrong organizations, even if names sound similar
- INVALID: Generic job boards without entity-specific postings
- INVALID: Unrelated documents that happen to mention some keywords
- INVALID: Results from completely different geographic regions or contexts
- INVALID: Old documents (>3 years old) unless highly relevant

Respond with your analysis:"""

        try:
            response = await self.claude.query(
                prompt=prompt,
                model="haiku",
                max_tokens=1000
            )

            # Parse Claude's response
            validation_decisions = self._parse_validation_response(
                response.get('content', ''),
                len(results)
            )

            for i, result in enumerate(results):
                decision = validation_decisions.get(i, {"valid": False, "reason": "Parse error"})

                result['validation'] = decision

                if decision['valid']:
                    valid_results.append(result)
                else:
                    rejected_results.append(result)

            logger.info(f"✅ Validated {len(results)} results: {len(valid_results)} valid, {len(rejected_results)} rejected")

            return valid_results, rejected_results

        except Exception as e:
            logger.error(f"❌ Validation failed: {e}")
            # On error, return all results as valid (fail-safe)
            return results, []

    def _format_results_for_validation(
        self,
        results: List[Dict[str, Any]],
        entity_name: str,
        entity_type: str
    ) -> str:
        """Format results for Claude validation prompt"""
        formatted = []

        for i, result in enumerate(results, 1):
            title = result.get('title', 'N/A')
            url = result.get('url', 'N/A')
            snippet = result.get('snippet', result.get('content', ''))[:200]

            # Extract domain for context
            domain = url.split('/')[2] if '/' in url else url

            formatted.append(f"""Result {i}:
Title: {title}
URL: {url}
Domain: {domain}
Snippet: {snippet}""")

        return "\n\n".join(formatted)

    def _parse_validation_response(self, response_text: str, num_results: int) -> Dict[int, Dict[str, Any]]:
        """
        Parse Claude's validation response

        Returns dict mapping result index to {valid: bool, reason: str}
        """
        decisions = {}

        lines = response_text.strip().split('\n')

        for line in lines:
            line = line.strip()
            if not line:
                continue

            # Match patterns like "Result 1: VALID - Relevant job posting"
            import re
            match = re.match(r'Result\s+(\d+):\s*(VALID|INVALID)\s*-\s*(.+)', line, re.IGNORECASE)

            if match:
                index = int(match.group(1)) - 1  # Convert to 0-indexed
                valid = match.group(2).upper() == 'VALID'
                reason = match.group(3).strip()

                if 0 <= index < num_results:
                    decisions[index] = {"valid": valid, "reason": reason}

        return decisions

    async def validate_single_result(
        self,
        result: Dict[str, Any],
        entity_name: str,
        entity_type: str
    ) -> Dict[str, Any]:
        """
        Validate a single search result

        Returns validation dict with 'valid' bool and 'reason' str
        """
        valid, rejected = await self.validate_search_results(
            [result],
            entity_name,
            entity_type,
            "single result validation"
        )

        if valid:
            return valid[0].get('validation', {"valid": True, "reason": "Valid"})
        else:
            return {"valid": False, "reason": "Not validated"}


async def demo_validation():
    """
    Demo the post-search validation with ICF examples
    """
    from brightdata_sdk_client import BrightDataSDKClient
    from claude_client import ClaudeClient

    # Sample results (mix of relevant and irrelevant)
    sample_results = [
        {
            "title": "FIT FOR FUTURE EVOLUTION",
            "url": "https://federations.canoeicf.com/sites/default/files/icf_fit_for_future_-_evolution_2024.pdf",
            "snippet": "ICF strategic plan for digital transformation"
        },
        {
            "title": "Emplois operations lead (lausanne, vd)",
            "url": "https://ch-fr.indeed.com/q-operations-lead-lausanne,-vd-emplois.html",
            "snippet": "Job operations lead position in Lausanne"
        },
        {
            "title": "UAE Government Launches New Online Training Platform",
            "url": "https://www.crous-clermont.fr/logement/residence-le-port-2/?s-news-22259874",
            "snippet": "UAE government training platform launch"
        },
        {
            "title": "Paddle Worldwide DXP - Request for Proposal (RFP)",
            "url": "https://www.canoeicf.com/sites/default/files/paddleworldwide_dxp_rfp.pdf",
            "snippet": "ICF seeking digital experience platform"
        },
        {
            "title": "USA Swimming Board of Directors Meeting Minutes",
            "url": "https://websitedevsa.blob.core.windows.net/.../2018-may-12-bod-usas-minutes-w-attachments.pdf",
            "snippet": "Meeting minutes from USA Swimming (different federation)"
        }
    ]

    validator = SearchResultValidator()

    print("=" * 80)
    print("POST-SEARCH VALIDATION DEMO - ICF Search Results")
    print("=" * 80)

    print(f"\n📊 Testing {len(sample_results)} search results for validation:\n")

    valid, rejected = await validator.validate_search_results(
        results=sample_results,
        entity_name="International Canoe Federation",
        entity_type="SPORT_FEDERATION",
        search_query="International Canoe Federation digital transformation",
        hypothesis_context="ICF seeking member federation management platform with mobile app support"
    )

    print(f"\n✅ VALID Results ({len(valid)}):")
    for r in valid:
        validation = r.get('validation', {})
        status = "✅" if validation.get('valid') else "❌"
        print(f"   {status} {r.get('title', 'N/A')[:60]}")
        print(f"      URL: {r.get('url', 'N/A')}")
        print(f"      Reason: {validation.get('reason', 'No reason')}")

    print(f"\n❌ REJECTED Results ({len(rejected)}):")
    for r in rejected:
        validation = r.get('validation', {})
        status = "❌" if validation.get('valid') else "✅"
        print(f"   {status} {r.get('title', 'N/A')[:60]}")
        print(f"      URL: {r.get('url', 'N/A')}")
        print(f"      Reason: {validation.get('reason', 'No reason')}")

    print(f"\n📊 Validation Summary:")
    print(f"   Before: {len(sample_results)} results")
    print(f"   After: {len(valid)} relevant results")
    print(f"   Filtered: {len(rejected)} false positives ({len(rejected)/len(sample_results)*100:.1f}%)")


if __name__ == "__main__":
    asyncio.run(demo_validation())
