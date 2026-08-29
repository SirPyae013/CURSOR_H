# ImpactMatch

AI-powered donation matching. Describe what you have; we match it to organizations by item fit, urgency, quantity, and location.

## Stack

- Frontend: React, Vite, Tailwind CSS
- Backend: Django, Django REST Framework, SQLite
- AI: OpenAI `gpt-4o-mini` with a keyword fallback

## Run locally

Use two terminals.

**Backend**

```bash
cd backend
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
copy .env.example .env
python manage.py migrate
python manage.py seed
python manage.py runserver
```

Add `OPENAI_API_KEY` to `backend/.env` if you want live extraction. Without it, the keyword fallback still runs the demo.

**Frontend**

```bash
cd frontend
npm install
npm run dev
```

Open [http://localhost:5173](http://localhost:5173).

## Demo path

1. Home → Donate now
2. Description is prefilled: *I have 20 children's shirts, 10 middle-school textbooks, and 15 notebooks.* City: Mandalay
3. Find my best match → Bright Future Center should rank first
4. Open organization → Contact
5. Dashboard → Bright Future Center shows School Uniforms 50 / 15 / 35 HIGH
