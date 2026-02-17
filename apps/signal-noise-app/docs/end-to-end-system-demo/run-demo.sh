#!/bin/bash
set -e  # Exit on error

# Print header
echo "================================"
echo "  SIGNAL NOISE E2E DEMO"
echo "================================"

# Check Python version
PYTHON_VERSION=$(python3 --version 2>&1 | awk '{print $2}')
echo "Python version: $PYTHON_VERSION"

# Check for .env file (warn if missing)
if [ ! -f ../../.env ]; then
    echo "Warning: .env file not found. Creating from .env.example..."
    if [ -f ../../.env.example ]; then
        cp ../../.env.example ../../.env
        echo "Created .env file. Please edit it with your API keys."
        echo "Then run this script again."
        exit 1
    else
        echo "Error: .env.example not found. Cannot create .env file."
        exit 1
    fi
else
    echo "Found .env file"
fi

# Run orchestrator
echo ""
echo "Running end-to-end orchestrator..."
cd scripts && python3 run_end_to_end_demo.py
cd ..

# Run documentation generator
echo ""
echo "Generating documentation..."
python3 scripts/generate_documentation.py

# Print completion with doc location
echo ""
echo "================================"
echo "  DEMO COMPLETE"
echo "================================"
echo "Documentation: docs/end-to-end-system-demo/output/end-to-end-demo-report.md"
echo ""
echo "View results: cat docs/end-to-end-system-demo/output/end-to-end-demo-report.md"
