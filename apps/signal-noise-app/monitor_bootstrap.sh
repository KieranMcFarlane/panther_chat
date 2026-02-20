#!/bin/bash

echo "🔍 Monitoring production template discovery..."
echo "Started: $(date)"
echo ""

while true; do
    # Check if bootstrap script is still running
    if ! ps -p $(cat bootstrap.pid 2>/dev/null) > /dev/null 2>&1; then
        echo ""
        echo "🎉 BOOTSTRAP COMPLETE!"
        echo "Finished: $(date)"
        echo ""
        
        # Show final results
        if [ -f "bootstrapped_templates/bootstrap_summary.json" ]; then
            echo "📊 Final Results:"
            jq '.' bootstrapped_templates/bootstrap_summary.json
        fi
        
        # Show template count
        if [ -f "bootstrapped_templates/templates.json" ]; then
            COUNT=$(jq '. | length' bootstrapped_templates/templates.json)
            echo ""
            echo "✅ Templates generated: $COUNT"
        fi
        
        break
    fi
    
    # Show progress every 30 seconds
    if [ $(( $(date +%s) % 30 )) -lt 2 ]; then
        bash scripts/check_bootstrap_progress.sh 2>/dev/null | grep -E "(Entities|Clustering|Templates|Validation|complete|pending)" || true
        echo "Still running... $(date +%H:%M:%S)"
        echo ""
    fi
    
    sleep 2
done

echo ""
echo "✅ Monitor complete. Check bootstrap_full.log for details."
