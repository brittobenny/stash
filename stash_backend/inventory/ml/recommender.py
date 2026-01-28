import pandas as pd
import os

BASE_DIR = os.path.dirname(os.path.abspath(__file__))

DATASET_PATH = os.path.join(
    BASE_DIR,
    "data",
    "Cleaned_Indian_Food_Dataset.csv"
)

class MealRecommender:
    """
    Lightweight content-based recommender
    Uses Pantry items to suggest recipes
    """

    def __init__(self):
        self.recipes = None
        self.loaded = False

    def load_data(self):
        if self.loaded:
            return True

        if not os.path.exists(DATASET_PATH):
            raise FileNotFoundError(f"Dataset not found: {DATASET_PATH}")

        df = pd.read_csv(DATASET_PATH)

        # Normalize ingredient column
        df["ingredients_set"] = df["Cleaned-Ingredients"].apply(
            lambda x: set(i.strip().lower() for i in str(x).split(","))
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

    def recommend(self, pantry_items, top_k=5):

        if not self.loaded:
            self.load_data()

        pantry_set = set(i.lower() for i in pantry_items)

        results = []

        for _, row in self.recipes.iterrows():

            recipe_ingredients = row["ingredients_set"]
            intersection = pantry_set & recipe_ingredients

            if not intersection:
                continue

            score = len(intersection) / len(recipe_ingredients)

            if score >= 0.2:
                minutes = row["minutes"]

                if minutes <= 30:
                    difficulty = "Easy"
                elif minutes <= 60:
                    difficulty = "Intermediate"
                else:
                    difficulty = "Advanced"

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
                    "missing_ingredients": list(recipe_ingredients - pantry_set)
                })

        results.sort(key=lambda x: x["match_percent"], reverse=True)

        return results[:top_k]


# Global instance
recommender = MealRecommender()
