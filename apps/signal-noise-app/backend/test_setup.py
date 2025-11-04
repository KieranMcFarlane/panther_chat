#!/usr/bin/env python3
"""
Test script to verify Signal Noise App setup
Run this script to test all components after installation
"""

import sys
import os
import json
from datetime import datetime

# Add backend to path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), 'backend'))

def test_imports():
    """Test that all required modules can be imported"""
    print("🔍 Testing imports...")
    
    try:
        import fastapi
        print("✅ FastAPI imported successfully")
    except ImportError as e:
        print(f"❌ FastAPI import failed: {e}")
        return False
    
    try:
        import celery
        print("✅ Celery imported successfully")
    except ImportError as e:
        print(f"❌ Celery import failed: {e}")
        return False
    
    try:
        import neo4j
        print("✅ Neo4j driver imported successfully")
    except ImportError as e:
        print(f"❌ Neo4j driver import failed: {e}")
        return False
    
    try:
        import requests
        print("✅ Requests imported successfully")
    except ImportError as e:
        print(f"❌ Requests import failed: {e}")
        return False
    
    try:
        import pydantic
        print("✅ Pydantic imported successfully")
    except ImportError as e:
        print(f"❌ Pydantic import failed: {e}")
        return False
    
    return True

def test_backend_modules():
    """Test that all backend modules can be imported"""
    print("\n🔍 Testing backend modules...")
    
    try:
        from db import init_db, create_task, get_task
        print("✅ Database module imported successfully")
    except ImportError as e:
        print(f"❌ Database module import failed: {e}")
        return False
    
    try:
        from schemas import DossierRequest, TaskStatus
        print("✅ Schemas module imported successfully")
    except ImportError as e:
        print(f"❌ Schemas module import failed: {e}")
        return False
    
    try:
        from brightdata_client import fetch_company_data
        print("✅ Bright Data client imported successfully")
    except ImportError as e:
        print(f"❌ Bright Data client import failed: {e}")
        return False
    
    try:
        from perplexity_client import fetch_perplexity_summary
        print("✅ Perplexity client imported successfully")
    except ImportError as e:
        print(f"❌ Perplexity client import failed: {e}")
        return False
    
    try:
        from claude_client import synthesize_signals
        print("✅ Claude Code client imported successfully")
    except ImportError as e:
        print(f"❌ Claude Code client import failed: {e}")
        return False
    
    try:
        from neo4j_client import upsert_signals
        print("✅ Neo4j client imported successfully")
    except ImportError as e:
        print(f"❌ Neo4j client import failed: {e}")
        return False
    
    return True

def test_database():
    """Test database functionality"""
    print("\n🔍 Testing database...")
    
    try:
        from db import init_db, create_task, get_task, update_task
        
        # Initialize database
        init_db()
        print("✅ Database initialized successfully")
        
        # Test task creation
        task_id = create_task("company", "Test Company", "normal")
        print(f"✅ Task created successfully: {task_id}")
        
        # Test task retrieval
        task = get_task(task_id)
        if task and task.get("status") == "pending":
            print("✅ Task retrieved successfully")
        else:
            print("❌ Task retrieval failed")
            return False
        
        # Test task update
        result = {"status": "complete", "data": "test"}
        update_success = update_task(task_id, result)
        if update_success:
            print("✅ Task updated successfully")
        else:
            print("❌ Task update failed")
            return False
        
        # Verify update
        updated_task = get_task(task_id)
        if updated_task and updated_task.get("result", {}).get("status") == "complete":
            print("✅ Task update verified successfully")
        else:
            print("❌ Task update verification failed")
            return False
        
        return True
        
    except Exception as e:
        print(f"❌ Database test failed: {e}")
        return False

