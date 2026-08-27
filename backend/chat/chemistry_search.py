"""DuckDuckGo search helpers for chemistry-related dataset generator citations.

The decision of *whether* to search lives with the LLM itself (it calls the
`web_search` tool in `chat.chat_agent`); this module only executes searches and
handles the citation bookkeeping around them.
"""

from __future__ import annotations

import logging
import re
from typing import Any
from urllib.parse import urlsplit, urlunsplit

logger = logging.getLogger(__name__)

_MAX_QUERY_LEN = 180
_MAX_QUERIES = 2
_MAX_RESULTS_PER_QUERY = 3
_MAX_TOTAL_SOURCES = 5


def _truncate_query(text: str, max_len: int = _MAX_QUERY_LEN) -> str:
    text = re.sub(r"\s+", " ", text).strip()
    if len(text) <= max_len:
        return text
    return text[: max_len - 3].rsplit(" ", 1)[0] + "..."


def _ingredient_names(form_state: dict[str, Any]) -> list[str]:
    names: list[str] = []
    for group in form_state.get("formulation_groups") or []:
        for ingredient in group.get("ingredients") or []:
            name = (ingredient.get("name") or "").strip()
            if name:
                names.append(name)
    return names


_GENERIC_FILENAME_BASES = {"dataset", "data", "untitled", "demo"}

# Bulk/carrier roles that rarely help scope a web search.
_GENERIC_GROUP_NAMES = {
    "aqueous",
    "base",
    "bulk",
    "carrier",
    "diluent",
    "filler",
    "fillers",
    "general",
    "liquid",
    "main",
    "matrix",
    "medium",
    "misc",
    "other",
    "phase",
    "primary",
    "vehicle",
    "water",
}

_MAX_FALLBACK_GROUP_NAMES = 5
_USE_ALL_FALLBACK_GROUPS_IF_AT_MOST = 5


def _is_generic_group_name(name: str) -> bool:
    return name.strip().lower() in _GENERIC_GROUP_NAMES


def _select_group_names_for_hint(group_names: list[str]) -> list[str]:
    """Pick formulation group names worth using as a search domain hint.

    Drops generic bulk/carrier roles (e.g. water, base, diluent). Uses every remaining
    name when there are few; otherwise keeps up to five in form order.
    """
    distinctive = [name for name in group_names if not _is_generic_group_name(name)]
    candidates = distinctive if distinctive else group_names

    if len(candidates) <= _USE_ALL_FALLBACK_GROUPS_IF_AT_MOST:
        return candidates
    return candidates[:_MAX_FALLBACK_GROUP_NAMES]


def _domain_hint(form_state: dict[str, Any]) -> str:
    """Infer the formulation domain from form state for search query scoping.

    Prefers an informative filename; otherwise joins selected formulation group
    names (skipping generic roles like bater/base/diluent). Used as a query prefix so
    follow-up prompts stay on-topic.
    """
    filename = (form_state.get("filename") or "").strip()
    if filename:
        base = re.sub(r"\.[a-z0-9]+$", "", filename, flags=re.IGNORECASE)
        base = re.sub(r"[_\-]+", " ", base).strip()
        if base and base.lower() not in _GENERIC_FILENAME_BASES:
            return base

    group_names = [
        (group.get("name") or "").strip()
        for group in form_state.get("formulation_groups") or []
    ]
    group_names = [name for name in group_names if name]
    selected = _select_group_names_for_hint(group_names)
    if selected:
        return " ".join(selected)
    return ""


def build_search_queries(
    user_message: str, form_state: dict[str, Any] | None = None
) -> list[str]:
    """Build a small set of targeted, domain-anchored search queries.

    Prefers queries centered on specifically named ingredients and the dataset's
    domain (from filename/group names) rather than appending generic keyword soup.
    """
    form_state = form_state or {}
    msg = _truncate_query(user_message.strip())
    if not msg:
        return []

    domain = _domain_hint(form_state)
    ingredients = _ingredient_names(form_state)
    mentioned = [name for name in ingredients if name.lower() in user_message.lower()]

    queries: list[str] = []

    if mentioned:
        focus = ", ".join(mentioned[:3])
        scoped = f"{focus} {domain}".strip() if domain else focus
        queries.append(f"{scoped} typical use level formulation")

    # A domain-anchored version of the actual question keeps results on-topic.
    queries.append(f"{domain} {msg}".strip() if domain else msg)

    seen: set[str] = set()
    unique: list[str] = []
    for query in queries:
        cleaned = _truncate_query(query)
        key = cleaned.lower()
        if cleaned and key not in seen:
            seen.add(key)
            unique.append(cleaned)

    return unique[:_MAX_QUERIES]


