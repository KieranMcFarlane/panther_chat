#!/usr/bin/env python3
"""
Signal Noise App - Celery Worker Entry Point
Background task processing for dossier enrichment
"""

from backend.celery_app import celery

if __name__ == "__main__":
    celery.start()
