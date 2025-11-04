#!/usr/bin/env python3

# Script to systematically add missing entities from CSV to achieve 100% coverage
# Focus on national federations and sports organizations

import json

# Entities to import - organized by category for systematic addition
entities_to_import = [
    # Cambodian federations
    {"name": "Cambodian Baseball Federation", "type": "Federation", "sport": "Baseball", "country": "Cambodia", "level": "National"},
    {"name": "Cambodian Basketball Federation", "type": "Federation", "sport": "Basketball", "country": "Cambodia", "level": "National"},
    {"name": "Cambodian Football Federation", "type": "Federation", "sport": "Football", "country": "Cambodia", "level": "National"},
    {"name": "Cambodian Rugby Federation", "type": "Federation", "sport": "Rugby", "country": "Cambodia", "level": "National"},
    {"name": "Cambodian Volleyball Federation", "type": "Federation", "sport": "Volleyball", "country": "Cambodia", "level": "National"},
    
    # Cameroon federations
    {"name": "Cameroon Cricket Federation", "type": "Federation", "sport": "Cricket", "country": "Cameroon", "level": "National"},
    {"name": "Cameroon Handball Federation", "type": "Federation", "sport": "Handball", "country": "Cameroon", "level": "National"},
    {"name": "Cameroonian Basketball Federation", "type": "Federation", "sport": "Basketball", "country": "Cameroon", "level": "National"},
    {"name": "Cameroonian Football Federation", "type": "Federation", "sport": "Football", "country": "Cameroon", "level": "National"},
    {"name": "Cameroonian Volleyball Federation", "type": "Federation", "sport": "Volleyball", "country": "Cameroon", "level": "National"},
    
    # Canadian federations
    {"name": "Canadian Automobile Sport Clubs (CASC)", "type": "Federation", "sport": "Motorsport", "country": "Canada", "level": "National"},
    {"name": "Canadian Baseball Federation", "type": "Federation", "sport": "Baseball", "country": "Canada", "level": "National"},
    {"name": "Canadian Basketball Federation", "type": "Federation", "sport": "Basketball", "country": "Canada", "level": "National"},
    {"name": "Canadian Ice Hockey Federation", "type": "Federation", "sport": "Ice Hockey", "country": "Canada", "level": "National"},
    {"name": "Canadian Rugby Union", "type": "Federation", "sport": "Rugby", "country": "Canada", "level": "National"},
    {"name": "Canadian Soccer Association", "type": "Federation", "sport": "Football", "country": "Canada", "level": "National"},
    {"name": "Canadian Team Handball Federation", "type": "Federation", "sport": "Handball", "country": "Canada", "level": "National"},
    {"name": "Canadian Volleyball Federation", "type": "Federation", "sport": "Volleyball", "country": "Canada", "level": "National"},
    
    # Cayman Islands federations
    {"name": "Cayman Islands Baseball Federation", "type": "Federation", "sport": "Baseball", "country": "Cayman Islands", "level": "National"},
    {"name": "Cayman Islands Basketball Association", "type": "Federation", "sport": "Basketball", "country": "Cayman Islands", "level": "National"},
    {"name": "Cayman Islands Cricket Association", "type": "Federation", "sport": "Cricket", "country": "Cayman Islands", "level": "National"},
    {"name": "Cayman Islands Football Association", "type": "Federation", "sport": "Football", "country": "Cayman Islands", "level": "National"},
    {"name": "Cayman Islands Rugby Union", "type": "Federation", "sport": "Rugby", "country": "Cayman Islands", "level": "National"},
    {"name": "Cayman Islands Volleyball Federation", "type": "Federation", "sport": "Volleyball", "country": "Cayman Islands", "level": "National"},
    
    # Central African Republic federations
    {"name": "Central African Football Federation", "type": "Federation", "sport": "Football", "country": "Central African Republic", "level": "National"},
    {"name": "Central African Republic Basketball Federation", "type": "Federation", "sport": "Basketball", "country": "Central African Republic", "level": "National"},
    {"name": "Central African Republic Handball Federation", "type": "Federation", "sport": "Handball", "country": "Central African Republic", "level": "National"},
    {"name": "Central African Republic Volleyball Federation", "type": "Federation", "sport": "Volleyball", "country": "Central African Republic", "level": "National"},
    
    # Chadian federations
    {"name": "Chadian Basketball Federation", "type": "Federation", "sport": "Basketball", "country": "Chad", "level": "National"},
    {"name": "Chadian Football Federation", "type": "Federation", "sport": "Football", "country": "Chad", "level": "National"},
    {"name": "Chadian Handball Federation", "type": "Federation", "sport": "Handball", "country": "Chad", "level": "National"},
    {"name": "Chadian Volleyball Federation", "type": "Federation", "sport": "Volleyball", "country": "Chad", "level": "National"},
    
    # Chilean federations
    {"name": "Chilean Automobile Sports Federation (FADECH)", "type": "Federation", "sport": "Motorsport", "country": "Chile", "level": "National"},
    {"name": "Chilean Baseball Federation", "type": "Federation", "sport": "Baseball", "country": "Chile", "level": "National"},
    {"name": "Chilean Basketball Federation", "type": "Federation", "sport": "Basketball", "country": "Chile", "level": "National"},
    {"name": "Chilean Football Federation", "type": "Federation", "sport": "Football", "country": "Chile", "level": "National"},
    {"name": "Chilean Handball Federation", "type": "Federation", "sport": "Handball", "country": "Chile", "level": "National"},
    {"name": "Chilean Ice Hockey Association", "type": "Federation", "sport": "Ice Hockey", "country": "Chile", "level": "National"},
    {"name": "Chilean Rugby Federation", "type": "Federation", "sport": "Rugby", "country": "Chile", "level": "National"},
    {"name": "Chilean Volleyball Federation", "type": "Federation", "sport": "Volleyball", "country": "Chile", "level": "National"},
    
    # Chinese federations
    {"name": "China Cricket Association", "type": "Federation", "sport": "Cricket", "country": "China", "level": "National"},
    {"name": "Chinese Baseball Association", "type": "Federation", "sport": "Baseball", "country": "China", "level": "National"},
    {"name": "Chinese Basketball Association", "type": "Federation", "sport": "Basketball", "country": "China", "level": "National"},
    {"name": "Chinese Football Association", "type": "Federation", "sport": "Football", "country": "China", "level": "National"},
    {"name": "Chinese Handball Association", "type": "Federation", "sport": "Handball", "country": "China", "level": "National"},
    {"name": "Chinese Ice Hockey Association", "type": "Federation", "sport": "Ice Hockey", "country": "China", "level": "National"},
    {"name": "Chinese Rugby Football Association", "type": "Federation", "sport": "Rugby", "country": "China", "level": "National"},
    {"name": "Chinese Super League (CSL)", "type": "League", "sport": "Football", "country": "China", "level": "Professional"},
    {"name": "Chinese Taipei Baseball Association", "type": "Federation", "sport": "Baseball", "country": "Chinese Taipei", "level": "National"},
    {"name": "Chinese Taipei Basketball Association", "type": "Federation", "sport": "Basketball", "country": "Chinese Taipei", "level": "National"},
    {"name": "Chinese Taipei Football Association", "type": "Federation", "sport": "Football", "country": "Chinese Taipei", "level": "National"},
    {"name": "Chinese Taipei Handball Association", "type": "Federation", "sport": "Handball", "country": "Chinese Taipei", "level": "National"},
    {"name": "Chinese Taipei Ice Hockey Federation", "type": "Federation", "sport": "Ice Hockey", "country": "Chinese Taipei", "level": "National"},
    {"name": "Chinese Taipei Motor Sports Association (CTMSA)", "type": "Federation", "sport": "Motorsport", "country": "Chinese Taipei", "level": "National"},
    {"name": "Chinese Taipei Rugby Union", "type": "Federation", "sport": "Rugby", "country": "Chinese Taipei", "level": "National"},
    {"name": "Chinese Taipei Volleyball Association", "type": "Federation", "sport": "Volleyball", "country": "Chinese Taipei", "level": "National"},
    {"name": "Chinese Volleyball Association", "type": "Federation", "sport": "Volleyball", "country": "China", "level": "National"}
]

print(f"Generated {len(entities_to_import)} entities for import")
print("Use these with the Neo4j MCP tool to complete the 100% CSV coverage target")