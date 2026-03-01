"""
Weakly supervised hero-ingredient pipeline for recipes.

What this module does:
1. Generates pseudo hero labels using rule-based scoring.
2. Trains a supervised model (TF-IDF + Logistic Regression).
3. Saves model artifacts.
4. Exposes predict_hero() for new recipes.

Dataset input columns expected:
- recipe_id
- title
- ingredients (comma-separated)
- quantities (comma-separated, aligned with ingredients)
"""

from __future__ import annotations

from collections import Counter
from pathlib import Path
import re
from statistics import median
from typing import Dict, List, Optional, Sequence, Tuple

import joblib
import numpy as np
import pandas as pd
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import accuracy_score, classification_report
from sklearn.model_selection import train_test_split

from .semantic_matcher import best_semantic_match, is_semantic_match


MODULE_DIR = Path(__file__).resolve().parent
DEFAULT_INPUT_CSV = MODULE_DIR / "data" / "recipes.csv"
DEFAULT_PSEUDO_CSV = MODULE_DIR / "data" / "recipes_with_hero.csv"
DEFAULT_MODEL_PATH = MODULE_DIR / "hero_model.pkl"
DEFAULT_VECTORIZER_PATH = MODULE_DIR / "tfidf_vectorizer.pkl"


# Raw synonym mapping. Keys and values are normalized at startup.
_RAW_SYNONYMS = {
    "scallion": "green onion",
    "scallions": "green onion",
    "spring onion": "green onion",
    "spring onions": "green onion",
    "green onions": "green onion",
    "onions": "onion",

    "tomatoes": "tomato",

    "chilli": "chili",
    "chilies": "chili",
    "chillies": "chili",
    "green chillies": "green chili",
    "green chilies": "green chili",

    "garlic cloves": "garlic",
    "clove garlic": "garlic",

    "coriander leaves": "cilantro",

    "curd": "yogurt",
    "hung curd": "yogurt",
    "dahi": "yogurt",

    "capsicum": "bell pepper",
    "shimla mirch": "bell pepper",

    "atta": "whole wheat flour",
    "maida": "all purpose flour",

    "paneer cubes": "paneer",
    "boneless chicken": "chicken",
    "chicken breast": "chicken",
    "chicken thighs": "chicken",

    "basmati rice": "rice",
    "sona masuri rice": "rice",

    "table salt": "salt",
    "sea salt": "salt",
    "kosher salt": "salt",
}

_STOPWORDS = {
    "fresh", "dried", "chopped", "sliced", "minced", "crushed", "powder", "powdered",
    "small", "medium", "large", "optional", "to", "taste", "as", "required", "needed",
    "cup", "cups", "tbsp", "tablespoon", "tablespoons", "tsp", "teaspoon", "teaspoons",
    "gram", "grams", "g", "kg", "ml", "l", "liter", "litre", "pieces", "piece", "pcs",
    "pinch", "pinches", "dash", "handful", "bunch", "sprig", "sprigs",
}


def _clean_text(text: str) -> str:
    """Lower-case text and keep only letters/numbers/spaces."""
    value = str(text or "").lower().strip()
    value = re.sub(r"\(.*?\)", " ", value)
    value = re.sub(r"[^a-z0-9 ]", " ", value)
    value = re.sub(r"\s+", " ", value).strip()
    return value


def _singularize_token(token: str) -> str:
    """A tiny singularization heuristic to improve matching."""
    if token.endswith("ies") and len(token) > 4:
        return token[:-3] + "y"
    if token.endswith("s") and len(token) > 3 and not token.endswith("ss"):
        return token[:-1]
    return token


def _normalize_phrase(phrase: str) -> str:
    """Normalize a short ingredient phrase to a canonical lookup form."""
    cleaned = _clean_text(phrase)
    if not cleaned:
        return ""

    tokens: List[str] = []
    for token in cleaned.split():
        token = _singularize_token(token)
        if token in _STOPWORDS:
            continue
        if len(token) <= 1:
            continue
        tokens.append(token)
    return " ".join(tokens).strip()


# Normalize synonym map once so both training and prediction use identical canonicalization.
SYNONYM_MAP: Dict[str, str] = {
    _normalize_phrase(k): _normalize_phrase(v)
    for k, v in _RAW_SYNONYMS.items()
    if _normalize_phrase(k) and _normalize_phrase(v)
}


