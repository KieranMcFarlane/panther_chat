#!/bin/bash
# =============================================================================
# Ralph Loop Validation Service (Iteration 08 Compliant)
# =============================================================================
#
# Purpose: Start Ralph Loop validation service on port 8001
#
# Iteration 08 Invariants:
#   - min_evidence = 3 (signals with < 3 evidence items rejected)
#   - min_confidence = 0.7 (signals below threshold rejected)
#   - max_passes = 3 (3-pass validation enforced)
#   - validated == true and validation_pass == 3 before write
#   - Ralph Loop is MANDATORY for all signal creation
#
# Architecture:
#   Port 8001: Ralph Loop validation service (this script)
#   Port 8000: Graphiti MCP server (storage)
#   Port 3005: CopilotKit (runtime queries)
#
# Data Flow (Iteration 08):
#   Scrapers → Ralph Loop (port 8001) → 3-pass validation → Graphiti (port 8000)
#   CopilotKit → Graphiti (port 8000) → Tool-backed answers → User
#
# Usage:
#   ./scripts/start-ralph-loop.sh
#
# =============================================================================

set -e  # Exit on error

# Change to project root directory
cd "$(dirname "$0")/.."
PROJECT_ROOT="$(pwd)"

if [ ! -f "$PROJECT_ROOT/.env" ]; then
  echo "❌ Error: .env file not found at $PROJECT_ROOT/.env"
  exit 1
fi

# Load environment variables from main .env file
echo "🔐 Loading environment variables from .env..."
set -a  # Automatically export all variables
source "$PROJECT_ROOT/.env"
set +a

# Change to backend directory for running the service
BACKEND_DIR="$PROJECT_ROOT/backend"

if [ ! -d "$BACKEND_DIR" ]; then
  echo "❌ Error: backend directory not found at $BACKEND_DIR"
  exit 1
fi

cd "$BACKEND_DIR"

# Check required environment variables
if [ -z "$ANTHROPIC_API_KEY" ] && [ -z "$ANTHROPIC_AUTH_TOKEN" ]; then
  echo "❌ Error: Neither ANTHROPIC_API_KEY nor ANTHROPIC_AUTH_TOKEN is set"
  echo "   Please set your Anthropic API credentials in .env"
  exit 1
fi

# Check for database connection
if [ -z "$NEO4J_URI" ] && [ -z "$FALKORDB_URI" ]; then
  echo "❌ Error: Neither NEO4J_URI nor FALKORDB_URI is set"
  echo "   Please set your database credentials in .env"
  exit 1
fi

echo ""
echo "🔄 Ralph Loop Validation Service (Iteration 08 Compliant)"
echo "══════════════════════════════════════════════════════════"
echo ""
echo "📊 Iteration 08 Invariants:"
echo "   • min_evidence = 3 (minimum 3 evidence items per signal)"
echo "   • min_confidence = 0.7 (confidence threshold)"
echo "   • max_passes = 3 (3-pass validation enforced)"
echo "   • validated == true (only validated signals written to Graphiti)"
echo ""
echo "🌐 Service Configuration:"
echo "   • Port: 8001 (Ralph Loop validation)"
echo "   • Graphiti MCP: Port 8000 (storage)"
echo "   • API Docs: http://localhost:8001/docs"
echo "   • Health Check: http://localhost:8001/health"
echo ""
echo "🔄 Signal Validation Endpoint:"
echo "   • POST http://localhost:8001/api/signals/validate"
echo ""
echo "📋 Data Flow (Iteration 08):"
echo "   1. Scrapers → Ralph Loop (port 8001) → 3-pass validation"
echo "   2. Ralph Loop → Graphiti (port 8000) → validated signals only"
echo "   3. CopilotKit → Graphiti (port 8000) → tool-backed answers"
echo ""
echo "══════════════════════════════════════════════════════════"
echo ""
echo "✅ Starting Ralph Loop service..."
echo ""

# Start the FastAPI backend
python3 main.py
