from pathlib import Path


def test_fastmcp_env_disables_hosted_mcp():
    env_path = Path(__file__).resolve().parents[2] / '.env'
    text = env_path.read_text()
    assert 'BRIGHTDATA_MCP_USE_HOSTED=true' in text
