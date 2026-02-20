"""Test multi-agent system end-to-end"""
import asyncio
import json
import sys
sys.path.insert(0, '/Users/kieranmcfarlane/Downloads/panther_chat/apps/signal-noise-app')

from backend.agents import MultiAgentCoordinator

async def test_full_discovery():
    """Test complete discovery workflow"""
    print("="*60)
    print("Testing Multi-Agent System")
    print("="*60)

    # Create coordinator
    coordinator = MultiAgentCoordinator(
        max_iterations=1,  # Quick test (1 iteration)
        target_confidence=0.70,
        verbose=True
    )

    # Discover entity
    print("\n🚀 Starting discovery for: Arsenal FC")
    try:
        context = await coordinator.discover_entity(
            entity_name="Arsenal FC",
            entity_id="arsenal-fc",
            entity_type="organization"
        )

        # Print results
        print("\n" + "="*60)
        print("Discovery Results")
        print("="*60)
        print(f"Primary Domain: {context.primary_domain}")
        print(f"Subdomains: {context.subdomains}")
        print(f"Scraped URLs: {len(context.scraped_urls)}")
        print(f"Raw Signals: {len(context.raw_signals)}")
        print(f"Scored Signals: {len(context.scored_signals)}")
        print(f"Final Confidence: {context.current_confidence:.3f}")
        print(f"Confidence Band: {context.confidence_metrics.get('band', 'UNKNOWN')}")
        print(f"Iterations: {context.iterations}")
        print(f"Actionable Gate: {context.confidence_metrics.get('actionable_gate', False)}")

        # Validate results
        assert context.entity_name == "Arsenal FC"
        assert context.current_confidence >= 0.50
        assert context.iterations <= 1

        print("\n✅ All assertions passed!")
        print("\n" + "="*60)
        print("Full Context (JSON)")
        print("="*60)
        print(json.dumps(context.to_dict(), indent=2)[:1000] + "...")

        return context

    except Exception as e:
        print(f"\n❌ Discovery failed: {e}")
        import traceback
        traceback.print_exc()
        return None

if __name__ == "__main__":
    context = asyncio.run(test_full_discovery())
