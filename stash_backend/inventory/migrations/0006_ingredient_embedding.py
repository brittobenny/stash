from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("inventory", "0005_ingredient_image_url"),
    ]

    operations = [
        migrations.AddField(
            model_name="ingredient",
            name="embedding",
            field=models.JSONField(blank=True, null=True),
        ),
    ]
