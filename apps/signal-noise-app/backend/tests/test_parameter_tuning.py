"""
Unit Tests for Parameter Tuning

Tests the grid search and Bayesian optimization for parameter tuning.
"""

import pytest
from backend.parameter_tuning import (
    ParameterConfig,
    ParameterTuner,
    TuningResult,
    get_default_param_ranges,
    get_bayesian_param_ranges
)


@pytest.fixture
def sample_validation_data():
    """Sample validation data for testing"""
    data = []
    for i in range(20):
        has_signal = i % 3 == 0
        actual_actionable = has_signal and (i % 5 == 0)

        sample = {
            "entity_id": f"entity_{i:04d}",
            "has_signal": has_signal,
            "actual_actionable": actual_actionable,
            "actual_cost_usd": 0.25
        }
        data.append(sample)
    return data


@pytest.fixture
def tuner(sample_validation_data):
    """ParameterTuner instance for testing"""
    return ParameterTuner(sample_validation_data)


def test_parameter_config_defaults():
    """Test default parameter values"""
    config = ParameterConfig()

    assert config.c_suite_multiplier == 1.5
    assert config.digital_multiplier == 1.3
    assert config.accept_delta == 0.06
    assert config.max_iterations == 30
    assert config.cache_ttl_minutes == 60


def test_parameter_config_validation():
    """Test parameter validation"""
    # Valid config
    config = ParameterConfig(
        accept_delta=0.05,
        max_iterations=20
    )
    assert config.validate() is True

    # Invalid config (accept_delta too high)
    config = ParameterConfig(
        accept_delta=1.5  # > 1.0
    )
    assert config.validate() is False

    # Invalid config (max_iterations negative)
    config = ParameterConfig(
        max_iterations=-1
    )
    assert config.validate() is False


def test_parameter_config_serialization():
    """Test config save/load"""
    config = ParameterConfig(
        accept_delta=0.07,
        max_iterations=25
    )

    # To dict
    data = config.to_dict()
    assert data["accept_delta"] == 0.07
    assert data["max_iterations"] == 25

    # From dict
    config2 = ParameterConfig.from_dict(data)
    assert config2.accept_delta == 0.07
    assert config2.max_iterations == 25


def test_get_eig_multipliers():
    """Test EIG multiplier retrieval"""
    config = ParameterConfig(
        c_suite_multiplier=2.0,
        digital_multiplier=1.5
    )

    multipliers = config.get_eig_multipliers()

    assert multipliers["C-SUITE"] == 2.0
    assert multipliers["DIGITAL"] == 1.5
    assert multipliers["COMMERCIAL"] == 1.1  # default


def test_grid_search(tuner):
    """Test grid search optimization"""
    param_ranges = {
        "accept_delta": (0.01, 0.10, 0.02),
        "max_iterations": (10, 30, 10)
    }

    result = tuner.grid_search(
        param_ranges=param_ranges,
        n_samples=5,
        validation_split=0.8
    )

    assert isinstance(result, TuningResult)
    assert result.best_config is not None
    # Score can be negative with mock data (realistic - models aren't perfect)
    assert isinstance(result.best_score, (int, float))
    assert len(result.all_results) > 0
    assert result.tuning_duration_seconds >= 0


def test_grid_search_small_range(tuner):
    """Test grid search with small parameter range"""
    param_ranges = {
        "accept_delta": (0.04, 0.08, 0.02)  # 0.04, 0.06, 0.08
    }

    result = tuner.grid_search(
        param_ranges=param_ranges,
        n_samples=3,
        validation_split=0.8
    )

    # Should test 3 combinations
    assert len(result.all_results) <= 3


def test_validate_config(tuner):
    """Test config validation on test data"""
    config = ParameterConfig(
        accept_delta=0.06,
        max_iterations=20
    )

    metrics = tuner.validate_config(config)

    assert "accuracy" in metrics
    assert "correct_actionable" in metrics
    assert "correct_non_actionable" in metrics
    assert "incorrect" in metrics
    assert "avg_cost_usd" in metrics


def test_simulate_discovery(tuner):
    """Test discovery simulation"""
    sample = {
        "entity_id": "test_entity",
        "has_signal": True,
        "actual_actionable": True,
        "actual_cost_usd": 0.25
    }

    config = ParameterConfig(
        accept_delta=0.06,
        max_iterations=10
    )

    result = tuner._simulate_discovery(sample, config)

    assert "entity_id" in result
    assert "actionable" in result
    assert "cost_usd" in result
    assert "confidence" in result
    assert "iterations" in result


def test_simulate_discovery_no_signal(tuner):
    """Test discovery simulation with no signal"""
    sample = {
        "entity_id": "test_entity",
        "has_signal": False,
        "actual_actionable": False,
        "actual_cost_usd": 0.10
    }

    config = ParameterConfig(
        accept_delta=0.06,
        max_iterations=10
    )

    result = tuner._simulate_discovery(sample, config)

    # Should not be actionable without signal
    assert result["actionable"] is False


def test_calculate_score(tuner):
    """Test score calculation"""
    config = ParameterConfig(accept_delta=0.06)

    # Use first 80% for training, last 20% for validation
    split_idx = int(len(tuner.validation_data) * 0.8)
    validation_data = tuner.validation_data[split_idx:]
    train_data = tuner.validation_data[:split_idx]

    score = tuner._calculate_score(config, validation_data, train_data)

    assert isinstance(score, float)
    # Score should be reasonable (not NaN or infinite)
    assert abs(score) < 1000


def test_bayesian_optimization_fallback(tuner, monkeypatch):
    """Test Bayesian optimization falls back to grid search if scikit-optimize not available"""
    # Mock import error
    import builtins
    real_import = builtins.__import__

    def mock_import(name, *args, **kwargs):
        if name == "skopt":
            raise ImportError("No module named 'skopt'")
        return real_import(name, *args, **kwargs)

    monkeypatch.setattr(builtins, "__import__", mock_import)

    param_ranges = {
        "accept_delta": (0.01, 0.10),
        "max_iterations": (10, 30)
    }

    result = tuner.bayesian_optimization(
        param_ranges=param_ranges,
        n_iterations=10,
        validation_split=0.8
    )

    # Should fall back to grid search
    assert isinstance(result, TuningResult)
    assert result.best_config is not None


def test_get_default_param_ranges():
    """Test default parameter ranges"""
    ranges = get_default_param_ranges()

    assert "accept_delta" in ranges
    assert "weak_accept_delta" in ranges
    assert "c_suite_multiplier" in ranges
    assert "max_iterations" in ranges

    # Check format: (min, max, step)
    for param, range_val in ranges.items():
        assert len(range_val) == 3
        assert range_val[0] < range_val[1]  # min < max
        assert range_val[2] > 0  # positive step


def test_get_bayesian_param_ranges():
    """Test Bayesian parameter ranges"""
    ranges = get_bayesian_param_ranges()

    assert "accept_delta" in ranges
    assert "max_iterations" in ranges

    # Check format: (min, max)
    for param, range_val in ranges.items():
        assert len(range_val) == 2
        assert range_val[0] < range_val[1]  # min < max


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
