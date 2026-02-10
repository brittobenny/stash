import pandas as pd
import os
import re
from nutrition.parser import parse_ingredient
from nutrition.calculator import calculate_nutrition

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

    # ----------------------------------
    def clean_ingredient(self, text):
        """
        Converts:
        '2 onions' -> 'onion'
        '1 tsp oil' -> 'oil'
        """
        text = text.lower()
        text = re.sub(r"[^a-zA-Z ]", "", text)
        words = text.split()
        return words[-1] if words else ""

    # ----------------------------------
    def load_data(self):

        if self.loaded:
            return True

        if not os.path.exists(DATASET_PATH):
            raise FileNotFoundError(f"Dataset not found: {DATASET_PATH}")

        df = pd.read_csv(DATASET_PATH)

        df["ingredients_set"] = df["Cleaned-Ingredients"].apply(
            lambda x: set(
                self.clean_ingredient(i)
                for i in str(x).split(",")
            )
        )

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

    # ----------------------------------
    def recommend(self, pantry_items, top_k=5):

        if not self.loaded:
            self.load_data()

        pantry_set = set(i.lower() for i in pantry_items)

        if not pantry_set:
            return []

        results = []

        # Detect hero items user owns
        user_heroes = [
            i for i in pantry_set
            if any(h in i for h in self.hero_keywords)
        ]

        for _, row in self.recipes.iterrows():

            recipe_ing = row["ingredients_set"]

            intersection = pantry_set & recipe_ing

            # Must match at least ONE ingredient
            if not intersection:
                continue

            # Enforce hero rule
            if user_heroes:
                if not any(hero in recipe_ing for hero in user_heroes):
                    continue

            used = len(intersection)
            missing = len(recipe_ing - pantry_set)

            # Scoring formula
            score = used / (used + missing + 1)

            minutes = row["minutes"]
            difficulty = (
                "Easy" if minutes <= 30 else
                "Intermediate" if minutes <= 60 else
                "Advanced"
            )
            raw_ingredients = row["TranslatedIngredients"].split(",")

            parsed_ingredients = []
            for ing in raw_ingredients:
                parsed_ingredients.append(parse_ingredient(ing))
            nutrition = calculate_nutrition(parsed_ingredients)

            results.append({
                "id": int(row["id"]),
                "name": row["name"],
                "match_percent": round(score * 100, 1),
                "minutes": int(minutes),
                "difficulty": difficulty,
                "cuisine": row.get("cuisine", "General"),
                "image_url": row.get("image_url"),
                "steps": row["instructions"].split("."),
                "used_ingredients": list(intersection),
                "missing_ingredients": list(recipe_ing - pantry_set),
                "parsed_ingredients": parsed_ingredients,
                "nutrition": nutrition
            })

        results.sort(key=lambda x: x["match_percent"], reverse=True)

        return results[:top_k]


# Global Instance
recommender = MealRecommender()
