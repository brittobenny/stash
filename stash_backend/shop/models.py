from django.db import models
from django.conf import settings

User = settings.AUTH_USER_MODEL


class Category(models.Model):
    name = models.CharField(max_length=100, unique=True)

    def __str__(self):
        return self.name


class Product(models.Model):
    UNIT_CHOICES = [
        ('g', 'Grams'),
        ('kg', 'Kilograms'),
        ('ml', 'Millilitre'),
        ('l', 'Litre'),
        ('pcs', 'Pieces'),
        ('pack', 'Pack'),
    ]
    owner = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        limit_choices_to={'userprofile__role': 'shopowner'}
    )

    category = models.ForeignKey(
        Category,
        on_delete=models.CASCADE,
        related_name="products"
    )

    name = models.CharField(max_length=150)
    price = models.DecimalField(max_digits=10, decimal_places=2)
    stock_quantity = models.PositiveIntegerField()
    unit = models.CharField(max_length=10, choices=UNIT_CHOICES, default='pcs')
    image = models.ImageField(upload_to="products/", blank=True, null=True)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return self.name
