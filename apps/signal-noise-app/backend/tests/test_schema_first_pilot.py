import sys
from pathlib import Path


backend_dir = Path(__file__).parent.parent
sys.path.insert(0, str(backend_dir))


from schema_first_pilot import (
    _default_field_configs,
    extract_value_for_field,
    score_candidate,
    select_best_candidate,
)


def test_extract_value_for_field_founded_year():
    text = "FIBA was founded in 1932 and is the world governing body for basketball."
    assert extract_value_for_field("founded_year", text) == "1932"


def test_extract_value_for_field_headquarters():
    text = "Our global headquarters are based in Mies, Switzerland overlooking Lake Geneva."
    value = extract_value_for_field("headquarters", text)
    assert value is not None
    assert "Mies" in value


def test_extract_value_for_field_procurement_signals():
    text = "The federation opened a tender and issued an RFP for a digital platform partnership."
    value = extract_value_for_field("procurement_signals", text)
    assert value is not None
    assert "tender" in value
    assert "rfp" in value


def test_score_candidate_prefers_trusted_domain_and_entity_relevance():
    trusted = ["fiba.basketball", "fiba3x3.com", "wikipedia.org"]
    trusted_score = score_candidate(
        entity_name="FIBA",
        trusted_domains=trusted,
        url="https://about.fiba.basketball/en/organization/what-we-do",
        title="What we do | About FIBA",
        content="FIBA founded in 1932.",
        field_name="founded_year",
    )
    noisy_score = score_candidate(
        entity_name="FIBA",
        trusted_domains=trusted,
        url="https://nlp.stanford.edu/~lmthang/morphoNLM/cwCsmRNN.words",
        title="words list",
        content="token token token",
        field_name="founded_year",
    )
    assert trusted_score > noisy_score


def test_select_best_candidate_returns_highest_score():
    trusted = ["fiba.basketball", "wikipedia.org"]
    candidates = [
        {
            "query": "fiba founded year",
            "url": "https://example.com/random",
            "title": "random page",
            "content": "No useful information.",
        },
        {
            "query": "fiba founded year",
            "url": "https://about.fiba.basketball/en/organization/what-we-do",
            "title": "What we do | About FIBA",
            "content": "FIBA was founded in 1932.",
        },
    ]
    best = select_best_candidate(
        entity_name="FIBA",
        trusted_domains=trusted,
        field_name="founded_year",
        candidates=candidates,
    )
    assert best is not None
    assert best["value"] == "1932"
    assert "fiba.basketball" in best["url"]


def test_default_field_configs_are_entity_generic():
    configs = _default_field_configs("Arsenal FC", "CLUB")
    all_queries = [query.lower() for cfg in configs for query in cfg.queries]
    assert all("arsenal fc" in query for query in all_queries)
    assert all("site:fiba" not in query for query in all_queries)
