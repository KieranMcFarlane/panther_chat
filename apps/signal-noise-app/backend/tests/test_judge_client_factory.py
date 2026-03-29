import os
import sys
from pathlib import Path

import pytest

backend_dir = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(backend_dir))

import judge_client_factory as factory
from judge_client_factory import build_deepseek_judge_client


def test_build_deepseek_judge_client_forces_chutes_provider(monkeypatch):
    monkeypatch.delenv("LLM_PROVIDER", raising=False)
    monkeypatch.setenv("CHUTES_API_KEY", "test-chutes-key")
    monkeypatch.delenv("CHUTES_MODEL_JUDGE", raising=False)

    client = build_deepseek_judge_client()

    assert client.provider == "chutes_openai"
    assert os.getenv("LLM_PROVIDER") == "chutes_openai"
    assert client.chutes_model_judge == "deepseek-ai/DeepSeek-V3.2-TEE"


def test_build_deepseek_judge_client_requires_chutes_key(monkeypatch):
    monkeypatch.delenv("CHUTES_API_KEY", raising=False)
    monkeypatch.delenv("LLM_PROVIDER", raising=False)
    monkeypatch.setattr(factory, "load_dotenv", lambda *args, **kwargs: None)

    with pytest.raises(RuntimeError, match="CHUTES_API_KEY.*DeepSeek"):
        build_deepseek_judge_client()


def test_build_deepseek_judge_client_loads_env_from_apps_signal_noise_app(tmp_path, monkeypatch):
    monkeypatch.delenv("LLM_PROVIDER", raising=False)
    monkeypatch.delenv("CHUTES_API_KEY", raising=False)
    monkeypatch.delenv("CHUTES_MODEL_JUDGE", raising=False)
    monkeypatch.delenv("CHUTES_BASE_URL", raising=False)

    env_dir = tmp_path / "apps" / "signal-noise-app"
    env_dir.mkdir(parents=True)
    (env_dir / ".env").write_text(
        "\n".join(
            [
                "CHUTES_API_KEY=test-chutes-key",
                "CHUTES_BASE_URL=https://llm.chutes.ai/v1",
                "CHUTES_MODEL_JUDGE=deepseek-ai/DeepSeek-V3.2-TEE",
            ]
        ),
        encoding="utf-8",
    )

    monkeypatch.chdir(tmp_path)

    client = build_deepseek_judge_client()

    assert client.provider == "chutes_openai"
    assert client.chutes_model_judge == "deepseek-ai/DeepSeek-V3.2-TEE"
