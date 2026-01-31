"""
Category mapping service

Maps current template categories (5) to canonical signal categories (14).
Uses keyword matching and fallback strategies.
"""

from typing import List, Optional
from backend.temporal.models import SignalCategory


class CategoryMapper:
    """Maps 5 current categories to 14 canonical signal categories"""

    # Mapping from current → canonical (one-to-many)
    CATEGORY_MAPPING = {
        "Digital Infrastructure": [
            SignalCategory.CRM,
            SignalCategory.DATA_PLATFORM,
            SignalCategory.INFRASTRUCTURE,
            SignalCategory.SECURITY
        ],
        "Commercial": [
            SignalCategory.COMMERCE,
            SignalCategory.MARKETING,
            SignalCategory.CONTENT
        ],
        "Technology": [
            SignalCategory.ANALYTICS,
            SignalCategory.COMMUNICATION,
            SignalCategory.COLLABORATION
        ],
        "Operations": [
            SignalCategory.OPERATIONS,
            SignalCategory.TICKETING
        ],
        "Strategic": [
            SignalCategory.HR,
            SignalCategory.FINANCE
        ]
    }

    # Reverse mapping: template keywords → canonical category
    # Priority order matters (first match wins)
    TEMPLATE_KEYWORD_MAPPING = {
        # CRM
        "salesforce": SignalCategory.CRM,
        "hubspot": SignalCategory.CRM,
        "crm": SignalCategory.CRM,
        "customer relationship": SignalCategory.CRM,
        "dynamics": SignalCategory.CRM,  # Microsoft Dynamics
        "pipedrive": SignalCategory.CRM,

        # Ticketing
        "zendesk": SignalCategory.TICKETING,
        "freshdesk": SignalCategory.TICKETING,
        "ticket": SignalCategory.TICKETING,
        "help desk": SignalCategory.TICKETING,
        "service now": SignalCategory.TICKETING,
        "servicenow": SignalCategory.TICKETING,
        "jira service": SignalCategory.TICKETING,

        # Data Platform
        "snowflake": SignalCategory.DATA_PLATFORM,
        "databricks": SignalCategory.DATA_PLATFORM,
        "data warehouse": SignalCategory.DATA_PLATFORM,
        "data lake": SignalCategory.DATA_PLATFORM,
        "etl": SignalCategory.DATA_PLATFORM,
        "pipeline": SignalCategory.DATA_PLATFORM,
        "bigquery": SignalCategory.DATA_PLATFORM,
        "redshift": SignalCategory.DATA_PLATFORM,

        # Commerce
        "shopify": SignalCategory.COMMERCE,
        "magento": SignalCategory.COMMERCE,
        "ecommerce": SignalCategory.COMMERCE,
        "e-commerce": SignalCategory.COMMERCE,
        "woocommerce": SignalCategory.COMMERCE,
        "bigcommerce": SignalCategory.COMMERCE,
        "stripe": SignalCategory.COMMERCE,  # Payment processing
        "payments": SignalCategory.COMMERCE,

        # Marketing
        "marketing automation": SignalCategory.MARKETING,
        "mailchimp": SignalCategory.MARKETING,
        "campaign": SignalCategory.MARKETING,
        "marketing cloud": SignalCategory.MARKETING,
        "hubspot marketing": SignalCategory.MARKETING,
        "marketo": SignalCategory.MARKETING,
        "adobe marketing": SignalCategory.MARKETING,

        # Content
        "cms": SignalCategory.CONTENT,
        "content management": SignalCategory.CONTENT,
        "wordpress": SignalCategory.CONTENT,
        "drupal": SignalCategory.CONTENT,
        "contentful": SignalCategory.CONTENT,
        "headless": SignalCategory.CONTENT,
        "digital experience": SignalCategory.CONTENT,
        "dxp": SignalCategory.CONTENT,

        # Analytics
        "tableau": SignalCategory.ANALYTICS,
        "looker": SignalCategory.ANALYTICS,
        "power bi": SignalCategory.ANALYTICS,
        "powerbi": SignalCategory.ANALYTICS,
        "analytics": SignalCategory.ANALYTICS,
        "business intelligence": SignalCategory.ANALYTICS,
        "bi platform": SignalCategory.ANALYTICS,
        "dashboard": SignalCategory.ANALYTICS,
        "reporting": SignalCategory.ANALYTICS,
        "visualization": SignalCategory.ANALYTICS,

        # Communication
        "email": SignalCategory.COMMUNICATION,
        "messaging": SignalCategory.COMMUNICATION,
        "sendgrid": SignalCategory.COMMUNICATION,
        "twilio": SignalCategory.COMMUNICATION,
        "slack": SignalCategory.COMMUNICATION,
        "teams": SignalCategory.COMMUNICATION,
        "zoom": SignalCategory.COMMUNICATION,
        "unified communications": SignalCategory.COMMUNICATION,

        # Collaboration
        "collaboration": SignalCategory.COLLABORATION,
        "sharepoint": SignalCategory.COLLABORATION,
        "confluence": SignalCategory.COLLABORATION,
        "notion": SignalCategory.COLLABORATION,
        "miro": SignalCategory.COLLABORATION,
        "workspace": SignalCategory.COLLABORATION,
        "project management": SignalCategory.COLLABORATION,
        "asana": SignalCategory.COLLABORATION,
        "monday.com": SignalCategory.COLLABORATION,
        "trello": SignalCategory.COLLABORATION,
        "jira": SignalCategory.COLLABORATION,

        # Operations
        "operations": SignalCategory.OPERATIONS,
        "erp": SignalCategory.OPERATIONS,
        "sAP": SignalCategory.OPERATIONS,
        "oracle": SignalCategory.OPERATIONS,
        "workday": SignalCategory.OPERATIONS,
        "service": SignalCategory.OPERATIONS,
        "field service": SignalCategory.OPERATIONS,

        # HR
        "hr": SignalCategory.HR,
        "human resources": SignalCategory.HR,
        "recruiting": SignalCategory.HR,
        "payroll": SignalCategory.HR,
        "workforce": SignalCategory.HR,
        "bamboohr": SignalCategory.HR,
        "workday hr": SignalCategory.HR,

        # Finance
        "finance": SignalCategory.FINANCE,
        "financial": SignalCategory.FINANCE,
        "accounting": SignalCategory.FINANCE,
        "budget": SignalCategory.FINANCE,
        "procurement": SignalCategory.FINANCE,
        "expense": SignalCategory.FINANCE,
        "coupa": SignalCategory.FINANCE,
        "concur": SignalCategory.FINANCE,

        # Infrastructure
        "cloud": SignalCategory.INFRASTRUCTURE,
        "aws": SignalCategory.INFRASTRUCTURE,
        "azure": SignalCategory.INFRASTRUCTURE,
        "gcp": SignalCategory.INFRASTRUCTURE,
        "infrastructure": SignalCategory.INFRASTRUCTURE,
        "devops": SignalCategory.INFRASTRUCTURE,
        "kubernetes": SignalCategory.INFRASTRUCTURE,
        "docker": SignalCategory.INFRASTRUCTURE,
        "server": SignalCategory.INFRASTRUCTURE,
        "hosting": SignalCategory.INFRASTRUCTURE,
        "cdn": SignalCategory.INFRASTRUCTURE,

        # Security
        "security": SignalCategory.SECURITY,
        "cybersecurity": SignalCategory.SECURITY,
        "sso": SignalCategory.SECURITY,
        "single sign-on": SignalCategory.SECURITY,
        "okta": SignalCategory.SECURITY,
        "auth0": SignalCategory.SECURITY,
        "identity": SignalCategory.SECURITY,
        "compliance": SignalCategory.SECURITY,
        "gdpr": SignalCategory.SECURITY,
        "firewall": SignalCategory.SECURITY,
        "endpoint": SignalCategory.SECURITY,
        "antivirus": SignalCategory.SECURITY,
    }

    @staticmethod
    def map_template_to_category(template_name: str, current_category: str) -> SignalCategory:
        """
        Map a template to canonical signal category

        Strategy:
        1. Try keyword matching against template_name
        2. Fallback to current_category mapping (first option)
        3. Default to OPERATIONS

        Args:
            template_name: Name of the template (e.g., "Salesforce CRM Upgrade")
            current_category: Current category (e.g., "Digital Infrastructure")

        Returns:
            Canonical SignalCategory
        """
        # 1. Try keyword matching
        template_lower = template_name.lower()

        for keyword, category in CategoryMapper.TEMPLATE_KEYWORD_MAPPING.items():
            if keyword in template_lower:
                return category

        # 2. Fallback to current category mapping (first option)
        canonical_options = CategoryMapper.CATEGORY_MAPPING.get(current_category, [])
        if canonical_options:
            return canonical_options[0]

        # 3. Default fallback
        return SignalCategory.OPERATIONS

    @staticmethod
    def expand_category(current_category: str) -> List[SignalCategory]:
        """
        Expand current category to all applicable canonical categories

        Args:
            current_category: Current category name

        Returns:
            List of SignalCategory options
        """
        return CategoryMapper.CATEGORY_MAPPING.get(current_category, [])

    @staticmethod
    def get_category_for_template(template_name: str) -> Optional[SignalCategory]:
        """
        Get category from template name using keyword matching only

        Args:
            template_name: Template name to analyze

        Returns:
            SignalCategory if matched, None otherwise
        """
        template_lower = template_name.lower()

        for keyword, category in CategoryMapper.TEMPLATE_KEYWORD_MAPPING.items():
            if keyword in template_lower:
                return category

        return None
