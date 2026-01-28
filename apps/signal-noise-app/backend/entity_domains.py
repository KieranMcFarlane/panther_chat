"""
Entity domain mappings for template binding

Maps entity names to their official website domains.
Used by template validation and expansion agents to replace [entity_domain] placeholders.
"""

from typing import Optional

# Premier League Clubs (domain without TLD)
PREMIER_LEAGUE_CLUBS = {
    "Arsenal FC": "arsenal",
    "Arsenal": "arsenal",
    "Liverpool FC": "liverpoolfc",
    "Liverpool": "liverpoolfc",
    "Manchester United": "manutd",
    "Man Utd": "manutd",
    "Chelsea FC": "chelseafc",
    "Chelsea": "chelseafc",
    "Manchester City": "mancity",
    "Man City": "mancity",
    "Tottenham Hotspur": "tottenhamhotspur",
    "Spurs": "tottenhamhotspur",
    "Brighton FC": "brightonandhovealbion",
    "Brighton": "brightonandhovealbion",
    "Aston Villa": "avfc",
    "Villa": "avfc",
    "Newcastle United": "newcastleunited",
    "Newcastle": "newcastleunited",
    "West Ham United": "westhamunited",
    "West Ham": "westhamunited",
    "Everton FC": "evertonfc",
    "Everton": "evertonfc",
    "Wolverhampton Wanderers": "wolves",
    "Wolves": "wolves",
    "Leicester City": "lcfc",
    "Leicester": "lcfc",
    "Leeds United": "leedsunited",
    "Leeds": "leedsunited",
    "Southampton FC": "southamptonfc",
    "Southampton": "southamptonfc",
    "Nottingham Forest": "nottinghamforest",
    "Forest": "nottinghamforest",
    "Fulham FC": "fulhamfc",
    "Fulham": "fulhamfc",
    "Crystal Palace": "cpfc",
    "Palace": "cpfc",
    "Brentford FC": "brentfordfc",
    "Brentford": "brentfordfc",
}

# Technology Partners (full domain names for partner site scraping)
TECHNOLOGY_PARTNERS = {
    "Salesforce": "salesforce",
    "HubSpot": "hubspot",
    "SAP": "sap",
    "Oracle": "oracle",
    "Microsoft": "microsoft",
    "Adobe": "adobe",
    "Google": "google",
    "Amazon": "amazon",
    "IBM": "ibm",
    "ServiceNow": "servicenow",
    "Snowflake": "snowflake",
    "Tableau": "tableau",
    "Shopify": "shopify",
    "Stripe": "stripe",
}

# Ticketing & Event Partners
TICKETING_PARTNERS = {
    "Ticketmaster": "ticketmaster",
    "StubHub": "stubhub",
    "AXS": "axs",
    "See Tickets": "seetickets",
}

# Sports Marketing Agencies
MARKETING_AGENCIES = {
    "Octagon": "octagon",
    "IMG": "img",
    "CAA": "caa",
    "Wasserman": "wassermanexperience",
    "Lagardère": "lagardere",
}

# Combined mapping
ENTITY_DOMAINS = {
    **PREMIER_LEAGUE_CLUBS,
    **TECHNOLOGY_PARTNERS,
    **TICKETING_PARTNERS,
    **MARKETING_AGENCIES,
}


def get_entity_domain(entity_name: str) -> Optional[str]:
    """
    Get domain for entity name

    Args:
        entity_name: Name of the entity (e.g., "Arsenal FC", "Salesforce")

    Returns:
        Domain without protocol (e.g., "arsenal.com") or None if not found
    """
    return ENTITY_DOMAINS.get(entity_name)


def get_entity_url(entity_name: str, protocol: str = "https", tld: str = "com") -> Optional[str]:
    """
    Get full URL for entity

    Args:
        entity_name: Name of the entity
        protocol: Protocol to use (default: "https")
        tld: Top-level domain (default: "com")

    Returns:
        Full URL (e.g., "https://arsenal.com") or None if not found
    """
    domain = get_entity_domain(entity_name)
    if domain:
        return f'{protocol}://{domain}.{tld}'
    return None


def add_entity_mapping(entity_name: str, domain: str) -> None:
    """
    Add or update entity domain mapping

    Args:
        entity_name: Name of the entity
        domain: Domain (e.g., "arsenal.com")
    """
    ENTITY_DOMAINS[entity_name] = domain


def bulk_add_mappings(mappings: dict) -> None:
    """
    Add multiple entity domain mappings at once

    Args:
        mappings: Dictionary of entity_name -> domain mappings
    """
    ENTITY_DOMAINS.update(mappings)


# Utility function for template placeholder binding
def bind_template_placeholders(template: dict, entity_name: str) -> dict:
    """
    Bind template placeholders to entity-specific values

    Args:
        template: Template dictionary with channels
        entity_name: Name of the entity to bind to

    Returns:
        Modified template with placeholders replaced
    """
    import copy

    bound_template = copy.deepcopy(template)

    # Get entity domain
    entity_domain = get_entity_domain(entity_name)

    # Update channels that use [entity_domain] placeholder
    if 'signal_channels' in bound_template:
        for channel in bound_template['signal_channels']:
            if channel.get('channel_type') == 'official_site':
                # Replace [entity_domain] placeholders
                example_domains = channel.get('example_domains', [])
                fixed_domains = []
                for domain in example_domains:
                    if '[entity_domain]' in domain:
                        if entity_domain:
                            # Replace placeholder (entity_domain doesn't include .com)
                            fixed_domains.append(
                                domain.replace('[entity_domain]', entity_domain)
                            )
                        else:
                            # Skip if entity not in mapping
                            continue
                    else:
                        # Keep original domain
                        fixed_domains.append(domain)

                channel['example_domains'] = fixed_domains

            elif channel.get('channel_type') == 'partner_site':
                # Partner sites don't need entity binding
                pass

    return bound_template


if __name__ == "__main__":
    # Test entity domain lookups
    print("=== Entity Domain Lookups ===")

    test_entities = [
        "Arsenal FC",
        "Liverpool",
        "Salesforce",
        "Unknown Entity",
    ]

    for entity in test_entities:
        domain = get_entity_domain(entity)
        url = get_entity_url(entity)
        print(f"{entity:20} → {domain or 'Not found':30} → {url or 'N/A'}")

    # Test template placeholder binding
    print("\n=== Template Placeholder Binding ===")

    sample_template = {
        "template_name": "test_template",
        "channels": [
            {
                "channel_type": "official_site",
                "example_domains": [
                    "[entity_domain].com",
                    "news.[entity_domain].com",
                ]
            },
            {
                "channel_type": "partner_site",
                "example_domains": ["salesforce.com", "hubspot.com"]
            }
        ]
    }

    bound = bind_template_placeholders(sample_template, "Arsenal FC")
    print(f"Original: {sample_template['channels'][0]['example_domains']}")
    print(f"Bound:    {bound['channels'][0]['example_domains']}")