def search_chemistry_sources(
    queries: list[str],
    *,
    max_results_per_query: int = _MAX_RESULTS_PER_QUERY,
    max_total: int = _MAX_TOTAL_SOURCES,
) -> list[dict[str, str]]:
    """Run DuckDuckGo text search and return deduplicated source dicts."""
    if not queries:
        return []

    try:
        from ddgs import DDGS
    except ImportError:
        logger.warning(
            "ddgs package is not installed; skipping chemistry source search"
        )
        return []

    seen_urls: set[str] = set()
    sources: list[dict[str, str]] = []

    try:
        with DDGS() as ddgs:
            for query in queries:
                try:
                    hits = ddgs.text(query, max_results=max_results_per_query)
                except Exception as exc:
                    logger.warning("ddgs search failed for query %r: %s", query, exc)
                    continue

                for hit in hits or []:
                    url = (hit.get("href") or hit.get("url") or "").strip()
                    if not url or url in seen_urls:
                        continue
                    seen_urls.add(url)
                    sources.append(
                        {
                            "title": (hit.get("title") or url).strip(),
                            "url": url,
                            "snippet": (hit.get("body") or "").strip()[:400],
                        }
                    )
                    if len(sources) >= max_total:
                        return sources
    except Exception as exc:
        logger.warning("ddgs search session failed: %s", exc)

    return sources


def format_sources_for_prompt(sources: list[dict[str, str]]) -> str:
    """Format search hits as a block appended to the LLM system prompt."""
    if not sources:
        return ""

    lines = [
        "\n\n### Reference sources (web search)",
        "The following results were retrieved to help ground chemistry-related claims. "
        "When you state specific facts about ingredients, typical concentration ranges, "
        "roles, or measured properties, cite the relevant source inline in your message "
        "using markdown links: [short title](url). Only cite URLs from this list; do not "
        "invent citations, and only cite the ones you actually relied on (it is fine to "
        "cite none). Do NOT add your own 'Sources', 'References', or 'Citations' list/"
        "section anywhere in your message — the app renders the sources you cite inline "
        "automatically. If none are relevant, answer from general knowledge without links.\n",
    ]
    for idx, source in enumerate(sources, start=1):
        title = source.get("title") or source.get("url") or f"Source {idx}"
        url = source.get("url", "")
        snippet = source.get("snippet", "")
        lines.append(f"{idx}. **{title}** — {url}")
        if snippet:
            lines.append(f"   Snippet: {snippet}")
    return "\n".join(lines)


def format_sources_for_finalization(sources: list[dict[str, str]]) -> str:
    """Provide the finalizer only the source identities it may cite.

    Snippets are useful when deciding whether to search, but needlessly inflate
    the final structured-output request. The finalizer needs only a compact,
    allowlisted set of URLs to cite.
    """
    if not sources:
        return (
            "\n\n### Allowed reference sources\n"
            "No web sources were retrieved for this request. Do not include citations."
        )

    lines = [
        "\n\n### Allowed reference sources",
        "Cite only a source below, using a markdown link: [short title](url). "
        "Never use numeric citation markers such as [1] or [2].",
    ]
    for source in sources:
        title = source.get("title") or source.get("url") or "Source"
        url = source.get("url", "")
        lines.append(f"- [{title}]({url})")
    return "\n".join(lines)


_MARKDOWN_LINK_PATTERN = re.compile(r"\]\(\s*<?(https?://[^\s)]+?)>?\s*\)")
# Some models (e.g. gpt-oss on Groq) cite with numbered markers that echo the
# index of the source block they were given, e.g. 【1†Title】, instead of
# markdown links. Map those indices back onto the source list.
_NUMBERED_CITATION_PATTERN = re.compile(r"【\s*(\d+)\s*†([^】]*)】")
# Prose references like "(source 1)" that echo the numbered source block.
_SOURCE_REF_PATTERN = re.compile(r"\(source\s+(\d+)\)", re.IGNORECASE)
# Plain numeric footnotes are another common gpt-oss citation style. They are
# not markdown links, so detect them and ensure the UI receives References.
_PLAIN_NUMBERED_CITATION_PATTERN = re.compile(r"(?<![\w\]])\[(\d+)\](?!\()")


