from django.core.management.base import BaseCommand

from inventory.expiry_alerts import sync_expiry_notifications_for_all_users
from inventory.low_stock import sync_low_stock_notifications_for_all_users


class Command(BaseCommand):
    help = "Create or refresh pantry expiry and low-stock notifications for all active users."

    def handle(self, *args, **options):
        expiry_summary = sync_expiry_notifications_for_all_users()
        low_stock_summary = sync_low_stock_notifications_for_all_users()
        self.stdout.write(
            self.style.SUCCESS(
                (
                    "Processed {processed_users} users and created {expiry_notifications} "
                    "expiry notifications and {low_stock_notifications} low-stock notifications."
                ).format(
                    processed_users=expiry_summary["processed_users"],
                    expiry_notifications=expiry_summary["created_notifications"],
                    low_stock_notifications=low_stock_summary["created_notifications"],
                )
            )
        )
