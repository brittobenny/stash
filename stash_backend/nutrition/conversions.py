UNIT_TO_GRAMS = {
    "teaspoon": 5,
    "tsp": 5,

    "tablespoon": 15,
    "tbsp": 15,

    "cup": 240,

    "gram": 1,
    "grams": 1,
    "g": 1,

    "kg": 1000,

    "ml": 1,
    "liter": 1000,

    "piece": 100,
    "pcs": 100
}

DEFAULT_INGREDIENT_GRAMS = {
    "oil": 10,
    "sunflower oil": 10,
    "vegetable oil": 10,
    "olive oil": 10,

    "salt": 2,
    "sugar": 5,

    "chilli": 2,
    "chili": 2,
    "pepper": 2,
    "turmeric": 2,
    "cumin": 2,
    "coriander": 2,

    "onion": 50,
    "tomato": 50,
    "potato": 60,
    "carrot": 50,

    "rice": 50,
    "wheat": 50,
    "flour": 50,

    "milk": 100,
    "water": 100
}
# Approx weights (good for project-level nutrition estimates)
INCH_TO_GRAMS_BY_INGREDIENT = {
    "ginger": 6.0,     # 1 inch ginger ≈ 6g (typical knob)
    "cinnamon": 2.0,   # 1 inch cinnamon stick ≈ 2g
    "turmeric": 6.0,   # 1 inch fresh turmeric ≈ 6g
}

CM_TO_GRAMS_BY_INGREDIENT = {
    "ginger": 2.4,     # ~ 6g per 2.5cm
    "cinnamon": 0.8,
    "turmeric": 2.4,
}

PIECE_TO_GRAMS = {
    "onion": 100.0,
    "tomato": 100.0,
    "potato": 150.0,
    "egg": 50.0,
    "lemon": 60.0,
    "green chilli": 5.0,
    "dry red chilli": 3.0,
    "garlic clove": 3.0,
    "clove garlic": 3.0,
    "ginger": 6.0,   # if written like "1 ginger" (rare)
}
