import unittest

from backend.graphiti_service import GraphitiService


class GraphitiServiceUriNormalizationTest(unittest.TestCase):
    def test_redis_scheme_is_not_treated_as_neo4j_driver_uri(self):
        self.assertIsNone(GraphitiService._get_neo4j_driver_uri("redis://localhost:6379"))
        self.assertIsNone(GraphitiService._get_neo4j_driver_uri("rediss://cache.example:6380"))

    def test_neo4j_scheme_is_preserved_for_driver_usage(self):
        self.assertEqual(
            GraphitiService._get_neo4j_driver_uri("neo4j+s://db.example.io"),
            "neo4j+s://db.example.io"
        )


if __name__ == "__main__":
    unittest.main()
