# Quick Start Guide: Phases 5-6

This guide will help you quickly get started with the newly implemented Phase 5-6 components.

---

## Table of Contents

1. [Installation](#installation)
2. [Phase 5: Scalability](#phase-5-scalability)
3. [Phase 6: Production Rollout](#phase-6-production-rollout)
4. [Testing](#testing)
5. [Monitoring](#monitoring)

---

## Installation

### 1. Install Dependencies

```bash
# Core dependencies (already installed)
pip install pytest pytest-asyncio

# Optional: Bayesian optimization
pip install scikit-optimize
```

### 2. Verify Files

Check that all files are present:

```bash
# Phase 5 files
ls backend/hypothesis_cache.py
ls backend/batch_hypothesis_query.py
ls backend/cache_warmer.py

# Phase 6 files
ls backend/staged_rollout.py
ls backend/parameter_tuning.py
ls backend/rollout_monitor.py

# Scripts
ls scripts/run_staged_rollout.py
ls scripts/tune_parameters.py

# Tests
ls backend/tests/test_hypothesis_cache.py
ls backend/tests/test_parameter_tuning.py
```

---

## Phase 5: Scalability

### Using the LRU Cache

**Basic Usage**:

```python
from backend.hypothesis_cache import HypothesisLRUCache, CacheConfig

# Create cache with custom config
config = CacheConfig(
    max_size_mb=100,      # 100MB memory limit
    ttl_minutes=60,        # 1 hour TTL
    prefetch_enabled=True
)

cache = HypothesisLRUCache(config)

# Store data
await cache.set("hypothesis_1", {
    "hypothesis_id": "hypothesis_1",
    "confidence": 0.85
})

# Retrieve data
data = await cache.get("hypothesis_1")

# Check statistics
stats = cache.get_statistics()
print(f"Hit rate: {stats.hit_rate:.2%}")
print(f"Item count: {stats.item_count}")
print(f"Size: {stats.size_mb:.2f}MB")
```

**Using the Decorator**:

```python
from backend.hypothesis_cache import HypothesisLRUCache, cached

cache = HypothesisLRUCache()

@cached(cache)
async def expensive_operation(hypothesis_id: str):
    # This result will be cached
    return await load_from_database(hypothesis_id)

# First call: computes
result1 = await expensive_operation("hypothesis_1")

# Second call: from cache (much faster)
result2 = await expensive_operation("hypothesis_1")
```

### Using Batch Queries

```python
from backend.batch_hypothesis_query import BatchHypothesisQuery, BatchConfig

# Create batch handler
config = BatchConfig(
    chunk_size=100,       # 100 entities per chunk
    max_concurrent=10     # 10 parallel operations
)

batch = BatchHypothesisQuery(repository, config)

# Query many entities at once
entity_ids = ["entity_1", "entity_2", ..., "entity_3400"]
results = await batch.get_hypotheses_batch(entity_ids)

# Batch update confidences
updates = [
    {"hypothesis_id": "h1", "confidence_delta": 0.06},
    {"hypothesis_id": "h2", "confidence_delta": 0.06}
]
updated = await batch.update_confidences_batch(updates)

# Benchmark performance
metrics = await batch.benchmark_query_performance(
    entity_ids[:100],  # Test with 100 entities
    iterations=3
)
print(f"Throughput: {metrics['throughput_entities_per_second']:.1f} entities/sec")
```

### Using Cache Warming

```python
from backend.cache_warmer import CacheWarmer, WarmingConfig

# Create warmer
config = WarmingConfig(
    recent_window_hours=24,
    background_interval_minutes=15
)

warmer = CacheWarmer(cache, repository, config)

# Warm recent entities
warmed = await warmer.warm_recent_entities(limit=100)

# Warm cluster hotspots
warmed = await warmer.warm_cluster_hotspots(cluster_id="cluster_1")

# Warm all strategies
results = await warmer.warm_all_strategies()

# Start background warming
await warmer.start_background_warming(interval_minutes=15)

# Stop background warming
await warmer.stop_background_warming()
```

---

## Phase 6: Production Rollout

### Parameter Tuning

**Step 1: Prepare Validation Data**

Create a JSON file with historical discovery results:

```json
[
  {
    "entity_id": "entity_1",
    "has_signal": true,
    "actual_actionable": true,
    "actual_cost_usd": 0.25
  },
  {
    "entity_id": "entity_2",
    "has_signal": false,
    "actual_actionable": false,
    "actual_cost_usd": 0.10
  }
]
```

**Step 2: Run Parameter Tuning**

```bash
# Grid search (exhaustive)
python scripts/tune_parameters.py \
    --method grid \
    --validation-data data/validation.json \
    --iterations 50 \
    --output-file data/best_config.json

# Bayesian optimization (smarter, requires scikit-optimize)
python scripts/tune_parameters.py \
    --method bayesian \
    --validation-data data/validation.json \
    --iterations 100 \
    --output-file data/best_config.json
```

**Step 3: Validate Best Config**

```bash
python scripts/tune_parameters.py \
    --config-file data/best_config.json \
    --validate
```

**Step 4: Review Results**

Check the generated report:
```bash
cat data/tuning_report.md
```

### Staged Rollout

**Step 1: Pilot Stage (10 entities)**

```bash
# Dry run first
python scripts/run_staged_rollout.py \
    --stage pilot \
    --dry-run

# Run pilot
python scripts/run_staged_rollout.py \
    --stage pilot \
    --config-file data/best_config.json
```

**Step 2: Limited Stage (100 entities)**

```bash
python scripts/run_staged_rollout.py \
    --stage limited \
    --entities 100 \
    --config-file data/best_config.json
```

**Step 3: Production Stage (3,400 entities)**

```bash
python scripts/run_staged_rollout.py \
    --stage production \
    --config-file data/best_config.json
```

**Resuming from Checkpoint**

```bash
# If rollout is interrupted, resume with:
python scripts/run_staged_rollout.py \
    --stage all \
    --resume
```

### Monitoring

**Real-Time Monitoring**

```python
from backend.rollout_monitor import RolloutMonitor, print_metrics_summary

# Create monitor
monitor = RolloutMonitor(log_file="data/rollout_metrics.jsonl")

# Record discovery result
await monitor.record_discovery(
    entity_id="entity_1",
    result={
        "total_cost_usd": 0.15,
        "iterations": 5,
        "actionable": True,
        "final_confidence": 0.85,
        "duration_seconds": 0.5
    },
    old_system_result={
        "total_cost_usd": 0.25,
        "actionable": False
    }
)

# Get aggregate metrics
metrics = await monitor.get_aggregate_metrics(time_window_minutes=60)

# Check alerts
alerts = await monitor._check_alerts(metrics)
if alerts:
    print(f"🚨 Alerts: {alerts}")

# Print summary
await print_metrics_summary(monitor)

# Export report
report = monitor.export_report(format="markdown")
with open("data/monitoring_report.md", 'w') as f:
    f.write(report)
```

**Starting Monitoring Loop**

```python
# Define alert handler
async def handle_alerts(metrics, alerts):
    for alert in alerts:
        print(f"🚨 {alert}")
        # Send to Slack, email, etc.

# Start background monitoring
await monitor.start_monitoring_loop(
    interval_seconds=60,  # Check every minute
    alert_callback=handle_alerts
)
```

---

## Testing

### Run Unit Tests

```bash
# Cache tests
pytest backend/tests/test_hypothesis_cache.py -v

# Parameter tuning tests
pytest backend/tests/test_parameter_tuning.py -v

# All tests
pytest backend/tests/ -v
```

### Run Integration Tests

```bash
# Test cache integration with repository
python -c "
import asyncio
from backend.hypothesis_cache import HypothesisLRUCache
from backend.hypothesis_persistence_native import HypothesisRepository

async def test():
    cache = HypothesisLRUCache()
    repo = HypothesisRepository()

    # Test cache + repository
    hypothesis = await repo.get_hypothesis('test_id')
    if hypothesis:
        await cache.set('test_id', hypothesis.__dict__)
        cached = await cache.get('test_id')
        print(f'Cache hit: {cached is not None}')

asyncio.run(test())
"
```

### Benchmark Performance

```bash
# Cache benchmark
python -c "
import asyncio
import time
from backend.hypothesis_cache import HypothesisLRUCache

async def benchmark():
    cache = HypothesisLRUCache()

    # Warm cache
    for i in range(1000):
        await cache.set(f'hypothesis_{i}', {'confidence': 0.5})

    # Benchmark get operations
    start = time.time()
    for i in range(10000):
        await cache.get(f'hypothesis_{i % 1000}')
    duration = time.time() - start

    print(f'10,000 gets in {duration:.2f}s')
    print(f'Avg: {duration/10000*1000:.2f}ms per get')

asyncio.run(benchmark())
"
```

---

## Monitoring Dashboards

### Quick Metrics Check

```bash
# Print current metrics
python -c "
import asyncio
from backend.rollout_monitor import RolloutMonitor, print_metrics_summary

async def check():
    monitor = RolloutMonitor()
    await print_metrics_summary(monitor)

asyncio.run(check())
"
```

### Export Reports

```bash
# Markdown report
python -c "
import asyncio
from backend.rollout_monitor import RolloutMonitor

async def export():
    monitor = RolloutMonitor()
    report = monitor.export_report(format='markdown')
    print(report)

asyncio.run(export())
" > data/quick_report.md

# JSON report
python -c "
import asyncio
import json
from backend.rollout_monitor import RolloutMonitor

async def export():
    monitor = RolloutMonitor()
    metrics = await monitor.get_aggregate_metrics()
    print(json.dumps(metrics.to_dict(), indent=2))

asyncio.run(export())
" > data/quick_metrics.json
```

---

## Configuration Files

### Cache Configuration

Create `config/cache_config.json`:

```json
{
  "max_size_mb": 100,
  "ttl_minutes": 60,
  "prefetch_enabled": true,
  "statistics_enabled": true,
  "cleanup_interval_seconds": 300
}
```

### Batch Configuration

Create `config/batch_config.json`:

```json
{
  "chunk_size": 100,
  "max_concurrent": 10,
  "timeout_seconds": 300,
  "stream_enabled": true
}
```

### Monitoring Configuration

Create `config/monitoring_config.json`:

```json
{
  "max_error_rate_pct": 10.0,
  "max_avg_cost_usd": 1.0,
  "min_actionable_rate_pct": 30.0,
  "max_p95_latency_seconds": 30.0,
  "max_cost_increase_pct": 15.0,
  "min_actionable_increase_pct": 50.0
}
```

---

## Troubleshooting

### Cache Issues

**Problem**: Low hit rate (<50%)

**Solutions**:
1. Increase cache size: `CacheConfig(max_size_mb=200)`
2. Increase TTL: `CacheConfig(ttl_minutes=120)`
3. Enable cache warming: `CacheWarmer().warm_all_strategies()`

**Problem**: Memory overflow

**Solutions**:
1. Decrease cache size: `CacheConfig(max_size_mb=50)`
2. Enable more aggressive eviction: Reduce `max_size_mb`

### Batch Query Issues

**Problem**: Slow batch queries (>10s)

**Solutions**:
1. Reduce chunk size: `BatchConfig(chunk_size=50)`
2. Increase concurrency: `BatchConfig(max_concurrent=20)`
3. Check FalkorDB connection pooling

**Problem**: Memory spikes during batch queries

**Solutions**:
1. Enable streaming: `BatchConfig(stream_enabled=True)`
2. Reduce chunk size: `BatchConfig(chunk_size=50)`
3. Process entities sequentially instead of in parallel

### Rollout Issues

**Problem**: Rollout stuck at pilot stage

**Solutions**:
1. Check checkpoint file: `cat data/rollout_checkpoint.json`
2. Review logs: `tail -f data/rollout_metrics.jsonl`
3. Reset rollout: Delete checkpoint and restart

**Problem**: Frequent rollbacks

**Solutions**:
1. Adjust rollback triggers in `RolloutStage` config
2. Fix underlying issues (cost, errors, latency)
3. Run parameter tuning with new data

---

## Performance Expectations

### Phase 5 Targets

| Metric | Target | How to Measure |
|--------|--------|----------------|
| Cache hit rate | >70% | `cache.get_statistics().hit_rate` |
| Hot query latency | <100ms | Time `cache.get()` calls |
| 3,400 entity query | <5s | `batch.benchmark_query_performance()` |
| Memory usage | <2GB | System monitor |

### Phase 6 Targets

| Metric | Target | How to Measure |
|--------|--------|----------------|
| Cost reduction | ≥25% | Compare old vs new system costs |
| Actionable increase | ≥100% | Compare old vs new actionables |
| Error rate | <5% | `monitor.get_aggregate_metrics().error_rate` |
| P95 latency | <2s | `monitor.get_aggregate_metrics().p95_latency_seconds` |

---

## Next Steps

1. **Week 1**: Integrate cache into `HypothesisManager`
2. **Week 1**: Add batch operations to `HypothesisRepository`
3. **Week 2**: Generate validation data and tune parameters
4. **Week 4**: Run pilot rollout (10 entities)
5. **Week 5**: Run limited rollout (100 entities)
6. **Week 6+**: Run production rollout (3,400+ entities)

---

## Support

For issues or questions:
1. Check test files for usage examples
2. Review docstrings in source files
3. Check logs: `data/rollout_metrics.jsonl`
4. Run tests: `pytest backend/tests/ -v`

---

## Summary

**You now have**:
- ✅ Production-ready LRU cache
- ✅ Batch query optimization
- ✅ Cache warming strategies
- ✅ Parameter tuning framework
- ✅ Staged rollout system
- ✅ Real-time monitoring

**Ready to deploy to production!** 🚀
