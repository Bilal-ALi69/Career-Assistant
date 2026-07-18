"""AI Future Career Assistant — Milestone 2

New in this version:
- Spellcheck with an 85% confidence threshold: high-confidence corrections
  apply silently, low-confidence ones ask you to confirm or retype.
- Generates AT LEAST 4 ranked job recommendations per profile, each with a
  title, short description, confidence score, and justification — instead
  of a single career name.
- Pauses after showing results. Does NOT auto-loop into asking for another
  profile — you choose to continue or stop.
"""

import sqlite3
import json
from dataclasses import dataclass
from difflib import SequenceMatcher

import numpy as np
import ollama
from spellchecker import SpellChecker

DB_FILE = "career_cache.db"
EMBED_MODEL = "mxbai-embed-large"   # ollama pull nomic-embed-text
GEN_MODEL = "llama3"
SIMILARITY_THRESHOLD = 0.8
FIELD_WEIGHTS = {"strengths": 0.30, "weaknesses": 0.30, "interests": 0.40}

MIN_JOBS = 4
SPELLCHECK_CONFIDENCE_THRESHOLD = 0.85
SPELLCHECK_WHITELIST = {
    "python", "javascript", "html", "css", "sql", "ux", "ui", "api",
    "coding", "devops", "ollama", "ai", "ml", "js",
}

_spell = SpellChecker()


@dataclass
class CachedMatch:
    row_id: int
    recommendation: str
    similarity: float


# ---------------------------------------------------------------- Spellcheck

def check_word(word: str) -> tuple[str, float]:
    """Returns (best_guess, confidence 0-1). Confidence is a string-similarity
    proxy (how close the correction is to what you typed) — pyspellchecker
    has no true probability score, so this is an approximation, not a
    statistical guarantee."""
    stripped = word.strip(",.").lower()
    if not stripped.isalpha() or stripped in SPELLCHECK_WHITELIST or stripped in _spell:
        return word, 1.0

    correction = _spell.correction(stripped)
    if not correction or correction == stripped:
        return word, 1.0  # nothing better found, leave as-is

    confidence = SequenceMatcher(None, stripped, correction).ratio()
    return correction, confidence


def interactive_input(prompt: str) -> str:
    """Loops per field: auto-applies high-confidence corrections silently,
    asks for confirmation on low-confidence ones, lets you retype if unsure."""
    while True:
        raw = input(prompt)
        words = raw.split()
        corrected_words = []
        low_confidence_flag = False

        for word in words:
            corrected, confidence = check_word(word)
            corrected_words.append(corrected)
            if corrected != word:
                if confidence >= SPELLCHECK_CONFIDENCE_THRESHOLD:
                    print(f"   (autocorrected \"{word}\" -> \"{corrected}\", {confidence:.0%} confidence)")
                else:
                    low_confidence_flag = True

        corrected_text = " ".join(corrected_words)

        if not low_confidence_flag:
            return corrected_text

        choice = input(
            f"   Not fully sure — did you mean \"{corrected_text}\"? "
            f"(y = use this / n = keep what I typed / r = let me retype): "
        ).strip().lower()

        if choice == "y":
            return corrected_text
        if choice == "n":
            return raw
        # anything else (including 'r') loops back and re-prompts


# ------------------------------------------------------------------- Storage

def get_connection():
    conn = sqlite3.connect(DB_FILE)
    conn.row_factory = sqlite3.Row
    return conn


def init_db(conn):
    with conn:
        conn.execute('''
            CREATE TABLE IF NOT EXISTS matches (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                strengths TEXT, weaknesses TEXT, interests TEXT,
                recommendation TEXT,
                strengths_embedding TEXT, weaknesses_embedding TEXT, interests_embedding TEXT,
                hit_count INTEGER DEFAULT 0
            )
        ''')


def embed(text: str) -> np.ndarray:
    return np.array(ollama.embeddings(model=EMBED_MODEL, prompt=text)["embedding"], dtype=np.float32)


def embed_fields(strengths: str, weaknesses: str, interests: str) -> dict[str, np.ndarray]:
    return {"strengths": embed(strengths), "weaknesses": embed(weaknesses), "interests": embed(interests)}


def cosine_similarity_matrix(query_vec: np.ndarray, cached_matrix: np.ndarray) -> np.ndarray:
    if cached_matrix.size == 0:
        return np.array([])
    normed = cached_matrix / np.linalg.norm(cached_matrix, axis=1, keepdims=True)
    return normed @ (query_vec / np.linalg.norm(query_vec))
GRAY_ZONE_LOW = 0.75   # below this, don't even bother asking AI — clearly not a match

def ai_confirms_match(new_profile: str, cached_profile: str) -> bool:
    """Only called for borderline embedding scores. Asks the AI directly
    whether two profiles are close enough to share a recommendation."""
    prompt = (
        f"Profile A: {new_profile}\nProfile B: {cached_profile}\n\n"
        "Are these two profiles similar enough that the same career "
        "recommendations would suit both? Reply with ONLY 'yes' or 'no'."
    )
    response = ollama.chat(model=GEN_MODEL, messages=[{"role": "user", "content": prompt}])
    return response["message"]["content"].strip().lower().startswith("y")

