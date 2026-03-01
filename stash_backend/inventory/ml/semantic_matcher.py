from __future__ import annotations

from typing import Iterable, Optional, Sequence, Tuple

import numpy as np
from sklearn.metrics.pairwise import cosine_similarity


def _as_row_vector(vec: Optional[Sequence[float]]) -> Optional[np.ndarray]:
    if vec is None:
        return None
    try:
        arr = np.asarray(list(vec), dtype=float)
    except (TypeError, ValueError):
        return None
    if arr.ndim != 1 or arr.size == 0:
        return None
    return arr.reshape(1, -1)


def cosine_sim(vec1: Sequence[float], vec2: Sequence[float]) -> float:
    """
    Safe cosine similarity for two vectors.
    Returns 0.0 when vectors are invalid or dimensionality mismatches.
    """
    left = _as_row_vector(vec1)
    right = _as_row_vector(vec2)
    if left is None or right is None:
        return 0.0
    if left.shape[1] != right.shape[1]:
        return 0.0
    return float(cosine_similarity(left, right)[0][0])


def is_semantic_match(vec1: Sequence[float], vec2: Sequence[float], threshold: float = 0.80) -> bool:
    return cosine_sim(vec1, vec2) >= float(threshold)


def best_semantic_match(
    source_vec: Sequence[float],
    candidates: Iterable[Tuple[str, Sequence[float]]],
    threshold: float = 0.80,
) -> Tuple[str, float]:
    """
    Return (best_candidate_key, similarity).
    Returns ("", 0.0) when no candidate meets threshold.
    """
    best_key = ""
    best_score = 0.0

    for key, candidate_vec in candidates:
        score = cosine_sim(source_vec, candidate_vec)
        if score > best_score:
            best_key = key
            best_score = score

    if best_score >= float(threshold):
        return best_key, best_score
    return "", 0.0
