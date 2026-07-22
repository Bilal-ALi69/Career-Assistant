/* ---------------------------------------------------------
   JOB HISTORY — stores past recommendation results with
   timestamps so the My Jobs page can list them.
--------------------------------------------------------- */

const STORAGE_KEY = "career_assistant_job_history";

export function loadJobHistory() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function appendJobHistory(results) {
  if (!results) return;
  try {
    const history = loadJobHistory();
    history.unshift({ id: Date.now(), date: new Date().toISOString(), results });
    localStorage.setItem(STORAGE_KEY, JSON.stringify(history.slice(0, 50)));
  } catch {
    /* no-op */
  }
}

export function clearJobHistory() {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    /* no-op */
  }
}
