from pathlib import Path


def test_main_sets_app_root_before_backend_package_imports():
    source = Path(__file__).resolve().parents[1].joinpath("main.py").read_text(encoding="utf-8")

    path_setup_index = source.index("SIGNAL_NOISE_APP_ROOT")
    first_backend_import_index = min(
        source.index(token)
        for token in ("from backend.", "import backend.")
        if token in source
    )

    assert path_setup_index < first_backend_import_index