# Canonical overrides for strict recipe matching.
CANONICAL_MAP: Dict[str, str] = {
    "chicken breast": "chicken",
    "boneless chicken": "chicken",
    "table salt": "salt",
    "sea salt": "salt",
    "curd": "yogurt",
    "dahi": "yogurt",
}


def normalize_ingredient(name: str) -> str:
    """Normalize one ingredient name into canonical form."""
    normalized = _normalize_phrase(name)
    if not normalized:
        return ""
    return SYNONYM_MAP.get(normalized, normalized)


def normalize_ingredient_list(ingredients: str) -> List[str]:
    """Split comma-separated ingredients and normalize each item."""
    parts = [p.strip() for p in str(ingredients or "").split(",")]
    result: List[str] = []
    for part in parts:
        canonical = normalize_ingredient(part)
        if canonical:
            result.append(canonical)
    return result


def normalize(name: str) -> str:
    """
    Lowercase, strip, and map ingredient to canonical form.
    """
    normalized = normalize_ingredient(name)
    if not normalized:
        return ""
    return CANONICAL_MAP.get(normalized, normalized)


def _parse_quantity(value: str) -> float:
    """Extract first numeric component from quantity text."""
    text = str(value or "").strip()
    if not text:
        return 0.0

    # Try direct float first.
    try:
        return float(text)
    except (TypeError, ValueError):
        pass

    # Support simple fractions like 1/2.
    frac_match = re.match(r"^(\d+)\s*/\s*(\d+)$", text)
    if frac_match:
        num = float(frac_match.group(1))
        den = float(frac_match.group(2))
        return num / den if den else 0.0

    # Fallback: first decimal/integer token inside text.
    number_match = re.search(r"-?\d+(?:\.\d+)?", text)
    if number_match:
        try:
            return float(number_match.group(0))
        except ValueError:
            return 0.0

    return 0.0


def _parse_quantities(quantities: str, expected_len: int) -> List[float]:
    """Parse and align quantities list with ingredients length."""
    raw_parts = [p.strip() for p in str(quantities or "").split(",")]
    parsed = [_parse_quantity(part) for part in raw_parts if part != ""]

    if len(parsed) < expected_len:
        parsed.extend([0.0] * (expected_len - len(parsed)))
    elif len(parsed) > expected_len:
        parsed = parsed[:expected_len]
    return parsed


def _ingredient_in_title(ingredient: str, normalized_title: str) -> bool:
    """Check if full ingredient phrase appears in normalized title."""
    if not ingredient:
        return False
    return bool(re.search(rf"\b{re.escape(ingredient)}\b", normalized_title))


def compute_pseudo_hero(title: str, ingredients: str, quantities: str) -> str:
    """
    Rule-based pseudo label generation.

    Score per ingredient (canonical, deduplicated):
    +5 if ingredient appears in title
    +3 if ingredient has highest quantity
    +2 if ingredient appears multiple times
    +1 if ingredient appears early in list (first 3 positions)
    """
    ingredient_list = normalize_ingredient_list(ingredients)
    if not ingredient_list:
        return ""

    quantity_list = _parse_quantities(quantities, len(ingredient_list))
    normalized_title = _normalize_phrase(title)

    counts = Counter(ingredient_list)
    max_quantity = max(quantity_list) if quantity_list else 0.0

    first_idx: Dict[str, int] = {}
    max_qty_per_ingredient: Dict[str, float] = {}

    for idx, ingredient in enumerate(ingredient_list):
        first_idx.setdefault(ingredient, idx)
        current_max = max_qty_per_ingredient.get(ingredient, float("-inf"))
        max_qty_per_ingredient[ingredient] = max(current_max, quantity_list[idx])

    scores: Dict[str, int] = {}
    for ingredient in first_idx:
        score = 0

        if _ingredient_in_title(ingredient, normalized_title):
            score += 5

        if max_quantity > 0 and np.isclose(max_qty_per_ingredient[ingredient], max_quantity):
            score += 3

        if counts[ingredient] > 1:
            score += 2

        if first_idx[ingredient] <= 2:
            score += 1

        scores[ingredient] = score

    # Tie-breakers: score, then quantity, then earlier appearance, then alpha.
    hero = sorted(
        scores.keys(),
        key=lambda ing: (
            scores[ing],
            max_qty_per_ingredient.get(ing, 0.0),
            -first_idx.get(ing, 10**6),
            ing,
        ),
        reverse=True,
    )[0]

    return hero


