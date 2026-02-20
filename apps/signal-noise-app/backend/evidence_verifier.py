"""
Evidence Verification Service

Validates evidence by:
1. Checking URLs are accessible
2. Verifying content matches claims
3. Validating source credibility
4. Checking recency of evidence
"""

import asyncio
import aiohttp
from datetime import datetime, timedelta
from typing import Dict, List, Optional
from urllib.parse import urlparse
import re
import logging

logger = logging.getLogger(__name__)


class EvidenceVerifier:
    """Verifies evidence quality and authenticity"""

    def __init__(self):
        self.session = None
        self.verification_cache = {}  # Cache verification results

        # Trusted domains with base credibility scores
        self.trusted_sources = {
            "linkedin.com": 0.85,
            "brightdata.com": 0.82,
            "crunchbase.com": 0.80,
            "twitter.com": 0.75,
            "x.com": 0.75,
            "news.google.com": 0.78,
            "reuters.com": 0.90,
            "bloomberg.com": 0.88,
            "techcrunch.com": 0.82,
            "arsenal.com": 0.95,  # Official club site
            "manutd.com": 0.95,
            "chelseafc.com": 0.95,
        }

    async def verify_evidence(self, evidence: Dict) -> Dict:
        """
        Verify evidence and return adjusted credibility score

        Returns:
            Dict with:
                - verified: bool
                - url_accessible: bool
                - content_matches: bool
                - actual_credibility: float
                - verification_details: dict
        """
        url = evidence.get("url", "")
        source = evidence.get("source", "")
        claimed_credibility = evidence.get("credibility_score", 0.5)
        claimed_text = evidence.get("text", "")
        date_str = evidence.get("date", "")

        result = {
            "verified": False,
            "url_accessible": False,
            "content_matches": False,
            "source_trusted": False,
            "claimed_credibility": claimed_credibility,
            "actual_credibility": 0.0,
            "verification_details": {},
            "issues": []
        }

        # Step 1: Verify URL is accessible
        if url:
            url_result = await self._verify_url(url)
            result["url_accessible"] = url_result["accessible"]
            result["verification_details"]["url"] = url_result

            if not url_result["accessible"]:
                result["issues"].append(f"URL not accessible: {url}")
                # Penalize heavily for fake/broken URLs
                result["actual_credibility"] = max(0.0, claimed_credibility - 0.3)
                return result

        # Step 2: Validate source credibility
        source_result = await self._validate_source(source, url)
        result["source_trusted"] = source_result["trusted"]
        result["verification_details"]["source"] = source_result

        base_credibility = source_result["credibility"]

        # Step 3: Check recency
        recency_result = self._check_recency(date_str)
        result["verification_details"]["recency"] = recency_result

        # Adjust credibility based on recency
        if not recency_result["recent"]:
            result["issues"].append(f"Evidence is old: {date_str}")
            base_credibility -= 0.1

        # Step 4: Verify content if URL provided
        if url and claimed_text:
            content_result = await self._verify_content(url, claimed_text)
            result["content_matches"] = content_result["matches"]
            result["verification_details"]["content"] = content_result

            if content_result["matches"]:
                base_credibility += 0.05  # Boost for verified content
            else:
                result["issues"].append("Content does not match claims")
                base_credibility -= 0.15  # Penalize for mismatch

        # Final credibility calculation
        result["actual_credibility"] = max(0.0, min(1.0, base_credibility))

        # Consider verified if no major issues
        result["verified"] = len(result["issues"]) == 0 and result["actual_credibility"] >= 0.5

        return result

    async def _verify_url(self, url: str, timeout: int = 5) -> Dict:
        """Check if URL is accessible"""
        try:
            # Parse URL to get domain
            parsed = urlparse(url)
            domain = parsed.netloc.lower()

            # Remove www. prefix
            if domain.startswith("www."):
                domain = domain[4:]

            async with aiohttp.ClientSession() as session:
                async with session.head(
                    url,
                    timeout=aiohttp.ClientTimeout(total=timeout),
                    allow_redirects=True,
                    headers={"User-Agent": "Mozilla/5.0"}
                ) as response:
                    return {
                        "accessible": response.status == 200,
                        "status_code": response.status,
                        "domain": domain,
                        "final_url": str(response.url),
                        "content_type": response.headers.get("Content-Type", ""),
                    }
        except asyncio.TimeoutError:
            return {"accessible": False, "error": "timeout"}
        except Exception as e:
            return {"accessible": False, "error": str(e)}

    async def _validate_source(self, source: str, url: str) -> Dict:
        """Validate source credibility"""
        credibility = 0.5  # Default for unknown sources
        trusted = False

        # Check if source is in trusted list
        for trusted_domain, score in self.trusted_sources.items():
            if trusted_domain in source.lower():
                credibility = score
                trusted = True
                break

        # Extract domain from URL and check
        if url:
            try:
                parsed = urlparse(url)
                domain = parsed.netloc.lower()

                for trusted_domain, score in self.trusted_sources.items():
                    if trusted_domain in domain:
                        credibility = max(credibility, score)
                        trusted = True
                        break
            except:
                pass

        return {
            "trusted": trusted,
            "credibility": credibility,
            "source_name": source,
        }

    def _check_recency(self, date_str: str, max_age_days: int = 30) -> Dict:
        """Check if evidence is recent"""
        if not date_str:
            return {"recent": False, "reason": "no_date"}

        try:
            # Parse date string (try multiple formats)
            for fmt in ["%Y-%m-%d", "%Y-%m-%dT%H:%M:%SZ", "%Y-%m-%dT%H:%M:%S"]:
                try:
                    evidence_date = datetime.strptime(date_str, fmt)
                    break
                except:
                    continue
            else:
                return {"recent": False, "reason": "invalid_date_format"}

            # Check if within max_age_days
            age = (datetime.now() - evidence_date).days
            recent = age <= max_age_days

            return {
                "recent": recent,
                "age_days": age,
                "evidence_date": evidence_date.isoformat(),
            }
        except Exception as e:
            return {"recent": False, "reason": str(e)}

    async def _verify_content(self, url: str, claimed_text: str) -> Dict:
        """
        Verify content matches claims

        Note: This is a simplified version. In production, you'd:
        - Fetch the actual content
        - Use NLP to compare with claimed text
        - Check for key phrases, entities, etc.
        """
        try:
            async with aiohttp.ClientSession() as session:
                async with session.get(
                    url,
                    timeout=aiohttp.ClientTimeout(total=10),
                    headers={"User-Agent": "Mozilla/5.0"}
                ) as response:
                    if response.status != 200:
                        return {"matches": False, "error": f"HTTP {response.status}"}

                    content = await response.text()
                    content_lower = content.lower()

                    # Extract key terms from claimed text
                    claimed_words = set(claimed_text.lower().split())
                    claimed_words = {w for w in claimed_words if len(w) > 3}

                    # Check if key terms appear in content
                    matches = sum(1 for word in claimed_words if word in content_lower)
                    match_ratio = matches / len(claimed_words) if claimed_words else 0

                    # Consider it a match if >30% of key terms appear
                    return {
                        "matches": match_ratio > 0.3,
                        "match_ratio": match_ratio,
                        "terms_found": matches,
                        "total_terms": len(claimed_words),
                        "content_length": len(content),
                    }
        except Exception as e:
            return {"matches": False, "error": str(e)}

    async def verify_all_evidence(self, evidence_list: List[Dict]) -> List[Dict]:
        """Verify all evidence items in parallel"""
        tasks = [self.verify_evidence(ev) for ev in evidence_list]
        results = await asyncio.gather(*tasks, return_exceptions=True)

        verified_evidence = []
        for i, result in enumerate(results):
            if isinstance(result, Exception):
                logger.error(f"Error verifying evidence {i}: {result}")
                verified_evidence.append({
                    "verified": False,
                    "actual_credibility": 0.0,
                    "issues": [f"Verification error: {str(result)}"]
                })
            else:
                verified_evidence.append(result)

        return verified_evidence

    def get_verification_summary(self, verified_evidence: List[Dict]) -> Dict:
        """Get summary of verification results"""
        total = len(verified_evidence)
        verified = sum(1 for v in verified_evidence if v.get("verified", False))

        total_claimed_credibility = sum(v.get("claimed_credibility", 0.5) for v in verified_evidence)
        total_actual_credibility = sum(v.get("actual_credibility", 0.0) for v in verified_evidence)

        all_issues = []
        for v in verified_evidence:
            all_issues.extend(v.get("issues", []))

        return {
            "total_evidence": total,
            "verified_count": verified,
            "verification_rate": verified / total if total > 0 else 0.0,
            "avg_claimed_credibility": total_claimed_credibility / total if total > 0 else 0.0,
            "avg_actual_credibility": total_actual_credibility / total if total > 0 else 0.0,
            "credibility_adjustment": (total_actual_credibility - total_claimed_credibility) / total if total > 0 else 0.0,
            "all_issues": all_issues,
            "has_critical_issues": any("not accessible" in issue for issue in all_issues),
        }


# Usage example
async def main():
    """Test evidence verification"""
    verifier = EvidenceVerifier()

    # Test with real URL
    evidence = [
        {
            "source": "LinkedIn",
            "credibility_score": 0.85,
            "url": "https://linkedin.com",
            "text": "LinkedIn job posting",
            "date": "2026-01-28"
        },
        {
            "source": "Fake Source",
            "credibility_score": 0.90,
            "url": "https://this-domain-definitely-does-not-exist-12345.com",
            "text": "Fake evidence",
            "date": "2026-01-28"
        }
    ]

    verified = await verifier.verify_all_evidence(evidence)

    for i, v in enumerate(verified):
        print(f"\nEvidence {i+1}:")
        print(f"  Claimed credibility: {v['claimed_credibility']}")
        print(f"  Actual credibility: {v['actual_credibility']:.2f}")
        print(f"  Verified: {v['verified']}")
        print(f"  Issues: {v['issues']}")

    summary = verifier.get_verification_summary(verified)
    print(f"\nSummary:")
    print(f"  Verification rate: {summary['verification_rate']:.1%}")
    print(f"  Credibility adjustment: {summary['credibility_adjustment']:+.2f}")


if __name__ == "__main__":
    asyncio.run(main())
