"""Core business logic — shared between the CLI script and the API.
No input()/print() here; this module just does work and returns data."""

import json
import sqlite3
from pathlib import Path
from difflib import SequenceMatcher

import numpy as np
import ollama
from spellchecker import SpellChecker

DB_FILE = Path(__file__).with_name("career_cache.db")
EMBED_MODEL = "mxbai-embed-large"
GEN_MODEL = "gpt-oss:120b-cloud"
TRAIT_SIMILARITY_THRESHOLD = 0.85

class GenerationCancelled(Exception):
    """Raised when a user cancels mid-generation."""


MIN_JOBS = 4
SPELLCHECK_CONFIDENCE_THRESHOLD = 0.85
SPELLCHECK_WHITELIST = {
    "python", "javascript", "html", "css", "sql", "ux", "ui", "api",
    "coding", "devops", "ollama", "ai", "ml", "js",
}

_spell = SpellChecker()


# ---------------------------------------------------------------- Spellcheck

def check_word(word: str) -> tuple[str, float]:
    stripped = word.strip(",.").lower()
    if not stripped.isalpha() or stripped in SPELLCHECK_WHITELIST or stripped in _spell:
        return word, 1.0
    correction = _spell.correction(stripped)
    if not correction or correction == stripped:
        return word, 1.0
    return correction, SequenceMatcher(None, stripped, correction).ratio()


def spellcheck_text(text: str) -> dict:
    """API-friendly version of the old interactive_input() — no input()/print(),
    just returns everything the frontend needs to decide what to show the user."""
    words = text.split()
    corrected_words = []
    needs_confirmation = False

    for word in words:
        corrected, confidence = check_word(word)
        corrected_words.append(corrected)
        if corrected != word and confidence < SPELLCHECK_CONFIDENCE_THRESHOLD:
            needs_confirmation = True

    return {
        "original": text,
        "corrected": " ".join(corrected_words),
        "needs_confirmation": needs_confirmation,
    }


# ------------------------------------------------------------------- Storage

def get_connection():
    # Connections are short-lived per request (see api.py).  Do not share one
    # connection between FastAPI worker threads.
    conn = sqlite3.connect(DB_FILE, timeout=10)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA journal_mode=WAL")
    conn.execute("PRAGMA foreign_keys=ON")
    conn.execute("PRAGMA busy_timeout=10000")
    return conn


def init_db(conn):
    with conn:
        conn.execute('''
            CREATE TABLE IF NOT EXISTS strengths (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT UNIQUE NOT NULL,
                embedding BLOB NOT NULL
            )
        ''')
        conn.execute('''
            CREATE TABLE IF NOT EXISTS weaknesses (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT UNIQUE NOT NULL,
                embedding BLOB NOT NULL
            )
        ''')
        conn.execute('''
            CREATE TABLE IF NOT EXISTS interests (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT UNIQUE NOT NULL,
                embedding BLOB NOT NULL
            )
        ''')
        conn.execute('''
            CREATE TABLE IF NOT EXISTS jobs (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                title TEXT UNIQUE NOT NULL,
                description TEXT NOT NULL
            )
        ''')
        conn.execute('''
            CREATE TABLE IF NOT EXISTS job_strengths (
                job_id INTEGER NOT NULL,
                strength_id INTEGER NOT NULL,
                PRIMARY KEY (job_id, strength_id),
                FOREIGN KEY (job_id) REFERENCES jobs(id) ON DELETE CASCADE,
                FOREIGN KEY (strength_id) REFERENCES strengths(id) ON DELETE CASCADE
            )
        ''')
        conn.execute('''
            CREATE TABLE IF NOT EXISTS job_weaknesses (
                job_id INTEGER NOT NULL,
                weakness_id INTEGER NOT NULL,
                PRIMARY KEY (job_id, weakness_id),
                FOREIGN KEY (job_id) REFERENCES jobs(id) ON DELETE CASCADE,
                FOREIGN KEY (weakness_id) REFERENCES weaknesses(id) ON DELETE CASCADE
            )
        ''')
        conn.execute('''
            CREATE TABLE IF NOT EXISTS job_interests (
                job_id INTEGER NOT NULL,
                interest_id INTEGER NOT NULL,
                PRIMARY KEY (job_id, interest_id),
                FOREIGN KEY (job_id) REFERENCES jobs(id) ON DELETE CASCADE,
                FOREIGN KEY (interest_id) REFERENCES interests(id) ON DELETE CASCADE
            )
        ''')


