# Integration Guide: Phases 5-6

This guide provides step-by-step instructions for integrating the new Phase 5-6 components into the existing hypothesis-driven discovery system.

---

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Phase 5 Integration](#phase-5-integration)
3. [Phase 6 Integration](#phase-6-integration)
4. [Testing Integration](#testing-integration)
5. [Deployment Checklist](#deployment-checklist)

---

## Prerequisites

### Files to Modify

You'll need to modify these existing files:

1. `backend/hypothesis_manager.py` - Add cache layer
2. `backend/hypothesis_persistence_native.py` - Add batch operations
3. `backend/eig_calculator.py` - Make parameters configurable
4. `backend/hypothesis_driven_discovery.py` - Accept ParameterConfig

### Backup First!

```bash
# Create backup directory
mkdir -p backups/phases_5_6_integration

# Backup files to modify
cp backend/hypothesis_manager.py backups/phases_5_6_integration/
cp backend/hypothesis_persistence_native.py backups/phases_5_6_integration/
cp backend/eig_calculator.py backups/phases_5_6_integration/
cp backend/hypothesis_driven_discovery.py backups/phases_5_6_integration/
```

---

## Phase 5 Integration

### Step 1: Integrate Cache into HypothesisManager

**File**: `backend/hypothesis_manager.py`

**Location**: After imports, before `__init__` method

**Add import**:
```python
from backend.hypothesis_cache import HypothesisLRUCache, CacheConfig
```

**Modify `__init__` method**:

```python
class HypothesisManager:
    def __init__(
        self,
        repository: HypothesisRepository = None,
        cache_enabled: bool = True,
        cache_config: CacheConfig = None
    ):
        self.repository = repository or HypothesisRepository()

        # Initialize cache
        if cache_enabled:
            self.cache = HypothesisLRUCache(cache_config or CacheConfig())
            logger.info("Hypothesis cache enabled")
        else:
            self.cache = None
            logger.info("Hypothesis cache disabled")
```

**Modify `get_hypothesis` method**:

```python
async def get_hypothesis(self, hypothesis_id: str) -> Optional[Hypothesis]:
    """
    Get hypothesis by ID with cache layer.

    Args:
        hypothesis_id: Unique hypothesis identifier

    Returns:
        Hypothesis object or None
    """
    # Check cache first
    if self.cache:
        cached = await self.cache.get(hypothesis_id)
        if cached:
            logger.debug(f"Cache hit: {hypothesis_id}")
            return Hypothesis(**cached)

    logger.debug(f"Cache miss: {hypothesis_id}")

    # Fall back to repository
    hypothesis = await self.repository.get_hypothesis(hypothesis_id)

    # Update cache
    if self.cache and hypothesis:
        from dataclasses import asdict
        await self.cache.set(hypothesis_id, asdict(hypothesis))

    return hypothesis
```

**Add cache invalidation to update/delete methods**:

```python
async def update_hypothesis(self, hypothesis: Hypothesis) -> bool:
    """Update hypothesis and invalidate cache"""
    success = await self.repository.update_hypothesis(hypothesis)

    # Invalidate cache entry
    if success and self.cache:
        await self.cache.invalidate(hypothesis.hypothesis_id)

    return success

async def delete_hypothesis(self, hypothesis_id: str) -> bool:
    """Delete hypothesis and invalidate cache"""
    success = await self.repository.delete_hypothesis(hypothesis_id)

    # Invalidate cache entry
    if success and self.cache:
        await self.cache.invalidate(hypothesis_id)

    return success
```

**Add cache statistics method**:

```python
def get_cache_statistics(self):
    """Get cache performance statistics"""
    if self.cache:
        return self.cache.get_statistics()
    return None
```

---

### Step 2: Add Batch Operations to HypothesisRepository

**File**: `backend/hypothesis_persistence_native.py`

**Location**: After existing query methods

**Add import**:
```python
from backend.batch_hypothesis_query import BatchHypothesisQuery, BatchConfig
```

**Add batch query method**:

```python
async def get_hypotheses_batch(
    self,
    entity_ids: List[str],
    template_id: Optional[str] = None
) -> Dict[str, List[Hypothesis]]:
    """
    Batch query hypotheses for multiple entities.

    Args:
        entity_ids: List of entity IDs
        template_id: Optional template filter

    Returns:
        Dict mapping entity_id to list of hypotheses
    """
    batch = BatchHypothesisQuery(self)
    return await batch.get_hypotheses_batch(entity_ids, template_id)
```

**Add batch update method**:

```python
async def update_confidences_batch(
    self,
    updates: List[Dict[str, float]]
) -> int:
    """
    Batch update hypothesis confidences.

    Args:
        updates: List of {hypothesis_id, confidence_delta} dicts

    Returns:
        Number of hypotheses successfully updated
    """
    batch = BatchHypothesisQuery(self)
    return await batch.update_confidences_batch(updates)
```

**Add batch create method**:

```python
async def create_hypotheses_batch(
    self,
    hypotheses: List[Hypothesis]
) -> int:
    """
    Batch create hypotheses.

    Args:
        hypotheses: List of Hypothesis objects to create

    Returns:
        Number of hypotheses successfully created
    """
    batch = BatchHypothesisQuery(self)
    return await batch.create_hypotheses_batch(hypotheses)
```

---

### Step 3: Initialize Cache Warmer (Optional)

**File**: `backend/hypothesis_manager.py`

**Add to `__init__` method**:

```python
class HypothesisManager:
    def __init__(
        self,
        repository: HypothesisRepository = None,
        cache_enabled: bool = True,
        cache_warming_enabled: bool = True
    ):
        self.repository = repository or HypothesisRepository()

        # Initialize cache
        if cache_enabled:
            self.cache = HypothesisLRUCache()
        else:
            self.cache = None

        # Initialize cache warmer
        if cache_warming_enabled and self.cache:
            from backend.cache_warmer import CacheWarmer
            self.cache_warmer = CacheWarmer(self.cache, self.repository)
        else:
            self.cache_warmer = None
```

**Add warming method**:

```python
async def warm_cache(self):
    """Warm cache with recent entities"""
    if self.cache_warmer:
        results = await self.cache_warmer.warm_all_strategies()
        logger.info(f"Cache warming completed: {results}")
        return results
    return {}
```

---

## Phase 6 Integration

### Step 1: Make EIG Calculator Configurable

**File**: `backend/eig_calculator.py`

**Location**: After imports, before `EIGCalculator` class

**Add config dataclass**:

```python
from dataclasses import dataclass

@dataclass
class EIGConfig:
    """Configuration for EIG calculation"""
    category_multipliers: Dict[str, float]
    novelty_decay_factor: float = 1.0
    information_value_default: float = 1.0

    def __post_init__(self):
        """Validate configuration"""
        if not self.category_multipliers:
            raise ValueError("category_multipliers cannot be empty")
```

**Modify `EIGCalculator.__init__`**:

```python
class EIGCalculator:
    def __init__(self, config: EIGConfig = None):
        """
        Initialize EIG calculator with configuration.

        Args:
            config: EIGConfig or None for defaults
        """
        if config is None:
            # Use default multipliers
            config = EIGConfig(
                category_multipliers=CATEGORY_VALUE_MULTIPLIERS.copy()
            )

        self.config = config
        self.category_multipliers = config.category_multipliers
        self.novelty_decay_factor = config.novelty_decay_factor
        self.information_value_default = config.information_value_default
```

**Update `calculate_eig` to use config**:

```python
def calculate_eig(
    self,
    hypothesis: Hypothesis,
    cluster_state: Dict[str, Any]
) -> float:
    """
    Calculate Expected Information Gain (EIG).

    Args:
        hypothesis: Hypothesis to evaluate
        cluster_state: Current cluster learning state

    Returns:
        EIG score
    """
    # Get category multiplier from config
    category_mult = self.category_multipliers.get(
        hypothesis.category,
        self.config.information_value_default
    )

    # Rest of calculation...
```

---

### Step 2: Make Discovery System Accept ParameterConfig

**File**: `backend/hypothesis_driven_discovery.py`

**Add import**:
```python
from backend.parameter_tuning import ParameterConfig
from backend.eig_calculator import EIGConfig
```

**Modify `__init__` method**:

```python
class HypothesisDrivenDiscovery:
    def __init__(
        self,
        config: ParameterConfig = None,
        repository: HypothesisRepository = None,
        cache_enabled: bool = True
    ):
        """
        Initialize hypothesis-driven discovery with parameters.

        Args:
            config: ParameterConfig or None for defaults
            repository: HypothesisRepository instance
            cache_enabled: Enable hypothesis caching
        """
        self.config = config or ParameterConfig()
        self.repository = repository or HypothesisRepository()

        # Initialize EIG calculator with config
        eig_config = EIGConfig(
            category_multipliers=self.config.get_eig_multipliers(),
            novelty_decay_factor=self.config.novelty_decay_factor
        )
        self.eig_calculator = EIGCalculator(eig_config)

        # Initialize hypothesis manager with cache
        self.hypothesis_manager = HypothesisManager(
            repository=self.repository,
            cache_enabled=cache_enabled
        )

        # Use config parameters
        self.max_iterations = self.config.max_iterations
        self.max_depth = self.config.max_depth
        self.accept_delta = self.config.accept_delta
        self.weak_accept_delta = self.config.weak_accept_delta
```

**Update methods to use config parameters**:

```python
async def run_discovery(
    self,
    entity_id: str,
    template_id: str,
    max_cost_usd: float = None
) -> Dict:
    """
    Run hypothesis-driven discovery.

    Args:
        entity_id: Entity to discover
        template_id: Template to use
        max_cost_usd: Optional cost override

    Returns:
        Discovery results
    """
    # Use config max_cost if not specified
    if max_cost_usd is None:
        max_cost_usd = self.config.max_cost_per_entity

    # Rest of discovery...
    for iteration in range(self.config.max_iterations):
        if current_cost >= max_cost_usd:
            break

        # Check depth limit
        if current_depth >= self.config.max_depth:
            break

        # ... rest of logic
```

---

### Step 3: Add Monitoring Integration

**File**: `backend/hypothesis_driven_discovery.py`

**Add monitoring to `__init__`**:

```python
class HypothesisDrivenDiscovery:
    def __init__(
        self,
        config: ParameterConfig = None,
        repository: HypothesisRepository = None,
        monitor: RolloutMonitor = None
    ):
        # ... existing init ...

        # Optional monitoring
        self.monitor = monitor
```

**Add monitoring to `run_discovery`**:

```python
async def run_discovery(
    self,
    entity_id: str,
    template_id: str,
    max_cost_usd: float = None
) -> Dict:
    """Run discovery with monitoring"""
    start_time = datetime.now()

    try:
        # ... run discovery ...

        result = {
            "entity_id": entity_id,
            "total_cost_usd": total_cost,
            "iterations": iterations,
            "actionable": is_actionable,
            "final_confidence": final_confidence,
            "duration_seconds": (datetime.now() - start_time).total_seconds()
        }

        # Record to monitor if available
        if self.monitor:
            await self.monitor.record_discovery(
                entity_id=entity_id,
                result=result
            )

        return result

    except Exception as e:
        # Record error to monitor
        if self.monitor:
            await self.monitor.record_discovery(
                entity_id=entity_id,
                result={
                    "entity_id": entity_id,
                    "error": str(e),
                    "total_cost_usd": 0,
                    "iterations": 0,
                    "actionable": False,
                    "duration_seconds": (datetime.now() - start_time).total_seconds()
                }
            )
        raise
```

---

## Testing Integration

### Test 1: Cache Integration

```bash
python -c "
import asyncio
from backend.hypothesis_manager import HypothesisManager

async def test():
    # Create manager with cache
    manager = HypothesisManager(cache_enabled=True)

    # Check cache stats
    stats = manager.get_cache_statistics()
    print(f'Cache initialized: {stats.item_count} items')

    # Get hypothesis (will cache)
    h = await manager.get_hypothesis('test_id')
    if h:
        print(f'Got hypothesis: {h.hypothesis_id}')

    # Check cache hit rate
    stats = manager.get_cache_statistics()
    print(f'Hit rate: {stats.hit_rate:.2%}')

asyncio.run(test())
"
```

### Test 2: Batch Operations

```bash
python -c "
import asyncio
from backend.hypothesis_persistence_native import HypothesisRepository

async def test():
    repo = HypothesisRepository()

    # Batch query
    entity_ids = ['entity_1', 'entity_2', 'entity_3']
    results = await repo.get_hypotheses_batch(entity_ids)

    print(f'Batch query results: {len(results)} entities')

    # Batch update
    updates = [
        {'hypothesis_id': 'h1', 'confidence_delta': 0.06},
        {'hypothesis_id': 'h2', 'confidence_delta': 0.06}
    ]
    updated = await repo.update_confidences_batch(updates)

    print(f'Batch update: {updated} hypotheses')

asyncio.run(test())
"
```

### Test 3: Parameter Config

```bash
python -c "
from backend.parameter_tuning import ParameterConfig
from backend.hypothesis_driven_discovery import HypothesisDrivenDiscovery

# Create custom config
config = ParameterConfig(
    accept_delta=0.07,
    max_iterations=25,
    c_suite_multiplier=2.0
)

# Validate config
assert config.validate(), 'Config validation failed'

# Initialize discovery with config
discovery = HypothesisDrivenDiscovery(config=config)

print(f'Discovery initialized with custom config')
print(f'  accept_delta: {discovery.accept_delta}')
print(f'  max_iterations: {discovery.max_iterations}')
"
```

### Test 4: End-to-End Integration

```bash
python -c "
import asyncio
from backend.hypothesis_driven_discovery import HypothesisDrivenDiscovery
from backend.rollout_monitor import RolloutMonitor
from backend.parameter_tuning import ParameterConfig

async def test():
    # Create monitor
    monitor = RolloutMonitor()

    # Create discovery with monitoring
    config = ParameterConfig()
    discovery = HypothesisDrivenDiscovery(
        config=config,
        monitor=monitor
    )

    # Run discovery
    result = await discovery.run_discovery(
        entity_id='test_entity',
        template_id='crm_template'
    )

    print(f'Discovery result: {result}')

    # Check metrics
    metrics = await monitor.get_aggregate_metrics()
    print(f'Metrics: {metrics.entities_processed} entities processed')

asyncio.run(test())
"
```

---

## Deployment Checklist

### Pre-Deployment

- [ ] Backup all files to modify
- [ ] Run unit tests: `pytest backend/tests/ -v`
- [ ] Review code changes
- [ ] Create feature branch

### Phase 5 Deployment

- [ ] Integrate cache into `HypothesisManager`
- [ ] Add batch operations to `HypothesisRepository`
- [ ] Test cache hit rate (>70% target)
- [ ] Benchmark batch queries (<5s for 3400 entities)
- [ ] Enable cache warming
- [ ] Monitor memory usage (<2GB target)

### Phase 6 Deployment

- [ ] Make `EIGCalculator` configurable
- [ ] Make `HypothesisDrivenDiscovery` accept `ParameterConfig`
- [ ] Generate validation data (100 entities)
- [ ] Run parameter tuning: `python scripts/tune_parameters.py --method grid`
- [ ] Validate best config
- [ ] Run pilot rollout: `python scripts/run_staged_rollout.py --stage pilot`
- [ ] Monitor metrics: check `data/rollout_metrics.jsonl`
- [ ] Review pilot report: `data/rollout_report.md`

### Production Deployment

- [ ] Run limited rollout (100 entities)
- [ ] Validate success criteria (≥20% cost reduction, ≥80% actionable increase)
- [ ] Fix any issues
- [ ] Run production rollout (3400 entities)
- [ ] Monitor continuously (check alerts daily)
- [ ] Optimize parameters weekly

### Post-Deployment

- [ ] Monitor cache hit rate
- [ ] Monitor batch query performance
- [ ] Monitor cost reduction vs old system
- [ ] Monitor actionable increase
- [ ] Review error rates
- [ ] Tune parameters as needed

---

## Rollback Plan

If issues arise:

1. **Disable Cache**:
   ```python
   manager = HypothesisManager(cache_enabled=False)
   ```

2. **Use Default Config**:
   ```python
   discovery = HypothesisDrivenDiscovery(config=None)
   ```

3. **Restore Backups**:
   ```bash
   cp backups/phases_5_6_integration/hypothesis_manager.py backend/
   cp backups/phases_5_6_integration/hypothesis_persistence_native.py backend/
   ```

4. **Rollback Staged Rollout**:
   ```bash
   # Delete checkpoint and restart with old system
   rm data/rollout_checkpoint.json
   ```

---

## Troubleshooting

### Issue: Import Errors

**Problem**: `ModuleNotFoundError: No module named 'backend.hypothesis_cache'`

**Solution**:
```bash
# Check file exists
ls backend/hypothesis_cache.py

# Check PYTHONPATH
echo $PYTHONPATH

# Add to path if needed
export PYTHONPATH="/path/to/signal-noise-app:$PYTHONPATH"
```

### Issue: Cache Not Working

**Problem**: Cache hit rate is 0%

**Solutions**:
1. Check cache is enabled: `manager.cache is not None`
2. Check cache statistics: `manager.get_cache_statistics()`
3. Verify cache is being called (add debug logs)
4. Check TTL is not too short: `CacheConfig(ttl_minutes=60)`

### Issue: Batch Queries Slow

**Problem**: Batch queries take >10 seconds

**Solutions**:
1. Reduce chunk size: `BatchConfig(chunk_size=50)`
2. Check FalkorDB connection: Verify credentials
3. Enable connection pooling
4. Check for locks: `SHOW PROCESSLIST` in FalkorDB

### Issue: Parameter Tuning Fails

**Problem**: Tuning script crashes

**Solutions**:
1. Check validation data format
2. Reduce iterations: `--iterations 10`
3. Use grid search instead of Bayesian
4. Check parameter ranges are valid

---

## Support

For integration issues:
1. Check this guide's troubleshooting section
2. Review test files for examples
3. Check source code docstrings
4. Run tests: `pytest backend/tests/ -v`

---

## Summary

**Integration Steps**:
1. ✅ Backup existing files
2. ✅ Integrate cache into HypothesisManager
3. ✅ Add batch operations to HypothesisRepository
4. ✅ Make EIGCalculator configurable
5. ✅ Make Discovery accept ParameterConfig
6. ✅ Add monitoring integration
7. ✅ Test integration
8. ✅ Deploy to production

**You're ready to go!** 🚀
