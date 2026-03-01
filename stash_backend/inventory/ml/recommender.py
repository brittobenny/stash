import pandas as pd
import os
import re
from datetime import datetime
from nutrition.parser import parse_ingredient
from nutrition.calculator import calculate_nutrition
from nutrition.services import DAILY_RANGES
from inventory.substitutions import get_substitutions, normalize_name as normalize_sub_name
from .hero_ingredient_pipeline import compute_strict_recipe_match

BASE_DIR = os.path.dirname(os.path.abspath(__file__))

RAW_DATASET_PATH = os.path.join(
    BASE_DIR,
    "data",
    "Cleaned_Indian_Food_Dataset.csv"
)
COMMON_DATASET_PATH = os.path.join(
    BASE_DIR,
    "data",
    "common_recipes.csv"
)


def _resolve_dataset_path():
    if os.path.exists(COMMON_DATASET_PATH):
        return COMMON_DATASET_PATH
    return RAW_DATASET_PATH

class MealRecommender:
    """
    Smart Pantry-Based Recipe Recommender
    Prevents suggesting recipes whose MAIN ingredient is missing
    """

    def __init__(self):
        self.recipes = None
        self.loaded = False
        self.dataset_path = None
        self._embedding_lookup_cache = None

        # Main ingredients that MUST exist
        self.hero_keywords = [
            "egg", "chicken", "mutton", "paneer", "fish",
            "rice", "noodle", "pasta", "dal",
            "potato", "aloo", "prawn"
        ]

        self.seasonal_ingredients = {
            "winter": {"spinach", "broccoli", "cauliflower", "carrot", "pea", "green pea", "turnip"},
            "summer": {"mango", "cucumber", "tomato", "watermelon", "okra", "corn"},
            "monsoon": {"gourd", "bitter gourd", "mushroom", "cluster beans", "drumstick"},
            "autumn": {"pumpkin", "sweet potato", "beetroot", "apple", "pomegranate"},
        }
        self._drop_tokens = {
            "of", "and", "or", "to", "taste", "required", "as", "needed", "optional", "for",
            "fresh", "dried", "finely", "roughly", "small", "large", "medium", "leaf", "leaves",
            "whole", "stalk", "stalks", "powdered", "powder", "chopped", "sliced", "minced", "crushed", "ground",
            "tsp", "tbsp", "teaspoon", "teaspoons", "tablespoon", "tablespoons", "cup", "cups",
            "gram", "grams", "g", "kg", "ml", "liter", "liters", "piece", "pieces", "pcs",
            "pinch", "pinches", "dash", "handful", "bunch", "sprig", "sprigs",
        }
        self._token_ignore_for_match = {"of", "and", "or", "to", "as", "for"}
        self._aliases = {
            "green onions": "green onion",
            "spring onion": "green onion",
            "spring onions": "green onion",
            "scallions": "green onion",
            "garlic cloves": "garlic",
            "cloves garlic": "garlic",
            "tablespoon milk": "milk",
            "tbsp milk": "milk",
            "saltpepper": "salt",
            "salt pepper": "salt",
            "table salt": "salt",
            "sea salt": "salt",
            "kosher salt": "salt",
            "red chilli": "chilli",
            "red chili": "chilli",
            "tomatoe": "tomato",
            "tomatoes": "tomato",
            "chillie": "chilli",
            "chillies": "chilli",
            "chilie": "chilli",
            "chilies": "chilli",
            "green chillie": "green chilli",
            "green chillies": "green chilli",
            "green chilie": "green chilli",
            "green chilies": "green chilli",
            "inger arlic": "ginger garlic",
            "inger arlic paste": "ginger garlic paste",
        }
        self._token_fixes = {
            "tomatoe": "tomato",
            "tomatoes": "tomato",
            "chillie": "chilli",
            "chillies": "chilli",
            "chilie": "chilli",
            "chilies": "chilli",
            "reen": "green",
            "inger": "ginger",
            "arlic": "garlic",
        }

    # ----------------------------------
    def clean_ingredient(self, text):
        """
        Converts:
        '2 onions' -> 'onion'
        '1 tsp oil' -> 'oil'
        """
        value = str(text or "").lower().strip()
        value = re.sub(r"\(.*?\)", " ", value)
        value = re.sub(r"[^a-zA-Z ]", " ", value)
        value = re.sub(r"\s+", " ", value).strip()
        return self._canonical_name(value)

    def _canonical_name(self, text):
        value = normalize_sub_name(text or "")
        if not value:
            return ""
        parts = []
        for token in value.split():
            tok = token.strip().lower()
            if not tok or tok in self._drop_tokens:
                continue
            tok = self._token_fixes.get(tok, tok)
            if tok.endswith("s") and len(tok) > 3:
                tok = tok[:-1]
            if len(tok) <= 1:
                continue
            parts.append(tok)
        while parts and parts[-1] in self._drop_tokens:
            parts.pop()
        if not parts:
            return ""
        name = " ".join(parts).strip()
        name = self._aliases.get(name, name)
        if name == "su ar":
            return "sugar"
        return name

    def _expand_name_for_match(self, text):
        canonical = self._canonical_name(text)
        if not canonical:
            return set()
        parts = canonical.split()
        variants = {canonical}
        for token in parts:
            if token and token not in self._token_ignore_for_match:
                variants.add(token)
        if len(parts) >= 2:
            variants.add(" ".join(parts[-2:]))
        return variants

    def _parse_recipe_ingredients(self, raw_ingredients):
        parsed_ingredients = []
        ingredient_names = []
        ingredient_quantities = []
        ingredient_match_set = set()
        ingredient_to_idx = {}

        for raw in str(raw_ingredients or "").split(","):
            parsed = parse_ingredient(raw)
            canonical_name = self._canonical_name(parsed.get("name"))
            if not canonical_name:
                canonical_name = self.clean_ingredient(raw)
            if not canonical_name:
                continue

            parsed_item = {
                "name": canonical_name,
                "grams": float(parsed.get("grams") or 0),
                "quantity": parsed.get("quantity"),
                "unit": parsed.get("unit"),
                "display": parsed.get("display") or "",
            }
            parsed_ingredients.append(parsed_item)
            quantity_value = float(parsed_item.get("grams") or 0.0)
            if quantity_value <= 0:
                try:
                    quantity_value = float(parsed_item.get("quantity") or 0.0)
                except (TypeError, ValueError):
                    quantity_value = 0.0
            quantity_value = max(0.0, quantity_value)

            if canonical_name not in ingredient_to_idx:
                ingredient_to_idx[canonical_name] = len(ingredient_names)
                ingredient_names.append(canonical_name)
                ingredient_quantities.append(quantity_value)
            else:
                idx = ingredient_to_idx[canonical_name]
                ingredient_quantities[idx] = max(ingredient_quantities[idx], quantity_value)
            ingredient_match_set.update(self._expand_name_for_match(canonical_name))

        hero_ingredient = ""
        if ingredient_names and ingredient_quantities:
            max_idx = max(range(len(ingredient_names)), key=lambda idx: ingredient_quantities[idx])
            hero_ingredient = ingredient_names[max_idx]
        elif ingredient_names:
            hero_ingredient = ingredient_names[0]

        return (
            parsed_ingredients,
            ingredient_names,
            ingredient_quantities,
            ingredient_match_set,
            hero_ingredient,
        )

    # ----------------------------------
    def load_data(self):

        if self.loaded:
            return True

        dataset_path = _resolve_dataset_path()
        self.dataset_path = dataset_path
        if not os.path.exists(dataset_path):
            raise FileNotFoundError(f"Dataset not found: {dataset_path}")

        df = pd.read_csv(dataset_path)

        parsed_bundle = df["TranslatedIngredients"].apply(self._parse_recipe_ingredients)
        df["parsed_ingredients"] = parsed_bundle.apply(lambda x: x[0])
        df["ingredient_names"] = parsed_bundle.apply(lambda x: x[1])
        df["ingredient_quantities"] = parsed_bundle.apply(lambda x: x[2])
        # Match set includes canonical names + token variants for robust matching.
        df["ingredients_set"] = parsed_bundle.apply(lambda x: x[3])
        df["hero_ingredient"] = parsed_bundle.apply(lambda x: x[4])

        df.rename(columns={
            "TranslatedRecipeName": "name",
            "TotalTimeInMins": "minutes",
            "image-url": "image_url",
            "TranslatedInstructions": "instructions",
            "Cuisine": "cuisine"
        }, inplace=True)

        df["id"] = df.index

        self.recipes = df
        self.loaded = True
        return True

    def _clean_image_url(self, image_url):
        if not image_url:
            return ""
        img = str(image_url).strip()
        if not img or img.lower() in {"nan", "none", "null"}:
            return ""
        if not re.match(r"^https?://", img):
            return ""
        return img

    def _current_season(self):
        month = datetime.now().month
        if month in (12, 1, 2):
            return "winter"
        if month in (3, 4, 5):
            return "summer"
        if month in (6, 7, 8, 9):
            return "monsoon"
        return "autumn"

    def _seasonal_hint(self, ingredients_set):
        season = self._current_season()
        seasonal = self.seasonal_ingredients.get(season, set())
        if any(ing in seasonal for ing in ingredients_set):
            return f"In season: {season.title()}"
        return ""

    def _nutrition_score(self, nutrition):
        if not nutrition:
            return 0.0
        metrics = [
            ("calories", "calories"),
            ("protein", "protein"),
            ("carbs", "carbs"),
            ("fat", "fats"),
        ]
        score = 0.0
        count = 0
        for nutrition_key, range_key in metrics:
            if range_key not in DAILY_RANGES:
                continue
            low, high = DAILY_RANGES[range_key]
            # Recipes are usually part of a day, not full-day totals.
            low = low / 4.0
            high = high / 4.0
            value = float(nutrition.get(nutrition_key, 0) or 0)
            if value <= 0:
                continue

            if low <= value <= high:
                ratio = 1.0
            elif value < low:
                ratio = max(0.15, value / max(low, 1.0))
            else:
                ratio = max(0.10, high / max(value, 1.0))

            score += ratio
            count += 1
        return round(score / count, 3) if count else 0.0

    def _find_substitutable(self, missing_set, pantry_set):
        pantry_lookup = {normalize_sub_name(i) for i in pantry_set}
        substitutable = []
        for missing in missing_set:
            for option in get_substitutions(missing):
                opt_name = normalize_sub_name(option.get("name"))
                if opt_name in pantry_lookup:
                    substitutable.append(missing)
                    break
        return substitutable

    def _resolve_recipe_hero(self, title, ingredient_names, ingredient_quantities):
        names = []
        for item in ingredient_names or []:
            canonical = self._canonical_name(item)
            if canonical:
                names.append(canonical)

        if not names:
            return ""

        title_text = re.sub(r"[^a-z ]", " ", str(title or "").lower())
        title_text = re.sub(r"\s+", " ", title_text).strip()

        quantities = []
        for value in ingredient_quantities or []:
            try:
                quantities.append(max(0.0, float(value)))
            except (TypeError, ValueError):
                quantities.append(0.0)

        if len(quantities) < len(names):
            quantities.extend([0.0] * (len(names) - len(quantities)))
        elif len(quantities) > len(names):
            quantities = quantities[: len(names)]

        # Fast path: if ingredient phrase appears in recipe title, prioritize it.
        title_candidates = []
        for idx, ingredient in enumerate(names):
            if ingredient and re.search(rf"\b{re.escape(ingredient)}\b", title_text):
                title_candidates.append((quantities[idx], len(ingredient), -idx, ingredient))
        if title_candidates:
            # Prefer higher quantity, then more specific (longer) phrase, then earlier.
            title_candidates.sort(reverse=True)
            return title_candidates[0][3]

        if quantities:
            max_idx = max(range(len(names)), key=lambda idx: quantities[idx])
            return names[max_idx]

        return names[0]

    def _load_embedding_lookup(self):
        if self._embedding_lookup_cache is not None:
            return self._embedding_lookup_cache

        lookup = {}
        try:
            from inventory.models import Ingredient

            rows = (
                Ingredient.objects.exclude(embedding__isnull=True)
                .exclude(embedding=[])
                .values_list("name", "embedding")
            )
            for name, embedding in rows:
                canonical = self._canonical_name(name)
                if not canonical or not embedding:
                    continue
                lookup[canonical] = embedding
        except Exception:
            # Recommendation should keep functioning even when embeddings are unavailable.
            return {}
        self._embedding_lookup_cache = lookup
        return lookup

    # ----------------------------------
    def recommend(self, pantry_items, top_k=10, min_match_percent=25.0):

        if not self.loaded:
            self.load_data()

        pantry_qty_lookup = {}
        for item in pantry_items:
            raw_name = ""
            qty_value = 1.0

            if isinstance(item, dict):
                raw_name = str(item.get("name") or item.get("ingredient") or "").strip().lower()
                try:
                    qty_value = float(item.get("quantity", 1.0))
                except (TypeError, ValueError):
                    qty_value = 0.0
            elif isinstance(item, (tuple, list)) and len(item) >= 2:
                raw_name = str(item[0] or "").strip().lower()
                try:
                    qty_value = float(item[1])
                except (TypeError, ValueError):
                    qty_value = 0.0
            else:
                raw_name = str(item or "").strip().lower()
                qty_value = 1.0

            canonical = self._canonical_name(raw_name) or self.clean_ingredient(raw_name)
            if not canonical:
                continue
            pantry_qty_lookup[canonical] = pantry_qty_lookup.get(canonical, 0.0) + max(qty_value, 0.0)

        if not pantry_qty_lookup:
            return []

        pantry_names = set(pantry_qty_lookup.keys())
        candidates = []
        season = self._current_season()
        pantry_name_list = list(pantry_qty_lookup.keys())
        pantry_qty_list = [float(pantry_qty_lookup[name]) for name in pantry_name_list]
        embedding_lookup = self._load_embedding_lookup()
        pantry_embedding_lookup = {
            name: embedding_lookup[name]
            for name in pantry_name_list
            if name in embedding_lookup
        }

        for row_idx, row in self.recipes.iterrows():

            recipe_ing_names = row.get("ingredient_names", []) or []
            recipe_quantities = row.get("ingredient_quantities", []) or []
            hero_ingredient = row.get("hero_ingredient", "") or ""
            if not recipe_ing_names:
                continue

            recipe_embedding_lookup = {
                ingredient: embedding_lookup[ingredient]
                for ingredient in recipe_ing_names
                if ingredient in embedding_lookup
            }
            match_result = compute_strict_recipe_match(
                recipe_ingredients=recipe_ing_names,
                recipe_quantities=recipe_quantities,
                hero_ingredient=hero_ingredient,
                pantry_ingredients=pantry_name_list,
                pantry_quantities=pantry_qty_list,
                recipe_embedding_lookup=recipe_embedding_lookup,
                pantry_embedding_lookup=pantry_embedding_lookup,
                threshold=0.80,
                return_details=True,
            )

            status_value = match_result.get("status", "")
            if status_value in {"NEEDS_KEY_INGREDIENT", "INSUFFICIENT_HERO_QUANTITY"}:
                continue

            available_names = set(match_result.get("matched_ingredients") or [])
            if not available_names:
                continue

            missing_set = set(match_result.get("missing_ingredients") or [])
            match_percent = float(match_result.get("score", 0.0) or 0.0)
            candidates.append({
                "row_idx": row_idx,
                "available_names": sorted(list(available_names)),
                "missing_set": missing_set,
                "match_percent": match_percent,
                "hero_ingredient": hero_ingredient,
                "match_status": status_value,
            })

        if not candidates:
            return []

        candidates.sort(key=lambda x: float(x.get("match_percent", 0) or 0), reverse=True)

        # Expensive enrichment (nutrition/substitutions) only for top candidates.
        pool_size = min(len(candidates), max(top_k * 10, 100))
        ranked_pool = candidates[:pool_size]

        results = []
        for candidate in ranked_pool:
            row = self.recipes.loc[candidate["row_idx"]]
            minutes = row["minutes"]
            difficulty = (
                "Easy" if minutes <= 30 else
                "Intermediate" if minutes <= 60 else
                "Advanced"
            )
            recipe_ing_names = row.get("ingredient_names", []) or []
            parsed_ingredients = row.get("parsed_ingredients", []) or []
            nutrition = calculate_nutrition(parsed_ingredients)
            nutrition_score = self._nutrition_score(nutrition)
            seasonal_hint = self._seasonal_hint(recipe_ing_names)
            seasonal_bonus = 1.0 if seasonal_hint else 0.0
            base_match = max(0.0, min(1.0, float(candidate["match_percent"]) / 100.0))
            rank_score = (base_match * 0.6) + (nutrition_score * 0.25) + (seasonal_bonus * 0.15)

            image_url = row.get("image_url")
            if image_url and image_url != image_url:
                image_url = ""
            image_url = self._clean_image_url(image_url)

            missing_set = candidate["missing_set"]
            substitutable = self._find_substitutable(missing_set, pantry_names)
            results.append({
                "id": int(row["id"]),
                "name": row["name"],
                "match_percent": round(float(candidate["match_percent"]), 2),
                "rank_score": round(rank_score, 4),
                "minutes": int(minutes),
                "difficulty": difficulty,
                "cuisine": row.get("cuisine", "General"),
                "image_url": image_url,
                "steps": row["instructions"].split("."),
                "hero_ingredient": candidate["hero_ingredient"],
                "match_status": candidate["match_status"],
                "used_ingredients": candidate["available_names"],
                "missing_ingredients": sorted(list(missing_set)),
                "substitutable_ingredients": substitutable,
                "season": season,
                "seasonal_hint": seasonal_hint,
                "nutrition_score": nutrition_score,
                "parsed_ingredients": parsed_ingredients,
                "nutrition": nutrition
            })

        results.sort(
            key=lambda x: (
                x.get("match_percent", 0),
                x.get("rank_score", 0),
                -int(x.get("minutes", 0) or 0),
            ),
            reverse=True,
        )

        filtered = [r for r in results if float(r.get("match_percent", 0) or 0) >= float(min_match_percent)]

        # Avoid empty lists for sparse pantries while still suppressing very low matches.
        if len(filtered) < min(3, top_k):
            filtered = [r for r in results if float(r.get("match_percent", 0) or 0) >= 15.0]

        if not filtered:
            filtered = results

        return filtered[:top_k]

    def get_by_id(self, recipe_id: int):
        if not self.loaded:
            self.load_data()

        if self.recipes is None:
            return None

        row = self.recipes[self.recipes["id"] == int(recipe_id)]
        if row.empty:
            return None

        row = row.iloc[0]

        parsed_ingredients = row.get("parsed_ingredients", []) or []
        recipe_ing_names = row.get("ingredient_names", set()) or set()

        nutrition = calculate_nutrition(parsed_ingredients)
        nutrition_score = self._nutrition_score(nutrition)

        minutes = int(row.get("minutes", 0))
        difficulty = (
            "Easy" if minutes <= 30 else
            "Intermediate" if minutes <= 60 else
            "Advanced"
        )

        seasonal_hint = self._seasonal_hint(recipe_ing_names)

        image_url = row.get("image_url")
        if image_url and image_url != image_url:
            image_url = ""
        image_url = self._clean_image_url(image_url)

        return {
            "id": int(row["id"]),
            "name": row.get("name"),
            "minutes": minutes,
            "difficulty": difficulty,
            "cuisine": row.get("cuisine", "General"),
            "image_url": image_url,
            "steps": str(row.get("instructions", "")).split("."),
            "parsed_ingredients": parsed_ingredients,
            "nutrition": nutrition,
            "nutrition_score": nutrition_score,
            "season": self._current_season(),
            "seasonal_hint": seasonal_hint,
            "ingredients_set": list(recipe_ing_names),
        }


# Global Instance
recommender = MealRecommender()