# ------------------------------------------------------------- Embeddings

def get_embedding(text: str) -> np.ndarray:
    """Fetch a vector embedding for the given text via Ollama."""
    response = ollama.embeddings(model=EMBED_MODEL, prompt=text)
    return np.array(response["embedding"], dtype=np.float32)


def embedding_to_blob(vector: np.ndarray) -> bytes:
    return vector.astype(np.float32).tobytes()


def blob_to_embedding(blob: bytes) -> np.ndarray:
    return np.frombuffer(blob, dtype=np.float32)


def cosine_similarity(vec_a: np.ndarray, vec_b: np.ndarray) -> float:
    norm_a = np.linalg.norm(vec_a)
    norm_b = np.linalg.norm(vec_b)
    if norm_a == 0 or norm_b == 0:
        return 0.0
    return float(np.dot(vec_a, vec_b) / (norm_a * norm_b))


# ---------------------------------------------------- Trait resolution

def parse_trait_tokens(text: str) -> list[str]:
    """Split comma-separated trait phrases; fall back to the whole string."""
    text = text.strip()
    if not text:
        return []
    parts = [part.strip() for part in text.split(",") if part.strip()]
    return parts or [text]


def _find_semantic_match(rows, query_embedding: np.ndarray) -> tuple[int | None, str, float]:
    best_id = None
    best_name = ""
    best_score = -1.0

    for row in rows:
        stored = blob_to_embedding(row["embedding"])
        score = cosine_similarity(query_embedding, stored)
        if score > best_score:
            best_score = score
            best_id = row["id"]
            best_name = row["name"]

    return best_id, best_name, best_score


def resolve_trait(conn, text: str, table: str) -> tuple[int, str, bool]:
    """Resolve a trait string to a database row.

    Returns (id, canonical_name, was_existing). A trait is considered existing
    when it matches an exact name or a stored embedding above the threshold.
    """
    if table not in {"strengths", "weaknesses", "interests"}:
        raise ValueError(f"Unsupported trait table: {table}")

    text = text.strip()
    if not text:
        raise ValueError("Trait text must not be empty")

    exact = conn.execute(
        f"SELECT id, name FROM {table} WHERE name = ?",
        (text,),
    ).fetchone()
    if exact:
        return exact["id"], exact["name"], True

    query_embedding = get_embedding(text)
    rows = conn.execute(f"SELECT id, name, embedding FROM {table}").fetchall()
    best_id, best_name, best_score = _find_semantic_match(rows, query_embedding)

    if best_id is not None and best_score >= TRAIT_SIMILARITY_THRESHOLD:
        return best_id, best_name, True

    with conn:
        cursor = conn.execute(
            f"INSERT INTO {table} (name, embedding) VALUES (?, ?)",
            (text, embedding_to_blob(query_embedding)),
        )
    return cursor.lastrowid, text, False


def resolve_traits(conn, text: str, table: str) -> tuple[list[int], list[str], bool]:
    """Resolve every trait token; returns whether every token was pre-existing."""
    ids: list[int] = []
    names: list[str] = []
    all_existing = True

    for token in parse_trait_tokens(text):
        trait_id, name, was_existing = resolve_trait(conn, token, table)
        ids.append(trait_id)
        names.append(name)
        all_existing = all_existing and was_existing

    return ids, names, all_existing


# -------------------------------------------------------- Job persistence

