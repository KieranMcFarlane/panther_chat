import importlib
import sys
import warnings
from pathlib import Path

backend_dir = Path(__file__).parent.parent
sys.path.insert(0, str(backend_dir))


def test_brightdata_fastmcp_client_import_is_warning_free():
    sys.modules.pop("brightdata_fastmcp_client", None)
    sys.modules.pop("backend.brightdata_fastmcp_client", None)

    with warnings.catch_warnings(record=True) as caught:
        warnings.simplefilter("always")
        importlib.import_module("brightdata_fastmcp_client")

    assert not any(issubclass(item.category, DeprecationWarning) for item in caught)
