"""
Vendor Search Agent - Targeted Vendor Discovery

Specialized agent for discovering specific technology vendors, stakeholders,
and partnerships through intelligent search strategies.

Unlike the general search agent, this agent targets specific procurement signals:
- Job postings requiring specific vendor knowledge
- Press releases announcing vendor partnerships
- Case studies featuring vendor implementations
- LinkedIn profiles revealing vendor expertise

Usage:
    from backend.agents import VendorSearchAgent

    vendor_agent = VendorSearchAgent()
    results = await vendor_agent.discover_vendors(
        entity_name="Arsenal FC",
        categories=["CRM", "Analytics", "ERP"]
    )
"""

import asyncio
import logging
import re
from typing import Dict, List, Any, Optional
from datetime import datetime

logger = logging.getLogger(__name__)


class VendorSearchAgent:
    """
    Specialized agent for targeted vendor discovery.

    Uses intelligent search strategies to identify:
    - Specific technology vendors (Salesforce, SAP, Adobe, etc.)
    - Stakeholders with vendor expertise
    - Vendor partnerships and implementations
    - Procurement signals and opportunities
    """

    # Technology vendor ecosystems
    VENDOR_ECOSYSTEMS = {
        "CRM": [
            "Salesforce", "HubSpot", "Microsoft Dynamics", "Oracle", "SAP",
            "Zendesk", "Pipedrive", "Freshsales", "Insightly"
        ],
        "ANALYTICS": [
            "Google Analytics", "Adobe Analytics", "Tableau", "Power BI",
            "Looker", "Mixpanel", "Amplitude", "Segment", "Snowflake"
        ],
        "ERP": [
            "SAP", "Oracle", "Microsoft Dynamics", "NetSuite", "Workday",
            "Infor", "Epicor", "Sage", "Odoo"
        ],
        "ECOMMERCE": [
            "Shopify", "Magento", "WooCommerce", "BigCommerce", "Salesforce Commerce Cloud",
            "SAP Commerce", "Oracle Commerce", " commercetools"
        ],
        "MARKETING_AUTOMATION": [
            "HubSpot", "Marketo", "Pardot", "Mailchimp", "ActiveCampaign",
            "Campaign Monitor", "Braze", "Iterable"
        ],
        "CMS": [
            "WordPress", "Drupal", "Sitecore", "Adobe Experience Manager",
            "Contentful", "Optimizely", "Wix", "Squarespace"
        ],
        "CLOUD": [
            "AWS", "Azure", "Google Cloud", "Oracle Cloud", "IBM Cloud",
            "Heroku", "DigitalOcean", "Linode"
        ],
        "COLLABORATION": [
            "Microsoft 365", "Google Workspace", "Slack", "Zoom", "Teams",
            "Dropbox", "Box", "Notion"
        ]
    }

    # Search patterns for vendor discovery
    SEARCH_PATTERNS = {
        "job_postings": {
            "CRM": [
                "{entity} CRM Manager",
                "{entity} Salesforce Administrator",
                "{entity} HubSpot Specialist",
                "{entity} Dynamics CRM Analyst"
            ],
            "ANALYTICS": [
                "{entity} Data Analyst",
                "{entity} Tableau Developer",
                "{entity} Power BI Specialist",
                "{entity} Analytics Manager"
            ]
        },
        "partnerships": [
            "{entity} partners with {vendor}",
            "{entity} selects {vendor}",
            "{entity} implements {vendor}",
            "{entity} chooses {vendor}"
        ],
        "case_studies": [
            "{vendor} {entity} case study",
            "{entity} {vendor} success story",
            "how {entity} uses {vendor}",
            "{entity} {vendor} implementation"
        ]
    }

    def __init__(self):
        """Initialize the vendor search agent"""
        self.brightdata = None
        self._init_brightdata()

    def _init_brightdata(self):
        """Initialize BrightData client (lazy initialization)"""
        if self.brightdata is None:
            from backend.brightdata_sdk_client import BrightDataSDKClient
            self.brightdata = BrightDataSDKClient()
            logger.info("✅ VendorSearchAgent: BrightData SDK initialized")

    async def discover_vendors(
        self,
        entity_name: str,
        entity_id: str,
        categories: Optional[List[str]] = None,
        max_vendors_per_category: int = 3
    ) -> Dict[str, Any]:
        """
        Discover vendors for specified technology categories.

        Args:
            entity_name: Display name (e.g., "Arsenal FC")
            entity_id: Unique ID (e.g., "arsenal-fc")
            categories: Technology categories to search (default: all)
            max_vendors_per_category: Max vendors to find per category

        Returns:
            Dictionary with discovered vendors, stakeholders, and partnerships
        """
        logger.info(f"🔍 Starting vendor discovery for {entity_name}")

        # Default to all categories if none specified
        if categories is None:
            categories = list(self.VENDOR_ECOSYSTEMS.keys())

        results = {
            "entity_id": entity_id,
            "entity_name": entity_name,
            "discovered_at": datetime.now().isoformat(),
            "vendors": {},
            "stakeholders": [],
            "partnerships": [],
            "procurement_signals": [],
            "total_vendors_found": 0
        }

        # Search each category
        for category in categories:
            logger.info(f"🔍 Searching {category} vendors...")
            category_vendors = await self._search_category(
                entity_name, category, max_vendors_per_category
            )

            if category_vendors:
                results["vendors"][category] = category_vendors
                results["total_vendors_found"] += len(category_vendors)
                logger.info(f"  Found {len(category_vendors)} {category} vendors")

        # Search for stakeholders
        logger.info("👥 Searching for stakeholders...")
        stakeholders = await self._search_stakeholders(entity_name, results["vendors"])
        results["stakeholders"] = stakeholders
        logger.info(f"  Found {len(stakeholders)} stakeholders")

        # Search for partnerships
        logger.info("🤝 Searching for partnerships...")
        partnerships = await self._search_partnerships(entity_name, results["vendors"])
        results["partnerships"] = partnerships
        logger.info(f"  Found {len(partnerships)} partnerships")

        return results

    async def _search_category(
        self,
        entity_name: str,
        category: str,
        max_vendors: int
    ) -> List[Dict[str, Any]]:
        """
        Search for vendors in a specific category.

        Strategy:
        1. Job posting search (most reliable for current usage)
        2. Partnership announcements
        3. Case studies
        """
        vendors = []

        # Get vendor list for this category
        vendor_list = self.VENDOR_ECOSYSTEMS.get(category, [])

        # Strategy 1: Job posting search
        job_vendors = await self._search_job_postings(entity_name, category, vendor_list)
        vendors.extend(job_vendors)

        # Strategy 2: Partnership announcements
        if len(vendors) < max_vendors:
            partner_vendors = await self._search_vendor_partnerships(entity_name, category)
            vendors.extend(partner_vendors)

        # Strategy 3: Case studies
        if len(vendors) < max_vendors:
            case_study_vendors = await self._search_case_studies(entity_name, category)
            vendors.extend(case_study_vendors)

        # Deduplicate and limit
        seen = set()
        unique_vendors = []
        for vendor in vendors:
            vendor_name = vendor.get("vendor_name", "")
            if vendor_name and vendor_name not in seen:
                seen.add(vendor_name)
                unique_vendors.append(vendor)

        return unique_vendors[:max_vendors]

    async def _search_job_postings(
        self,
        entity_name: str,
        category: str,
        vendor_list: List[str]
    ) -> List[Dict[str, Any]]:
        """
        Search job postings for vendor requirements.

        Job postings often mention specific vendor requirements:
        - "Experience with Salesforce required"
        - "HubSpot certification preferred"
        - "Knowledge of SAP ERP essential"
        """
        vendors = []

        # Build search queries
        queries = []
        for vendor in vendor_list[:5]:  # Limit to top 5 per category
            queries.append(f'"{entity_name}" "{vendor}" job posting')
            queries.append(f'"{entity_name}" "{vendor}" careers')
            queries.append(f'"{entity_name}" "{vendor}" role')

        # Execute searches
        for query in queries[:3]:  # Limit to 3 queries per category
            try:
                result = await self.brightdata.search_engine(
                    query=query,
                    engine="google",
                    num_results=5
                )

                if result.get("status") == "success":
                    for item in result.get("results", []):
                        # Extract vendor name from search context
                        for vendor in vendor_list:
                            if vendor.lower() in item.get("title", "").lower() or \
                               vendor.lower() in item.get("snippet", "").lower():
                                vendors.append({
                                    "vendor_name": vendor,
                                    "category": category,
                                    "source": "job_posting",
                                    "title": item.get("title", ""),
                                    "url": item.get("url", ""),
                                    "snippet": item.get("snippet", ""),
                                    "confidence": 0.7
                                })
                                break  # One vendor per search result
            except Exception as e:
                logger.warning(f"Job search error: {e}")

        return vendors

    async def _search_vendor_partnerships(
        self,
        entity_name: str,
        category: str
    ) -> List[Dict[str, Any]]:
        """Search for partnership announcements."""
        vendors = []
        vendor_list = self.VENDOR_ECOSYSTEMS.get(category, [])

        # Search for partnership patterns
        for vendor in vendor_list[:3]:
            queries = [
                f'"{entity_name}" partners with {vendor}',
                f'"{entity_name}" selects {vendor}',
                f'"{entity_name}" {vendor} partnership'
            ]

            for query in queries:
                try:
                    result = await self.brightdata.search_engine(
                        query=query,
                        engine="google",
                        num_results=3
                    )

                    if result.get("status") == "success":
                        for item in result.get("results", []):
                            vendors.append({
                                "vendor_name": vendor,
                                "category": category,
                                "source": "partnership",
                                "title": item.get("title", ""),
                                "url": item.get("url", ""),
                                "snippet": item.get("snippet", ""),
                                "confidence": 0.8
                            })
                            break  # One result per query
                except Exception as e:
                    logger.warning(f"Partnership search error: {e}")

        return vendors

    async def _search_case_studies(
        self,
        entity_name: str,
        category: str
    ) -> List[Dict[str, Any]]:
        """Search for vendor case studies."""
        vendors = []
        vendor_list = self.VENDOR_ECOSYSTEMS.get(category, [])

        for vendor in vendor_list[:2]:
            queries = [
                f'{vendor} "{entity_name}" case study',
                f'"{entity_name}" {vendor} implementation',
                f'how "{entity_name}" uses {vendor}'
            ]

            for query in queries:
                try:
                    result = await self.brightdata.search_engine(
                        query=query,
                        engine="google",
                        num_results=3
                    )

                    if result.get("status") == "success":
                        for item in result.get("results", []):
                            vendors.append({
                                "vendor_name": vendor,
                                "category": category,
                                "source": "case_study",
                                "title": item.get("title", ""),
                                "url": item.get("url", ""),
                                "snippet": item.get("snippet", ""),
                                "confidence": 0.9
                            })
                            break
                except Exception as e:
                    logger.warning(f"Case study search error: {e}")

        return vendors

    async def _search_stakeholders(
        self,
        entity_name: str,
        discovered_vendors: Dict[str, List[Dict]]
    ) -> List[Dict[str, Any]]:
        """
        Search for stakeholders based on discovered vendors.

        Strategy: Search LinkedIn for people with vendor expertise at the entity
        """
        stakeholders = []

        # Get top vendors from each category
        for category, vendors in discovered_vendors.items():
            for vendor in vendors[:2]:  # Top 2 per category
                # Search for stakeholder patterns
                queries = [
                    f'"{entity_name}" "{vendor}" manager',
                    f'"{entity_name}" "{vendor}" specialist',
                    f'"{entity_name}" {category} manager'
                ]

                for query in queries[:2]:
                    try:
                        # Note: LinkedIn search is restricted, so we use general web search
                        result = await self.brightdata.search_engine(
                            query=query,
                            engine="google",
                            num_results=3
                        )

                        if result.get("status") == "success":
                            for item in result.get("results", []):
                                title = item.get("title", "")
                                snippet = item.get("snippet", "")

                                # Extract potential stakeholder info
                                stakeholder = self._extract_stakeholder_info(
                                    title, snippet, entity_name, vendor, category
                                )
                                if stakeholder:
                                    stakeholders.append(stakeholder)
                    except Exception as e:
                        logger.warning(f"Stakeholder search error: {e}")

        # Deduplicate
        seen = set()
        unique_stakeholders = []
        for s in stakeholders:
            key = f"{s.get('name', '')}-{s.get('role', '')}"
            if key not in seen and s.get('name'):
                seen.add(key)
                unique_stakeholders.append(s)

        return unique_stakeholders[:10]  # Limit to top 10

    def _extract_stakeholder_info(
        self,
        title: str,
        snippet: str,
        entity_name: str,
        vendor: str,
        category: str
    ) -> Optional[Dict[str, Any]]:
        """Extract stakeholder information from search results."""
        # Look for name patterns
        name_patterns = [
            r'([A-Z][a-z]+ [A-Z][a-z]+)',  # First Last
            r'([A-Z]\. [A-Z][a-z]+)'  # F. Last
        ]

        name = None
        for pattern in name_patterns:
            match = re.search(pattern, title)
            if match:
                name = match.group(1)
                break

        if not name:
            return None

        # Determine role
        role_keywords = {
            "Manager": "Manager",
            "Director": "Director",
            "Head": "Head",
            "Lead": "Lead",
            "Specialist": "Specialist",
            "Analyst": "Analyst",
            "Administrator": "Administrator"
        }

        role = f"{category} Specialist"  # Default role
        for keyword, title in role_keywords.items():
            if keyword.lower() in title.lower():
                role = title
                break

        return {
            "name": name,
            "role": role,
            "entity": entity_name,
            "vendor_expertise": vendor,
            "category": category,
            "source": "web_search",
            "confidence": 0.6
        }

    async def _search_partnerships(
        self,
        entity_name: str,
        discovered_vendors: Dict[str, List[Dict]]
    ) -> List[Dict[str, Any]]:
        """Search for detailed partnership information."""
        partnerships = []

        # Search for partnerships with discovered vendors
        for category, vendors in discovered_vendors.items():
            for vendor_info in vendors[:1]:  # Top vendor per category
                vendor = vendor_info.get("vendor_name", "")

                queries = [
                    f'"{entity_name}" {vendor} partnership announcement',
                    f'"{entity_name}" {vendor} implementation',
                    f'"{entity_name}" {vendor} case study'
                ]

                for query in queries:
                    try:
                        result = await self.brightdata.search_engine(
                            query=query,
                            engine="google",
                            num_results=2
                        )

                        if result.get("status") == "success":
                            for item in result.get("results", []):
                                partnerships.append({
                                    "vendor": vendor,
                                    "category": category,
                                    "entity": entity_name,
                                    "title": item.get("title", ""),
                                    "description": item.get("snippet", "")[:200],
                                    "url": item.get("url", ""),
                                    "type": "technology_partnership",
                                    "confidence": 0.8
                                })
                                break  # One result per query
                    except Exception as e:
                        logger.warning(f"Partnership search error: {e}")

        return partnerships
