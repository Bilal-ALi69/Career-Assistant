/* ---------------------------------------------------------
   API CONFIG — point this at your running FastAPI backend
--------------------------------------------------------- */
const DEFAULT_API_BASE = "http://127.0.0.1:8000";
export const API_BASE = import.meta.env.VITE_API_BASE || DEFAULT_API_BASE;

function authHeaders(token) {
  const headers = { "Content-Type": "application/json" };
  if (token) headers["Authorization"] = `Bearer ${token}`;
  return headers;
}

/* ---------------------------------------------------------
   ERROR HANDLING — structured ApiError with status codes
--------------------------------------------------------- */

export class ApiError extends Error {
  constructor(message, status, detail) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.detail = detail;
  }

  get isNetworkError() { return this.status === 0; }
  get isTimeout() { return this.name === "AbortError" || this.message.toLowerCase().includes("timeout"); }
  get isUnauthorized() { return this.status === 401; }
  get isForbidden() { return this.status === 403; }
  get isNotFound() { return this.status === 404; }
  get isValidationError() { return this.status === 422; }
  get isRateLimited() { return this.status === 429; }
  get isServerError() { return this.status >= 500; }
  get isServiceUnavailable() { return this.status === 503; }

  get userMessage() {
    if (this.isNetworkError) return "Unable to connect. Please check your internet connection and try again.";
    if (this.isTimeout) return "The request took too long. Please try again.";
    if (this.isUnauthorized) return "Your session has expired. Please sign in again.";
    if (this.isForbidden) return "You don't have permission to perform this action.";
    if (this.isNotFound) return "The requested resource was not found.";
    if (this.isRateLimited) return "Too many requests. Please wait a moment and try again.";
    if (this.isServiceUnavailable) return "The service is temporarily unavailable. Please try again in a moment.";
    if (this.isServerError) return "Something went wrong on our end. Please try again later.";
    return this.message;
  }
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
    throw new ApiError(msg, res.status, data.detail);
  }
  return data;
}

/* ---------------------------------------------------------
   TIMEOUT UTILITY — wraps a fetch promise with a timeout
--------------------------------------------------------- */

function withTimeout(fetchFn, ms = 30000) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), ms);

  return {
    run: (signal) => {
      if (signal) {
        signal.addEventListener("abort", () => controller.abort(), { once: true });
      }
      return fetchFn(controller.signal).finally(() => clearTimeout(timeoutId));
    },
    cancel: () => { clearTimeout(timeoutId); controller.abort(); },
  };
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
  return parseOrThrow(res);
}

export async function fetchWorkdaySummary(jobTitle, jobDescription) {
  const timeout = withTimeout(
    (signal) => fetch(`${API_BASE}/recommendations/workday`, {
      method: "POST",
      headers: authHeaders(),
      body: JSON.stringify({ job_title: jobTitle, job_description: jobDescription }),
      signal,
    }),
    60000,
  );
  const res = await timeout.run();
  return parseOrThrow(res);
}

export async function fetchRegeneratedRecommendations({ signedIn, token, formValues, signal }) {
  const body = {
    strengths: formValues?.strengths || "",
    weaknesses: formValues?.weaknesses || "",
    interests: formValues?.interests || "",
  };
  const res = await fetch(`${API_BASE}/recommendations/regenerate`, {
    method: "POST",
    headers: authHeaders(signedIn ? token : null),
    body: JSON.stringify(body),
    signal,
  });
  return parseOrThrow(res);
}
