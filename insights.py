"""Lightweight sidebar summarizer for streaming agent thoughts.

This helper stays **separate** from the main agents/orchestrator logic.
It only consumes the recent public transcript (last ~5 steps) and asks a
cheaper model to condense it into a tiny finding plus an optional chart
spec the frontend can render.
"""

from __future__ import annotations

import json
import os
import logging
from typing import Any, Dict, List, Optional

import anthropic

logger = logging.getLogger(__name__)


_client: Optional[anthropic.Anthropic] = None


def _get_client() -> anthropic.Anthropic:
    """Lazily create a single Anthropic client (re-used across requests)."""

    global _client
    if _client is None:
        api_key = os.environ.get("ANTHROPIC_API_KEY")
        if not api_key:
            raise RuntimeError("ANTHROPIC_API_KEY is not set")
        _client = anthropic.Anthropic(api_key=api_key)
    return _client


def _build_prompt(history: List[Dict[str, str]]) -> str:
    """Format the last few steps into a compact textual context."""

    lines: List[str] = []
    for item in history[-5:]:  # hard cap: last 5 turns only
        role = (item.get("type") or "text").upper()
        content = (item.get("content") or "").strip()
        # Trim individual snippets to keep context small and cheap
        if len(content) > 1600:
            content = content[:1600] + "\n...[truncated]"
        lines.append(f"[{role}]\n{content}")

    return "\n\n".join(lines)


def summarize_agent_findings(
    agent_id: str,
    history: List[Dict[str, str]],
) -> Dict[str, Any]:
    """Return a JSON-friendly finding + optional chart for a single agent.

    Args:
        agent_id: Identifier of the sub-agent (for logging only).
        history: List of dicts with at least ``type`` and ``content`` keys.
                 Only the 5 most recent entries are used.

    Returns:
        {"summary": str, "chart": Optional[dict]}
    """
    prompt = _build_prompt(history)

    if not prompt.strip():
        return {"summary": "Waiting for agent output...", "chart": None}

    system_instruction = (
        "You distill an autonomous research agent's most recent scratch notes "
        "into crisp sidebar findings. Keep it short (<=120 words), prefer "
        "bullets, surface concrete numbers, and call out the next action.\n"
        "If you can see numeric progressions (loss/accuracy/score vs step), "
        "add a compact chart spec. Use simple types only: line or bar.\n"
        "Respond as JSON with keys: summary (markdown-safe string) and optional "
        "chart. Chart shape: {\"title\": str, \"type\": \"line\"|\"bar\", "
        "\"labels\": [str], \"series\":[{\"name\": str, \"values\": [number]}]}. "
        "Omit chart if no numeric series are present."
    )

    client = _get_client()

    try:
        response = client.messages.create(
            model="claude-opus-4-5-20251101",  # Using Opus 4.5
            max_tokens=4000,
            system=system_instruction,
            messages=[
                {"role": "user", "content": prompt}
            ],
        )
    except Exception as e:
        logger.error("Claude summarize failed for agent %s: %s", agent_id, e)
        raise

    raw_text = ""
    try:
        # Extract text from Claude's response
        for block in response.content:
            if hasattr(block, 'text'):
                raw_text += block.text
        raw_text = raw_text.strip()
    except Exception as e:
        logger.warning("Failed to extract text for agent %s: %s", agent_id, e)

    result: Dict[str, Any]
    try:
        result = json.loads(raw_text)
    except Exception as json_err:
        logger.debug(
            "summarize_agent: json decode failed for agent=%s err=%s raw_sample=%s",
            agent_id,
            json_err,
            (raw_text[:200] + ("..." if len(raw_text) > 200 else "")),
        )
        # Heuristic: try to salvage a JSON-ish blob between the first { and last }
        salvaged = None
        if "{" in raw_text and "}" in raw_text:
            candidate_blob = raw_text[raw_text.find("{") : raw_text.rfind("}") + 1]
            try:
                salvaged = json.loads(candidate_blob)
            except Exception:
                pass

        if salvaged and isinstance(salvaged, dict):
            result = salvaged
        else:
            # Fallback: treat the raw text as the summary string.
            result = {"summary": raw_text or "No summary produced", "chart": None}

    # Ensure required fields exist and are JSON-serializable
    if "summary" not in result or not isinstance(result.get("summary"), str):
        result["summary"] = raw_text or "No summary produced"
    if "chart" in result and result["chart"] is not None:
        if not isinstance(result["chart"], dict):
            result["chart"] = None

    # Trim overly verbose summaries so the rail stays tight
    if result.get("summary") and len(result["summary"]) > 800:
        result["summary"] = result["summary"][:800] + "..."

    return result
