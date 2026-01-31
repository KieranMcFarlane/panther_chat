#!/bin/bash
# Manual test of temporal prior system

set -e

cd "$(dirname "$0")/.."

echo "========================================="
echo "Testing TemporalPriorService"
echo "========================================="
echo ""

python3 -c "
import sys
sys.path.insert(0, '.')

from backend.temporal.temporal_prior_service import TemporalPriorService
from backend.temporal.category_mapper import CategoryMapper
from backend.temporal.models import SignalCategory

# Test 1: Category mapping
print('Test 1: Category Mapping')
print('-' * 40)
crm_cat = CategoryMapper.map_template_to_category('Salesforce CRM Upgrade', 'Digital Infrastructure')
print(f'  Salesforce CRM Upgrade → {crm_cat.value}')

ticket_cat = CategoryMapper.map_template_to_category('Zendesk Ticketing System', 'Operations')
print(f'  Zendesk Ticketing System → {ticket_cat.value}')

analytics_cat = CategoryMapper.map_template_to_category('Tableau Dashboard', 'Technology')
print(f'  Tableau Dashboard → {analytics_cat.value}')
print('')

# Test 2: Load/Create priors
print('Test 2: Temporal Prior Service')
print('-' * 40)
service = TemporalPriorService()
print(f'  Loaded {len(service.priors)} priors from disk')
print('')

# Test 3: Get multiplier for known entity+category
print('Test 3: Multiplier for Arsenal + CRM')
print('-' * 40)
result = service.get_multiplier('arsenal', SignalCategory.CRM)
print(f'  Entity: arsenal')
print(f'  Category: CRM')
print(f'  Multiplier: {result.multiplier:.3f}')
print(f'  Backoff Level: {result.backoff_level}')
print(f'  Confidence: {result.confidence}')
if result.prior:
    print(f'  Prior Sample Size: {result.prior.sample_size}')
print('')

# Test 4: Get multiplier for unknown entity (should use global)
print('Test 4: Multiplier for Unknown Entity + ANALYTICS')
print('-' * 40)
result = service.get_multiplier('unknown_entity_xyz', SignalCategory.ANALYTICS)
print(f'  Entity: unknown_entity_xyz')
print(f'  Category: ANALYTICS')
print(f'  Multiplier: {result.multiplier:.3f}')
print(f'  Backoff Level: {result.backoff_level}')
print(f'  Confidence: {result.confidence}')
if result.prior:
    print(f'  Prior Sample Size: {result.prior.sample_size}')
print('')

# Test 5: Verify all 14 categories
print('Test 5: All 14 Categories Defined')
print('-' * 40)
categories = [cat.value for cat in SignalCategory]
print(f'  Total categories: {len(categories)}')
for i, cat in enumerate(categories, 1):
    print(f'  {i:2d}. {cat}')
print('')

print('=========================================')
print('All tests completed successfully!')
print('=========================================')
" 2>&1

echo ""
echo "Test complete"
