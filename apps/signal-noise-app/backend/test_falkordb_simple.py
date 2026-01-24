#!/usr/bin/env python3
import os
import urllib.parse
from dotenv import load_dotenv
from falkordb import FalkorDB

load_dotenv()

uri = os.getenv('FALKORDB_URI')
print(f'URI loaded: {uri[:50] if uri else "None"}...')

if not uri:
    print('ERROR: FALKORDB_URI not set')
    exit(1)

username = os.getenv('FALKORDB_USER', 'falkordb')
password = os.getenv('FALKORDB_PASSWORD')
database = os.getenv('FALKORDB_DATABASE', 'sports_intelligence')

parsed = urllib.parse.urlparse(uri.replace('rediss://', 'http://'))
host = parsed.hostname
port = parsed.port

print(f'Host: {host}')
print(f'Port: {port}')
print(f'Database: {database}')

try:
    print('\nConnecting to FalkorDB...')
    db = FalkorDB(host=host, port=port, username=username, password=password, ssl=True)
    g = db.select_graph(database)
    result = g.query('RETURN 1 as test')
    print(f'✓ SUCCESS: {result}')

    # Get node count
    result = g.query('MATCH (n) RETURN count(n) AS count')
    print(f'✓ Nodes: {result[0][0] if result else 0}')

except Exception as e:
    print(f'\n✗ FAILED: {type(e).__name__}: {e}')
    import traceback
    traceback.print_exc()
    exit(1)
