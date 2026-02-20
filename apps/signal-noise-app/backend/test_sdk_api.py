"""Test Claude Agent SDK actual API"""
import asyncio
from claude_agent_sdk import ClaudeSDKClient

async def test_sdk():
    """Test the actual SDK API"""
    print("="*60)
    print("Testing Claude Agent SDK API")
    print("="*60)

    # Create client
    client = ClaudeSDKClient()

    # Query
    print("\n1. Sending query...")
    await client.query("What is 2+2? Give a brief answer.")

    # Receive response
    print("2. Receiving response...")
    async for message in client.receive_response():
        print(f"   Message type: {type(message).__name__}")

        # Check content
        if hasattr(message, 'content'):
            for block in message.content:
                if hasattr(block, 'text'):
                    print(f"   Text: {block.text[:100]}")
                    break  # Just show first text block
            break  # Just show first message with content

    print("\n✅ SDK API test complete!")

if __name__ == "__main__":
    asyncio.run(test_sdk())
