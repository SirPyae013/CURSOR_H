from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):
    initial = True

    dependencies = []

    operations = [
        migrations.CreateModel(
            name="Organization",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("name", models.CharField(max_length=200)),
                ("description", models.TextField()),
                ("location", models.CharField(max_length=100)),
                ("contact_email", models.EmailField(max_length=254)),
                ("contact_phone", models.CharField(blank=True, max_length=50)),
                ("image_url", models.URLField(blank=True)),
            ],
        ),
        migrations.CreateModel(
            name="Donation",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("description", models.TextField()),
                ("location", models.CharField(max_length=100)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
            ],
        ),
        migrations.CreateModel(
            name="Need",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("item_name", models.CharField(max_length=200)),
                ("category", models.CharField(choices=[("clothing", "Clothing"), ("education", "Education"), ("school_supplies", "School supplies"), ("food", "Food"), ("hygiene", "Hygiene"), ("toys", "Toys"), ("household", "Household"), ("shoes", "Shoes"), ("blankets", "Blankets"), ("other", "Other")], max_length=50)),
                ("quantity_needed", models.PositiveIntegerField()),
                ("quantity_received", models.PositiveIntegerField(default=0)),
                ("urgency", models.CharField(choices=[("high", "High"), ("medium", "Medium"), ("low", "Low")], default="medium", max_length=10)),
                ("description", models.TextField(blank=True)),
                ("organization", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="needs", to="core.organization")),
            ],
        ),
        migrations.CreateModel(
            name="DonationItem",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("item_name", models.CharField(max_length=200)),
                ("category", models.CharField(choices=[("clothing", "Clothing"), ("education", "Education"), ("school_supplies", "School supplies"), ("food", "Food"), ("hygiene", "Hygiene"), ("toys", "Toys"), ("household", "Household"), ("shoes", "Shoes"), ("blankets", "Blankets"), ("other", "Other")], max_length=50)),
                ("quantity", models.PositiveIntegerField(default=1)),
                ("condition", models.CharField(blank=True, max_length=100, null=True)),
                ("intended_users", models.CharField(blank=True, max_length=200)),
                ("donation", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="items", to="core.donation")),
            ],
        ),
        migrations.CreateModel(
            name="Match",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("score", models.IntegerField()),
                ("reason", models.TextField()),
                ("breakdown", models.JSONField(default=dict)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("donation", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="matches", to="core.donation")),
                ("organization", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="matches", to="core.organization")),
            ],
            options={"ordering": ["-score"]},
        ),
    ]
