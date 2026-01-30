#!/usr/bin/env python3
"""
PDF Text Extractor

Extracts text from PDF documents using multiple methods with fallback.
Designed to replace binary PDF data with readable text for RFP signal detection.

Methods:
1. Native extraction (pdfplumber) - for digital/native PDFs
2. PyMuPDF fallback - for complex PDFs
3. OCR fallback (optional) - for scanned/image-based PDFs

Author: Claude Code
Date: 2026-01-30
"""

import io
import logging
from typing import Optional, Dict, Any
from pathlib import Path

import httpx

logger = logging.getLogger(__name__)


class PDFExtractor:
    """
    Extract text from PDF documents with multiple fallback methods.

    Priority:
    1. pdfplumber (native extraction) - fast, accurate
    2. PyMuPDF (fitz) - alternative native extraction
    3. OCR (optional) - for scanned PDFs
    """

    def __init__(self, enable_ocr: bool = False):
        """
        Initialize PDF extractor.

        Args:
            enable_ocr: Whether to enable OCR fallback (requires tesseract)
        """
        self.enable_ocr = enable_ocr

        # Try to import pdfplumber
        try:
            import pdfplumber
            self.pdfplumber = pdfplumber
            self.has_pdfplumber = True
            logger.info("✅ pdfplumber available for PDF extraction")
        except ImportError:
            self.pdfplumber = None
            self.has_pdfplumber = False
            logger.warning("⚠️ pdfplumber not available, will try PyMuPDF")

        # Try to import PyMuPDF
        try:
            import fitz
            self.fitz = fitz
            self.has_fitz = True
            logger.info("✅ PyMuPDF (fitz) available for PDF extraction")
        except ImportError:
            self.fitz = None
            self.has_fitz = False
            logger.warning("⚠️ PyMuPDF not available")

        # Check if we have any PDF extraction method
        if not self.has_pdfplumber and not self.has_fitz:
            raise ImportError(
                "No PDF extraction library available. "
                "Install: pip install pdfplumber pymupdf"
            )

        # Try to import OCR if enabled
        self.has_ocr = False
        if self.enable_ocr:
            try:
                from pdf2image import convert_from_bytes
                import pytesseract
                self.convert_from_bytes = convert_from_bytes
                self.pytesseract = pytesseract
                self.has_ocr = True
                logger.info("✅ OCR available (Tesseract)")
            except ImportError as e:
                logger.warning(f"⚠️ OCR not available: {e}")
                logger.warning("  Install: brew install tesseract && pip install pytesseract pdf2image")

    async def extract(
        self,
        url: str,
        timeout: float = 30.0,
        max_pages: Optional[int] = None
    ) -> Dict[str, Any]:
        """
        Extract text from PDF URL with automatic fallback.

        Args:
            url: PDF URL to extract
            timeout: HTTP request timeout
            max_pages: Maximum pages to extract (None = all pages)

        Returns:
            {
                "status": "success" | "failed",
                "method": "pdfplumber" | "fitz" | "ocr",
                "content": str (extracted text),
                "char_count": int,
                "page_count": int,
                "confidence": "high" | "medium" | "low",
                "cost_usd": float
            }
        """
        logger.info(f"📄 Attempting PDF extraction: {url}")

        # Download PDF
        try:
            async with httpx.AsyncClient(timeout=timeout) as client:
                response = await client.get(url)
                response.raise_for_status()
                pdf_bytes = response.content

            logger.info(f"  📥 Downloaded {len(pdf_bytes):,} bytes")

        except Exception as e:
            logger.error(f"  ❌ Failed to download PDF: {e}")
            return {
                "status": "failed",
                "error": f"Download failed: {e}"
            }

        # Try pdfplumber first (best for digital PDFs)
        if self.has_pdfplumber:
            result = self._extract_with_pdfplumber(pdf_bytes, max_pages)
            if result["status"] == "success" and result["char_count"] > 500:
                return result

        # Try PyMuPDF as fallback
        if self.has_fitz:
            result = self._extract_with_fitz(pdf_bytes, max_pages)
            if result["status"] == "success" and result["char_count"] > 500:
                return result

        # Try OCR as last resort (if enabled)
        if self.has_ocr and self.enable_ocr:
            result = await self._extract_with_ocr(pdf_bytes, max_pages)
            if result["status"] == "success" and result["char_count"] > 100:
                return result

        # All methods failed
        logger.error("  ❌ All PDF extraction methods failed")
        return {
            "status": "failed",
            "error": "All extraction methods failed or returned insufficient text"
        }

    def _extract_with_pdfplumber(
        self,
        pdf_bytes: bytes,
        max_pages: Optional[int] = None
    ) -> Dict[str, Any]:
        """Extract text using pdfplumber (first choice)."""
        try:
            import pdfplumber

            with pdfplumber.open(io.BytesIO(pdf_bytes)) as pdf:
                pages_to_process = pdf.pages[:max_pages] if max_pages else pdf.pages

                text_parts = []
                for i, page in enumerate(pages_to_process):
                    text = page.extract_text()
                    if text and text.strip():
                        text_parts.append(f"--- Page {i+1} ---\n{text}")

                text = "\n".join(text_parts)
                char_count = len(text.strip())

                if char_count < 100:
                    logger.warning(f"  ⚠️ pdfplumber: Only {char_count} chars extracted")
                    return {"status": "failed", "error": "Insufficient text"}

                logger.info(f"  ✅ pdfplumber: {char_count:,} chars from {len(pages_to_process)} pages")

                return {
                    "status": "success",
                    "method": "pdfplumber",
                    "content": text,
                    "char_count": char_count,
                    "page_count": len(pages_to_process),
                    "confidence": "high",
                    "cost_usd": 0.0
                }

        except Exception as e:
            logger.warning(f"  ⚠️ pdfplumber extraction failed: {e}")
            return {"status": "failed", "error": str(e)}

    def _extract_with_fitz(
        self,
        pdf_bytes: bytes,
        max_pages: Optional[int] = None
    ) -> Dict[str, Any]:
        """Extract text using PyMuPDF (fallback)."""
        try:
            import fitz

            doc = fitz.open(stream=pdf_bytes, filetype="pdf")
            page_count = doc.page_count

            if max_pages:
                page_count = min(page_count, max_pages)

            text_parts = []
            for i in range(page_count):
                page = doc[i]
                text = page.get_text()
                if text and text.strip():
                    text_parts.append(f"--- Page {i+1} ---\n{text}")

            doc.close()

            text = "\n".join(text_parts)
            char_count = len(text.strip())

            if char_count < 100:
                logger.warning(f"  ⚠️ PyMuPDF: Only {char_count} chars extracted")
                return {"status": "failed", "error": "Insufficient text"}

            logger.info(f"  ✅ PyMuPDF: {char_count:,} chars from {page_count} pages")

            return {
                "status": "success",
                "method": "fitz",
                "content": text,
                "char_count": char_count,
                "page_count": page_count,
                "confidence": "high",
                "cost_usd": 0.0
            }

        except Exception as e:
            logger.warning(f"  ⚠️ PyMuPDF extraction failed: {e}")
            return {"status": "failed", "error": str(e)}

    async def _extract_with_ocr(
        self,
        pdf_bytes: bytes,
        max_pages: Optional[int] = None
    ) -> Dict[str, Any]:
        """Extract text using OCR (last resort, for scanned PDFs)."""
        try:
            from pdf2image import convert_from_bytes
            import pytesseract

            # Convert PDF to images
            logger.info(f"  🔍 Converting PDF to images for OCR...")
            images = convert_from_bytes(pdf_bytes, dpi=300, fmt='jpeg')

            if max_pages:
                images = images[:max_pages]

            # OCR each image
            text_parts = []
            for i, img in enumerate(images):
                logger.info(f"  🔍 OCR processing page {i+1}/{len(images)}...")
                text = pytesseract.image_to_string(img)
                if text and text.strip():
                    text_parts.append(f"--- Page {i+1} (OCR) ---\n{text}")

            text = "\n".join(text_parts)
            char_count = len(text.strip())

            if char_count < 100:
                logger.warning(f"  ⚠️ OCR: Only {char_count} chars extracted")
                return {"status": "failed", "error": "Insufficient text"}

            logger.info(f"  ✅ OCR: {char_count:,} chars from {len(images)} pages")

            return {
                "status": "success",
                "method": "ocr",
                "content": text,
                "char_count": char_count,
                "page_count": len(images),
                "confidence": "medium",  # OCR can have errors
                "cost_usd": 0.01  # Small cost for OCR processing
            }

        except Exception as e:
            logger.warning(f"  ⚠️ OCR extraction failed: {e}")
            return {"status": "failed", "error": str(e)}

    def is_pdf_url(self, url: str) -> bool:
        """Check if URL points to a PDF document."""
        return (
            url.lower().endswith('.pdf') or
            'application/pdf' in url.lower() or
            '.pdf?' in url.lower() or
            '/pdf/' in url.lower()
        )


