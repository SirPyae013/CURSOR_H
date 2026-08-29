from django.contrib.auth import get_user_model
from django.test import TestCase
from rest_framework.test import APIClient

from core.ai import fallback_extract
from core.matching import score_organization
from core.models import Donation, Need, Organization

User = get_user_model()


class MatchingDemoTests(TestCase):
    def setUp(self):
        self.org = Organization.objects.create(
            name="Bright Future Center",
            description="Demo",
            location="Mandalay",
            contact_email="hello@brightfuture.mm",
        )
        Need.objects.create(
            organization=self.org,
            item_name="Children's clothing",
            category="clothing",
            quantity_needed=40,
            urgency="high",
        )
        Need.objects.create(
            organization=self.org,
            item_name="Middle-school textbooks",
            category="education",
            quantity_needed=25,
            urgency="high",
        )
        Need.objects.create(
            organization=self.org,
            item_name="Notebooks",
            category="school_supplies",
            quantity_needed=30,
            urgency="medium",
        )

    def test_fallback_extracts_demo_sentence(self):
        items = fallback_extract(
            "I have 20 children's shirts, 10 middle-school textbooks, and 15 notebooks."
        )
        self.assertEqual(len(items), 3)
        self.assertEqual(items[0]["quantity"], 20)
        self.assertEqual(items[0]["category"], "clothing")
        self.assertEqual(items[1]["category"], "education")
        self.assertEqual(items[2]["category"], "school_supplies")

    def test_bright_future_scores_very_high(self):
        items = fallback_extract(
            "I have 20 children's shirts, 10 middle-school textbooks, and 15 notebooks."
        )
        scored = score_organization(items, self.org, "Mandalay")
        self.assertGreaterEqual(scored["score"], 90)
        self.assertEqual(scored["highest_urgency"], "high")
        self.assertEqual(len(scored["impact"]), 3)


class AuthAndOwnershipTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.owner = User.objects.create_user(
            email="owner@org.mm",
            password="password12",
            first_name="Org",
            last_name="Owner",
            is_donor=True,
            is_receiver=True,
        )
        self.donor = User.objects.create_user(
            email="donor@mail.mm",
            password="password12",
            first_name="Ada",
            is_donor=True,
            is_receiver=False,
        )
        self.org = Organization.objects.create(
            owner=self.owner,
            name="Owned Org",
            description="Demo",
            location="Mandalay",
            contact_email="owner@org.mm",
        )
        self.need = Need.objects.create(
            organization=self.org,
            item_name="Blankets",
            category="blankets",
            quantity_needed=10,
            urgency="high",
        )

    def _login(self, email):
        response = self.client.post(
            "/api/auth/login/",
            {"email": email, "password": "password12"},
            format="json",
        )
        self.assertEqual(response.status_code, 200)
        self.assertIn("donor", response.data["user"]["roles"])
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {response.data['access']}")
        return response.data

    def test_register_returns_jwt_with_donor_role(self):
        response = self.client.post(
            "/api/auth/register/",
            {
                "email": "new@mail.mm",
                "password": "password12",
                "name": "New Donor",
                "location": "Yangon",
            },
            format="json",
        )
        self.assertEqual(response.status_code, 201)
        self.assertEqual(response.data["user"]["roles"], ["donor"])
        self.assertTrue(response.data["access"])

    def test_guest_can_donate(self):
        response = self.client.post(
            "/api/donations/analyze/",
            {"description": "I have 5 blankets", "location": "Mandalay"},
            format="json",
        )
        self.assertEqual(response.status_code, 200)
        donation = Donation.objects.get(pk=response.data["donation"]["id"])
        self.assertIsNone(donation.donor_id)

    def test_logged_in_donate_attaches_donor(self):
        self._login("donor@mail.mm")
        response = self.client.post(
            "/api/donations/analyze/",
            {"description": "I have 5 blankets", "location": "Mandalay"},
            format="json",
        )
        self.assertEqual(response.status_code, 200)
        donation = Donation.objects.get(pk=response.data["donation"]["id"])
        self.assertEqual(donation.donor_id, self.donor.id)

    def test_donor_cannot_edit_needs(self):
        self._login("donor@mail.mm")
        response = self.client.patch(
            f"/api/needs/{self.need.id}/",
            {"quantity_needed": 99},
            format="json",
        )
        self.assertEqual(response.status_code, 403)

    def test_owner_can_edit_needs(self):
        self._login("owner@org.mm")
        response = self.client.patch(
            f"/api/needs/{self.need.id}/",
            {"quantity_needed": 99},
            format="json",
        )
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["quantity_needed"], 99)

    def test_become_receiver_and_create_org(self):
        self._login("donor@mail.mm")
        enabled = self.client.post("/api/auth/become-receiver/", format="json")
        self.assertEqual(enabled.status_code, 200)
        self.assertIn("receiver", enabled.data["user"]["roles"])
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {enabled.data['access']}")
        created = self.client.post(
            "/api/organizations/me/",
            {
                "name": "New Shelter",
                "description": "Helps families",
                "location": "Yangon",
                "contact_email": "donor@mail.mm",
            },
            format="json",
        )
        self.assertEqual(created.status_code, 201)
        mine = self.client.get("/api/organizations/me/")
        self.assertEqual(mine.status_code, 200)
        self.assertEqual(mine.data["name"], "New Shelter")
