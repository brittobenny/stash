from nutrition.utils import get_nutrition

def calculate_nutrition(parsed_ingredients):
    total = {
        "calories": 0,
        "protein": 0,
        "carbs": 0,
        "fat": 0
    }

    for item in parsed_ingredients:
        data = get_nutrition(item["name"])
        grams = item["grams"]

        if not data:
            continue

        factor = grams / 100   # dataset values per 100g

        total["calories"] += data["calories"] * factor
        total["protein"] += data["protein"] * factor
        total["carbs"] += data["carbs"] * factor
        total["fat"] += data["fat"] * factor

    return total