def upsert_job(conn, title: str, description: str) -> int:
    with conn:
        conn.execute(
            "INSERT INTO jobs (title, description) VALUES (?, ?) "
            "ON CONFLICT(title) DO UPDATE SET description = excluded.description",
            (title, description),
        )
    row = conn.execute("SELECT id FROM jobs WHERE title = ?", (title,)).fetchone()
    return row["id"]


def link_job_traits(
    conn,
    job_id: int,
    strength_ids: list[int],
    weakness_ids: list[int],
    interest_ids: list[int],
):
    with conn:
        for strength_id in strength_ids:
            conn.execute(
                "INSERT OR IGNORE INTO job_strengths (job_id, strength_id) VALUES (?, ?)",
                (job_id, strength_id),
            )
        for weakness_id in weakness_ids:
            conn.execute(
                "INSERT OR IGNORE INTO job_weaknesses (job_id, weakness_id) VALUES (?, ?)",
                (job_id, weakness_id),
            )
        for interest_id in interest_ids:
            conn.execute(
                "INSERT OR IGNORE INTO job_interests (job_id, interest_id) VALUES (?, ?)",
                (job_id, interest_id),
            )


def persist_generated_jobs(
    conn,
    strength_ids: list[int],
    weakness_ids: list[int],
    interest_ids: list[int],
    jobs: list[dict],
):
    for job in jobs:
        job_id = upsert_job(conn, job["title"], job["description"])
        link_job_traits(conn, job_id, strength_ids, weakness_ids, interest_ids)


def fetch_linked_jobs(
    conn,
    strength_ids: list[int],
    weakness_ids: list[int],
    interest_ids: list[int],
) -> list[dict]:
    """Return jobs linked to every resolved strength, weakness, and interest ID."""
    if not strength_ids or not weakness_ids or not interest_ids:
        return []

    strength_placeholders = ",".join("?" * len(strength_ids))
    weakness_placeholders = ",".join("?" * len(weakness_ids))
    interest_placeholders = ",".join("?" * len(interest_ids))
    params = [
        *strength_ids, len(strength_ids),
        *interest_ids, len(interest_ids),
        *weakness_ids, len(weakness_ids),
    ]

    rows = conn.execute(
        f"""
        SELECT j.id, j.title, j.description
        FROM jobs j
        WHERE (
            SELECT COUNT(DISTINCT js.strength_id)
            FROM job_strengths js
            WHERE js.job_id = j.id AND js.strength_id IN ({strength_placeholders})
        ) = ?
        AND (
            SELECT COUNT(DISTINCT ji.interest_id)
            FROM job_interests ji
            WHERE ji.job_id = j.id AND ji.interest_id IN ({interest_placeholders})
        ) = ?
        AND (
            SELECT COUNT(DISTINCT jw.weakness_id)
            FROM job_weaknesses jw
            WHERE jw.job_id = j.id AND jw.weakness_id IN ({weakness_placeholders})
        ) = ?
        ORDER BY j.title
        """,
        params,
    ).fetchall()

    return [
        {
            "title": row["title"],
            "description": row["description"],
            "confidence": 90,
            "justification": (
                "Matched your strengths, weaknesses, and interests against stored career paths "
                "in the knowledge base."
            ),
        }
        for row in rows
    ]


# ---------------------------------------------------------------- Generation

def sanitize_text(value, fallback: str, max_len: int) -> str:
    if not isinstance(value, str) or not value.strip():
        return fallback
    text = value.strip()
    if len(text) > max_len:
        text = text[:max_len].rsplit(" ", 1)[0] + "..."
    return text


def sanitize_confidence(value) -> int:
    try:
        conf = float(value)
    except (TypeError, ValueError):
        return 50
    if 0 <= conf <= 1:
        conf *= 100
    return max(0, min(100, round(conf)))


def sanitize_job(job: dict) -> dict:
    return {
        "title": sanitize_text(job.get("title"), "Unspecified Role", 60),
        "description": sanitize_text(job.get("description"), "No description provided.", 220),
        "confidence": sanitize_confidence(job.get("confidence")),
        "justification": sanitize_text(job.get("justification"), "No justification provided.", 160),
    }


