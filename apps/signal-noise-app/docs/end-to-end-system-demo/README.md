# End-to-End System Demonstration

This directory contains the complete end-to-end system demonstration for client presentation.

## Structure

- `scripts/` - Orchestration and data capture scripts
- `data/` - Raw captured data from system execution
- `2026-02-17-end-to-end-system-demo.md` - Complete documentation (generated)

## Running the Demo

```bash
cd docs/end-to-end-system-demo/scripts
python run_end_to_end_demo.py
```

This will:
1. Execute all 6 system steps for 3 entities
2. Capture all outputs, metrics, and logs
3. Generate the complete markdown documentation