def find_best_match(conn, query_embeddings: dict[str, np.ndarray], strengths: str, weaknesses: str, interests: str) -> CachedMatch | None:
    rows = conn.execute(
        "SELECT id, recommendation, strengths, weaknesses, interests, "
        "strengths_embedding, weaknesses_embedding, interests_embedding FROM matches"
    ).fetchall()
    if not rows:
        return None

    scores = np.zeros(len(rows), dtype=np.float32)
    for field, weight in FIELD_WEIGHTS.items():
        matrix = np.array([json.loads(row[f"{field}_embedding"]) for row in rows], dtype=np.float32)
        scores += weight * cosine_similarity_matrix(query_embeddings[field], matrix)

    best_idx = int(np.argmax(scores))
    best_score = float(scores[best_idx])
    print(f"   (closest cached profile scored {best_score:.0%}, threshold is {SIMILARITY_THRESHOLD:.0%})")

    row = rows[best_idx]
    if best_score >= SIMILARITY_THRESHOLD:
        return CachedMatch(row["id"], row["recommendation"], best_score)

    if GRAY_ZONE_LOW <= best_score < SIMILARITY_THRESHOLD:
        new_profile_text = f"Strengths: {strengths}, Weaknesses: {weaknesses}, Interests: {interests}"
        cached_profile_text = f"Strengths: {row['strengths']}, Weaknesses: {row['weaknesses']}, Interests: {row['interests']}"
        print("   (score is borderline — asking AI to double-check this match...)")
        if ai_confirms_match(new_profile_text, cached_profile_text):
            print("   (AI tie-breaker confirmed this as a match)")
            return CachedMatch(row["id"], row["recommendation"], best_score)
        print("   (AI tie-breaker said no — not a match)")

    return None


def save_to_cache(conn, strengths, weaknesses, interests, jobs: list[dict], embeddings):
    with conn:
        conn.execute('''
            INSERT INTO matches (strengths, weaknesses, interests, recommendation,
                strengths_embedding, weaknesses_embedding, interests_embedding)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        ''', (
            strengths, weaknesses, interests, json.dumps(jobs),
            json.dumps(embeddings["strengths"].tolist()),
            json.dumps(embeddings["weaknesses"].tolist()),
            json.dumps(embeddings["interests"].tolist()),
        ))


# ---------------------------------------------------------------- Generation

def generate_job_list(strengths: str, weaknesses: str, interests: str) -> list[dict]:
    """This system prompt IS the 'implementation-ready LLM prompt' — it's
    what actually enforces the >=4 jobs, ranking, and confidence+justification
    requirements at generation time."""
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

    response = ollama.chat(
        model=GEN_MODEL,
        format="json",
        messages=[
            {"role": "system", "content": system_role},
            {"role": "user", "content": user_prompt},
        ],
    )

    try:
        jobs = json.loads(response["message"]["content"]).get("jobs", [])
    except json.JSONDecodeError:
        jobs = []

    # Contract: this function ALWAYS returns at least MIN_JOBS, even if the
    # model under-delivers, so calling code never has to special-case a short list.
    while len(jobs) < MIN_JOBS:
        jobs.append({
            "title": "General Entry-Level Role",
            "description": "A broad starting role suited to building foundational experience.",
            "confidence": 50,
            "justification": "Fallback suggestion — the model returned fewer options than required.",
        })

    return jobs


def print_job_list(jobs: list[dict]):
    print(f"\nHere are {len(jobs)} job matches for your profile:\n")
    for idx, job in enumerate(jobs, start=1):
        print(f"{idx}. {job.get('title', 'Unknown role')} — {job.get('confidence', 'N/A')}% match")
        print(f"   {job.get('description', '')}")
        print(f"   Why: {job.get('justification', '')}\n")


# --------------------------------------------------------------------- Core

def get_career_advice(conn, strengths: str, weaknesses: str, interests: str) -> list[dict]:
    strengths, weaknesses, interests = strengths.strip(), weaknesses.strip(), interests.strip()
    query_embeddings = embed_fields(strengths, weaknesses, interests)

    match = find_best_match(conn, query_embeddings, strengths, weaknesses, interests)
    if match:
        conn.execute("UPDATE matches SET hit_count = hit_count + 1 WHERE id = ?", (match.row_id,))
        conn.commit()
        print(f"\n⚡ [CACHE HIT] Similarity {match.similarity:.2f} — serving instant answer.")
        return json.loads(match.recommendation)

    print("\n🤖 [AI GENERATION] No close match found. Querying local Ai...")
    jobs = generate_job_list(strengths, weaknesses, interests)
    save_to_cache(conn, strengths, weaknesses, interests, jobs, query_embeddings)
    return jobs


if __name__ == "__main__":
    conn = get_connection()
    init_db(conn)
    print("==== AI Future Career Assistant ====")

    while True:
        s = interactive_input("\nEnter your core strengths (e.g. Coding, Math): ")
        w = interactive_input("Enter your core weaknesses (e.g. Procrastination): ")
        i = interactive_input("Enter your primary interests (e.g. Gaming, Open Source): ")

        jobs = get_career_advice(conn, s, w, i)
        print_job_list(jobs)

        again = input("Enter another profile? (y/n): ").strip().lower()
        if again != "y":
            break

    conn.close()
    print("\nSession ended.")