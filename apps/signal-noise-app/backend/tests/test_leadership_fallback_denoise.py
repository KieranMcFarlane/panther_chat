#!/usr/bin/env python3

import pytest

from dossier_data_collector import DossierDataCollector


def test_leadership_fallback_filters_non_person_phrases_and_keeps_grounded_names():
    collector = DossierDataCollector.__new__(DossierDataCollector)

    scraped_data = {
        "press_releases": [
            {
                "title": "The San Francisco partners with Coventry City FC",
                "snippet": "Commercial Director hiring update announced this week.",
            },
            {
                "title": "Coventry City FC appoints John Taylor as Commercial Director",
                "snippet": "John Taylor joins to lead partnerships and sponsorship.",
            },
        ],
        "job_postings": [],
        "linkedin": [],
    }

    result = collector._fallback_extract_leadership_from_signals("Coventry City FC", scraped_data)
    names = {item.get("name") for item in result}

    assert "The San Francisco" not in names
    assert "John Taylor" in names


def test_postprocess_decision_makers_filters_org_like_names_and_keeps_real_people():
    collector = DossierDataCollector.__new__(DossierDataCollector)

    decision_makers = [
        {"name": "Basketball Association Of", "role": "Secretary General"},
        {"name": "Euroleague Basketball", "role": "Commercial Director"},
        {"name": "Alberto Muti", "role": "Secretary General"},
        {"name": "Anna Lopez", "role": "Partnerships Manager"},
        {"name": "Hagop Khajirian", "role": "Chief Digital Officer"},
    ]

    result = collector._postprocess_decision_makers("International Canoe Federation", decision_makers)
    names = {item.get("name") for item in result}

    assert "Basketball Association Of" not in names
    assert "Euroleague Basketball" not in names
    assert "Alberto Muti" in names
    assert "Anna Lopez" in names
    assert "Hagop Khajirian" in names


def test_leadership_fallback_filters_role_fragment_phrase_names():
    collector = DossierDataCollector.__new__(DossierDataCollector)

    scraped_data = {
        "press_releases": [
            {
                "title": "Professional Development Phase appointed as Head of Digital",
                "snippet": "Coventry City FC update from training staff.",
            },
            {
                "title": "Coventry City FC appoints David Boddy as Chief Executive Officer",
                "snippet": "David Boddy to lead club operations and strategy.",
            },
        ],
        "job_postings": [],
        "linkedin": [],
    }

    result = collector._fallback_extract_leadership_from_signals("Coventry City FC", scraped_data)
    names = {item.get("name") for item in result}

    assert "Professional Development Phase" not in names
    assert "David Boddy" in names


@pytest.mark.asyncio
async def test_search_linkedin_profiles_prefers_name_matching_profile_over_first_result():
    collector = DossierDataCollector.__new__(DossierDataCollector)

    class FakeBrightData:
        async def search_engine(self, query, engine="google", num_results=3):
            return {
                "status": "success",
                "results": [
                    {
                        "url": "https://www.linkedin.com/in/global-sports-marketing",
                        "title": "Global Sports Marketing | LinkedIn",
                        "snippet": "Agency page for sports growth",
                    },
                    {
                        "url": "https://www.linkedin.com/in/alberto-muti-icf",
                        "title": "Alberto Muti - Secretary General - International Canoe Federation | LinkedIn",
                        "snippet": "Secretary General at International Canoe Federation",
                    },
                ],
            }

    collector.brightdata_client = FakeBrightData()

    result = await collector._search_linkedin_profiles(
        "International Canoe Federation",
        [{"name": "Alberto Muti", "role": "Secretary General"}],
    )

    assert result[0].get("linkedin_url") == "https://www.linkedin.com/in/alberto-muti-icf"


@pytest.mark.asyncio
async def test_search_linkedin_profiles_rejects_low_quality_mismatch_results():
    collector = DossierDataCollector.__new__(DossierDataCollector)

    class FakeBrightData:
        async def search_engine(self, query, engine="google", num_results=3):
            return {
                "status": "success",
                "results": [
                    {
                        "url": "https://www.linkedin.com/in/sports-digest",
                        "title": "Sports Digest",
                        "snippet": "Daily sports updates and marketing trends.",
                    },
                    {
                        "url": "https://www.linkedin.com/in/club-commercial-team",
                        "title": "Club Commercial Team",
                        "snippet": "Commercial and partnerships team overview.",
                    },
                ],
            }

    collector.brightdata_client = FakeBrightData()

    result = await collector._search_linkedin_profiles(
        "Coventry City FC",
        [{"name": "David Boddy", "role": "Chief Executive Officer"}],
    )

    assert result[0].get("linkedin_url") is None