def _cited_indexes(message: str) -> set[int]:
    """Return 1-based source indexes cited via 【N†...】 or (source N) markers."""
    if not message:
        return set()
    indexes = {
        int(match.group(1)) for match in _NUMBERED_CITATION_PATTERN.finditer(message)
    }
    indexes.update(
        int(match.group(1)) for match in _SOURCE_REF_PATTERN.finditer(message)
    )
    indexes.update(
        int(match.group(1))
        for match in _PLAIN_NUMBERED_CITATION_PATTERN.finditer(message)
    )
    return indexes


def _normalize_url(url: str) -> str:
    """Normalize a URL for comparison: drop fragment, trailing slash/punctuation."""
    url = url.strip().rstrip(").,;'\"")
    try:
        parts = urlsplit(url)
    except ValueError:
        return url.rstrip("/").lower()
    path = parts.path.rstrip("/")
    normalized = urlunsplit((parts.scheme, parts.netloc, path, parts.query, ""))
    return normalized.lower()


def extract_cited_urls(message: str) -> set[str]:
    """Return the set of normalized URLs cited via markdown links in a message."""
    if not message:
        return set()
    return {_normalize_url(match) for match in _MARKDOWN_LINK_PATTERN.findall(message)}


def _filter_cited_source_pairs(
    message: str, sources: list[dict[str, str]]
) -> list[tuple[int, dict[str, str]]]:
    """Return (original 1-based index, source) pairs for cited sources only."""
    if not sources:
        return []
    cited_urls = extract_cited_urls(message)
    cited_indexes = _cited_indexes(message)
    if not cited_urls and not cited_indexes:
        return []

    def _included(source: dict[str, str], index: int) -> bool:
        if index in cited_indexes:
            return True
        return _normalize_url(source.get("url", "")) in cited_urls

    return [
        (index, source)
        for index, source in enumerate(sources, start=1)
        if _included(source, index)
    ]


def filter_cited_sources(
    message: str, sources: list[dict[str, str]]
) -> list[dict[str, str]]:
    """Keep only the sources the assistant actually cited in its message.

    Handles both citation styles: markdown links ``[title](url)`` and numbered
    markers ``【N†...】`` (where N is the index in the source block).
    Preserves the original ordering of ``sources``.
    """
    return [source for _, source in _filter_cited_source_pairs(message, sources)]


def renumber_source_citations(message: str, index_map: dict[int, int]) -> str:
    """Rewrite inline source indexes so displayed citations are contiguous."""
    if not message or not index_map:
        return message

    def _renumber_bracket_marker(match: re.Match[str]) -> str:
        old_index = int(match.group(1))
        new_index = index_map.get(old_index)
        if new_index is None:
            return match.group(0)
        return f"【{new_index}†{match.group(2)}】"

    def _renumber_source_ref(match: re.Match[str]) -> str:
        old_index = int(match.group(1))
        new_index = index_map.get(old_index)
        if new_index is None:
            return match.group(0)
        return f"(source {new_index})"

    updated = _NUMBERED_CITATION_PATTERN.sub(_renumber_bracket_marker, message)
    updated = _SOURCE_REF_PATTERN.sub(_renumber_source_ref, updated)

    def _renumber_plain_marker(match: re.Match[str]) -> str:
        old_index = int(match.group(1))
        new_index = index_map.get(old_index)
        if new_index is None:
            return match.group(0)
        return f"[{new_index}]"

    return _PLAIN_NUMBERED_CITATION_PATTERN.sub(_renumber_plain_marker, updated)


def prepare_cited_sources_for_display(
    message: str, sources: list[dict[str, str]]
) -> tuple[str, list[dict[str, str]]]:
    """Filter to cited sources and renumber inline citations for the UI."""
    pairs = _filter_cited_source_pairs(message, sources)
    if not pairs:
        return message, []

    index_map = {
        old_index: new_index for new_index, (old_index, _) in enumerate(pairs, start=1)
    }
    cited_sources = [source for _, source in pairs]
    display_message = renumber_source_citations(message, index_map)
    return display_message, cited_sources
