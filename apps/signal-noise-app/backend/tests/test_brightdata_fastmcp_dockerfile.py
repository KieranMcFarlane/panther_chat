from pathlib import Path


def test_brightdata_fastmcp_dockerfile_declares_service_contract():
    dockerfile = Path(__file__).resolve().parents[2] / "Dockerfile.fastmcp"
    content = dockerfile.read_text(encoding="utf-8")

    assert 'EXPOSE 8000' in content
    assert 'http://localhost:8000/health' in content
    assert 'BRIGHTDATA_FASTMCP_HOST=0.0.0.0' in content
    assert 'python3", "-m", "backend.brightdata_fastmcp_service' in content
    assert 'fastmcp' in content.lower()
