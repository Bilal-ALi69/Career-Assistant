/* ---------------------------------------------------------
   LOCAL PROFILE — the backend only stores 14 fields but the
   frontend has 30+. Extra fields (full_name, date_of_birth,
   gender, phone_number, etc.) are persisted here client-side
   so they survive page reloads and tab switches.
--------------------------------------------------------- */

const STORAGE_PREFIX = "career_assistant_local_profile_";

function keyFor(email) {
  return STORAGE_PREFIX + (email || "anonymous");
}

export function loadLocalProfile(email) {
  try {
    const raw = localStorage.getItem(keyFor(email));
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

export function saveLocalProfile(email, data) {
  try {
    localStorage.setItem(keyFor(email), JSON.stringify(data));
  } catch {
    /* storage unavailable — silently no-op */
  }
}

export function clearLocalProfile(email) {
  try {
    localStorage.removeItem(keyFor(email));
  } catch {
    /* no-op */
  }
}
