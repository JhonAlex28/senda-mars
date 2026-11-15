"""Detección mínima del idioma del usuario (español o inglés).

Un modelo de 1.7B tiende a contestar en inglés si la documentación que lee está en inglés;
decirle explícitamente en qué idioma responder lo corrige. Las dos lenguas del equipo
bastan; ante la duda se responde en español."""
from __future__ import annotations

import re

_SPANISH_MARKS = set("¿¡áéíóúñ")
_SPANISH = {"el", "la", "los", "las", "de", "del", "que", "y", "una", "un", "para", "por",
            "con", "es", "hoy", "mañana", "ruta", "hazme", "dame", "cómo", "como", "qué",
            "cuál", "puedo", "podemos", "quiero", "tengo", "horas", "salida", "lugares",
            "objetivos", "tormenta", "polvo", "simula", "cambia", "explica", "muestra"}
_ENGLISH = {"the", "and", "what", "which", "how", "is", "are", "to", "for", "my",
            "can", "we", "today", "tomorrow", "make", "give", "show", "hours", "outing",
            "targets", "storm", "dust", "where", "should", "go", "with", "start", "switch",
            "explain", "i", "have", "want", "write", "about", "please", "this", "that", "of",
            "in", "on", "it", "you", "your", "do", "does", "why", "when", "who", "tell"}


def reply_language(text: str) -> str:
    lowered = text.lower()
    if _SPANISH_MARKS & set(lowered):
        return "Spanish"
    words = re.findall(r"[a-záéíóúñ]+", lowered)
    spanish = sum(w in _SPANISH for w in words)
    english = sum(w in _ENGLISH for w in words)
    return "English" if english > spanish else "Spanish"
