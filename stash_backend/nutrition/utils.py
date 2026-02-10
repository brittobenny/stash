import pandas as pd
import os

BASE_DIR = os.path.dirname(os.path.abspath(__file__))

DATASET_PATH = os.path.join(
    BASE_DIR,
    "..",
    "data",
    "nutrition.csv"
)
ALIASES = {
    "khichdi pongal": "khichdi",
    "pongal": "khichdi",
    "rice flour": "rice flour",  # keep
}

# Load once
nutrition_df = pd.read_csv(DATASET_PATH)

# Normalize column names
nutrition_df.columns = nutrition_df.columns.str.strip()

# YOUR CSV USES "Food Name"
nutrition_df["Food Name"] = nutrition_df["Food Name"].str.lower()

def get_nutrition(food_name):
    food_name = food_name.lower()
    food_name = ALIASES.get(food_name, food_name)

    match = nutrition_df[
        nutrition_df["Food Name"].str.contains(food_name, na=False, regex=False)
    ]

    if match.empty:
        return {
            "calories": 0,
            "protein": 0,
            "carbs": 0,
            "fat": 0
        }

    row = match.iloc[0]

    return {
        "calories": float(row.get("Calories", 0)),
        "protein": float(row.get("Protein", 0)),
        "carbs": float(row.get("Carbs", 0)),
        "fat": float(row.get("Fats", 0))
    }
