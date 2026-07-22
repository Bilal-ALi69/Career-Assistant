# AGENTS.md — career-assistant-updated

## What this is

React 19 + Vite 8 + Tailwind CSS 4 SPA. Single-page app with no routing library — page state is a `page` string in `App.jsx`. Backend is a separate FastAPI server (not in this repo).

## Commands

- `npm run dev` — Vite dev server on :5173
- `npm run build` — production build to `dist/`
- `npm run lint` — runs `oxlint` (no ESLint)
- `npm run preview` — serves `dist/` locally

No test runner. No typecheck. No formatter config.

## Architecture

- **`src/App.jsx`** — the entire app: all pages (Home, Analyzing, Jobs, Skills, Account), Navbar, AuthModal, ConfirmPopup, and state management. ~1400 lines. This is the file you will edit 90% of the time.
- **`src/components/`** — extracted UI pieces: AccountSettingsModal, SignupSurvey, PasswordInput, PasswordStrengthMeter, ProfileField.
- **`src/lib/api.js`** — all backend fetch calls. `API_BASE` is hardcoded to `http://127.0.0.1:8000`.
- **`src/lib/`** — persistence helpers: `savedJobs.js`, `jobHistory.js`, `localProfile.js`, `profileFields.js`. These use `localStorage` and `sessionStorage`.
- **`src/index.css`** — Tailwind import + custom `@keyframes` animations (modalIn, dropIn, overlayIn, etc.).

## Key quirks

- **No routing library.** `page` state string controls which component renders. Page values: `"home"`, `"analyzing"`, `"jobs"`, `"jobs-nav"`, `"skills"`, `"account"`.
- **Backend required for real data.** Without FastAPI on :8000, the app falls back to demo/mock jobs. The error message shows in the UI.
- **CORS must be enabled** on the FastAPI backend for `http://localhost:5173`.
- **`API_BASE`** is in `src/lib/api.js:4`. Change it if your backend runs elsewhere.
- **Auth is JWT-based.** Token stored in `localStorage` under `career_assistant_token`.
- **Unsigned-in job persistence.** `results` and `formValues` are saved to `sessionStorage` so unsigned-in users don't lose generated jobs on refresh or navigation.
- **Tailwind v4** uses `@tailwindcss/vite` plugin, not the old `tailwind.config.js`. No config file exists — Tailwind v4 infers from source.
- **OxLint**, not ESLint. Config in `.oxlintrc.json`. Rules: `react/rules-of-hooks` (error), `react/only-export-components` (warn).
- **No TypeScript.** All files are `.jsx` / `.js`.
- **All styling is Tailwind utility classes inline.** No CSS modules, no styled-components, no separate CSS files beyond `index.css`.

## Conventions

- Theme tokens come from `useTokens(dark)` hook — use `tokens.text`, `tokens.card`, `tokens.hover`, etc. instead of hardcoding colors.
- The `cx()` helper joins class names: `cx("class1", condition && "class2")`.
- Modals use a consistent pattern: `fixed inset-0 z-[100]` overlay with `backdrop-blur-sm` + inner card with `rounded-2xl shadow-2xl`.
- Animations are defined in `src/index.css` as `@keyframes` with matching `.animate-*` utility classes.
- Buttons use the `Button` component with `variant` prop (`primary`, `outline`, `ghost`, `danger`).
