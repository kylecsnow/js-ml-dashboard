from chemistry_search import (
    build_search_queries,
    format_sources_for_prompt,
    search_chemistry_sources,
    should_search_for_sources,
)


def test_should_search_for_sources_skips_short_and_acknowledgements():
    assert should_search_for_sources("ok") is False
    assert should_search_for_sources("thanks!") is False
    assert should_search_for_sources(
        "Set up a DLP 3D printing resin dataset with UDMA and HDDA"
    ) is True


def test_build_search_queries_uses_user_message_and_mentioned_ingredients():
    queries = build_search_queries(
        "Add more photoinitiators like TPO alongside Irganox 819",
        {
            "formulation_groups": [
                {
                    "name": "Photoinitiator",
                    "ingredients": [
                        {"name": "Irganox 819", "min": "0.01", "max": "0.03"},
                        {"name": "TPO", "min": "0.01", "max": "0.03"},
                    ],
                }
            ]
        },
    )
    assert len(queries) >= 1
    assert "formulation chemistry materials" in queries[0]
    assert any("Irganox 819" in q or "TPO" in q for q in queries)


def test_format_sources_for_prompt_includes_urls_and_citation_guidance():
    block = format_sources_for_prompt(
        [
            {
                "title": "UV Resin Formulation Guide",
                "url": "https://example.com/resin",
                "snippet": "Typical photoinitiator loadings are 0.5-3 wt%.",
            }
        ]
    )
    assert "Reference sources (web search)" in block
    assert "https://example.com/resin" in block
    assert "UV Resin Formulation Guide" in block
    assert "do not invent citations" in block.lower()


def test_search_chemistry_sources_deduplicates_and_maps_fields(monkeypatch):
    class _FakeDDGS:
        def __enter__(self):
            return self

        def __exit__(self, *args):
            return False

        def text(self, query, max_results=4):
            return [
                {
                    "title": "Result A",
                    "href": "https://example.com/a",
                    "body": "Snippet A",
                },
                {
                    "title": "Result A duplicate",
                    "href": "https://example.com/a",
                    "body": "Duplicate",
                },
                {
                    "title": "Result B",
                    "href": "https://example.com/b",
                    "body": "Snippet B",
                },
            ]

    monkeypatch.setattr("ddgs.DDGS", _FakeDDGS)

    sources = search_chemistry_sources(["uv resin formulation"])
    assert len(sources) == 2
    assert sources[0] == {
        "title": "Result A",
        "url": "https://example.com/a",
        "snippet": "Snippet A",
    }
    assert sources[1]["url"] == "https://example.com/b"
