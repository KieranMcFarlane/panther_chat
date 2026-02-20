#!/usr/bin/env python3
"""
Parameter Tuning Script

Automated parameter optimization using grid search or Bayesian
optimization to maximize discovery effectiveness.

Usage:
    python scripts/tune_parameters.py --method grid --iterations 50
    python scripts/tune_parameters.py --method bayesian --iterations 100
    python scripts/tune_parameters.py --config-file data/best_config.json --validate
"""

import asyncio
import argparse
import json
import logging
import sys
from pathlib import Path

# Add backend to path
sys.path.insert(0, str(Path(__file__).parent.parent))

from backend.parameter_tuning import (
    ParameterTuner,
    ParameterConfig,
    get_default_param_ranges,
    get_bayesian_param_ranges
)

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)


async def load_validation_data(filepath: str = None) -> list:
    """
    Load validation data for parameter tuning.

    Args:
        filepath: Path to validation data JSON file

    Returns:
        List of validation samples
    """
    if filepath:
        with open(filepath, 'r') as f:
            data = json.load(f)
        logger.info(f"Loaded {len(data)} validation samples from {filepath}")
        return data

    # Generate mock validation data
    logger.info("Generating mock validation data")

    mock_data = []
    for i in range(100):
        has_signal = i % 3 == 0  # 33% have signals
        actual_actionable = has_signal and (i % 5 == 0)  # 20% of signals are actionable

        sample = {
            "entity_id": f"entity_{i:04d}",
            "has_signal": has_signal,
            "actual_actionable": actual_actionable,
            "actual_cost_usd": 0.25 if has_signal else 0.10  # Old system cost
        }
        mock_data.append(sample)

    logger.info(f"Generated {len(mock_data)} mock validation samples")
    return mock_data


async def main():
    """Main entry point"""
    parser = argparse.ArgumentParser(description="Tune discovery parameters")
    parser.add_argument(
        "--method",
        choices=["grid", "bayesian"],
        default="grid",
        help="Optimization method"
    )
    parser.add_argument(
        "--iterations",
        type=int,
        default=50,
        help="Number of iterations/samples"
    )
    parser.add_argument(
        "--validation-data",
        type=str,
        default=None,
        help="Path to validation data JSON file"
    )
    parser.add_argument(
        "--output-file",
        type=str,
        default="data/best_config.json",
        help="Path to save best config"
    )
    parser.add_argument(
        "--config-file",
        type=str,
        default=None,
        help="Path to existing config (for validation mode)"
    )
    parser.add_argument(
        "--validation-split",
        type=float,
        default=0.8,
        help="Fraction of data for training (rest for validation)"
    )
    parser.add_argument(
        "--report-file",
        type=str,
        default="data/tuning_report.md",
        help="Path to save tuning report"
    )

    args = parser.parse_args()

    # Validation mode: just validate existing config
    if args.config_file:
        logger.info(f"Validating config from {args.config_file}")

        config = ParameterConfig.load(args.config_file)

        if not config.validate():
            logger.error("Config validation failed")
            return 1

        validation_data = await load_validation_data(args.validation_data)
        tuner = ParameterTuner(validation_data)

        metrics = tuner.validate_config(config)

        logger.info("Validation Results:")
        logger.info(f"  Accuracy: {metrics['accuracy']:.2%}")
        logger.info(f"  Correct Actionable: {metrics['correct_actionable']}")
        logger.info(f"  Correct Non-Actionable: {metrics['correct_non_actionable']}")
        logger.info(f"  Incorrect: {metrics['incorrect']}")
        logger.info(f"  Avg Cost: ${metrics['avg_cost_usd']:.4f}")

        return 0

    # Tuning mode: optimize parameters
    logger.info(f"Starting parameter tuning with {args.method} search")

    # Load validation data
    validation_data = await load_validation_data(args.validation_data)

    # Initialize tuner
    tuner = ParameterTuner(validation_data)

    # Run optimization
    if args.method == "grid":
        logger.info("Using grid search optimization")
        param_ranges = get_default_param_ranges()
        result = tuner.grid_search(
            param_ranges=param_ranges,
            n_samples=args.iterations,
            validation_split=args.validation_split
        )
    else:  # bayesian
        logger.info("Using Bayesian optimization")
        param_ranges = get_bayesian_param_ranges()
        result = tuner.bayesian_optimization(
            param_ranges=param_ranges,
            n_iterations=args.iterations,
            validation_split=args.validation_split
        )

    # Print results
    logger.info("\n=== Tuning Results ===")
    logger.info(f"Best Score: {result.best_score:.4f}")
    logger.info(f"Iterations Completed: {result.iterations_completed}")
    logger.info(f"Duration: {result.tuning_duration_seconds:.2f}s")

    logger.info("\nBest Config:")
    logger.info(json.dumps(result.best_config.to_dict(), indent=2))

    # Save best config
    output_path = Path(args.output_file)
    output_path.parent.mkdir(parents=True, exist_ok=True)
    result.best_config.save(str(output_path))
    logger.info(f"\nBest config saved to {output_path}")

    # Generate report
    report = generate_tuning_report(result, param_ranges, args)
    report_path = Path(args.report_file)
    report_path.parent.mkdir(parents=True, exist_ok=True)
    with open(report_path, 'w') as f:
        f.write(report)
    logger.info(f"Report saved to {report_path}")

    # Validate best config
    logger.info("\n=== Validating Best Config ===")
    validation_metrics = tuner.validate_config(result.best_config)

    logger.info("Validation Metrics:")
    logger.info(f"  Accuracy: {validation_metrics['accuracy']:.2%}")
    logger.info(f"  Correct Actionable: {validation_metrics['correct_actionable']}")
    logger.info(f"  Correct Non-Actionable: {validation_metrics['correct_non_actionable']}")
    logger.info(f"  Incorrect: {validation_metrics['incorrect']}")
    logger.info(f"  Avg Cost: ${validation_metrics['avg_cost_usd']:.4f}")
    logger.info(f"  Total Cost: ${validation_metrics['total_cost_usd']:.2f}")

    return 0


def generate_tuning_report(result, param_ranges, args) -> str:
    """Generate markdown report from tuning results"""
    report = f"""# Parameter Tuning Report

**Generated:** {result.best_config.__class__.__name__}
**Method:** {args.method}
**Iterations:** {result.iterations_completed}
**Duration:** {result.tuning_duration_seconds:.2f}s

## Best Configuration

```json
{json.dumps(result.best_config.to_dict(), indent=2)}
```

## Best Score

{result.best_score:.4f}

## Parameter Ranges

{json.dumps(param_ranges, indent=2)}

## Top 10 Results

"""
    # Sort results by score
    sorted_results = sorted(result.all_results, key=lambda x: x["score"], reverse=True)[:10]

    for i, r in enumerate(sorted_results, 1):
        report += f"\n### Rank {i}: Score {r['score']:.4f}\n"
        report += f"```json\n{json.dumps(r['config'], indent=2)}\n```\n"

    return report


if __name__ == "__main__":
    exit_code = asyncio.run(main())
    sys.exit(exit_code)
