from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("shop", "0006_order_cancelled_at_order_refunded_at_and_more"),
    ]

    operations = [
        migrations.AddField(
            model_name="product",
            name="low_stock_threshold",
            field=models.PositiveIntegerField(default=10),
        ),
    ]
