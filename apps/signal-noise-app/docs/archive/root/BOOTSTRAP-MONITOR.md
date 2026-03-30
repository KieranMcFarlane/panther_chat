# Full SDK Bootstrap - Monitoring Guide

## Status: 🚀 RUNNING

**Started:** 2026-01-31 23:18
**PID:** 15676
**Target:** 1,268 entities × 30 iterations
**Est. Duration:** 6-8 hours
**Est. Cost:** ~$951

---

## Quick Monitor Commands

```bash
# Live monitoring
./scripts/monitor_bootstrap.sh

# Watch logs in real-time
tail -f /tmp/bootstrap_output.log

# Check specific entity progress
grep "Entity.*1268" /tmp/bootstrap_output.log | tail -20

# Count completed entities
ls -1 data/runtime_bindings/*.json | grep -v cache | wc -l
```

---

## Progress Tracking

### Current Stats
- **Entities Processed:** Check monitor output
- **Total Cost:** Check monitor output
- **Avg Cost/Entity:** ~$0.63 (from test runs)

### Checkpoint System
- **Interval:** Every 50 entities
- **Checkpoint File:** `data/bootstrap_checkpoint.json`
- **Resume Capability:** `--resume` flag

---

## What's Happening

For each entity (1,268 total):
1. **Domain Discovery** (BrightData SDK)
   - Searches for "Entity Name official website"
   - Returns 6-10 domain candidates
   - Extracts official domains

2. **30 Iterations** (Category Round-Robin)
   - Iterates through 8 categories
   - Collects evidence via BrightData SDK
   - Applies Ralph Decision Rubric (ACCEPT/WEAK_ACCEPT/REJECT)
   - Updates confidence score
   - Tracks cost

3. **Save Binding**
   - Updates `data/runtime_bindings/{entity_id}.json`
   - Adds discovered domains
   - Adds bootstrap metadata (30 iterations)
   - Updates performance metrics

---

## Evidence Collection

**Categories** (8 fixed):
1. Digital Infrastructure & Stack
2. Commercial & Revenue Systems
3. Fan Engagement & Experience
4. Data, Analytics & AI
5. Operations & Internal Transformation
6. Media, Content & Broadcasting
7. Partnerships, Vendors & Ecosystem
8. Governance, Compliance & Security

**Ralph Decisions:**
- **ACCEPT:** All criteria met (new, specific, future action, credible)
- **WEAK_ACCEPT:** New but partially missing ACCEPT criteria
- **REJECT:** No new information or fails multiple criteria

---

## Output Files

### Runtime Bindings
- **Location:** `data/runtime_bindings/{entity_id}.json`
- **Updated Fields:**
  - `domains` - Discovered official domains
  - `performance_metrics.total_iterations` - 30
  - `performance_metrics.total_cost_usd` - ~$0.63
  - `performance_metrics.final_confidence` - ~0.80
  - `metadata.bootstrap_iterations` - Full iteration history

### Logs
- **Bootstrap Log:** `data/full_sdk_bootstrap.log`
- **Output Log:** `/tmp/bootstrap_output.log`

### Reports
- **Checkpoint:** `data/bootstrap_checkpoint.json` (deleted after success)
- **Final Report:** `data/full_sdk_bootstrap_report_*.json`

---

## Stopping & Resuming

### Stop Bootstrap
```bash
kill $(cat /tmp/bootstrap.pid)
# Graceful stop after current entity completes
```

### Resume Bootstrap
```bash
# Resume from last checkpoint
python3 scripts/full_sdk_bootstrap.py --resume --iterations 30

# Or restart (will skip completed entities)
python3 scripts/full_sdk_bootstrap.py --iterations 30
```

---

## Success Criteria

When complete, verify:
```bash
# 1. All bindings have 30 iterations
for f in data/runtime_bindings/*.json; do
  if ! jq -e '.performance_metrics.total_iterations == 30' "$f" > /dev/null; then
    echo "Missing iterations: $f"
  fi
done

# 2. All bindings have discovered domains
for f in data/runtime_bindings/*.json; do
  if ! jq -e '.domains | length > 0' "$f" > /dev/null; then
    echo "Missing domains: $f"
  fi
done

# 3. Total cost verification
python3 - <<'EOF'
import json
from pathlib import Path

total_cost = 0.0
total_iterations = 0

for binding_file in Path('data/runtime_bindings').glob('*.json'):
    if 'cache' not in binding_file.name:
        with open(binding_file) as f:
            binding = json.load(f)
            total_cost += binding['performance_metrics'].get('total_cost_usd', 0.0)
            total_iterations += binding['performance_metrics'].get('total_iterations', 0)

print(f"Total iterations: {total_iterations:,}")
print(f"Total cost: ${total_cost:.2f}")
print(f"Avg iterations per entity: {total_iterations/1268:.1f}")
print(f"Avg cost per entity: ${total_cost/1268:.2f}")
EOF
```

---

## Rollback Plan

If anything goes wrong:
```bash
# Restore template-inherited bindings
rm -rf data/runtime_bindings
cp -r data/runtime_bindings_backup_20260131_224932 data/runtime_bindings

# Regenerate cache with template-inherited bindings
python3 scripts/simple_batch_discovery.py
```

---

## Next Steps After Completion

1. **Validation** (Task 4)
   - Verify all bindings have discovered patterns
   - Check Ralph Loop decision distribution
   - Generate final report

2. **Compare** template-inherited vs SDK-discovered
   - Measure confidence improvement
   - Calculate ROI on SDK exploration cost

3. **Schedule** ongoing bootstrap passes
   - Quarterly: Full SDK bootstrap for new entities
   - Monthly: SDK refresh for high-priority entities

---

## Troubleshooting

### Bootstrap died
```bash
# Check logs
tail -100 /tmp/bootstrap_output.log

# Resume from checkpoint
python3 scripts/full_sdk_bootstrap.py --resume --iterations 30
```

### BrightData SDK errors
- Token will auto-refresh
- Falls back to httpx if SDK unavailable
- Check `.env` file has `BRIGHTDATA_API_TOKEN`

### Memory issues
- Checkpoint every 50 entities prevents data loss
- Resume capability handles interruptions

---

**Last Updated:** 2026-01-31 23:19
**Bootstrap Script:** `scripts/full_sdk_bootstrap.py`
**Monitor Script:** `scripts/monitor_bootstrap.sh`
