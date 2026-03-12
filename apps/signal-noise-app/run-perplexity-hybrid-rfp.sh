#!/bin/bash

# Perplexity-First Hybrid RFP Detection System
# Intelligent discovery with BrightData fallback for maximum quality & cost efficiency

echo "🎯 PERPLEXITY-FIRST HYBRID RFP DETECTION SYSTEM"
echo "=============================================="
echo ""

# Check if Python 3 is available
if ! command -v python3 &> /dev/null; then
    echo "❌ Error: Python 3 is not installed"
    exit 1
fi

# Check if required environment variables are set
echo "🔍 Checking environment variables..."

if [ -f .env ]; then
    echo "✅ .env file found"
    
    # Check for required variables
    if grep -q "PERPLEXITY_API_KEY=" .env; then
        echo "✅ PERPLEXITY_API_KEY is set"
    else
        echo "⚠️  PERPLEXITY_API_KEY not found - Perplexity features will be limited"
    fi
    
    if grep -q "BRIGHTDATA_API_TOKEN=" .env; then
        echo "✅ BRIGHTDATA_API_TOKEN is set"
    else
        echo "⚠️  BRIGHTDATA_API_TOKEN not found - BrightData fallback will be disabled"
    fi
    
    if grep -q "SUPABASE_URL=" .env; then
        echo "✅ SUPABASE_URL is set"
    else
        echo "⚠️  SUPABASE_URL not found - Storage will be disabled"
    fi
else
    echo "❌ Error: .env file not found"
    echo "Please create .env file with required environment variables"
    exit 1
fi

echo ""
echo "🚀 Starting Perplexity-First Hybrid RFP Detection..."
echo ""

# Run the detection system
python3 backend/perplexity_hybrid_rfp_detector.py

# Check if execution was successful
if [ $? -eq 0 ]; then
    echo ""
    echo "✅ RFP detection completed successfully!"
    echo ""
    echo "📊 Results have been saved to: perplexity_hybrid_rfp_results_*.json"
    echo "📋 Logs available in: rfp_detection.log"
else
    echo ""
    echo "❌ RFP detection failed. Check logs for details."
    exit 1
fi