import asyncio
import sys
from pathlib import Path

backend_dir = Path(__file__).parent.parent
sys.path.insert(0, str(backend_dir))

from extract_from_supabase import SupabaseExtractor
from import_to_falkordb import FalkorDBImporter
from falkordb_cloud_import import FalkorDBCloudImporter


def test_extract_from_supabase_prefers_stable_property_neo4j_id():
    extractor = object.__new__(SupabaseExtractor)

    nodes = extractor._parse_entities([
        {
            "id": "dbb4b0d7-68e4-49d7-929a-b1a0613454fd",
            "neo4j_id": "544",
            "labels": ["Entity"],
            "properties": {
                "name": "1. FC Köln",
                "neo4j_id": "1-fc-koln",
            },
        }
    ])

    assert len(nodes) == 1
    assert nodes[0].neo4j_id == "1-fc-koln"


def test_import_to_falkordb_preserves_stable_property_neo4j_id():
    importer = object.__new__(FalkorDBImporter)
    calls = []

    class _Session:
        def run(self, query, **kwargs):
            calls.append((query, kwargs))

    asyncio.run(importer._import_single_entity(
        _Session(),
        {
            "neo4j_id": "544",
            "labels": ["Entity"],
            "properties": {
                "name": "1. FC Köln",
                "neo4j_id": "1-fc-koln",
            },
        },
    ))

    assert calls[0][1]["neo4j_id"] == "1-fc-koln"
    assert calls[0][1]["properties"]["neo4j_id"] == "1-fc-koln"


def test_falkordb_cloud_import_preserves_stable_property_neo4j_id():
    importer = object.__new__(FalkorDBCloudImporter)
    queries = []
    importer.execute_cypher = queries.append

    asyncio.run(importer._import_single_entity(
        {
            "neo4j_id": "544",
            "labels": ["Entity"],
            "properties": {
                "name": "1. FC Köln",
                "neo4j_id": "1-fc-koln",
            },
        }
    ))

    assert "MERGE (n:Entity {neo4j_id: '1-fc-koln'})" in queries[0]
    assert "n.neo4j_id = '1-fc-koln'" in queries[0]