# Singleton instance
_pdf_extractor_instance = None

def get_pdf_extractor(enable_ocr: bool = False) -> PDFExtractor:
    """Get or create singleton PDF extractor instance."""
    global _pdf_extractor_instance

    if _pdf_extractor_instance is None:
        _pdf_extractor_instance = PDFExtractor(enable_ocr=enable_ocr)

    return _pdf_extractor_instance


# Convenience function for quick usage
async def extract_pdf_text(
    url: str,
    enable_ocr: bool = False,
    max_pages: Optional[int] = None
) -> Optional[str]:
    """
    Quick PDF text extraction function.

    Args:
        url: PDF URL
        enable_ocr: Enable OCR fallback
        max_pages: Max pages to extract

    Returns:
        Extracted text or None if failed
    """
    extractor = get_pdf_extractor(enable_ocr=enable_ocr)
    result = await extractor.extract(url, max_pages=max_pages)

    if result["status"] == "success":
        return result["content"]
    else:
        return None


if __name__ == "__main__":
    # Test the PDF extractor
    import asyncio

    async def test():
        extractor = PDFExtractor(enable_ocr=False)

        # Test with ICF PDF
        url = "https://www.canoeicf.com/sites/default/files/paddle_worldwide_proposed_ecosystem.pdf"

        print(f"📄 Testing PDF extraction: {url}")
        result = await extractor.extract(url)

        if result["status"] == "success":
            print(f"✅ Success!")
            print(f"   Method: {result['method']}")
            print(f"   Characters: {result['char_count']:,}")
            print(f"   Pages: {result['page_count']}")
            print(f"   Confidence: {result['confidence']}")
            print(f"   Cost: ${result['cost_usd']:.3f}")
            print(f"\n📝 First 500 chars:")
            print(result["content"][:500])
        else:
            print(f"❌ Failed: {result.get('error', 'Unknown error')}")

    asyncio.run(test())
