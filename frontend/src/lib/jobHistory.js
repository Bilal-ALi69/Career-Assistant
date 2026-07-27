/* ---------------------------------------------------------
   JOB HISTORY — stores past recommendation results with
   timestamps so the My Jobs page can list them.
   Scoped per user via their email.
--------------------------------------------------------- */

function keyFor(email) {
  return `career_assistant_job_history__${email || "_anon"}`;
}

export function loadJobHistory(email) {
  try {
    const raw = localStorage.getItem(keyFor(email));
    const parsed = raw ? JSON.parse(raw) : [];
    if (!Array.isArray(parsed)) return [];
    const seen = new Set();
    return parsed.filter((s) => {
      const key = s.date || s.id;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  } catch {
    return [];
  }
}

export function appendJobHistory(results, email) {
  if (!results) return;
  try {
    const history = loadJobHistory(email);
    history.unshift({ id: Date.now(), date: new Date().toISOString(), results });
    localStorage.setItem(keyFor(email), JSON.stringify(history.slice(0, 50)));
  } catch {
    /* no-op */
  }
}

export function clearJobHistory(email) {
  try {
    localStorage.removeItem(keyFor(email));
  } catch {
    /* no-op */
  }
}
