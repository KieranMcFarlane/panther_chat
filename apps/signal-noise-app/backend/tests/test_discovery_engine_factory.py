import sys
from pathlib import Path

backend_dir = Path(__file__).parent.parent
app_dir = backend_dir.parent
sys.path.insert(0, str(app_dir))
sys.path.insert(0, str(backend_dir))

try:
    from backend.discovery_engine_factory import create_discovery_engine
    from backend.discovery_runtime_v2 import DiscoveryRuntimeV2
except ImportError:
    from discovery_engine_factory import create_discovery_engine
    from discovery_runtime_v2 import DiscoveryRuntimeV2


class _FakeClaude:
    async def query(self, **_kwargs):
        return {"content": "{}"}


class _FakeBrightData:
    async def search_engine(self, **_kwargs):
        return {"status": "success", "results": []}

    async def scrape_as_markdown(self, _url):
        return {"status": "success", "content": "", "metadata": {}}


def test_factory_selects_v2_by_default():
    engine, name = create_discovery_engine(
        claude_client=_FakeClaude(),
        brightdata_client=_FakeBrightData(),
        engine="v2",
    )
    assert name == "v2"
    assert isinstance(engine, DiscoveryRuntimeV2)

