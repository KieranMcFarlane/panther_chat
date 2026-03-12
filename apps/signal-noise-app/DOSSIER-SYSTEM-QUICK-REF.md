# Dossier System Quick Reference

## REAL System Files ✅

| File | Purpose |
|------|---------|
| `backend/dossier_generator.py` | Main generator - use this |
| `backend/dossier_data_collector.py` | Real leadership data collection |
| `backend/brightdata_sdk_client.py` | SDK wrapper (fixed) |

## TEST Scripts (DO NOT USE) ❌

| Pattern | Why |
|---------|-----|
| `/tmp/test_*.py` | Temporary test scripts |
| Custom batch scripts | Placeholder data only |
| Files >100KB | Wikipedia dump (bad!) |

## Quick Verification

```python
# Real system has these characteristics:
- 16K chars per entity (not 500K)
- Real names: "Billy Hogan CEO" (not "Chairperson")
- Multiple sources: job_postings, linkedin, press_releases, official_site
- Confidence scores: 80-100%
```

## See Full Documentation

`docs/DOSSIER-SYSTEM-IDENTIFICATION.md` for complete details.
