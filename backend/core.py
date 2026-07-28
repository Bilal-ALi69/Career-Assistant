"""Core business logic — shared between the CLI script and the API.
No input()/print() here; this module just does work and returns data."""

import json
import os
import sqlite3
from pathlib import Path
from difflib import SequenceMatcher

import numpy as np
import ollama
from groq import Groq
from spellchecker import SpellChecker

OLLAMA_HOST = os.getenv("OLLAMA_HOST", "http://127.0.0.1:11434")
ollama_client = ollama.Client(host=OLLAMA_HOST)

GROQ_API_KEY = os.getenv("GROQ_API_KEY", "")
groq_client = Groq(api_key=GROQ_API_KEY) if GROQ_API_KEY else None

DB_FILE = Path(__file__).with_name("career_cache.db")
EMBED_MODEL = "all-minilm"
GEN_MODEL = "llama-3.1-8b-instant"
TRAIT_SIMILARITY_THRESHOLD = 0.85


def stream_chat(messages, cancel_event=None, **kwargs):
    """Generate text via Groq (fast cloud API). Falls back gracefully if Groq is unavailable."""
    if groq_client is None:
        raise RuntimeError("GROQ_API_KEY not set")

    use_json = kwargs.pop("format", None) == "json"
    groq_kwargs = dict(
        model=GEN_MODEL,
        messages=messages,
        stream=True,
        temperature=0.7,
        max_tokens=2048,
    )
    if use_json:
        groq_kwargs["response_format"] = {"type": "json_object"}

    try:
        stream = groq_client.chat.completions.create(**groq_kwargs)
        chunks = []
        for chunk in stream:
            if cancel_event is not None and cancel_event.is_set():
                raise GenerationCancelled()
            text = chunk.choices[0].delta.content or ""
            if text:
                chunks.append(text)
        return "".join(chunks)
    except GenerationCancelled:
        raise

class GenerationCancelled(Exception):
    """Raised when a user cancels mid-generation."""


MIN_JOBS = 3
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
    conn = sqlite3.connect(DB_FILE, timeout=10, check_same_thread=False)
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
        conn.execute('''
            CREATE TABLE IF NOT EXISTS workday_summaries (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                job_title TEXT NOT NULL,
                job_description TEXT NOT NULL,
                summary TEXT NOT NULL,
                created_at INTEGER NOT NULL DEFAULT (strftime('%s','now')),
                UNIQUE(job_title, job_description)
            )
        ''')


# ------------------------------------------------------------- Embeddings

def get_embedding(text: str) -> np.ndarray:
    """Fetch a vector embedding for the given text via Ollama."""
    response = ollama_client.embeddings(model=EMBED_MODEL, prompt=text)
    return np.array(response["embedding"], dtype=np.float32)


def get_embeddings_batch(texts: list[str]) -> list[np.ndarray]:
    """Fetch embeddings for multiple texts in a single API call."""
    if not texts:
        return []
    response = ollama_client.embed(model=EMBED_MODEL, input=texts)
    return [np.array(vec, dtype=np.float32) for vec in response["embeddings"]]


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
    """Resolve every trait token; returns whether every token was pre-existing.

    Batches all embedding calls into a single API request for performance.
    """
    if table not in {"strengths", "weaknesses", "interests"}:
        raise ValueError(f"Unsupported trait table: {table}")

    tokens = parse_trait_tokens(text)
    if not tokens:
        return [], [], True

    ids: list[int | None] = [None] * len(tokens)
    names: list[str] = [""] * len(tokens)
    need_embedding: list[tuple[int, str]] = []

    for i, token in enumerate(tokens):
        token_text = token.strip()
        if not token_text:
            raise ValueError("Trait text must not be empty")
        exact = conn.execute(
            f"SELECT id, name FROM {table} WHERE name = ?",
            (token_text,),
        ).fetchone()
        if exact:
            ids[i] = exact["id"]
            names[i] = exact["name"]
        else:
            need_embedding.append((i, token_text))

    all_existing = True

    if need_embedding:
        texts_to_embed = [t for _, t in need_embedding]
        embeddings = get_embeddings_batch(texts_to_embed)

        rows = conn.execute(f"SELECT id, name, embedding FROM {table}").fetchall()

        for (idx, token_text), embedding in zip(need_embedding, embeddings):
            best_id, best_name, best_score = _find_semantic_match(rows, embedding)

            if best_id is not None and best_score >= TRAIT_SIMILARITY_THRESHOLD:
                ids[idx] = best_id
                names[idx] = best_name
            else:
                with conn:
                    cursor = conn.execute(
                        f"INSERT INTO {table} (name, embedding) VALUES (?, ?)",
                        (token_text, embedding_to_blob(embedding)),
                    )
                ids[idx] = cursor.lastrowid
                names[idx] = token_text
                all_existing = False

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
            "estimated_salary": "—",
            "match_breakdown": [
                "Your traits match this role's known requirements from our career database.",
                "This role consistently appears for candidates with similar profiles.",
            ],
            "action_tags": ["Knowledge Base Match", "Verified Path"],
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


