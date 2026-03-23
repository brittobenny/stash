from django.conf import settings
from django.core.management.base import BaseCommand, CommandError
from django.core.mail import send_mail


class Command(BaseCommand):
    help = "Send a real SMTP test email using the configured email backend."

    def add_arguments(self, parser):
        parser.add_argument("recipient", nargs="?", help="Recipient email address. Defaults to DEFAULT_FROM_EMAIL.")

    def handle(self, *args, **options):
        recipient = (options.get("recipient") or settings.DEFAULT_FROM_EMAIL or "").strip()
        if not recipient or "@" not in recipient:
            raise CommandError("Provide a valid recipient email or set DEFAULT_FROM_EMAIL.")

        if not settings.EMAIL_HOST_USER or not settings.EMAIL_HOST_PASSWORD:
            raise CommandError("EMAIL_HOST_USER and EMAIL_HOST_PASSWORD must be set before sending a real email.")

        send_mail(
            subject="Stash Gmail SMTP test",
            message=(
                "This is a real test email from Stash.\n\n"
                "If you received this, Gmail SMTP is configured correctly."
            ),
            from_email=settings.DEFAULT_FROM_EMAIL,
            recipient_list=[recipient],
            fail_silently=False,
        )
        self.stdout.write(self.style.SUCCESS(f"Test email sent to {recipient}"))
