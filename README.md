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
5. Sign in as `hello@brightfuture.mm` / `demo1234` → Dashboard shows School Uniforms 50 / 15 / 35 HIGH

Accounts use JWT. One user can be both a donor and a receiver. Receivers build a single organization profile at `/organization/setup`. Guest donate still works; signed-in donations appear on `/profile`.

## Live URLs

- Frontend: [https://spiffy-gingersnap-8d4ab2.netlify.app](https://spiffy-gingersnap-8d4ab2.netlify.app) — this repo (`frontend/`) on Netlify
- Backend: [https://impactbackend-production.up.railway.app](https://impactbackend-production.up.railway.app) — [Sanchez-313/impactBackend](https://github.com/Sanchez-313/impactBackend) on Railway

Netlify builds with `VITE_API_URL=https://impactbackend-production.up.railway.app` (see [netlify.toml](netlify.toml)). Railway allows that Netlify origin in CORS.

## Deploy (Railway + Netlify)

Push this repo to GitHub first. Deploy the API on Railway and the React app on Netlify, then point each at the other.

### 1. Backend on Render

1. [Render](https://render.com) → **New** → **Blueprint** and select this repo (uses [render.yaml](render.yaml)), **or** **New Web Service** with:
   - Root directory: `backend`
   - Build: `pip install -r requirements.txt && python manage.py migrate --noinput && python manage.py collectstatic --noinput`
   - Start: `gunicorn config.wsgi:application --bind 0.0.0.0:$PORT`
2. Set environment variables:
   - `DEBUG` = `False`
   - `DJANGO_SECRET_KEY` = a long random string (Render can generate this)
   - `ALLOWED_HOSTS` = `.onrender.com`
   - `SERVE_MEDIA` = `True`
   - `OPENAI_API_KEY` = optional
3. After the first deploy, copy the API URL (example: `https://impactmatch-api.onrender.com`).
4. In Render **Shell**, seed demo data and create an admin once:

```bash
python manage.py seed
python manage.py createsuperuser
```

Admin: `https://YOUR-API.onrender.com/admin/`

SQLite on Render’s free disk is wiped on some restarts. That is fine for a demo. Use a paid disk or Postgres if you need data to last.

### 2. Frontend on Netlify

1. [Netlify](https://app.netlify.com) → **Add new site** → **Import from Git** → this repo.
2. Build settings (also in [netlify.toml](netlify.toml)):
   - Base directory: `frontend`
   - Build command: `npm run build`
   - Publish directory: `dist`
3. Site settings → **Environment variables**:
   - `VITE_API_URL` = `https://YOUR-API.onrender.com` (no trailing slash)
4. Deploy. Copy the site URL (example: `https://impactmatch.netlify.app`).

### 3. Connect CORS

Back on Render, add:

- `CORS_ALLOWED_ORIGINS` = `https://YOUR-SITE.netlify.app`
- `CSRF_TRUSTED_ORIGINS` = `https://YOUR-API.onrender.com`

Redeploy the API. Then reload the Netlify site and try login, donate, and admin.

Local `npm run dev` still uses `VITE_API_URL` from [frontend/.env.example](frontend/.env.example) (`http://127.0.0.1:8000`).