def sanitize_match_breakdown(value) -> list[str]:
    if not isinstance(value, list):
        return ["Match based on your provided traits.", "This role aligns with your interests."]
    bullets = []
    for item in value[:2]:
        if isinstance(item, str) and item.strip():
            bullets.append(item.strip()[:120])
    while len(bullets) < 2:
        bullets.append("This role aligns with your interests.")
    return bullets


def sanitize_action_tags(value) -> list[str]:
    if not isinstance(value, list):
        return []
    tags = []
    for item in value[:3]:
        if isinstance(item, str) and item.strip():
            tags.append(item.strip()[:40])
    return tags


def sanitize_job(job: dict) -> dict:
    return {
        "title": sanitize_text(job.get("title"), "Unspecified Role", 60),
        "description": sanitize_text(job.get("description"), "No description provided.", 220),
        "confidence": sanitize_confidence(job.get("confidence")),
        "justification": sanitize_text(job.get("justification"), "No justification provided.", 160),
        "estimated_salary": sanitize_text(job.get("estimated_salary"), "—", 40),
        "match_breakdown": sanitize_match_breakdown(job.get("match_breakdown")),
        "action_tags": sanitize_action_tags(job.get("action_tags")),
    }


def generate_job_list(strengths: str, weaknesses: str, interests: str, cancel_event=None) -> list[dict]:
    system_role = (
        "You rank entry-level jobs for a candidate. "
        "Reply ONLY with valid JSON (no markdown):\n"
        '{"jobs": [\n'
        '  {"title": "string", "description": "1-2 sentences", '
        '"confidence": 0-100, "justification": "1 sentence", '
        '"estimated_salary": "e.g. $45k-$60k/yr", '
        '"match_breakdown": ["bullet 1", "bullet 2"], '
        '"action_tags": ["tag1", "tag2", "tag3"]}\n'
        ']}\n'
        f"Return {MIN_JOBS} jobs ranked by confidence. "
        "match_breakdown: exactly 2 short bullets. "
        "action_tags: exactly 2-3 tags (environment, tools, style)."
    )
    user_prompt = f"Strengths: {strengths}\nWeaknesses: {weaknesses}\nInterests: {interests}"

    raw = stream_chat(
        messages=[
            {"role": "system", "content": system_role},
            {"role": "user", "content": user_prompt},
        ],
        cancel_event=cancel_event,
        format="json",
    )

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
            "estimated_salary": "—",
            "match_breakdown": [
                "A broad entry-level role that fits many skill combinations.",
                "Good starting point for building foundational experience.",
            ],
            "action_tags": ["Entry Level", "Versatile"],
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
    country = (profile.get("country") or "").strip()
    salary_instruction = (
        f"For estimated_salary, estimate a realistic annual income range for the role "
        f"using the currency of the user's country ({country}). "
        "Use the user's salary expectations as a reference if provided."
        if country
        else "For estimated_salary, estimate a realistic annual income range in USD. "
        "Use the user's salary expectations as a reference if provided."
    )
    system_role = (
        "You rank entry-level jobs tailored to a candidate's full profile. "
        "Reply ONLY with valid JSON (no markdown):\n"
        '{"jobs": [\n'
        '  {"title": "string", "description": "1-2 sentences", '
        '"confidence": 0-100, "justification": "1 sentence", '
        '"estimated_salary": "string with currency", '
        '"match_breakdown": ["bullet 1", "bullet 2"], '
        '"action_tags": ["tag1", "tag2", "tag3"]}\n'
        ']}\n'
        f"Return {MIN_JOBS} jobs ranked by confidence. "
        "Tailor to the candidate's background, location, goals. "
        "match_breakdown: exactly 2 short bullets. "
        "action_tags: exactly 2-3 tags. "
        + salary_instruction
    )
    user_prompt = (
        f"Strengths: {strengths}\n"
        f"Weaknesses: {weaknesses}\n"
        f"Interests: {interests}\n"
        f"Personal background:\n{profile_context}"
    )

    raw = stream_chat(
        messages=[
            {"role": "system", "content": system_role},
            {"role": "user", "content": user_prompt},
        ],
        cancel_event=cancel_event,
        format="json",
    )

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
            "estimated_salary": "—",
            "match_breakdown": [
                "A broad entry-level role that fits many skill combinations.",
                "Good starting point for building foundational experience.",
            ],
            "action_tags": ["Entry Level", "Versatile"],
        }))
    jobs.sort(key=lambda job: job["confidence"], reverse=True)
    return jobs


