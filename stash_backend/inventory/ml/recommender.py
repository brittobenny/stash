import pandas as pd
import os
import re
from datetime import datetime
from nutrition.parser import parse_ingredient
from nutrition.calculator import calculate_nutrition
from nutrition.services import DAILY_RANGES
from inventory.substitutions import get_substitutions, normalize_name as normalize_sub_name

BASE_DIR = os.path.dirname(os.path.abspath(__file__))

DATASET_PATH = os.path.join(
    BASE_DIR,
    "data",
    "Cleaned_Indian_Food_Dataset.csv"
)

class MealRecommender:
    """
    Smart Pantry-Based Recipe Recommender
    Prevents suggesting recipes whose MAIN ingredient is missing
    """

    def __init__(self):
        self.recipes = None
        self.loaded = False

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
            "red chilli": "chilli",
            "red chili": "chilli",
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
        ingredient_match_set = set()

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
            if canonical_name not in ingredient_names:
                ingredient_names.append(canonical_name)
            ingredient_match_set.update(self._expand_name_for_match(canonical_name))

        return parsed_ingredients, set(ingredient_names), ingredient_match_set

    # ----------------------------------
    def load_data(self):

        if self.loaded:
            return True

        if not os.path.exists(DATASET_PATH):
            raise FileNotFoundError(f"Dataset not found: {DATASET_PATH}")

        df = pd.read_csv(DATASET_PATH)

        parsed_bundle = df["TranslatedIngredients"].apply(self._parse_recipe_ingredients)
        df["parsed_ingredients"] = parsed_bundle.apply(lambda x: x[0])
        df["ingredient_names"] = parsed_bundle.apply(lambda x: x[1])
        # Match set includes canonical names + token variants for robust matching.
        df["ingredients_set"] = parsed_bundle.apply(lambda x: x[2])

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

    # ----------------------------------
    def recommend(self, pantry_items, top_k=10, min_match_percent=25.0):

        if not self.loaded:
            self.load_data()

        pantry_names = set()
        pantry_set = set()
        for item in pantry_items:
            raw = str(item or "").strip().lower()
            if not raw:
                continue
            canonical = self._canonical_name(raw) or self.clean_ingredient(raw)
            if not canonical:
                continue
            pantry_names.add(canonical)
            pantry_set.update(self._expand_name_for_match(canonical))

        if not pantry_set:
            return []

        results = []
        season = self._current_season()

        # Detect hero items user owns
        user_heroes = {hero for hero in self.hero_keywords if hero in pantry_set}

        for _, row in self.recipes.iterrows():

            recipe_ing_match_set = row["ingredients_set"]
            recipe_ing_names = row.get("ingredient_names", set()) or set()
            if not recipe_ing_match_set or not recipe_ing_names:
                continue

            available_names = {
                ing_name
                for ing_name in recipe_ing_names
                if self._expand_name_for_match(ing_name) & pantry_set
            }

            # Must match at least ONE ingredient
            if not available_names:
                continue

            # Enforce hero rule
            if user_heroes and not any(hero in recipe_ing_match_set for hero in user_heroes):
                continue

            used = len(available_names)
            missing_set = set(recipe_ing_names) - available_names
            missing = len(missing_set)

            substitutable = self._find_substitutable(missing_set, pantry_names)
            missing_effective = max(0.0, missing - (len(substitutable) * 0.6))
            total_effective = used + missing_effective
            if total_effective <= 0:
                continue
            base_coverage = used / total_effective
            pantry_focus = used / max(1, len(pantry_names))
            base_match = min(1.0, max(0.0, (base_coverage * 0.9) + (pantry_focus * 0.1)))

            minutes = row["minutes"]
            difficulty = (
                "Easy" if minutes <= 30 else
                "Intermediate" if minutes <= 60 else
                "Advanced"
            )
            parsed_ingredients = row.get("parsed_ingredients", []) or []
            nutrition = calculate_nutrition(parsed_ingredients)
            nutrition_score = self._nutrition_score(nutrition)
            seasonal_hint = self._seasonal_hint(recipe_ing_names)
            seasonal_bonus = 1.0 if seasonal_hint else 0.0
            rank_score = (base_match * 0.6) + (nutrition_score * 0.25) + (seasonal_bonus * 0.15)

            image_url = row.get("image_url")
            if image_url and image_url != image_url:
                image_url = ""
            image_url = self._clean_image_url(image_url)
            results.append({
                "id": int(row["id"]),
                "name": row["name"],
                "match_percent": round(base_match * 100, 1),
                "rank_score": round(rank_score, 4),
                "minutes": int(minutes),
                "difficulty": difficulty,
                "cuisine": row.get("cuisine", "General"),
                "image_url": image_url,
                "steps": row["instructions"].split("."),
                "used_ingredients": sorted(list(available_names)),
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
