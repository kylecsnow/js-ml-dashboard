"""DuckDuckGo search helpers for chemistry-related dataset generator citations."""

from __future__ import annotations

import logging
import re
from typing import Any

logger = logging.getLogger(__name__)

_MAX_QUERY_LEN = 180
_MAX_QUERIES = 2
_MAX_RESULTS_PER_QUERY = 4
_MAX_TOTAL_SOURCES = 8

# Skip search for acknowledgements / very short non-substantive replies.
_SKIP_PATTERNS = re.compile(
    r"^(thanks|thank you|ok|okay|yes|no|sure|got it|cool|great|hi|hello)\.?!?$",
    re.IGNORECASE,
)


def should_search_for_sources(user_message: str) -> bool:
    """Return True when a web search may help ground chemistry-related answers."""
    msg = user_message.strip()
    if len(msg) < 8:
        return False
    if _SKIP_PATTERNS.match(msg):
        return False
    return True


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


def build_search_queries(user_message: str, form_state: dict[str, Any] | None = None) -> list[str]:
    """Build a small set of targeted search queries from the user request."""
    form_state = form_state or {}
    msg = _truncate_query(user_message.strip())
    if not msg:
        return []

    queries: list[str] = [f"{msg} formulation chemistry materials"]

    ingredients = _ingredient_names(form_state)
    mentioned = [name for name in ingredients if name.lower() in user_message.lower()]
    if mentioned:
        focus = ", ".join(mentioned[:3])
        queries.append(f"{focus} typical concentration formulation")
    elif len(msg) > 40:
        queries.append(f"{msg} typical composition ranges")

    # Preserve order while deduplicating.
    seen: set[str] = set()
    unique: list[str] = []
    for query in queries:
        key = query.lower()
        if key not in seen:
            seen.add(key)
            unique.append(_truncate_query(query))

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
        logger.warning("ddgs package is not installed; skipping chemistry source search")
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
        'using markdown links: [short title](url). Only cite URLs from this list; '
        "do not invent citations. If none are relevant, answer from general knowledge "
        "without fabricating links.\n",
    ]
    for idx, source in enumerate(sources, start=1):
        title = source.get("title") or source.get("url") or f"Source {idx}"
        url = source.get("url", "")
        snippet = source.get("snippet", "")
        lines.append(f"{idx}. **{title}** — {url}")
        if snippet:
            lines.append(f"   Snippet: {snippet}")
    return "\n".join(lines)