def build_training_text(title: str, ingredients: str) -> str:
    """Create normalized text used for both training and prediction."""
    normalized_title = _normalize_phrase(title)
    normalized_ingredients = " ".join(normalize_ingredient_list(ingredients))
    return f"{normalized_title} {normalized_ingredients}".strip()


def generate_pseudo_labels(
    input_csv: Path | str = DEFAULT_INPUT_CSV,
    output_csv: Path | str = DEFAULT_PSEUDO_CSV,
) -> pd.DataFrame:
    """Read recipes CSV, generate pseudo hero labels, and save augmented CSV."""
    input_path = Path(input_csv)
    output_path = Path(output_csv)

    df = pd.read_csv(input_path)

    required_cols = {"recipe_id", "title", "ingredients", "quantities"}
    missing_cols = required_cols - set(df.columns)
    if missing_cols:
        missing = ", ".join(sorted(missing_cols))
        raise ValueError(f"Input CSV missing required columns: {missing}")

    df = df.copy()
    df["hero_ingredient"] = df.apply(
        lambda row: compute_pseudo_hero(
            row.get("title", ""),
            row.get("ingredients", ""),
            row.get("quantities", ""),
        ),
        axis=1,
    )

    output_path.parent.mkdir(parents=True, exist_ok=True)
    df.to_csv(output_path, index=False)
    return df


def _top_k_accuracy(model: LogisticRegression, X, y_true: np.ndarray, k: int = 3) -> float:
    """Compute top-k accuracy for multiclass classification."""
    if not hasattr(model, "predict_proba"):
        return float("nan")

    probs = model.predict_proba(X)
    classes = model.classes_
    top_k_idx = np.argsort(probs, axis=1)[:, -k:]

    hits = 0
    for i, true_label in enumerate(y_true):
        top_k_labels = classes[top_k_idx[i]]
        if true_label in top_k_labels:
            hits += 1

    return hits / max(len(y_true), 1)


def train_hero_model(
    labeled_df: Optional[pd.DataFrame] = None,
    labeled_csv_path: Path | str = DEFAULT_PSEUDO_CSV,
    model_path: Path | str = DEFAULT_MODEL_PATH,
    vectorizer_path: Path | str = DEFAULT_VECTORIZER_PATH,
    test_size: float = 0.2,
    random_state: int = 42,
) -> Tuple[TfidfVectorizer, LogisticRegression]:
    """Train TF-IDF + LogisticRegression model on pseudo labels and save artifacts."""
    if labeled_df is None:
        labeled_df = pd.read_csv(labeled_csv_path)

    df = labeled_df.copy()
    if "hero_ingredient" not in df.columns:
        raise ValueError("Dataframe must include 'hero_ingredient' column.")

    # Keep only rows with non-empty pseudo labels.
    df["hero_ingredient"] = df["hero_ingredient"].astype(str).str.strip()
    df = df[df["hero_ingredient"] != ""].copy()
    if df.empty:
        raise ValueError("No rows with hero_ingredient found for training.")

    df["ml_text"] = df.apply(
        lambda row: build_training_text(row.get("title", ""), row.get("ingredients", "")),
        axis=1,
    )

    X = df["ml_text"].values
    y = df["hero_ingredient"].values

    # Use stratify only when class support is sufficient.
    value_counts = pd.Series(y).value_counts()
    stratify = y if len(value_counts) > 1 and value_counts.min() >= 2 else None

    X_train, X_test, y_train, y_test = train_test_split(
        X,
        y,
        test_size=test_size,
        random_state=random_state,
        stratify=stratify,
    )

    vectorizer = TfidfVectorizer(ngram_range=(1, 2), min_df=1)
    X_train_vec = vectorizer.fit_transform(X_train)
    X_test_vec = vectorizer.transform(X_test)

    model = LogisticRegression(max_iter=2000)
    model.fit(X_train_vec, y_train)

    y_pred = model.predict(X_test_vec)
    accuracy = accuracy_score(y_test, y_pred)
    report = classification_report(y_test, y_pred, zero_division=0)
    top3 = _top_k_accuracy(model, X_test_vec, y_test, k=3)

    print("\n=== Model Evaluation ===")
    print(f"Accuracy: {accuracy:.4f}")
    print("\nClassification Report:")
    print(report)
    print(f"Top-3 Accuracy: {top3:.4f}")

    model_output_path = Path(model_path)
    vectorizer_output_path = Path(vectorizer_path)
    model_output_path.parent.mkdir(parents=True, exist_ok=True)
    vectorizer_output_path.parent.mkdir(parents=True, exist_ok=True)

    joblib.dump(model, model_output_path)
    joblib.dump(vectorizer, vectorizer_output_path)

    print("\nSaved artifacts:")
    print(f"- Model: {model_output_path}")
    print(f"- Vectorizer: {vectorizer_output_path}")

    return vectorizer, model


