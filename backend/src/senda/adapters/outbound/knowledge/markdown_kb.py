"""Adaptador de KnowledgeBase: un archivo Markdown por tema en una carpeta."""
from __future__ import annotations

from pathlib import Path


class MarkdownKnowledgeBase:
    def __init__(self, folder: Path) -> None:
        self._docs = {p.stem: p.read_text(encoding="utf-8") for p in sorted(folder.glob("*.md"))}

    def topics(self) -> dict[str, str]:
        return {name: _title(text) for name, text in self._docs.items()}

    def get(self, topic: str) -> str | None:
        return self._docs.get(topic)


def _title(text: str) -> str:
    first = text.lstrip().splitlines()[0] if text.strip() else ""
    return first.lstrip("# ").strip()
