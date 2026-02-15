import os
import django
import json
import sys

# Add project root to path
sys.path.append(os.getcwd())

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'stash_backend.settings')
django.setup()

from django.contrib.auth.models import User
from inventory.models import PantryItem
from inventory.serializers import PantryItemSerializer

try:
    # Try getting the user by email (since that's the username in this app usually)
    # Check if user exists first
    user = User.objects.filter(username='user@example.com').first()
    if not user:
         user = User.objects.filter(email='user@example.com').first()
    
    if not user:
        print("User user@example.com not found!")
        # List all users to see who exists
        print("Available users:", list(User.objects.values_list('username', 'email')))
        sys.exit(1)

    print(f"Checking pantry for user: {user.email} (ID: {user.id})")
    
    items = PantryItem.objects.filter(user=user)
    count = items.count()
    print(f"Found {count} pantry items in DB.")
    
    if count > 0:
        serializer = PantryItemSerializer(items, many=True)
        print("\n--- API RESPONSE PREVIEW ---")
        print(json.dumps(serializer.data, indent=2))
        print("----------------------------")
    else:
        print("Pantry is empty in DB.")

except Exception as e:
    print(f"Error: {e}")
    import traceback
    traceback.print_exc()