# In-process cache to avoid reloading artifacts repeatedly in API requests.
_PREDICTION_CACHE: Dict[str, object] = {}


def _load_artifacts(
    model_path: Path | str = DEFAULT_MODEL_PATH,
    vectorizer_path: Path | str = DEFAULT_VECTORIZER_PATH,
) -> Tuple[TfidfVectorizer, LogisticRegression]:
    """Load model artifacts from disk."""
    model_key = str(Path(model_path).resolve())
    vectorizer_key = str(Path(vectorizer_path).resolve())
    cache_key = f"{model_key}|{vectorizer_key}"

    if cache_key in _PREDICTION_CACHE:
        cached = _PREDICTION_CACHE[cache_key]
        return cached["vectorizer"], cached["model"]

    vectorizer: TfidfVectorizer = joblib.load(vectorizer_path)
    model: LogisticRegression = joblib.load(model_path)

    _PREDICTION_CACHE[cache_key] = {
        "vectorizer": vectorizer,
        "model": model,
    }
    return vectorizer, model


def predict_hero(
    title: str,
    ingredients: str,
    model_path: Path | str = DEFAULT_MODEL_PATH,
    vectorizer_path: Path | str = DEFAULT_VECTORIZER_PATH,
) -> str:
    """Predict hero ingredient for a new recipe using saved artifacts."""
    vectorizer, model = _load_artifacts(model_path=model_path, vectorizer_path=vectorizer_path)
    text = build_training_text(title, ingredients)
    vec = vectorizer.transform([text])
    pred = model.predict(vec)
    return str(pred[0])


def compute_recipe_match(
    recipe_ingredients: List[str],
    quantities: List[float],
    hero_ingredient: str,
    user_pantry: List[str],
    strict_mode: bool = False,
) -> float:
    """
    Compute weighted pantry match score for one recipe.

    Weights:
    - Hero ingredient: 5
    - Quantity above recipe median: 3
    - All others: 1

    If hero is missing:
    - strict_mode=True: return 0.0
    - strict_mode=False: apply a 50% penalty to base score
    """
    ingredient_list = list(recipe_ingredients or [])
    quantity_list = list(quantities or [])

    # Align quantity length with ingredients. Missing quantities default to 0.
    if len(quantity_list) < len(ingredient_list):
        quantity_list.extend([0.0] * (len(ingredient_list) - len(quantity_list)))
    elif len(quantity_list) > len(ingredient_list):
        quantity_list = quantity_list[: len(ingredient_list)]

    normalized_ingredients: List[str] = []
    normalized_quantities: List[float] = []

    for idx, ingredient in enumerate(ingredient_list):
        normalized_name = normalize_ingredient(str(ingredient or ""))
        if not normalized_name:
            continue

        quantity_value = 0.0
        try:
            quantity_value = float(quantity_list[idx])
        except (TypeError, ValueError):
            quantity_value = _parse_quantity(str(quantity_list[idx]))

        normalized_ingredients.append(normalized_name)
        normalized_quantities.append(quantity_value)

    if not normalized_ingredients:
        return 0.0

    pantry_set = set()
    for item in (user_pantry or []):
        normalized_item = normalize_ingredient(str(item or ""))
        if normalized_item:
            pantry_set.add(normalized_item)

    hero = normalize_ingredient(str(hero_ingredient or ""))
    recipe_ingredient_set = set(normalized_ingredients)
    hero_in_recipe = bool(hero and hero in recipe_ingredient_set)
    hero_in_pantry = bool(hero and hero in pantry_set)

    if strict_mode and hero_in_recipe and not hero_in_pantry:
        return 0.0

    quantity_median = median(normalized_quantities) if normalized_quantities else 0.0

    total_possible_score = 0.0
    matched_score = 0.0

    for ingredient, quantity in zip(normalized_ingredients, normalized_quantities):
        if hero_in_recipe and ingredient == hero:
            weight = 5
        elif quantity > quantity_median:
            weight = 3
        else:
            weight = 1

        total_possible_score += weight
        if ingredient in pantry_set:
            matched_score += weight

    if total_possible_score <= 0:
        return 0.0

    base_score = matched_score / total_possible_score

    if hero_in_recipe and not hero_in_pantry:
        base_score *= 0.5

    return round(base_score * 100.0, 2)