def test_mock_clients():
    """Test mock client functionality"""
    print("\n🔍 Testing mock clients...")
    
    try:
        from brightdata_client import fetch_company_data
        from perplexity_client import fetch_perplexity_summary
        from claude_client import synthesize_signals
        from neo4j_client import upsert_signals
        
        # Test Bright Data mock
        brightdata_result = fetch_company_data("Test Company", "company")
        if brightdata_result and brightdata_result.get("source") == "brightdata_mock":
            print("✅ Bright Data mock client working")
        else:
            print("❌ Bright Data mock client failed")
            return False
        
        # Test Perplexity mock
        perplexity_result = fetch_perplexity_summary("Test Company", "company")
        if perplexity_result and perplexity_result.get("source") == "perplexity_mock":
            print("✅ Perplexity mock client working")
        else:
            print("❌ Perplexity mock client failed")
            return False
        
        # Test Claude Code mock
        signals = {
            "brightdata": brightdata_result,
            "perplexity": perplexity_result
        }
        summary, cypher_updates = synthesize_signals("Test Company", "company", signals)
        if summary and cypher_updates:
            print("✅ Claude Code mock client working")
        else:
            print("❌ Claude Code mock client failed")
            return False
        
        # Test Neo4j mock
        neo4j_result = upsert_signals("Test Company", "company", cypher_updates)
        if neo4j_result and neo4j_result.get("status") == "complete":
            print("✅ Neo4j mock client working")
        else:
            print("❌ Neo4j mock client failed")
            return False
        
        return True
        
    except Exception as e:
        print(f"❌ Mock client test failed: {e}")
        return False

def test_celery_config():
    """Test Celery configuration"""
    print("\n🔍 Testing Celery configuration...")
    
    try:
        from celery_app import celery
        
        # Check Celery app configuration
        if celery.conf.broker_url and celery.conf.result_backend:
            print("✅ Celery configuration loaded successfully")
            print(f"   Broker: {celery.conf.broker_url}")
            print(f"   Backend: {celery.conf.result_backend}")
        else:
            print("❌ Celery configuration incomplete")
            return False
        
        return True
        
    except Exception as e:
        print(f"❌ Celery configuration test failed: {e}")
        return False

def test_environment():
    """Test environment configuration"""
    print("\n🔍 Testing environment configuration...")
    
    # Check required environment variables
    env_vars = {
        "NEO4J_URI": "bolt://localhost:7687",
        "NEO4J_USER": "neo4j",
        "NEO4J_PASSWORD": "pantherpassword",
        "CELERY_BROKER_URL": "redis://localhost:6379/0",
        "CELERY_RESULT_BACKEND": "redis://localhost:6379/0"
    }
    
    for var, default in env_vars.items():
        value = os.getenv(var, default)
        print(f"✅ {var}: {value}")
    
    # Check optional MCP environment variables
    mcp_vars = [
        "BRIGHTDATA_MCP_URL",
        "PERPLEXITY_MCP_URL", 
        "CLAUDE_CODE_URL",
        "NEO4J_MCP_URL"
    ]
    
    print("\n📡 MCP Server Configuration:")
    for var in mcp_vars:
        value = os.getenv(var, "Not set (will use mock data)")
        print(f"   {var}: {value}")
    
    return True

def main():
    """Run all tests"""
    print("🚀 Signal Noise App Setup Test")
    print("=" * 50)
    print(f"Test started at: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print()
    
    tests = [
        ("Python Imports", test_imports),
        ("Backend Modules", test_backend_modules),
        ("Database", test_database),
        ("Mock Clients", test_mock_clients),
        ("Celery Configuration", test_celery_config),
        ("Environment", test_environment)
    ]
    
    results = []
    
    for test_name, test_func in tests:
        try:
            success = test_func()
            results.append((test_name, success))
        except Exception as e:
            print(f"❌ {test_name} test crashed: {e}")
            results.append((test_name, False))
    
    # Summary
    print("\n" + "=" * 50)
    print("📊 TEST SUMMARY")
    print("=" * 50)
    
    passed = 0
    total = len(results)
    
    for test_name, success in results:
        status = "✅ PASS" if success else "❌ FAIL"
        print(f"{status} {test_name}")
        if success:
            passed += 1
    
    print(f"\nResults: {passed}/{total} tests passed")
    
    if passed == total:
        print("\n🎉 All tests passed! Your Signal Noise App is ready to run.")
        print("\nNext steps:")
        print("1. Start Redis: docker-compose up -d redis")
        print("2. Start the app: ./start.sh")
        print("3. Check the API: http://localhost:3000/docs")
    else:
        print(f"\n⚠️  {total - passed} test(s) failed. Please check the errors above.")
        print("\nTroubleshooting:")
        print("1. Make sure all dependencies are installed: pip install -r requirements.txt")
        print("2. Check that you're in the correct directory")
        print("3. Verify Python version (3.8+)")
    
    return passed == total

if __name__ == "__main__":
    success = main()
    sys.exit(0 if success else 1)
