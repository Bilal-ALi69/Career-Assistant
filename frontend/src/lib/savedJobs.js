/* ---------------------------------------------------------
   SAVED JOBS — there's no /jobs/save endpoint on the backend yet,
   so bookmarked jobs are kept client-side (per-browser) for now.
   If accounts.py grows a real saved-jobs table, swap these two
   functions for API calls and everything else (App.jsx, JobsPage,
   MyJobsPage) keeps working unchanged.
--------------------------------------------------------- */

const STORAGE_KEY = "career_assistant_saved_jobs";

export function loadSavedJobs() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function persistSavedJobs(jobs) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(jobs));
  } catch {
    /* storage unavailable / quota exceeded — saving silently no-ops */
  }
}

// Jobs coming back from the backend don't have a stable id, so derive one
// from title+salary — good enough to dedupe within a single account's list.
export function jobId(job) {
  return `${job.title}__${job.salary}`;
}