def generate_job_list(strengths: str, weaknesses: str, interests: str, cancel_event=None) -> list[dict]:
    system_role = (
        "You are a career-matching engine for students seeking entry-level or "
        "student-friendly jobs. Respond with ONLY valid JSON, no markdown, no extra "
        "commentary, matching exactly this shape:\n"
        '{"jobs": [\n'
        '  {"title": "string", "description": "string, 1-2 sentences", '
        '"confidence": integer 0-100, "justification": "string, 1 sentence"}\n'
        ']}\n'
        f"Provide AT LEAST {MIN_JOBS} jobs, ranked from HIGHEST to LOWEST confidence. "
        "Confidence reflects how well the job matches the given strengths, weaknesses, "
        "and interests. Justification must explain the score in one clear sentence."
    )
    user_prompt = f"Strengths: {strengths}\nWeaknesses: {weaknesses}\nInterests: {interests}"

    chunks = []
    stream = ollama.chat(
        model=GEN_MODEL,
        format="json",
        messages=[
            {"role": "system", "content": system_role},
            {"role": "user", "content": user_prompt},
        ],
        stream=True,
    )
    for chunk in stream:
        if cancel_event is not None and cancel_event.is_set():
            raise GenerationCancelled()
        text = chunk.get("message", {}).get("content", "")
        if text:
            chunks.append(text)

    raw = "".join(chunks)

    try:
        raw_jobs = json.loads(raw).get("jobs", [])
    except json.JSONDecodeError:
        raw_jobs = []

    jobs = [sanitize_job(job) for job in raw_jobs if isinstance(job, dict)]
    while len(jobs) < MIN_JOBS:
        jobs.append(sanitize_job({
            "title": "General Entry-Level Role",
            "description": "A broad starting role suited to building foundational experience.",
            "confidence": 50,
            "justification": "Fallback suggestion — the model returned fewer options than required.",
        }))
    jobs.sort(key=lambda job: job["confidence"], reverse=True)
    return jobs


PROFILE_FIELD_LABELS = {
    "hobbies": "Hobbies",
    "disabilities": "Disabilities or accessibility needs",
    "country": "Country where the user wants to work",
    "education": "Education",
    "qualifications": "Qualifications or certifications",
    "work_experience": "Work experience",
    "medical_conditions": "Health-related work constraints",
    "preferred_work_environments": "Preferred work environments",
    "work_preference": "Work preference",
    "weekly_availability": "Weekly availability",
    "career_goals": "Career goals",
    "background_constraints": "Background constraints",
    "date_of_birth": "Date of birth",
    "gender": "Gender",
    "current_address": "Current address or location",
    "languages": "Languages spoken",
    "linkedin_url": "LinkedIn profile URL",
    "portfolio_url": "Portfolio or personal website URL",
    "preferred_industries": "Preferred industries",
    "extracurriculars": "Extracurricular activities or volunteer work",
    "willing_to_relocate": "Willing to relocate (yes/no/where)",
    "salary_expectations": "Salary expectations",
    "notice_period": "Notice period or availability to start",
    "values": "Personal or workplace values",
    "work_authorization": "Work authorization status",
    "education_level": "Education level (legacy profile field)",
    "location": "Location (legacy profile field)",
}


def format_profile_context(profile: dict[str, str]) -> str:
    lines = []
    for field, label in PROFILE_FIELD_LABELS.items():
        value = profile.get(field, "").strip()
        if value:
            lines.append(f"{label}: {value}")
    return "\n".join(lines)


