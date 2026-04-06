import asyncio
import sys
from pathlib import Path

backend_dir = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(backend_dir))

from connections_graph_enricher import LinkedInBrightDataConnectionsProvider, enrich_connections_graph


class _FakeProvider:
    async def collect_connection_observations(self, *, entity_name, target_people, yp_members, bridge_contacts):
        assert entity_name == "International Canoe Federation"
        assert any(person["name"] == "Alberto Muti" for person in target_people)
        assert any(member["name"] == "Elliott Hillman" for member in yp_members)
        assert any(contact["name"] == "David Eames" for contact in bridge_contacts)
        return [
            {
                "yp_member": "Elliott Hillman",
                "target_person": "Alberto Muti",
                "edge_type": "direct_connection",
                "confidence": 72.0,
                "evidence_url": "https://www.linkedin.com/in/alberto-muti/",
            },
            {
                "yp_member": "Stuart Cope",
                "target_person": "Alberto Muti",
                "edge_type": "mutual_connection",
                "mutual_name": "David Eames",
                "confidence": 58.0,
                "evidence_url": "https://www.linkedin.com/in/david-eames/",
            },
        ]


def test_enrich_connections_graph_adds_provider_edges_and_bridge_targets():
    base_graph = {
        "schema_version": "connections_graph_v1",
        "entity_id": "international-canoe-federation",
        "entity_name": "International Canoe Federation",
        "nodes": [
            {"node_id": "international-canoe-federation", "node_type": "entity", "name": "International Canoe Federation"},
            {"node_id": "Elliott Hillman", "node_type": "yp_member", "name": "Elliott Hillman"},
            {"node_id": "Stuart Cope", "node_type": "yp_member", "name": "Stuart Cope"},
            {"node_id": "person:alberto-muti", "node_type": "person", "name": "Alberto Muti", "title": "Secretary General"},
            {"node_id": "bridge:david-eames", "node_type": "bridge_contact", "name": "David Eames"},
        ],
        "edges": [
            {"from_id": "international-canoe-federation", "to_id": "person:alberto-muti", "edge_type": "primary_owner_of"},
            {"from_id": "Stuart Cope", "to_id": "bridge:david-eames", "edge_type": "bridge_connection", "confidence": 35.0, "to_label": "David Eames"},
        ],
    }

    enriched = asyncio.run(
        enrich_connections_graph(
            connections_graph=base_graph,
            provider=_FakeProvider(),
        )
    )

    edge_types = {(edge["from_id"], edge["edge_type"], edge["to_id"]) for edge in enriched["edges"]}
    assert ("Elliott Hillman", "direct_connection", "person:alberto-muti") in edge_types
    assert ("Stuart Cope", "mutual_connection", "person:alberto-muti") in edge_types
    assert ("bridge:david-eames", "bridge_to_target", "person:alberto-muti") in edge_types


class _FastBrightData:
    def __init__(self):
        self.queries = []

    async def search_engine(self, *, query, engine="google", num_results=5, **_kwargs):
        self.queries.append(query)
        if '"Elliott Hillman" "Alberto Muti" LinkedIn' in query:
            return {
                "status": "success",
                "results": [
                    {
                        "title": "Alberto Muti | LinkedIn",
                        "url": "https://www.linkedin.com/in/alberto-muti/",
                        "snippet": "1st degree connection · Elliott Hillman and Alberto Muti are connected on LinkedIn",
                    }
                ],
            }
        if '"Stuart Cope" "Alberto Muti" mutual connections site:linkedin.com' in query:
            return {
                "status": "success",
                "results": [
                    {
                        "title": "David Eames",
                        "url": "https://www.linkedin.com/in/david-eames/",
                        "snippet": "Mutual connection between Stuart Cope and Alberto Muti",
                    }
                ],
            }
        return {"status": "success", "results": []}


def test_linkedin_brightdata_provider_adds_direct_and_mutual_observations_with_small_budget():
    provider = LinkedInBrightDataConnectionsProvider(_FastBrightData(), max_pairs=2, per_lookup_timeout_s=1.0)

    observations = asyncio.run(
        provider.collect_connection_observations(
            entity_name="International Canoe Federation",
            target_people=[
                {"node_id": "person:alberto-muti", "name": "Alberto Muti", "linkedin_url": "https://www.linkedin.com/in/alberto-muti/"}
            ],
            yp_members=[
                {"node_id": "Elliott Hillman", "name": "Elliott Hillman"},
                {"node_id": "Stuart Cope", "name": "Stuart Cope"},
            ],
            bridge_contacts=[
                {"node_id": "bridge:david-eames", "name": "David Eames"},
            ],
        )
    )

    edge_types = {(item["yp_member"], item["edge_type"], item["target_person"]) for item in observations}
    assert ("Elliott Hillman", "direct_connection", "Alberto Muti") in edge_types
    assert ("Stuart Cope", "mutual_connection", "Alberto Muti") in edge_types