def compute_strict_recipe_match(
    recipe_ingredients,
    recipe_quantities,
    hero_ingredient,
    pantry_ingredients,
    pantry_quantities,
    *,
    recipe_embedding_lookup: Optional[Dict[str, Sequence[float]]] = None,
    pantry_embedding_lookup: Optional[Dict[str, Sequence[float]]] = None,
    threshold: float = 0.80,
    return_details: bool = False,
):
    """
    Strict pantry-to-recipe match with semantic + quantity-aware scoring.

    Returns:
    {
        "score": float,
        "status": str
    }

    Notes:
    - Uses cosine similarity over provided embeddings when available.
    - Falls back to canonical exact matching when embeddings are missing.
    """
    ingredient_list = list(recipe_ingredients or [])
    quantity_list = list(recipe_quantities or [])
    pantry_list = list(pantry_ingredients or [])
    pantry_qty_list = list(pantry_quantities or [])
    recipe_embedding_lookup = recipe_embedding_lookup or {}
    pantry_embedding_lookup = pantry_embedding_lookup or {}

    if len(quantity_list) < len(ingredient_list):
        quantity_list.extend([0.0] * (len(ingredient_list) - len(quantity_list)))
    elif len(quantity_list) > len(ingredient_list):
        quantity_list = quantity_list[: len(ingredient_list)]

    if len(pantry_qty_list) < len(pantry_list):
        pantry_qty_list.extend([0.0] * (len(pantry_list) - len(pantry_qty_list)))
    elif len(pantry_qty_list) > len(pantry_list):
        pantry_qty_list = pantry_qty_list[: len(pantry_list)]

    def _safe_qty(value) -> float:
        try:
            return max(float(value), 0.0)
        except (TypeError, ValueError):
            return max(_parse_quantity(str(value)), 0.0)

    def _result(score: float, status: str, matched=None, missing=None, hero_match=""):
        payload = {
            "score": float(score),
            "status": status,
        }
        if return_details:
            payload["matched_ingredients"] = sorted(set(matched or []))
            payload["missing_ingredients"] = sorted(set(missing or []))
            payload["hero_pantry_match"] = hero_match
        return payload

    normalized_recipe_ingredients: List[str] = []
    normalized_recipe_quantities: List[float] = []
    recipe_vec_lookup: Dict[str, Sequence[float]] = {}

    for ingredient, qty in zip(ingredient_list, quantity_list):
        canonical = normalize(ingredient)
        if not canonical:
            continue
        normalized_recipe_ingredients.append(canonical)
        normalized_recipe_quantities.append(_safe_qty(qty))
        if canonical in recipe_embedding_lookup:
            recipe_vec_lookup[canonical] = recipe_embedding_lookup[canonical]

    if not normalized_recipe_ingredients:
        return _result(score=0.0, status="LOW_MATCH")

    pantry_lookup: Dict[str, Dict[str, object]] = {}
    for ingredient, qty in zip(pantry_list, pantry_qty_list):
        canonical = normalize(ingredient)
        if not canonical:
            continue
        item = pantry_lookup.setdefault(canonical, {"quantity": 0.0, "embedding": None})
        item["quantity"] = float(item["quantity"]) + _safe_qty(qty)
        if canonical in pantry_embedding_lookup and not item["embedding"]:
            item["embedding"] = pantry_embedding_lookup[canonical]

    if not pantry_lookup:
        return _result(score=0.0, status="NEEDS_KEY_INGREDIENT")

    def _best_pantry_match(recipe_name: str) -> Tuple[str, float]:
        recipe_vec = recipe_vec_lookup.get(recipe_name)
        if recipe_vec is not None:
            candidates = [
                (pantry_name, pantry_data.get("embedding"))
                for pantry_name, pantry_data in pantry_lookup.items()
                if pantry_data.get("embedding") is not None
            ]
            if candidates:
                best_key, best_score = best_semantic_match(
                    source_vec=recipe_vec,
                    candidates=candidates,
                    threshold=threshold,
                )
                if best_key and best_score > 0:
                    return best_key, best_score

        if recipe_name in pantry_lookup:
            return recipe_name, 1.0

        return "", 0.0

    hero = normalize(hero_ingredient)
    if not hero:
        return _result(score=0.0, status="NEEDS_KEY_INGREDIENT")

    hero_match, hero_similarity = _best_pantry_match(hero)
    if not hero_match:
        return _result(score=0.0, status="NEEDS_KEY_INGREDIENT")

    if hero in recipe_vec_lookup and pantry_lookup.get(hero_match, {}).get("embedding"):
        if not is_semantic_match(recipe_vec_lookup[hero], pantry_lookup[hero_match]["embedding"], threshold=threshold):
            return _result(score=0.0, status="NEEDS_KEY_INGREDIENT")
    elif hero_similarity < 1.0:
        return _result(score=0.0, status="NEEDS_KEY_INGREDIENT")

    required_hero_qty = sum(
        qty
        for ingredient, qty in zip(normalized_recipe_ingredients, normalized_recipe_quantities)
        if ingredient == hero
    )
    pantry_hero_qty = float(pantry_lookup.get(hero_match, {}).get("quantity", 0.0))
    if pantry_hero_qty < required_hero_qty:
        return _result(score=0.0, status="INSUFFICIENT_HERO_QUANTITY")

    quantity_median = median(normalized_recipe_quantities) if normalized_recipe_quantities else 0.0
    total_weighted_score = 0.0
    total_possible_weight = 0.0
    matched_names: List[str] = []
    missing_names: List[str] = []

    ingredient_match_cache: Dict[str, Tuple[str, float]] = {}
    for ingredient, required_qty in zip(normalized_recipe_ingredients, normalized_recipe_quantities):
        if ingredient not in ingredient_match_cache:
            ingredient_match_cache[ingredient] = _best_pantry_match(ingredient)
        matched_pantry_name, _ = ingredient_match_cache[ingredient]

        if ingredient == hero:
            weight = 5.0
        elif required_qty > quantity_median:
            weight = 3.0
        else:
            weight = 1.0

        pantry_qty = float(pantry_lookup.get(matched_pantry_name, {}).get("quantity", 0.0))
        if pantry_qty <= 0:
            ingredient_score = 0.0
            missing_names.append(ingredient)
        elif required_qty > 0:
            ingredient_score = min(max(pantry_qty / required_qty, 0.0), 1.0)
            matched_names.append(ingredient)
        else:
            ingredient_score = 1.0
            matched_names.append(ingredient)

        total_weighted_score += weight * ingredient_score
        total_possible_weight += weight

    if total_possible_weight <= 0:
        return _result(score=0.0, status="LOW_MATCH", matched=matched_names, missing=missing_names, hero_match=hero_match)

    final_score = total_weighted_score / total_possible_weight
    match_percentage = round(final_score * 100.0, 2)

    if match_percentage >= 70:
        status = "COOK_NOW"
    elif match_percentage >= 40:
        status = "ALMOST_READY"
    else:
        status = "LOW_MATCH"

    return _result(
        score=match_percentage,
        status=status,
        matched=matched_names,
        missing=missing_names,
        hero_match=hero_match,
    )


def run_pipeline(
    input_csv: Path | str = DEFAULT_INPUT_CSV,
    output_csv: Path | str = DEFAULT_PSEUDO_CSV,
    model_path: Path | str = DEFAULT_MODEL_PATH,
    vectorizer_path: Path | str = DEFAULT_VECTORIZER_PATH,
) -> None:
    """Convenience function to run pseudo-labeling + training in one call."""
    labeled_df = generate_pseudo_labels(input_csv=input_csv, output_csv=output_csv)
    train_hero_model(
        labeled_df=labeled_df,
        model_path=model_path,
        vectorizer_path=vectorizer_path,
    )


if __name__ == "__main__":
    # Example standalone usage with default paths.
    # Put your dataset at: inventory/ml/data/recipes.csv
    run_pipeline()

    # Quick prediction example
    example_title = "Paneer Butter Masala"
    example_ingredients = "paneer,tomato,butter,spices"
    print("\nExample Prediction:")
    print(
        f"Title: {example_title}\n"
        f"Ingredients: {example_ingredients}\n"
        f"Predicted hero: {predict_hero(example_title, example_ingredients)}"
    )
