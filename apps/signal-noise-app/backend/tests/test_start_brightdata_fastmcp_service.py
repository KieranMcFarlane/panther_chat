import importlib.util
from pathlib import Path


def _load_launcher_module():
    launcher_path = Path(__file__).resolve().parents[2] / "scripts" / "start_brightdata_fastmcp_service.py"
    spec = importlib.util.spec_from_file_location("start_brightdata_fastmcp_service", launcher_path)
    module = importlib.util.module_from_spec(spec)
    assert spec and spec.loader
    spec.loader.exec_module(module)
    return module


def test_find_repo_env_prefers_canonical_signal_noise_env(tmp_path):
    module = _load_launcher_module()
    env_root = tmp_path / "workspace" / "apps" / "signal-noise-app"
    env_root.mkdir(parents=True)
    env_file = env_root / ".env"
    env_file.write_text("BRIGHTDATA_API_TOKEN=test-token\n")

    probe = tmp_path / "workspace" / "scripts" / "launcher.py"
    probe.parent.mkdir(parents=True, exist_ok=True)

    found = module._find_repo_env(probe)

    assert found == env_file
