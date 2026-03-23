from datetime import timedelta
from decimal import Decimal

from django.contrib.auth import get_user_model
from django.core.management.base import BaseCommand
from django.db import transaction
from django.utils import timezone

from accounts.models import UserProfile
from inventory.models import Ingredient, InventoryItem, PantryItem
from inventory.pantry_batches import add_pantry_stock
from shop.models import Category, Product, ShopProfile
from social.models import RecipeComment, RecipeLike, RecipePost


DEMO_PASSWORD = "demo123"

INGREDIENT_FIXTURES = [
    {"name": "Tomato", "category": "Vegetable", "default_unit": "grams"},
    {"name": "Onion", "category": "Vegetable", "default_unit": "grams"},
    {"name": "Rice", "category": "Grain", "default_unit": "grams"},
    {"name": "Milk", "category": "Dairy", "default_unit": "ml"},
    {"name": "Banana", "category": "Fruit", "default_unit": "pcs"},
    {"name": "Paneer", "category": "Dairy", "default_unit": "grams"},
    {"name": "Potato", "category": "Vegetable", "default_unit": "grams"},
    {"name": "Carrot", "category": "Vegetable", "default_unit": "grams"},
    {"name": "Spinach", "category": "Vegetable", "default_unit": "grams"},
    {"name": "Coriander", "category": "Spice", "default_unit": "grams"},
    {"name": "Coconut Oil", "category": "Oil", "default_unit": "ml"},
]

CATEGORY_NAMES = [
    "Fresh Vegetables",
    "Staples",
    "Dairy",
    "Fruits",
    "Oils",
]

USER_FIXTURES = [
    {
        "username": "demo_customer_anu",
        "email": "anu.demo@stash.local",
        "password": DEMO_PASSWORD,
        "first_name": "Anu",
        "role": "customer",
        "mobile_number": "9876500011",
        "address": "Rose Villa, Marine Drive",
        "location": "Kochi",
    },
    {
        "username": "demo_customer_britto",
        "email": "britto.demo@stash.local",
        "password": DEMO_PASSWORD,
        "first_name": "Britto",
        "role": "customer",
        "mobile_number": "9876500012",
        "address": "Palm Residency, Chalakudy",
        "location": "Chalakudy",
    },
    {
        "username": "demo_shop_kochi",
        "email": "kochi.shop@stash.local",
        "password": DEMO_PASSWORD,
        "first_name": "Maya",
        "role": "shopowner",
        "mobile_number": "9876500021",
        "address": "Market Road, Kochi",
        "location": "Kochi",
    },
    {
        "username": "demo_shop_thrissur",
        "email": "thrissur.shop@stash.local",
        "password": DEMO_PASSWORD,
        "first_name": "Rohit",
        "role": "shopowner",
        "mobile_number": "9876500022",
        "address": "Round South, Thrissur",
        "location": "Thrissur",
    },
]


