from django.test import TestCase

from core.ai import fallback_extract
from core.matching import score_organization
from core.models import Need, Organization


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
