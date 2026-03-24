import os
import django
from datetime import datetime, timedelta

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "stash_backend.settings")
django.setup()

from django.contrib.auth.models import User
from shop.views import _owner_analytics_payload

# Find a shop owner
shop_owner = User.objects.filter(shop_profile__isnull=False).first()
if not shop_owner:
    print("No shop owner found.")
    exit(0)

# Simulate last 30 days
date_to = datetime.now().date()
date_from = date_to - timedelta(days=29)

print(f"Testing analytics for shop owner: {shop_owner.username}")
try:
    data = _owner_analytics_payload(shop_owner, date_from, date_to)
    import json
    print(json.dumps(data, indent=2))
except Exception as e:
    print("Error generating analytics:")
    import traceback
    traceback.print_exc()
