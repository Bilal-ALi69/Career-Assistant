# Career Assistant — Frontend

## 1. Run the frontend

```bash
cd career-assistant
npm install
npm run dev
```

Open the URL it prints (default `http://localhost:5173`).

## 2. Run your backend alongside it

In your `Ai-Vibe-Project` folder:

```bash
uvicorn api:app --reload
```

This should serve on `http://127.0.0.1:8000` (matches the `API_BASE` constant
at the top of `src/App.jsx`). If your backend runs on a different port, update
`API_BASE` in that file.

## 3. IMPORTANT — enable CORS on your FastAPI backend

Right now your browser (on :5173) will be blocked from calling your API (on
:8000) unless you add CORS middleware. In `api.py`, near the top, add:

```python
from fastapi.middleware.cors import CORSMiddleware

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
```

Without this, every fetch call from the frontend will fail with a CORS error
in the browser console, even if the backend is running fine.

## 4. What's wired up vs. still a placeholder

**Wired to your real backend:**
- Sign In / Create Account modal → calls `POST /auth/login` and
  `POST /auth/register`. Expects a JSON response containing `access_token`
  (or `token`) — adjust in `AuthModal`'s `submit()` function if your backend
  returns a different field name.
- "Analyze My Profile" → calls `POST /recommendations` when logged out, or
  `POST /recommendations/personalized` (with `Authorization: Bearer <token>`)
  when logged in.
- The JWT is stored in `localStorage` under `career_assistant_token` so you
  stay signed in across refreshes.

**Still placeholder / needs your input:**
- `JobsPage`'s field-mapping (`j.title`, `j.match`, `j.salary`, etc.) is a
  best guess at your response shape — check what `/recommendations` actually
  returns and adjust the mapping in `JobsPage` in `src/App.jsx`.
- The extended profile fields (education, work_experience, etc.) aren't
  wired to `/auth/profile` yet — the Personal Information form still shows
  static demo data.
- Skills & Traits tabs other than "Overview" and "Personal" are unbuilt
  placeholders.
- If a request fails (e.g. backend not running), the app falls back to demo
  data so you can still see the UI — check the browser console for the
  actual error.
