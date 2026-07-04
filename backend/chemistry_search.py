"""DuckDuckGo search helpers for chemistry-related dataset generator citations."""

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
_MIN_MESSAGE_LEN = 12

# Bare acknowledgements / chit-chat that never warrant a web search.
_ACK_PATTERN = re.compile(
    r"^(thanks?|thank you|thx|ok(ay)?|k|yes|yep|yeah|no|nope|sure|got it|cool|"
    r"nice|great|awesome|perfect|hi|hello|hey|done|good)\b[\s.!?]*$",
    re.IGNORECASE,
)

# Purely structural / settings operations on the form. These don't introduce new
# factual chemistry claims, so grounding them with a web search adds no value.
_FORM_CONTROL_PATTERN = re.compile(
    r"\b(rename|delete|remove|drop|clear|reset|undo|redo|move|reorder|reorganiz(e|ing)|"
    r"start over|start from scratch|set (the )?noise|noise to|num[_ ]?rows|"
    r"number of rows|rows? to|file ?name|filename|units? to|rename it|call it)\b",
    re.IGNORECASE,
)

# Positive signal that the user wants factual/domain information worth grounding.
_INFO_SIGNAL_PATTERN = re.compile(
    r"\b(what|which|why|how|when|explain|describe|compare|contrast|difference|"
    r"differ|versus|vs\.?|recommend|suggest|advice|advise|best|typical|common|"
    r"usual|realistic|range|ranges|concentration|loading|dosage|dose|amount|"
    r"role|function|purpose|effect|benefit|drawback|alternative|option|example|"
    r"tell me|more about|list|is (it|there)|are there|should i|help me understand|"
    r"reasonable|valid|correct)\b",
    re.IGNORECASE,
)

# Positive signal that the message is about formulation chemistry / materials.
_CHEM_SIGNAL_PATTERN = re.compile(
    r"\b(dataset|formulat\w*|recipe|mixture|blend|ingredient\w*|component\w*|"
    r"monomer\w*|oligomer\w*|polymer\w*|resin\w*|additive\w*|photoinitiator\w*|"
    r"initiator\w*|emulsifier\w*|surfactant\w*|solvent\w*|filler\w*|catalyst\w*|"
    r"binder\w*|plasticizer\w*|pigment\w*|stabiliz\w*|coating\w*|adhesive\w*|"
    r"composite\w*|electrolyte\w*|curing|cure|crosslink\w*|chemical\w*|compound\w*|"
    r"material\w*|wt ?%|weight fraction|mole fraction|synthes\w*)\b",
    re.IGNORECASE,
)


def should_search_for_sources(user_message: str) -> bool:
    """Return True only when a web search is likely to usefully ground the reply.

    Skips trivial/short messages, acknowledgements, and purely structural form
    operations (rename/remove/settings tweaks). Otherwise requires a positive
    informational or chemistry-domain signal before spending a network call.
    """
    msg = user_message.strip()
    if len(msg) < _MIN_MESSAGE_LEN:
        return False
    if _ACK_PATTERN.match(msg):
        return False

    has_info = bool(_INFO_SIGNAL_PATTERN.search(msg))
    has_chem = bool(_CHEM_SIGNAL_PATTERN.search(msg))

    # Structural/settings-only edits with no informational intent: skip.
    if _FORM_CONTROL_PATTERN.search(msg) and not has_info:
        return False

    return has_info or has_chem


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


def _domain_hint(form_state: dict[str, Any]) -> str:
    """Infer the formulation domain from form state for search query scoping.

    Uses the dataset filename (e.g. ice_cream_emulsifiers.csv) or, if that's
    generic, the first few formulation group names. Returned as a prefix so
    follow-up prompts stay on-topic (e.g. "compare emulsifiers" → ice cream).
    """
    filename = (form_state.get("filename") or "").strip()
    if filename:
        base = re.sub(r"\.[a-z0-9]+$", "", filename, flags=re.IGNORECASE)
        base = re.sub(r"[_\-]+", " ", base).strip()
        # Ignore uninformative default-ish names.
        if base and base.lower() not in {"dataset", "data", "untitled", "demo"}:
            return base

    group_names = [
        (group.get("name") or "").strip()
        for group in form_state.get("formulation_groups") or []
    ]
    group_names = [name for name in group_names if name]
    if group_names:
        return " ".join(group_names[:3])
    return ""


def build_search_queries(user_message: str, form_state: dict[str, Any] | None = None) -> list[str]:
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
        'using markdown links: [short title](url). Only cite URLs from this list; do not '
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


_MARKDOWN_LINK_PATTERN = re.compile(r"\]\(\s*<?(https?://[^\s)]+?)>?\s*\)")


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


def filter_cited_sources(
    message: str, sources: list[dict[str, str]]
) -> list[dict[str, str]]:
    """Keep only the sources whose URL the assistant actually cited in its message.

    Preserves the original ordering of ``sources``.
    """
    if not sources:
        return []
    cited = extract_cited_urls(message)
    if not cited:
        return []
    return [source for source in sources if _normalize_url(source.get("url", "")) in cited]
