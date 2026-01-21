#!/bin/bash
echo "╔══════════════════════════════════════════════════════════════╗"
echo "║  📊 BATCH 1 PROGRESS MONITOR (300 Entities)                 ║"
echo "╚══════════════════════════════════════════════════════════════╝"
echo ""

while true; do
  RESULT_FILE=$(ls -t logs/rfp_results_batch1_*.json 2>/dev/null | grep -v "_clean" | head -1)
  
  if [ -n "$RESULT_FILE" ]; then
    FILE_SIZE=$(ls -lh "$RESULT_FILE" 2>/dev/null | awk '{print $5}')
    echo -ne "\r🔄 Processing... File size: $FILE_SIZE | "
    
    CLAUDE_COUNT=$(ps aux | grep claude | grep -v grep | wc -l | tr -d ' ')
    echo -ne "Claude processes: $CLAUDE_COUNT | "
    
    echo -ne "Time: $(date +'%H:%M:%S')  "
  fi
  
  sleep 3
done
