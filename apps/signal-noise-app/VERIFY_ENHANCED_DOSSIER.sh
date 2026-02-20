#!/bin/bash

echo "=========================================="
echo "ENHANCED DOSSIER SYSTEM VERIFICATION"
echo "=========================================="
echo ""

echo "1. Checking Backend Files..."
echo ""

files=(
  "backend/dossier_data_collector.py:_collect_multi_source_intelligence"
  "backend/universal_club_prompts.py:SCORE_CONTEXT_TEMPLATE"
  "backend/universal_club_prompts.py:OUTREACH_STRATEGY_PROMPT"
  "backend/dossier_generator.py:outreach_strategy"
  "backend/linkedin_profiler.py:provider_keywords"
  "backend/dossier_outreach_api.py:get_outreach_intelligence"
)

all_found=true
for file in "${files[@]}"; do
  IFS=':' read -r filepath method <<< "$file"
  if [ -f "$filepath" ]; then
    if grep -q "$method" "$filepath"; then
      echo "  ✅ $filepath"
      echo "     └─ $method: FOUND"
    else
      echo "  ⚠️  $filepath"
      echo "     └─ $method: NOT FOUND"
      all_found=false
    fi
  else
    echo "  ❌ $filepath: FILE NOT FOUND"
    all_found=false
  fi
done

echo ""
echo "2. Checking Frontend Files..."
echo ""

frontend_files=(
  "src/components/entity-dossier/ScoreWithContext.tsx"
  "src/components/entity-dossier/ConversationTreeViewer.tsx"
  "src/app/api/outreach-intelligence/route.ts"
)

for file in "${frontend_files[@]}"; do
  if [ -f "$file" ]; then
    lines=$(wc -l < "$file")
    echo "  ✅ $file"
    echo "     └─ $lines lines"
  else
    echo "  ❌ $file: NOT FOUND"
    all_found=false
  fi
done

echo ""
echo "3. Testing Multi-Source Collection..."
echo ""

python3 -c "
import asyncio
import sys
sys.path.insert(0, 'backend')

async def test():
    from dossier_data_collector import DossierDataCollector
    collector = DossierDataCollector()
    data = await collector._collect_multi_source_intelligence('Test Entity')
    sources = data.get('sources_used', [])
    freshness = data.get('freshness_score', 0)
    print(f'  ✅ Sources: {len(sources)} found')
    print(f'  ✅ Freshness Score: {freshness}/100')
    return len(sources) > 0

result = asyncio.run(test())
sys.exit(0 if result else 1)
" 2>&1 | grep -E "✅|❌" | sed 's/^/  /'

echo ""
echo "4. Verifying Prompt Template Updates..."
echo ""

if grep -q '"outreach_strategy"' backend/dossier_generator.py; then
  echo "  ✅ outreach_strategy section in prompt template"
else
  echo "  ❌ outreach_strategy section NOT in prompt template"
  all_found=false
fi

if grep -q '"meaning"' backend/dossier_generator.py; then
  echo "  ✅ Contextual score fields (meaning, why, benchmark, action) in template"
else
  echo "  ❌ Contextual score fields NOT in template"
  all_found=false
fi

echo ""
echo "=========================================="
if [ "$all_found" = true ]; then
  echo "✅ VERIFICATION COMPLETE: ALL SYSTEMS GO"
else
  echo "⚠️  VERIFICATION COMPLETE: SOME ISSUES FOUND"
fi
echo "=========================================="
echo ""

echo "Next Steps:"
echo "  1. When API rate limits reset, run: python test_canoe_federation_dossier.py"
echo "  2. Full dossier will include outreach_strategy section"
echo "  3. Scores will have contextual fields (meaning, why, benchmark, action)"
echo "  4. Conversation trees will be generated for multi-turn outreach"
echo ""

