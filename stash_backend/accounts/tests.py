from django.test import TestCase

# Create your tests here.
from unittest.mock import patch

from django.contrib.auth.models import User
from django.test import TestCase
from rest_framework.test import APIClient

from accounts.models import UserProfile


class RegisterEmailTests(TestCase):
    def setUp(self):
        self.client = APIClient()

    @patch("accounts.views.send_mail")
    def test_register_sends_welcome_email(self, mocked_send_mail):
        payload = {
            "name": "Maya",
            "email": "maya@example.com",
            "password": "testpass123",
            "mobile_number": "9999999999",
        }

        response = self.client.post("/api/accounts/register/", payload, format="json")

        self.assertEqual(response.status_code, 201)
        self.assertTrue(User.objects.filter(email="maya@example.com").exists())
        self.assertTrue(UserProfile.objects.filter(user__email="maya@example.com").exists())
        mocked_send_mail.assert_called_once()

        _, kwargs = mocked_send_mail.call_args
        self.assertEqual(kwargs["recipient_list"], ["maya@example.com"])
        self.assertEqual(kwargs["subject"], "Welcome to Stash")
        self.assertIn("Welcome to Stash", kwargs["message"])
