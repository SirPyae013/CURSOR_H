from django.contrib.auth import get_user_model
from django.core.management.base import BaseCommand

from core.models import Need, Organization

User = get_user_model()

DEMO_EMAIL = "hello@brightfuture.mm"
DEMO_PASSWORD = "demo1234"

ORGS = [
    {
        "name": "Bright Future Center",
        "description": "A Mandalay learning hub that supports children who cannot afford school clothing and educational materials. Current gaps are uniforms, middle-school textbooks, and classroom notebooks.",
        "location": "Mandalay",
        "contact_email": "hello@brightfuture.mm",
        "contact_phone": "+95 9 200 111 222",
        "image_url": "https://images.unsplash.com/photo-1503676260728-1c00da094a0b?w=1200&q=80",
        "needs": [
            {
                "item_name": "School Uniforms",
                "category": "clothing",
                "quantity_needed": 50,
                "quantity_received": 15,
                "urgency": "high",
                "description": "Uniforms for primary and middle-school students.",
            },
            {
                "item_name": "Children's clothing",
                "category": "clothing",
                "quantity_needed": 40,
                "quantity_received": 0,
                "urgency": "high",
                "description": "Shirts, trousers, and dresses for children ages 6–14.",
            },
            {
                "item_name": "Middle-school textbooks",
                "category": "education",
                "quantity_needed": 25,
                "quantity_received": 0,
                "urgency": "high",
                "description": "Grade 7–9 textbooks across core subjects.",
            },
            {
                "item_name": "Notebooks",
                "category": "school_supplies",
                "quantity_needed": 30,
                "quantity_received": 0,
                "urgency": "medium",
                "description": "Exercise books for classroom use.",
            },
        ],
    },
    {
        "name": "Yangon Community Shelter",
        "description": "Emergency shelter serving displaced families in Yangon with overnight beds, clothing, and meals.",
        "location": "Yangon",
        "contact_email": "intake@yangonshelter.org",
        "contact_phone": "+95 9 255 333 444",
        "image_url": "https://images.unsplash.com/photo-1469571486292-0ba58a3f068b?w=1200&q=80",
        "needs": [
            {
                "item_name": "Blankets",
                "category": "blankets",
                "quantity_needed": 80,
                "quantity_received": 12,
                "urgency": "high",
                "description": "Warm blankets for overnight guests.",
            },
            {
                "item_name": "Adult clothing",
                "category": "clothing",
                "quantity_needed": 40,
                "quantity_received": 8,
                "urgency": "medium",
                "description": "Shirts and trousers for adults.",
            },
            {
                "item_name": "Packaged food",
                "category": "food",
                "quantity_needed": 100,
                "quantity_received": 40,
                "urgency": "low",
                "description": "Non-perishable meals and rice.",
            },
        ],
    },
    {
        "name": "Hope Primary School",
        "description": "A community primary school in Mandalay serving students from low-income households. Teachers request classroom supplies and children's shoes.",
        "location": "Mandalay",
        "contact_email": "office@hopeprimary.mm",
        "contact_phone": "+95 9 266 555 666",
        "image_url": "https://images.unsplash.com/photo-1588072432836-e10032774350?w=1200&q=80",
        "needs": [
            {
                "item_name": "School supplies",
                "category": "school_supplies",
                "quantity_needed": 60,
                "quantity_received": 10,
                "urgency": "medium",
                "description": "Pencils, erasers, and general stationery.",
            },
            {
                "item_name": "Toys",
                "category": "toys",
                "quantity_needed": 20,
                "quantity_received": 2,
                "urgency": "low",
                "description": "Simple play materials for younger students.",
            },
            {
                "item_name": "Children's shoes",
                "category": "shoes",
                "quantity_needed": 35,
                "quantity_received": 5,
                "urgency": "medium",
                "description": "School-appropriate shoes, mixed sizes.",
            },
        ],
    },
    {
        "name": "River Aid",
        "description": "A riverside community group in Mandalay distributing hygiene kits and household basics after seasonal flooding.",
        "location": "Mandalay",
        "contact_email": "team@riveraid.mm",
        "contact_phone": "+95 9 277 777 888",
        "image_url": "https://images.unsplash.com/photo-1488521787991-ed7bbaae773c?w=1200&q=80",
        "needs": [
            {
                "item_name": "Hygiene kits",
                "category": "hygiene",
                "quantity_needed": 70,
                "quantity_received": 20,
                "urgency": "high",
                "description": "Soap, toothpaste, and sanitary items.",
            },
            {
                "item_name": "Household items",
                "category": "household",
                "quantity_needed": 25,
                "quantity_received": 4,
                "urgency": "medium",
                "description": "Pots, basins, and basic utensils.",
            },
            {
                "item_name": "Children's clothing",
                "category": "clothing",
                "quantity_needed": 15,
                "quantity_received": 6,
                "urgency": "low",
                "description": "Light clothing remaining after the last drive.",
            },
        ],
    },
]


class Command(BaseCommand):
    help = "Load demo organizations and needs (idempotent)."

    def handle(self, *args, **options):
        for payload in ORGS:
            needs = payload.pop("needs")
            org, created = Organization.objects.update_or_create(
                name=payload["name"], defaults=payload
            )
            if not created:
                org.needs.all().delete()
            for need in needs:
                Need.objects.create(organization=org, **need)
            payload["needs"] = needs
            self.stdout.write(self.style.SUCCESS(f"Seeded {org.name}"))

        demo = User.objects.filter(email=DEMO_EMAIL).first()
        if demo is None:
            demo = User.objects.create_user(
                email=DEMO_EMAIL,
                password=DEMO_PASSWORD,
                first_name="Bright",
                last_name="Future",
                location="Mandalay",
                is_donor=True,
                is_receiver=True,
            )
        else:
            demo.is_donor = True
            demo.is_receiver = True
            demo.set_password(DEMO_PASSWORD)
            demo.save()

        bright = Organization.objects.get(name="Bright Future Center")
        if bright.owner_id != demo.id:
            bright.owner = demo
            bright.save(update_fields=["owner"])

        self.stdout.write(
            self.style.SUCCESS(f"Demo receiver: {DEMO_EMAIL} / {DEMO_PASSWORD}")
        )
        self.stdout.write(self.style.SUCCESS("Done."))
