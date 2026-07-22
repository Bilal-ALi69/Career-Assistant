/* ---------------------------------------------------------
   API CONFIG — point this at your running FastAPI backend
--------------------------------------------------------- */
export const API_BASE = "http://127.0.0.1:8000";

function authHeaders(token) {
  const headers = { "Content-Type": "application/json" };
  if (token) headers["Authorization"] = `Bearer ${token}`;
  return headers;
}

function formatErrorDetail(detail) {
  if (!detail) return null;
  if (typeof detail === "string") return detail;
  if (Array.isArray(detail)) {
    return detail.map((d) => d.msg || d.message || JSON.stringify(d)).join(", ");
  }
  return String(detail);
}

async function parseOrThrow(res) {
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg = formatErrorDetail(data.detail) || data.message || `Request failed (${res.status})`;
    throw new Error(msg);
  }
  return data;
}

/* ---------------------------------------------------------
   AUTH
--------------------------------------------------------- */

export async function login(email, password) {
  const res = await fetch(`${API_BASE}/auth/login`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify({ email, password }),
  });
  return parseOrThrow(res);
}

export async function register(email, password) {
  const res = await fetch(`${API_BASE}/auth/register`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify({ email, password }),
  });
  return parseOrThrow(res);
}

// Real check against accounts.py — no client-side scoring, the backend is
// the source of truth. Expects something like
// { score: 0-4, label: "Weak"|"Fair"|"Good"|"Strong", feedback: "..." }
export async function checkPasswordStrength(password, signal) {
  const res = await fetch(`${API_BASE}/auth/password-strength`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify({ password }),
    signal,
  });
  return parseOrThrow(res);
}

// GET /auth/me — basic account record (email, id, created/joined date, etc).
export async function getAccount(token) {
  const res = await fetch(`${API_BASE}/auth/me`, {
    method: "GET",
    headers: authHeaders(token),
  });
  return parseOrThrow(res);
}

export async function deleteAccount(token) {
  const res = await fetch(`${API_BASE}/auth/me`, {
    method: "DELETE",
    headers: authHeaders(token),
  });
  return parseOrThrow(res);
}

// NOTE: accounts.py doesn't expose change-password / 2FA routes yet in the
// documented API surface — these two calls assume the endpoints below get
// added there. Until then they'll fail with a 404, which the modals surface
// as a normal error message rather than crashing.
export async function changePassword(token, currentPassword, newPassword) {
  const res = await fetch(`${API_BASE}/auth/change-password`, {
    method: "POST",
    headers: authHeaders(token),
    body: JSON.stringify({ current_password: currentPassword, new_password: newPassword }),
  });
  return parseOrThrow(res);
}

export async function setTwoFactor(token, enabled) {
  const res = await fetch(`${API_BASE}/auth/2fa`, {
    method: "POST",
    headers: authHeaders(token),
    body: JSON.stringify({ enabled }),
  });
  return parseOrThrow(res);
}

/* ---------------------------------------------------------
   PROFILE SURVEY — accounts.py's profile survey store.
   Superset of fields the signup survey / Skills & Traits tabs collect:
   {
     full_name, date_of_birth, gender, phone_number, location,
     current_address, country, linkedin_url, portfolio_url, languages,
     education, qualifications, work_experience, certifications,
     preferred_industries, preferred_work_environments, work_preference,
     weekly_availability, willing_to_relocate, salary_expectations,
     notice_period, strengths, weaknesses, hobbies, interests, values,
     career_goals, background_constraints, disabilities,
     medical_conditions, work_authorization, extracurriculars,
     volunteer_experience
   }
   Any of these not yet in accounts.py's normalization just need adding
   there — the frontend already sends/reads them under these exact keys.
--------------------------------------------------------- */

export async function getProfile(token) {
  const res = await fetch(`${API_BASE}/auth/profile`, {
    method: "GET",
    headers: authHeaders(token),
  });
  return parseOrThrow(res);
}

export async function updateProfile(token, patch) {
  const res = await fetch(`${API_BASE}/auth/profile`, {
    method: "POST",
    headers: authHeaders(token),
    body: JSON.stringify(patch),
  });
  return parseOrThrow(res);
}

/* ---------------------------------------------------------
   RECOMMENDATIONS — now abortable so "Cancel" can actually
   stop an in-flight Ollama generation.
--------------------------------------------------------- */

export async function fetchRecommendations({ signedIn, token, formValues, signal }) {
  const path = signedIn ? "/recommendations/personalized" : "/recommendations";
  const res = await fetch(`${API_BASE}${path}`, {
    method: "POST",
    headers: authHeaders(signedIn ? token : null),
    body: JSON.stringify(formValues),
    signal,
  });
  return parseOrThrow(res);
}

export async function cancelRecommendation(token) {
  if (!token) return;
  const res = await fetch(`${API_BASE}/recommendations/cancel`, {
    method: "POST",
    headers: authHeaders(token),
  });
  return parseOrThrow(res).catch(() => {});
}
