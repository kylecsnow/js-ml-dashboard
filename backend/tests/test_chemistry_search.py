from chemistry_search import (
    _domain_hint,
    _select_group_names_for_hint,
    build_search_queries,
    extract_cited_urls,
    filter_cited_sources,
    format_sources_for_finalization,
    format_sources_for_prompt,
    prepare_cited_sources_for_display,
    renumber_source_citations,
    search_chemistry_sources,
)


def test_select_group_names_for_hint_skips_generic_roles():
    groups = [
        "Water",
        "Milk Solids",
        "Fat",
        "Sweetener",
        "Emulsifier",
        "Stabilizer",
        "Flavor",
        "Color",
    ]
    selected = _select_group_names_for_hint(groups)
    assert "Water" not in selected
    assert selected == [
        "Milk Solids",
        "Fat",
        "Sweetener",
        "Emulsifier",
        "Stabilizer",
    ]


def test_select_group_names_for_hint_uses_all_when_few_distinctive():
    groups = ["Monomer", "Photoinitiator", "Oligomer"]
    assert _select_group_names_for_hint(groups) == groups


def test_select_group_names_for_hint_keeps_all_when_only_generic_names():
    groups = ["Water", "Diluent", "Base"]
    assert _select_group_names_for_hint(groups) == groups


def test_domain_hint_prefers_filename_over_groups():
    hint = _domain_hint(
        {
            "filename": "ice_cream_emulsifiers.csv",
            "formulation_groups": [{"name": "Emulsifier", "ingredients": []}],
        }
    )
    assert hint == "ice cream emulsifiers"


def test_domain_hint_falls_back_to_selected_group_names():
    hint = _domain_hint(
        {
            "filename": "dataset.csv",
            "formulation_groups": [
                {"name": "Water", "ingredients": []},
                {"name": "Emulsifier", "ingredients": []},
                {"name": "Stabilizer", "ingredients": []},
            ],
        }
    )
    assert hint == "Emulsifier Stabilizer"


def test_build_search_queries_is_domain_anchored_and_ingredient_focused():
    queries = build_search_queries(
        "Add more photoinitiators like TPO alongside Irganox 819",
        {
            "filename": "dlp_resin_photoinitiators.csv",
            "formulation_groups": [
                {
                    "name": "Photoinitiator",
                    "ingredients": [
                        {"name": "Irganox 819", "min": "0.01", "max": "0.03"},
                        {"name": "TPO", "min": "0.01", "max": "0.03"},
                    ],
                }
            ],
        },
    )
    assert 1 <= len(queries) <= 2
    # No more generic keyword-soup suffix.
    assert all("formulation chemistry materials" not in q for q in queries)
    # Mentioned ingredients drive the focused query.
    assert any("Irganox 819" in q or "TPO" in q for q in queries)
    # Domain anchor derived from the filename appears in the queries.
    assert any("dlp resin photoinitiators" in q.lower() for q in queries)


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
    # Instructs the model not to append its own duplicate references list.
    assert "references" in block.lower()


def test_format_sources_for_finalization_is_compact_and_disallows_numeric_citations():
    block = format_sources_for_finalization(
        [
            {
                "title": "UV Resin Formulation Guide",
                "url": "https://example.com/resin",
                "snippet": "Typical photoinitiator loadings are 0.5-3 wt%.",
            }
        ]
    )
    assert "https://example.com/resin" in block
    assert "Typical photoinitiator loadings" not in block
    assert "Never use numeric citation markers" in block


def test_extract_cited_urls_parses_markdown_links():
    message = (
        "Lecithin is a common emulsifier [Emulsifier guide](https://example.com/guide). "
        "See also [ranges](https://example.com/ranges/) and (https://example.com/bare)."
    )
    cited = extract_cited_urls(message)
    assert "https://example.com/guide" in cited
    # Trailing slash is normalized away.
    assert "https://example.com/ranges" in cited
    # A bare URL not in markdown-link form is not treated as a citation.
    assert "https://example.com/bare" not in cited


def test_filter_cited_sources_keeps_only_cited_and_preserves_order():
    sources = [
        {"title": "A", "url": "https://example.com/a", "snippet": ""},
        {"title": "B", "url": "https://example.com/b", "snippet": ""},
        {"title": "C", "url": "https://example.com/c", "snippet": ""},
    ]
    message = (
        "Only two matter: [C](https://example.com/c) and "
        "[A](https://example.com/a/)."  # trailing slash still matches
    )
    filtered = filter_cited_sources(message, sources)
    assert [s["url"] for s in filtered] == [
        "https://example.com/a",
        "https://example.com/c",
    ]


def test_filter_cited_sources_returns_empty_when_nothing_cited():
    sources = [{"title": "A", "url": "https://example.com/a", "snippet": ""}]
    assert filter_cited_sources("No links here at all.", sources) == []


def test_filter_cited_sources_handles_numbered_citations():
    # gpt-oss on Groq cites with 【N†Title】 markers (N = index in the source
    # block) instead of markdown links; map those back onto the source list.
    sources = [
        {"title": "IRGANOX", "url": "https://basf.com/irganox", "snippet": ""},
        {"title": "PS 800", "url": "https://basf.com/ps800", "snippet": ""},
        {"title": "Unrelated", "url": "https://example.com/x", "snippet": ""},
    ]
    message = "The IRGANOX family【1†IRGANOX®】 and PS 800【2†ps 800】 fit here."
    filtered = filter_cited_sources(message, sources)
    assert [s["url"] for s in filtered] == [
        "https://basf.com/irganox",
        "https://basf.com/ps800",
    ]


def test_filter_cited_sources_handles_plain_numeric_citations():
    sources = [
        {"title": "Source A", "url": "https://example.com/a", "snippet": ""},
        {"title": "Source B", "url": "https://example.com/b", "snippet": ""},
    ]
    filtered = filter_cited_sources(
        "EDTA can help [1] and may stabilize emulsions [2].", sources
    )
    assert [s["url"] for s in filtered] == [
        "https://example.com/a",
        "https://example.com/b",
    ]


def test_renumber_source_citations_rewrites_skipped_indexes():
    message = (
        "Lecithin is common (source 1). Quora was skipped. "
        "Blends help too (source 3)."
    )
    renumbered = renumber_source_citations(message, {1: 1, 3: 2})
    assert "(source 1)" in renumbered
    assert "(source 3)" not in renumbered
    assert "(source 2)" in renumbered


def test_prepare_cited_sources_for_display_filters_and_renumbers():
    sources = [
        {"title": "Paper A", "url": "https://example.com/a", "snippet": "A"},
        {"title": "Quora", "url": "https://example.com/b", "snippet": "B"},
        {"title": "Paper C", "url": "https://example.com/c", "snippet": "C"},
    ]
    message = "See (source 1) and (source 3) for details."
    display_message, cited = prepare_cited_sources_for_display(message, sources)
    assert [s["url"] for s in cited] == [
        "https://example.com/a",
        "https://example.com/c",
    ]
    assert display_message == "See (source 1) and (source 2) for details."


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
