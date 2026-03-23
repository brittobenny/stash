import pandas as pd
import os
import re
from datetime import datetime
from nutrition.parser import parse_ingredient
from nutrition.calculator import calculate_nutrition
from nutrition.services import DAILY_RANGES
from nutrition.services import build_recipe_nutrition_badges
from inventory.substitutions import get_substitutions, normalize_name as normalize_sub_name
from .hero_ingredient_pipeline import normalize_hero_ingredients, is_basic_spice

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
    if os.path.exists(RAW_DATASET_PATH):
        return RAW_DATASET_PATH
    return COMMON_DATASET_PATH

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

        return (
            parsed_ingredients,
            ingredient_names,
            ingredient_quantities,
            ingredient_match_set,
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
        df["hero_ingredients"] = df.apply(
            lambda row: self._resolve_recipe_heroes(
                row.get("TranslatedRecipeName", ""),
                row.get("ingredient_names", []),
                row.get("ingredient_quantities", []),
            ),
            axis=1,
        )
        df["hero_ingredient"] = df["hero_ingredients"].apply(lambda heroes: heroes[0] if heroes else "")

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

    def _resolve_recipe_heroes(self, title, ingredient_names, ingredient_quantities):
        names = []
        for item in ingredient_names or []:
            canonical = self._canonical_name(item)
            if canonical:
                names.append(canonical)

        if not names:
            return []

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

        max_qty = max(quantities) if quantities else 0.0
        scored = []
        for idx, ingredient in enumerate(names):
            qty = quantities[idx] if idx < len(quantities) else 0.0
            appears_in_title = bool(ingredient and re.search(rf"\b{re.escape(ingredient)}\b", title_text))

            score = 0
            if appears_in_title:
                score += 5
            if max_qty > 0 and qty >= (0.75 * max_qty):
                score += 3
            if idx <= 2:
                score += 1
            if ingredient in self.hero_keywords:
                score += 1

            scored.append((score, qty, -idx, ingredient, appears_in_title))

        scored.sort(reverse=True)

        selected = []
        for score, _, _, ingredient, appears_in_title in scored:
            if appears_in_title or score >= 4:
                if ingredient not in selected:
                    selected.append(ingredient)

        if not selected and scored:
            selected.append(scored[0][3])

        # Keep list compact but allow multiple core ingredients per dish.
        return selected[:3]

    def _resolve_recipe_hero(self, title, ingredient_names, ingredient_quantities):
        heroes = self._resolve_recipe_heroes(title, ingredient_names, ingredient_quantities)
        return heroes[0] if heroes else ""

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

    def _normalize_selected_hero(self, hero_ingredient):
        normalized = normalize_hero_ingredients(hero_ingredient)
        if normalized:
            return normalized[0]
        return self._canonical_name(hero_ingredient)

    def _title_contains_token(self, title, token):
        clean_title = re.sub(r"[^a-z ]", " ", str(title or "").lower())
        clean_title = re.sub(r"\s+", " ", clean_title).strip()
        canonical_title = self._canonical_name(clean_title) or clean_title
        if not token or not canonical_title:
            return False
        return bool(re.search(rf"\b{re.escape(token)}\b", canonical_title))

    def _calculate_recipe_score(self, recipe_ingredients, user_ingredients):
        recipe_set = {
            canonical
            for item in recipe_ingredients or []
            for canonical in [self._canonical_name(item)]
            if canonical and not is_basic_spice(canonical)
        }
        user_set = {self._canonical_name(item) for item in user_ingredients or [] if self._canonical_name(item)}

        if not recipe_set or not user_set:
            return {
                "score": 0.0,
                "matched": [],
                "missing": sorted(recipe_set),
                "total": len(recipe_set),
                "match_ratio": 0.0,
                "missing_ratio": 0.0,
                "user_coverage": 0.0,
                "ease_score": 0.0,
            }

        matched = sorted(recipe_set & user_set)
        missing = sorted(recipe_set - user_set)

        total = len(recipe_set)
        matched_count = len(matched)
        missing_count = len(missing)

        match_ratio = matched_count / total if total else 0.0
        missing_ratio = missing_count / total if total else 0.0
        ease_score = 1.0 / (1.0 + total)
        user_coverage = matched_count / len(user_set) if user_set else 0.0

        score = (
            (0.65 * match_ratio)
            + (0.25 * user_coverage)
            + (0.10 * ease_score)
            - (0.15 * missing_ratio)
        )

        return {
            "score": round(max(score, 0.0), 6),
            "matched": matched,
            "missing": missing,
            "total": total,
            "match_ratio": round(match_ratio, 6),
            "missing_ratio": round(missing_ratio, 6),
            "user_coverage": round(user_coverage, 6),
            "ease_score": round(ease_score, 6),
        }

    def _recipe_matches_selected_hero(self, row, selected_hero):
        if not selected_hero:
            return True

        recipe_name = str(row.get("name", "") or "")
        return self._title_contains_token(recipe_name, selected_hero)

    def _compute_hero_presence_coverage(self, recipe_hero_names, pantry_names):
        coverage = {}
        if not recipe_hero_names:
            return coverage

        pantry_set = {self._canonical_name(item) for item in pantry_names or [] if self._canonical_name(item)}
        for hero in recipe_hero_names:
            canonical_hero = self._canonical_name(hero)
            if not canonical_hero:
                continue
            coverage[canonical_hero] = canonical_hero in pantry_set
        return coverage

    # ----------------------------------
    def recommend(self, pantry_items, top_k=10, min_match_percent=25.0, selected_hero_ingredient=None):

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
        pantry_name_list = list(pantry_qty_lookup.keys())
        selected_hero = self._normalize_selected_hero(selected_hero_ingredient)
        if not selected_hero and pantry_name_list:
            selected_hero = pantry_name_list[0]
        if selected_hero and selected_hero not in pantry_names:
            return []
        candidates = []
        season = self._current_season()
        pantry_user_ingredients = list(pantry_qty_lookup.keys())

        for row_idx, row in self.recipes.iterrows():
            recipe_ing_names = row.get("ingredient_names", []) or []
            hero_ingredients = list(row.get("hero_ingredients", []) or [])
            hero_ingredient = row.get("hero_ingredient", "") or (hero_ingredients[0] if hero_ingredients else "")
            if not recipe_ing_names:
                continue

            if not self._recipe_matches_selected_hero(row, selected_hero):
                continue

            score_result = self._calculate_recipe_score(
                recipe_ingredients=recipe_ing_names,
                user_ingredients=pantry_user_ingredients,
            )
            if score_result["score"] <= 0:
                continue

            available_names = set(score_result["matched"])
            if not available_names:
                continue

            missing_set = set(score_result["missing"])
            raw_match_percent = float(score_result["score"] * 100.0)
            primary_hero = self._canonical_name(hero_ingredient)
            hero_focus_score = 1.0
            if selected_hero and primary_hero and primary_hero != selected_hero:
                hero_focus_score = 0.6

            supporting_hero_ingredients = [hero for hero in hero_ingredients if hero != selected_hero]
            hero_coverage = self._compute_hero_presence_coverage(
                recipe_hero_names=supporting_hero_ingredients,
                pantry_names=pantry_user_ingredients,
            )
            supporting_hero_matches = [hero for hero, has_match in hero_coverage.items() if has_match]
            supporting_hero_missing = [hero for hero, has_match in hero_coverage.items() if not has_match]
            if supporting_hero_ingredients:
                supporting_hero_fit = len(supporting_hero_matches) / max(len(supporting_hero_ingredients), 1)
                supporting_hero_penalty = 0.45 + (0.55 * supporting_hero_fit)
            else:
                supporting_hero_fit = 1.0
                supporting_hero_penalty = 1.0

            match_percent = raw_match_percent * hero_focus_score * supporting_hero_penalty

            candidates.append({
                "row_idx": row_idx,
                "available_names": sorted(list(available_names)),
                "missing_set": missing_set,
                "match_percent": round(match_percent, 2),
                "raw_match_percent": round(raw_match_percent, 2),
                "score": round(score_result["score"], 6),
                "match_ratio": score_result["match_ratio"],
                "missing_ratio": score_result["missing_ratio"],
                "user_coverage": score_result["user_coverage"],
                "ease_score": score_result["ease_score"],
                "hero_ingredient": hero_ingredient,
                "hero_ingredients": hero_ingredients or ([hero_ingredient] if hero_ingredient else []),
                "match_status": (
                    "COOK_NOW" if match_percent >= 70
                    else "ALMOST_READY" if match_percent >= 40
                    else "LOW_MATCH"
                ),
                "selected_hero_ingredient": selected_hero,
                "supporting_hero_ingredients": supporting_hero_ingredients,
                "supporting_hero_matches": supporting_hero_matches,
                "supporting_hero_missing": supporting_hero_missing,
                "supporting_hero_fit": round(supporting_hero_fit, 3),
                "supporting_hero_match_count": len(supporting_hero_matches),
                "hero_focus_score": round(hero_focus_score, 3),
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
            base_match = max(0.0, min(1.0, float(candidate.get("score", 0.0) or 0.0)))
            supporting_heroes = candidate.get("supporting_hero_ingredients", [])
            supporting_hero_matches = candidate.get("supporting_hero_matches", [])
            supporting_hero_fit = float(candidate.get("supporting_hero_fit", 1.0) or 1.0)
            hero_focus_score = float(candidate.get("hero_focus_score", 1.0) or 1.0)
            rank_score = (
                (base_match * 0.82)
                + (supporting_hero_fit * 0.10)
                + (hero_focus_score * 0.08)
            )

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
                "raw_match_percent": round(float(candidate.get("raw_match_percent", candidate["match_percent"])), 2),
                "rank_score": round(rank_score, 4),
                "generic_score": round(float(candidate.get("score", 0.0) or 0.0), 4),
                "minutes": int(minutes),
                "difficulty": difficulty,
                "cuisine": row.get("cuisine", "General"),
                "image_url": image_url,
                "steps": row["instructions"].split("."),
                "hero_ingredient": candidate["hero_ingredient"],
                "hero_ingredients": candidate.get("hero_ingredients", []),
                "selected_hero_ingredient": candidate.get("selected_hero_ingredient", ""),
                "supporting_hero_ingredients": candidate.get("supporting_hero_ingredients", []),
                "supporting_hero_matches": candidate.get("supporting_hero_matches", []),
                "supporting_hero_missing": candidate.get("supporting_hero_missing", []),
                "supporting_hero_match_count": int(candidate.get("supporting_hero_match_count", 0) or 0),
                "match_status": candidate["match_status"],
                "used_ingredients": candidate["available_names"],
                "missing_ingredients": sorted(list(missing_set)),
                "substitutable_ingredients": substitutable,
                "season": season,
                "seasonal_hint": seasonal_hint,
                "nutrition_score": nutrition_score,
                "nutrition_badges": build_recipe_nutrition_badges(
                    {
                        "calories": nutrition.get("calories", 0),
                        "protein": nutrition.get("protein", 0),
                        "carbs": nutrition.get("carbs", 0),
                        "fats": nutrition.get("fat", 0),
                        "vegetable_servings": 0,
                    }
                ),
                "parsed_ingredients": parsed_ingredients,
                "nutrition": nutrition
            })

        results.sort(
            key=lambda x: (
                x.get("match_percent", 0),
                x.get("supporting_hero_match_count", 0),
                x.get("rank_score", 0),
                -int(x.get("minutes", 0) or 0),
            ),
            reverse=True,
        )

        filtered = [r for r in results if float(r.get("match_percent", 0) or 0) >= float(min_match_percent)]

        if len(filtered) < top_k:
            existing_ids = {item.get("id") for item in filtered}
            for recipe in results:
                if recipe.get("id") in existing_ids:
                    continue
                filtered.append(recipe)
                existing_ids.add(recipe.get("id"))
                if len(filtered) >= top_k:
                    break

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
            "hero_ingredient": row.get("hero_ingredient", ""),
            "hero_ingredients": list(row.get("hero_ingredients", []) or []),
        }


# Global Instance
recommender = MealRecommender()
