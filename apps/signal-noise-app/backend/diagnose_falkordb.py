#!/usr/bin/env python3
"""
FalkorDB Connection Diagnostic

Tests connectivity to FalkorDB Cloud with proper timeouts.
"""

import sys
import socket
from pathlib import Path

# Add parent directory to path
sys.path.insert(0, str(Path(__file__).parent.parent))


def test_dns_resolution():
    """Test if DNS can resolve the FalkorDB host"""
    print("\n=== Test 1: DNS Resolution ===\n")

    host = "<falkordb-cloud-host>"

    print(f"Resolving: {host}")

    try:
        # Set timeout
        socket.setdefaulttimeout(5)

        ip = socket.gethostbyname(host)
        print(f"✅ DNS resolved: {ip}")
        return True
    except socket.gaierror as e:
        print(f"❌ DNS resolution failed: {e}")
        return False
    except Exception as e:
        print(f"❌ DNS error: {e}")
        return False


def test_tcp_connection():
    """Test if TCP connection to port 50743 works"""
    print("\n=== Test 2: TCP Connection ===\n")

    host = "<falkordb-cloud-host>"
    port = 50743

    print(f"Connecting to: {host}:{port}")

    try:
        sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        sock.settimeout(5)

        result = sock.connect_ex((host, port))
        sock.close()

        if result == 0:
            print(f"✅ TCP connection successful")
            return True
        else:
            print(f"❌ TCP connection failed (error code: {result})")
            return False

    except socket.timeout:
        print(f"❌ TCP connection timed out")
        return False
    except Exception as e:
        print(f"❌ TCP error: {e}")
        return False


def test_falkordb_library():
    """Test if falkordb library is available"""
    print("\n=== Test 3: FalkorDB Library ===\n")

    try:
        from falkordb import FalkorDB
        print("✅ falkordb library installed")

        # Check version
        import importlib.metadata
        try:
            version = importlib.metadata.version('falkordb')
            print(f"   Version: {version}")
        except:
            print("   Version: unknown")

        return True
    except ImportError as e:
        print(f"❌ falkordb not installed: {e}")
        print("   Install with: pip install falkordb")
        return False


def test_environment_variables():
    """Test if environment variables are set"""
    print("\n=== Test 4: Environment Variables ===\n")

    import os

    # Set test variables
    os.environ["FALKORDB_URI"] = "rediss://<falkordb-cloud-host>:<port>"
    os.environ["FALKORDB_USER"] = "falkordb"
    os.environ["FALKORDB_PASSWORD"] = "<falkordb-password>"
    os.environ["FALKORDB_DATABASE"] = "sports_intelligence"

    print("Environment variables set:")
    print(f"  FALKORDB_URI: {os.getenv('FALKORDB_URI')[:50]}...")
    print(f"  FALKORDB_USER: {os.getenv('FALKORDB_USER')}")
    print(f"  FALKORDB_PASSWORD: {'*' * len(os.getenv('FALKORDB_PASSWORD'))}")
    print(f"  FALKORDB_DATABASE: {os.getenv('FALKORDB_DATABASE')}")

    return True


def main():
    """Run all diagnostic tests"""
    print("\n" + "="*60)
    print("FalkorDB Cloud Connection Diagnostic")
    print("="*60)

    results = []

    # Test 1: DNS
    results.append(("DNS Resolution", test_dns_resolution()))

    # Test 2: TCP
    results.append(("TCP Connection", test_tcp_connection()))

    # Test 3: Library
    results.append(("FalkorDB Library", test_falkordb_library()))

    # Test 4: Environment
    results.append(("Environment Variables", test_environment_variables()))

    # Summary
    print("\n" + "="*60)
    print("Diagnostic Summary")
    print("="*60)

    for test_name, passed in results:
        status = "✅ PASS" if passed else "❌ FAIL"
        print(f"{status}: {test_name}")

    all_passed = all(result[1] for result in results)

    if all_passed:
        print("\n✅ All diagnostic tests passed!")
        print("\n💡 Next steps:")
        print("   1. Run: python backend/test_hypothesis_system_simple.py")
        print("   2. This will test the hypothesis system without database")
        print("   3. Once verified, test with actual entity discovery")
    else:
        print("\n❌ Some diagnostic tests failed")
        print("\n💡 Troubleshooting:")
        print("   1. If DNS failed: Check internet connection")
        print("   2. If TCP failed: Check firewall settings")
        print("   3. If library failed: Run 'pip install falkordb'")
        print("   4. Consider using in-memory mode for development")


if __name__ == "__main__":
    main()