class Command(BaseCommand):
    help = "Seed demo customers, shop owners, products, pantry/inventory items, and social posts."

    @transaction.atomic
    def handle(self, *args, **options):
        ingredient_map, ingredients_created = self._ensure_ingredients()
        category_map, categories_created = self._ensure_categories()
        user_map, users_created = self._ensure_users()
        shops_created = self._ensure_shop_profiles(user_map)
        products_created = self._ensure_products(user_map, category_map, ingredient_map)
        pantry_created, inventory_created = self._ensure_inventory(user_map, ingredient_map)
        posts_created, likes_created, comments_created = self._ensure_social_data(user_map)

        self.stdout.write(self.style.SUCCESS("Demo data seeded successfully."))
        self.stdout.write(
            "\n".join(
                [
                    f"Users created: {users_created}",
                    f"Shop profiles created: {shops_created}",
                    f"Categories created: {categories_created}",
                    f"Ingredients created: {ingredients_created}",
                    f"Products created: {products_created}",
                    f"Pantry rows created: {pantry_created}",
                    f"Inventory rows created: {inventory_created}",
                    f"Posts created: {posts_created}",
                    f"Likes created: {likes_created}",
                    f"Comments created: {comments_created}",
                    "",
                    "Demo credentials:",
                    f"  customer: anu.demo@stash.local / {DEMO_PASSWORD}",
                    f"  customer: britto.demo@stash.local / {DEMO_PASSWORD}",
                    f"  shop owner: kochi.shop@stash.local / {DEMO_PASSWORD}",
                    f"  shop owner: thrissur.shop@stash.local / {DEMO_PASSWORD}",
                ]
            )
        )

    def _ensure_ingredients(self):
        existing = {
            ingredient.name.lower(): ingredient
            for ingredient in Ingredient.objects.filter(
                name__in=[item["name"] for item in INGREDIENT_FIXTURES]
            )
        }
        to_create = []
        for item in INGREDIENT_FIXTURES:
            key = item["name"].lower()
            if key in existing:
                continue
            to_create.append(
                Ingredient(
                    name=item["name"],
                    category=item["category"],
                    default_unit=item["default_unit"],
                    embedding=[0.0],
                )
            )
        if to_create:
            Ingredient.objects.bulk_create(to_create, ignore_conflicts=True)

        ingredient_map = {
            ingredient.name: ingredient
            for ingredient in Ingredient.objects.filter(
                name__in=[item["name"] for item in INGREDIENT_FIXTURES]
            )
        }
        return ingredient_map, len(to_create)

    def _ensure_categories(self):
        created = 0
        category_map = {}
        for name in CATEGORY_NAMES:
            category, was_created = Category.objects.get_or_create(name=name)
            category_map[name] = category
            created += int(was_created)
        return category_map, created

    def _ensure_users(self):
        User = get_user_model()
        user_map = {}
        created = 0

        for item in USER_FIXTURES:
            user = User.objects.filter(username=item["username"]).first()
            if user is None:
                user = User.objects.create_user(
                    username=item["username"],
                    email=item["email"],
                    password=item["password"],
                    first_name=item["first_name"],
                )
                created += 1
            else:
                changed_fields = []
                if user.email != item["email"]:
                    user.email = item["email"]
                    changed_fields.append("email")
                if user.first_name != item["first_name"]:
                    user.first_name = item["first_name"]
                    changed_fields.append("first_name")
                should_be_staff = item["role"] in {"shopowner", "admin"}
                if user.is_staff != should_be_staff:
                    user.is_staff = should_be_staff
                    changed_fields.append("is_staff")
                if changed_fields:
                    user.save(update_fields=changed_fields)
                user.set_password(item["password"])
                user.save(update_fields=["password"])

            should_be_staff = item["role"] in {"shopowner", "admin"}
            if user.is_staff != should_be_staff:
                user.is_staff = should_be_staff
                user.save(update_fields=["is_staff"])

            UserProfile.objects.update_or_create(
                user=user,
                defaults={
                    "mobile_number": item["mobile_number"],
                    "address": item["address"],
                    "location": item["location"],
                    "role": item["role"],
                },
            )
            user_map[item["username"]] = user

        return user_map, created

    def _ensure_shop_profiles(self, user_map):
        fixtures = [
            {
                "username": "demo_shop_kochi",
                "store_name": "Green Basket Market",
                "address": "Market Road, Kochi",
                "location": "Kochi",
                "phone": "0484-220011",
                "hours": "7 AM - 10 PM",
                "delivery_radius_km": Decimal("12.00"),
                "min_order_amount": Decimal("150.00"),
                "tax_rate": Decimal("5.00"),
                "service_fee": Decimal("15.00"),
            },
            {
                "username": "demo_shop_thrissur",
                "store_name": "Harvest Hub",
                "address": "Round South, Thrissur",
                "location": "Thrissur",
                "phone": "0487-220022",
                "hours": "8 AM - 9 PM",
                "delivery_radius_km": Decimal("10.00"),
                "min_order_amount": Decimal("100.00"),
                "tax_rate": Decimal("5.00"),
                "service_fee": Decimal("10.00"),
            },
        ]

        created = 0
        for item in fixtures:
            _, was_created = ShopProfile.objects.update_or_create(
                owner=user_map[item["username"]],
                defaults={
                    "store_name": item["store_name"],
                    "address": item["address"],
                    "location": item["location"],
                    "phone": item["phone"],
                    "hours": item["hours"],
                    "delivery_radius_km": item["delivery_radius_km"],
                    "min_order_amount": item["min_order_amount"],
                    "tax_rate": item["tax_rate"],
                    "service_fee": item["service_fee"],
                },
            )
            created += int(was_created)
        return created

    def _ensure_products(self, user_map, category_map, ingredient_map):
        fixtures = [
            {
                "owner": "demo_shop_kochi",
                "category": "Fresh Vegetables",
                "ingredient": "Tomato",
                "name": "Tomato Fresh Pack",
                "price": Decimal("20.00"),
                "stock_quantity": 100,
                "low_stock_threshold": 12,
                "unit": "g",
                "pack_size": 500,
                "pack_unit": "g",
            },
            {
                "owner": "demo_shop_kochi",
                "category": "Fresh Vegetables",
                "ingredient": "Onion",
                "name": "Onion Family Bag",
                "price": Decimal("42.00"),
                "stock_quantity": 35,
                "low_stock_threshold": 8,
                "unit": "kg",
                "pack_size": 1,
                "pack_unit": "kg",
            },
            {
                "owner": "demo_shop_kochi",
                "category": "Dairy",
                "ingredient": "Milk",
                "name": "Fresh Milk 1L",
                "price": Decimal("54.00"),
                "stock_quantity": 40,
                "low_stock_threshold": 10,
                "unit": "l",
                "pack_size": 1,
                "pack_unit": "l",
            },
            {
                "owner": "demo_shop_kochi",
                "category": "Oils",
                "ingredient": "Coconut Oil",
                "name": "Coconut Oil Bottle",
                "price": Decimal("160.00"),
                "stock_quantity": 18,
                "low_stock_threshold": 5,
                "unit": "l",
                "pack_size": 1,
                "pack_unit": "l",
            },
            {
                "owner": "demo_shop_kochi",
                "category": "Fruits",
                "ingredient": "Banana",
                "name": "Banana Bunch",
                "price": Decimal("35.00"),
                "stock_quantity": 24,
                "low_stock_threshold": 6,
                "unit": "pcs",
                "pack_size": 6,
                "pack_unit": "pcs",
            },
            {
                "owner": "demo_shop_thrissur",
                "category": "Staples",
                "ingredient": "Rice",
                "name": "Rice Bag 5kg",
                "price": Decimal("325.00"),
                "stock_quantity": 20,
                "low_stock_threshold": 5,
                "unit": "kg",
                "pack_size": 5,
                "pack_unit": "kg",
            },
            {
                "owner": "demo_shop_thrissur",
                "category": "Fresh Vegetables",
                "ingredient": "Potato",
                "name": "Potato Value Pack",
                "price": Decimal("48.00"),
                "stock_quantity": 30,
                "low_stock_threshold": 8,
                "unit": "kg",
                "pack_size": 1,
                "pack_unit": "kg",
            },
            {
                "owner": "demo_shop_thrissur",
                "category": "Fresh Vegetables",
                "ingredient": "Carrot",
                "name": "Carrot Fresh Pack",
                "price": Decimal("28.00"),
                "stock_quantity": 26,
                "low_stock_threshold": 6,
                "unit": "g",
                "pack_size": 500,
                "pack_unit": "g",
            },
            {
                "owner": "demo_shop_thrissur",
                "category": "Dairy",
                "ingredient": "Paneer",
                "name": "Paneer Block 200g",
                "price": Decimal("78.00"),
                "stock_quantity": 15,
                "low_stock_threshold": 4,
                "unit": "g",
                "pack_size": 200,
                "pack_unit": "g",
            },
            {
                "owner": "demo_shop_thrissur",
                "category": "Fresh Vegetables",
                "ingredient": "Spinach",
                "name": "Spinach Bundle",
                "price": Decimal("22.00"),
                "stock_quantity": 16,
                "low_stock_threshold": 4,
                "unit": "g",
                "pack_size": 250,
                "pack_unit": "g",
            },
        ]

        created = 0
        for item in fixtures:
            _, was_created = Product.objects.update_or_create(
                owner=user_map[item["owner"]],
                name=item["name"],
                defaults={
                    "category": category_map[item["category"]],
                    "ingredient": ingredient_map[item["ingredient"]],
                    "price": item["price"],
                    "stock_quantity": item["stock_quantity"],
                    "low_stock_threshold": item["low_stock_threshold"],
                    "unit": item["unit"],
                    "pack_size": item["pack_size"],
                    "pack_unit": item["pack_unit"],
                    "is_active": True,
                },
            )
            created += int(was_created)
        return created

    def _ensure_inventory(self, user_map, ingredient_map):
        today = timezone.localdate()
        pantry_fixtures = [
            {
                "user": "demo_customer_anu",
                "ingredient": "Tomato",
                "quantity": 120,
                "expiry_date": today + timedelta(days=2),
                "low_stock_limit": 250,
            },
            {
                "user": "demo_customer_anu",
                "ingredient": "Onion",
                "quantity": 180,
                "expiry_date": None,
                "low_stock_limit": 300,
            },
            {
                "user": "demo_customer_anu",
                "ingredient": "Rice",
                "quantity": 900,
                "expiry_date": None,
                "low_stock_limit": 1200,
            },
            {
                "user": "demo_customer_anu",
                "ingredient": "Milk",
                "quantity": 250,
                "expiry_date": today + timedelta(days=1),
                "low_stock_limit": 500,
            },
            {
                "user": "demo_customer_anu",
                "ingredient": "Banana",
                "quantity": 2,
                "expiry_date": today + timedelta(days=3),
                "low_stock_limit": 4,
            },
            {
                "user": "demo_customer_britto",
                "ingredient": "Potato",
                "quantity": 700,
                "expiry_date": today + timedelta(days=7),
                "low_stock_limit": 1000,
            },
            {
                "user": "demo_customer_britto",
                "ingredient": "Paneer",
                "quantity": 120,
                "expiry_date": today + timedelta(days=4),
                "low_stock_limit": 250,
            },
            {
                "user": "demo_customer_britto",
                "ingredient": "Spinach",
                "quantity": 90,
                "expiry_date": today + timedelta(days=2),
                "low_stock_limit": 150,
            },
            {
                "user": "demo_customer_britto",
                "ingredient": "Coriander",
                "quantity": 35,
                "expiry_date": today + timedelta(days=2),
                "low_stock_limit": 60,
            },
        ]

        inventory_fixtures = [
            {"user": "demo_customer_anu", "ingredient": "Tomato", "quantity": 380, "unit": "grams"},
            {"user": "demo_customer_anu", "ingredient": "Rice", "quantity": 1400, "unit": "grams"},
            {"user": "demo_customer_anu", "ingredient": "Milk", "quantity": 750, "unit": "ml"},
            {"user": "demo_customer_britto", "ingredient": "Potato", "quantity": 300, "unit": "grams"},
            {"user": "demo_customer_britto", "ingredient": "Paneer", "quantity": 80, "unit": "grams"},
            {"user": "demo_customer_britto", "ingredient": "Coriander", "quantity": 20, "unit": "grams"},
        ]

        pantry_created = 0
        for item in pantry_fixtures:
            pantry_item = PantryItem.objects.filter(
                user=user_map[item["user"]],
                ingredient=ingredient_map[item["ingredient"]],
            ).first()
            was_created = pantry_item is None
            if pantry_item:
                pantry_item.batches.all().delete()
                pantry_item.quantity = 0
                pantry_item.expiry_date = None
                pantry_item.low_stock_limit = item["low_stock_limit"]
                pantry_item.save(update_fields=["quantity", "expiry_date", "low_stock_limit"])

            add_pantry_stock(
                user=user_map[item["user"]],
                ingredient=ingredient_map[item["ingredient"]],
                quantity=item["quantity"],
                expiry_date=item["expiry_date"],
                low_stock_limit=item["low_stock_limit"],
            )
            pantry_created += int(was_created)

        inventory_created = 0
        for item in inventory_fixtures:
            _, was_created = InventoryItem.objects.update_or_create(
                user=user_map[item["user"]],
                ingredient=ingredient_map[item["ingredient"]],
                defaults={
                    "quantity": item["quantity"],
                    "unit": item["unit"],
                    "expiry_date": None,
                },
            )
            inventory_created += int(was_created)

        return pantry_created, inventory_created

    def _ensure_social_data(self, user_map):
        fixtures = [
            {
                "author": "demo_customer_anu",
                "title": "Tomato Rice for Busy Weeknights",
                "caption": "Used pantry rice, tomato, and onion for a quick dinner that still felt fresh.",
                "ingredients": "Rice, Tomato, Onion, Coconut Oil, Salt",
                "steps": "Saute onion and tomato. Add cooked rice. Finish with coriander.",
                "liked_by": ["demo_customer_britto"],
                "comments": [
                    ("demo_customer_britto", "This looks simple and really useful for weeknights."),
                ],
            },
            {
                "author": "demo_customer_britto",
                "title": "Paneer Spinach Skillet",
                "caption": "A fast one-pan paneer dinner with spinach and a little spice.",
                "ingredients": "Paneer, Spinach, Onion, Coconut Oil, Chilli",
                "steps": "Cook onion, add spinach, then paneer and season well before serving.",
                "liked_by": ["demo_customer_anu"],
                "comments": [
                    ("demo_customer_anu", "Love that this uses just a few ingredients."),
                ],
            },
            {
                "author": "demo_customer_anu",
                "title": "Banana Milk Breakfast Shake",
                "caption": "Good for finishing milk and bananas before they expire.",
                "ingredients": "Banana, Milk, Honey",
                "steps": "Blend everything until smooth and chill before serving.",
                "liked_by": ["demo_customer_britto", "demo_shop_kochi"],
                "comments": [
                    ("demo_shop_kochi", "Nice idea for reducing pantry waste."),
                ],
            },
        ]

        posts_created = 0
        likes_created = 0
        comments_created = 0

        for item in fixtures:
            post, was_created = RecipePost.objects.update_or_create(
                user=user_map[item["author"]],
                title=item["title"],
                defaults={
                    "caption": item["caption"],
                    "ingredients": item["ingredients"],
                    "steps": item["steps"],
                    "status": "APPROVED",
                    "rejection_reason": "",
                },
            )
            posts_created += int(was_created)

            for liker_username in item["liked_by"]:
                _, like_created = RecipeLike.objects.get_or_create(
                    post=post,
                    user=user_map[liker_username],
                )
                likes_created += int(like_created)

            for commenter_username, text in item["comments"]:
                exists = RecipeComment.objects.filter(
                    post=post,
                    user=user_map[commenter_username],
                    text=text,
                ).exists()
                if exists:
                    continue
                RecipeComment.objects.create(
                    post=post,
                    user=user_map[commenter_username],
                    text=text,
                )
                comments_created += 1

        return posts_created, likes_created, comments_created