def generate_personalized_job_list(
    strengths: str,
    weaknesses: str,
    interests: str,
    profile: dict[str, str],
    cancel_event=None,
) -> list[dict]:
    profile_context = format_profile_context(profile)
    system_role = (
        "You are a career-matching engine for students seeking entry-level or "
        "student-friendly jobs. Respond with ONLY valid JSON, no markdown, no extra "
        "commentary, matching exactly this shape:\n"
        '{"jobs": [\n'
        '  {"title": "string", "description": "string, 1-2 sentences", '
        '"confidence": integer 0-100, "justification": "string, 1 sentence", '
        '"salary": "string, estimated annual income in USD, e.g. $45k-$60k/yr"}\n'
        ']}\n'
        f"Provide AT LEAST {MIN_JOBS} jobs, ranked from HIGHEST to LOWEST confidence. "
        "Tailor every recommendation to the user's personal background constraints. "
        "Explain how their strengths and weaknesses translate into realistic roles "
        "given their education, experience, location, availability, goals, and other "
        "constraints. Confidence reflects how well each job fits the full profile. "
        "Justification must connect strengths, weaknesses, and background constraints "
        "in one clear sentence. "
        "For salary, estimate a realistic annual income range for the role based on "
        "the user's location and the job's typical market rate. Use the user's salary "
        "expectations as a reference if provided."
    )
    user_prompt = (
        f"Strengths: {strengths}\n"
        f"Weaknesses: {weaknesses}\n"
        f"Interests: {interests}\n"
        f"Personal background:\n{profile_context}"
    )

    chunks = []
    stream = ollama.chat(
        model=GEN_MODEL,
        format="json",
        messages=[
            {"role": "system", "content": system_role},
            {"role": "user", "content": user_prompt},
        ],
        stream=True,
    )
    for chunk in stream:
        if cancel_event is not None and cancel_event.is_set():
            raise GenerationCancelled()
        text = chunk.get("message", {}).get("content", "")
        if text:
            chunks.append(text)

    raw = "".join(chunks)

    try:
        raw_jobs = json.loads(raw).get("jobs", [])
    except json.JSONDecodeError:
        raw_jobs = []

    jobs = [sanitize_job(job) for job in raw_jobs if isinstance(job, dict)]
    while len(jobs) < MIN_JOBS:
        jobs.append(sanitize_job({
            "title": "General Entry-Level Role",
            "description": "A broad starting role suited to building foundational experience.",
            "confidence": 50,
            "justification": "Fallback suggestion — the model returned fewer options than required.",
        }))
    jobs.sort(key=lambda job: job["confidence"], reverse=True)
    return jobs


# --------------------------------------------------------------------- Core

def get_baseline_recommendations(conn, strengths: str, weaknesses: str, interests: str, cancel_event=None) -> dict:
    """Resolve traits against the relational cache; zero LLM calls on full cache hit."""
    strengths, weaknesses, interests = strengths.strip(), weaknesses.strip(), interests.strip()

    strength_ids, _, strengths_existing = resolve_traits(conn, strengths, "strengths")
    weakness_ids, _, weaknesses_existing = resolve_traits(conn, weaknesses, "weaknesses")
    interest_ids, _, interests_existing = resolve_traits(conn, interests, "interests")
    traits_existing = strengths_existing and weaknesses_existing and interests_existing

    if traits_existing:
        cached_jobs = fetch_linked_jobs(conn, strength_ids, weakness_ids, interest_ids)
        if cached_jobs:
            return {"source": "cache", "similarity": TRAIT_SIMILARITY_THRESHOLD, "jobs": cached_jobs}

    jobs = generate_job_list(strengths, weaknesses, interests, cancel_event=cancel_event)
    persist_generated_jobs(conn, strength_ids, weakness_ids, interest_ids, jobs)
    return {"source": "generated", "similarity": None, "jobs": jobs}


def get_personalized_career_advice(
    strengths: str,
    weaknesses: str,
    interests: str,
    profile: dict[str, str],
    cancel_event=None,
) -> dict:
    """Single-pass personalized recommendations — never reads from or writes to cache."""
    strengths, weaknesses, interests = strengths.strip(), weaknesses.strip(), interests.strip()
    jobs = generate_personalized_job_list(strengths, weaknesses, interests, profile, cancel_event=cancel_event)
    return {"source": "personalized", "similarity": None, "jobs": jobs}


def get_career_advice(conn, strengths: str, weaknesses: str, interests: str) -> dict:
    return get_baseline_recommendations(conn, strengths, weaknesses, interests)
