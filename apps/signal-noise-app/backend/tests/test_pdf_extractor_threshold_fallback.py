import pytest

from pdf_extractor import PDFExtractor


class _FakeResponse:
    def __init__(self, content: bytes):
        self.content = content

    def raise_for_status(self) -> None:
        return None


class _FakeAsyncClient:
    def __init__(self, timeout=None):
        self.timeout = timeout

    async def __aenter__(self):
        return self

    async def __aexit__(self, exc_type, exc, tb):
        return None

    async def get(self, url: str):
        return _FakeResponse(b"%PDF-1.4 fake")


@pytest.mark.asyncio
async def test_extract_returns_best_success_when_all_methods_below_threshold(monkeypatch):
    extractor = PDFExtractor(enable_ocr=False, ocr_threshold=100)
    extractor.has_pdfplumber = True
    extractor.has_fitz = True
    extractor.has_ocr = False

    monkeypatch.setattr(
        extractor,
        "_extract_with_pdfplumber",
        lambda _bytes, _max_pages: {
            "status": "success",
            "method": "pdfplumber",
            "content": "short text",
            "char_count": 29,
            "page_count": 1,
        },
    )
    monkeypatch.setattr(
        extractor,
        "_extract_with_fitz",
        lambda _bytes, _max_pages: {
            "status": "success",
            "method": "fitz",
            "content": "shorter text but slightly longer",
            "char_count": 35,
            "page_count": 1,
        },
    )

    import pdf_extractor as module_under_test

    monkeypatch.setattr(module_under_test.httpx, "AsyncClient", _FakeAsyncClient)

    result = await extractor.extract("https://example.com/short.pdf", timeout=1)

    assert result["status"] == "success"
    assert result["method"] == "fitz"
    assert result["char_count"] == 35
    assert result["below_threshold"] is True
    assert result["threshold"] == 100
