#!/bin/bash
# Nightly cron job: 0 2 * * *
# Computes temporal priors from all historical episodes

set -e

cd "$(dirname "$0")/.."

echo "[$(date)] Starting temporal prior computation..."

python3 -c "
import asyncio
import sys
sys.path.insert(0, '.')

from backend.temporal.temporal_prior_service import TemporalPriorService

async def main():
    service = TemporalPriorService()
    print(f'Loading episodes from Graphiti...')
    await service.compute_all_priors()
    print(f'Computed priors for {len(service.priors)} keys')
    print(f'Saved to {service.priors_path}')
    print(f'Computation complete at {service.priors[\"*:CRM\"].computed_at if \":*\" in str(list(service.priors.keys())[0]) else \"N/A\"}')

asyncio.run(main())
" 2>&1 | while IFS= read -r line; do echo "[$(date)] $line"; done

echo "[$(date)] Temporal prior computation complete"
