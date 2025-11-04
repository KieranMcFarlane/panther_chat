#!/usr/bin/env python3
"""
Test script to debug import issues
"""

import sys
import traceback

print("Testing imports...")

try:
    print("1. Testing backend import...")
    from backend import main
    print("✅ Backend import successful")
except Exception as e:
    print(f"❌ Backend import failed: {e}")
    traceback.print_exc()

try:
    print("2. Testing app import...")
    from backend.main import app
    print("✅ App import successful")
except Exception as e:
    print(f"❌ App import failed: {e}")
    traceback.print_exc()

try:
    print("3. Testing Celery import...")
    from backend.celery_app import celery
    print("✅ Celery import successful")
except Exception as e:
    print(f"❌ Celery import failed: {e}")
    traceback.print_exc()

print("Import test complete.")
