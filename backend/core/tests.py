from datetime import timedelta

from django.contrib.auth import get_user_model
from django.test import TestCase
from django.utils import timezone
from rest_framework.test import APIClient

from core.ai import fallback_extract
from core.matching import score_organization
from core.models import Donation, Match, Need, Notification, Organization

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


class MatchLoopTests(TestCase):
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
        self.other = User.objects.create_user(
            email="other@mail.mm",
            password="password12",
            first_name="Other",
            is_donor=True,
            is_receiver=False,
        )
        self.claimer = User.objects.create_user(
            email="claimer@mail.mm",
            password="password12",
            first_name="Claim",
            is_donor=True,
            is_receiver=True,
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
            quantity_received=0,
            urgency="high",
        )
        self.unowned = Organization.objects.create(
            name="Open Shelter",
            description="Waiting for a steward",
            location="Yangon",
            contact_email="open@shelter.mm",
        )
        Need.objects.create(
            organization=self.unowned,
            item_name="Rice",
            category="food",
            quantity_needed=20,
            urgency="medium",
        )

    def _login(self, email):
        response = self.client.post(
            "/api/auth/login/",
            {"email": email, "password": "password12"},
            format="json",
        )
        self.assertEqual(response.status_code, 200)
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {response.data['access']}")
        return response.data

    def _analyze(self, description="I have 5 blankets", location="Mandalay"):
        response = self.client.post(
            "/api/donations/analyze/",
            {"description": description, "location": location},
            format="json",
        )
        self.assertEqual(response.status_code, 200)
        return response.data

    def _match_for_org(self, payload, org=None):
        org = org or self.org
        return next(m for m in payload["matches"] if m["organization"]["id"] == org.id)

    def test_extract_does_not_create_donation(self):
        before = Donation.objects.count()
        response = self.client.post(
            "/api/donations/extract/",
            {"description": "I have 5 blankets"},
            format="json",
        )
        self.assertEqual(response.status_code, 200)
        self.assertTrue(response.data["items"])
        self.assertEqual(Donation.objects.count(), before)

    def test_analyze_accepts_supplied_items(self):
        self._login("donor@mail.mm")
        response = self.client.post(
            "/api/donations/analyze/",
            {
                "description": "custom list",
                "location": "Mandalay",
                "items": [
                    {"item_name": "Blankets", "category": "blankets", "quantity": 5},
                ],
            },
            format="json",
        )
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["items"][0]["item_name"], "Blankets")
        self.assertEqual(response.data["items"][0]["quantity"], 5)

    def test_guest_cannot_pledge(self):
        analyzed = self._analyze()
        match = self._match_for_org(analyzed)
        response = self.client.post(f"/api/matches/{match['id']}/pledge/", format="json")
        self.assertEqual(response.status_code, 401)

    def test_login_after_guest_donate_can_pledge(self):
        analyzed = self._analyze()
        match = self._match_for_org(analyzed)
        self._login("donor@mail.mm")
        pledged = self.client.post(f"/api/matches/{match['id']}/pledge/", format="json")
        self.assertEqual(pledged.status_code, 200)
        donation = Donation.objects.get(pk=analyzed["donation"]["id"])
        self.assertEqual(donation.donor_id, self.donor.id)
        self.assertEqual(donation.status, "pledged")

    def test_donor_can_pledge_and_switch_before_accept(self):
        self._login("donor@mail.mm")
        analyzed = self._analyze()
        first = analyzed["matches"][0]
        second = analyzed["matches"][1]
        pledged = self.client.post(f"/api/matches/{first['id']}/pledge/", format="json")
        self.assertEqual(pledged.status_code, 200)
        self.assertEqual(pledged.data["status"], "pledged")
        donation = Donation.objects.get(pk=analyzed["donation"]["id"])
        self.assertEqual(donation.status, "pledged")
        switched = self.client.post(f"/api/matches/{second['id']}/pledge/", format="json")
        self.assertEqual(switched.status_code, 200)
        self.assertEqual(switched.data["status"], "pledged")
        self.assertEqual(Match.objects.get(pk=first["id"]).status, "suggested")
        self.assertEqual(Match.objects.get(pk=second["id"]).status, "pledged")
        owner_notes = Notification.objects.filter(user=self.owner)
        self.assertTrue(owner_notes.exists())

    def test_inbox_is_owner_only(self):
        self._login("donor@mail.mm")
        analyzed = self._analyze()
        match = self._match_for_org(analyzed)
        self.client.post(f"/api/matches/{match['id']}/pledge/", format="json")
        denied = self.client.get("/api/organizations/me/matches/")
        self.assertEqual(denied.status_code, 403)
        self._login("owner@org.mm")
        inbox = self.client.get("/api/organizations/me/matches/")
        self.assertEqual(inbox.status_code, 200)
        self.assertEqual(len(inbox.data), 1)
        self.assertEqual(inbox.data[0]["status"], "pledged")
        self.assertEqual(inbox.data[0]["donation"]["description"], "I have 5 blankets")

    def test_accept_increments_quantity_once(self):
        self._login("donor@mail.mm")
        analyzed = self._analyze()
        match = self._match_for_org(analyzed)
        self.client.post(f"/api/matches/{match['id']}/pledge/", format="json")
        self._login("other@mail.mm")
        forbidden = self.client.post(f"/api/matches/{match['id']}/accept/", format="json")
        self.assertEqual(forbidden.status_code, 403)
        self._login("owner@org.mm")
        accepted = self.client.post(f"/api/matches/{match['id']}/accept/", format="json")
        self.assertEqual(accepted.status_code, 200)
        self.assertEqual(accepted.data["status"], "accepted")
        self.need.refresh_from_db()
        self.assertEqual(self.need.quantity_received, 5)
        again = self.client.post(f"/api/matches/{match['id']}/accept/", format="json")
        self.assertEqual(again.status_code, 200)
        self.need.refresh_from_db()
        self.assertEqual(self.need.quantity_received, 5)
        donation = Donation.objects.get(pk=analyzed["donation"]["id"])
        self.assertEqual(donation.status, "accepted")
        self.assertTrue(Notification.objects.filter(user=self.donor).exists())

    def test_claim_unowned_organization(self):
        self._login("donor@mail.mm")
        denied = self.client.post(f"/api/organizations/{self.unowned.id}/claim/", format="json")
        self.assertEqual(denied.status_code, 403)
        self._login("claimer@mail.mm")
        claimed = self.client.post(f"/api/organizations/{self.unowned.id}/claim/", format="json")
        self.assertEqual(claimed.status_code, 200)
        self.unowned.refresh_from_db()
        self.assertEqual(self.unowned.owner_id, self.claimer.id)
        owned = self.client.post(f"/api/organizations/{self.org.id}/claim/", format="json")
        self.assertEqual(owned.status_code, 400)

    def test_matches_are_locked_for_other_users(self):
        self._login("donor@mail.mm")
        analyzed = self._analyze()
        donation_id = analyzed["donation"]["id"]
        allowed = self.client.get(f"/api/donations/{donation_id}/matches/")
        self.assertEqual(allowed.status_code, 200)
        self._login("other@mail.mm")
        locked = self.client.get(f"/api/donations/{donation_id}/matches/")
        self.assertEqual(locked.status_code, 403)
        self._login("owner@org.mm")
        owner_view = self.client.get(f"/api/donations/{donation_id}/matches/")
        self.assertEqual(owner_view.status_code, 200)

    def test_signed_in_user_can_open_recent_guest_donation(self):
        analyzed = self._analyze()
        donation_id = analyzed["donation"]["id"]
        self._login("donor@mail.mm")
        response = self.client.get(f"/api/donations/{donation_id}/matches/")
        self.assertEqual(response.status_code, 200)

    def test_guest_matches_expire_after_two_hours(self):
        analyzed = self._analyze()
        donation_id = analyzed["donation"]["id"]
        fresh = self.client.get(f"/api/donations/{donation_id}/matches/")
        self.assertEqual(fresh.status_code, 200)
        Donation.objects.filter(pk=donation_id).update(
            created_at=timezone.now() - timedelta(hours=3)
        )
        expired = self.client.get(f"/api/donations/{donation_id}/matches/")
        self.assertEqual(expired.status_code, 403)

    def test_organizations_filter_by_query(self):
        response = self.client.get("/api/organizations/", {"location": "Yangon", "category": "food"})
        self.assertEqual(response.status_code, 200)
        names = [org["name"] for org in response.data]
        self.assertEqual(names, ["Open Shelter"])
