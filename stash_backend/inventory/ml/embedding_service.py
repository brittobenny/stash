from __future__ import annotations

from threading import Lock
from typing import Dict, Iterable, List


MODEL_NAME = "all-MiniLM-L6-v2"

_MODEL = None
_MODEL_LOCK = Lock()
_EMBEDDING_CACHE: Dict[str, List[float]] = {}
_CACHE_LOCK = Lock()


def _normalize_text(text: str) -> str:
    return str(text or "").strip().lower()


def _load_model():
    global _MODEL
    if _MODEL is not None:
        return _MODEL

    with _MODEL_LOCK:
        if _MODEL is None:
            from sentence_transformers import SentenceTransformer

            _MODEL = SentenceTransformer(MODEL_NAME)
    return _MODEL


def generate_embedding(text: str) -> List[float]:
    """
    Generate a semantic embedding for one ingredient-like text.
    Returns a list[float] that can be stored in JSONField.
    """
    normalized = _normalize_text(text)
    if not normalized:
        return []

    with _CACHE_LOCK:
        cached = _EMBEDDING_CACHE.get(normalized)
    if cached is not None:
        return list(cached)

    model = _load_model()
    vector = model.encode(normalized, normalize_embeddings=True)
    embedding = [float(value) for value in vector]

    with _CACHE_LOCK:
        _EMBEDDING_CACHE[normalized] = embedding
    return list(embedding)


def generate_embeddings(texts: Iterable[str]) -> Dict[str, List[float]]:
    """
    Batch-generate embeddings and return a normalized-text lookup.
    """
    normalized_items = [_normalize_text(text) for text in (texts or [])]
    normalized_items = [item for item in normalized_items if item]
    if not normalized_items:
        return {}

    unique_items = list(dict.fromkeys(normalized_items))
    missing_items = []

    with _CACHE_LOCK:
        for item in unique_items:
            if item not in _EMBEDDING_CACHE:
                missing_items.append(item)

    if missing_items:
        model = _load_model()
        vectors = model.encode(missing_items, normalize_embeddings=True)
        with _CACHE_LOCK:
            for item, vector in zip(missing_items, vectors):
                _EMBEDDING_CACHE[item] = [float(value) for value in vector]

    with _CACHE_LOCK:
        return {item: list(_EMBEDDING_CACHE[item]) for item in unique_items if item in _EMBEDDING_CACHE}