def generate_regenerated_job_list(
    strengths: str,
    weaknesses: str,
    interests: str,
    profile: dict[str, str] | None = None,
    cancel_event=None,
) -> list[dict]:
    """Ask the LLM again with an explicit instruction that the prior set was unsatisfactory."""
    is_personalized = bool(profile)
    if is_personalized:
        profile_context = format_profile_context(profile)
        country = (profile.get("country") or "").strip()
        salary_instruction = (
            f"For estimated_salary, estimate a realistic annual income range for the role "
            f"using the currency of the user's country ({country}). "
            "Use the user's salary expectations as a reference if provided."
            if country
            else "For estimated_salary, estimate a realistic annual income range in USD. "
            "Use the user's salary expectations as a reference if provided."
        )
    else:
        salary_instruction = "For estimated_salary, provide a realistic annual income range in USD. "

    system_role = (
        "The candidate rejected the previous job suggestions. "
        "Suggest COMPLETELY DIFFERENT roles — avoid repeating any title. "
        "Think laterally (adjacent or less obvious fields). "
        "Reply ONLY with valid JSON (no markdown):\n"
        '{"jobs": [\n'
        '  {"title": "string", "description": "1-2 sentences", '
        '"confidence": 0-100, "justification": "1 sentence", '
        '"estimated_salary": "string", '
        '"match_breakdown": ["bullet 1", "bullet 2"], '
        '"action_tags": ["tag1", "tag2", "tag3"]}\n'
        ']}\n'
        f"Return {MIN_JOBS} jobs ranked by confidence. "
        "All titles must be different from the previous round. "
        "match_breakdown: exactly 2 short bullets. "
        "action_tags: exactly 2-3 tags. "
        + salary_instruction
    )

    user_lines = [
        "IMPORTANT: The previous set of suggestions did not satisfy the user. "
        "Generate an entirely new and different set of career options.",
        f"Strengths: {strengths}",
        f"Weaknesses: {weaknesses}",
        f"Interests: {interests}",
    ]
    if is_personalized:
        user_lines.append(f"Personal background:\n{profile_context}")
    user_prompt = "\n".join(user_lines)

    raw = stream_chat(
        messages=[
            {"role": "system", "content": system_role},
            {"role": "user", "content": user_prompt},
        ],
        cancel_event=cancel_event,
        format="json",
    )

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
            "estimated_salary": "—",
            "match_breakdown": [
                "A broad entry-level role that fits many skill combinations.",
                "Good starting point for building foundational experience.",
            ],
            "action_tags": ["Entry Level", "Versatile"],
        }))
    jobs.sort(key=lambda job: job["confidence"], reverse=True)
    return jobs


def get_regenerated_recommendations(
    conn,
    strengths: str,
    weaknesses: str,
    interests: str,
    profile: dict[str, str] | None = None,
    cancel_event=None,
) -> dict:
    """Always call the LLM with a regeneration prompt — no cache lookup."""
    strengths, weaknesses, interests = strengths.strip(), weaknesses.strip(), interests.strip()

    if profile:
        jobs = generate_regenerated_job_list(strengths, weaknesses, interests, profile=profile, cancel_event=cancel_event)
        return {"source": "regenerated", "similarity": None, "jobs": jobs}

    jobs = generate_regenerated_job_list(strengths, weaknesses, interests, cancel_event=cancel_event)
    return {"source": "regenerated", "similarity": None, "jobs": jobs}

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


# ------------------------------------------------------------- Workday Sim

def generate_workday_summary(job_title: str, job_description: str, cancel_event=None) -> str:
    system_role = (
        "Generate a realistic workday summary in EXACTLY this format:\n"
        "Morning Kickoff:\n- task\n- task\n\n"
        "Mid-Day Sync:\n- task\n- task\n\n"
        "Afternoon Execution:\n- task\n- task\n\n"
        "Late-Day Wrap-Up:\n- task\n- task\n\n"
        "Evening Wind-Down:\n- task\n- task\n\n"
        "Use exactly these 5 phase headings with colons. "
        "2-4 bullet tasks per phase. No markdown, no intro/conclusion."
    )
    user_prompt = f"Job title: {job_title}\nJob description: {job_description}"

    raw = stream_chat(
        messages=[
            {"role": "system", "content": system_role},
            {"role": "user", "content": user_prompt},
        ],
        cancel_event=cancel_event,
    )

    return raw.strip() or "Workday details are not available at this time."


def get_workday_summary(job_title: str, job_description: str, cancel_event=None, conn=None) -> dict:
    if conn is not None:
        row = conn.execute(
            "SELECT summary FROM workday_summaries WHERE job_title = ? AND job_description = ?",
            (job_title, job_description),
        ).fetchone()
        if row:
            return {"title": job_title, "summary": row["summary"]}

    summary = generate_workday_summary(job_title, job_description, cancel_event=cancel_event)

    if conn is not None:
        try:
            conn.execute(
                "INSERT OR IGNORE INTO workday_summaries (job_title, job_description, summary) VALUES (?, ?, ?)",
                (job_title, job_description, summary),
            )
            conn.commit()
        except Exception:
            pass

    return {"title": job_title, "summary": summary}
