const STORAGE_KEY = "career_assistant_workday_cache";
const MAX_ENTRIES = 200;

function makeKey(title, description) {
  return `${title}||${description}`.toLowerCase().trim();
}

export function loadWorkdayCache() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY)) || {};
  } catch {
    return {};
  }
}

export function getWorkdaySummary(title, description) {
  const cache = loadWorkdayCache();
  return cache[makeKey(title, description)] || null;
}

export function storeWorkdaySummary(title, description, summary) {
  try {
    const cache = loadWorkdayCache();
    const key = makeKey(title, description);
    cache[key] = summary;
    const entries = Object.entries(cache);
    if (entries.length > MAX_ENTRIES) {
      const trimmed = Object.fromEntries(entries.slice(-MAX_ENTRIES));
      localStorage.setItem(STORAGE_KEY, JSON.stringify(trimmed));
    } else {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(cache));
    }
  } catch {
    // localStorage unavailable or quota exceeded — silently ignore
  }
}
