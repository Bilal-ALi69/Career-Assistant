"""AI Future Career Assistant — Milestone 1 (Lean)"""

import sqlite3
import json
from dataclasses import dataclass

import numpy as np
import ollama

DB_FILE = "career_cache.db"
EMBED_MODEL = "nomic-embed-text"   # ollama pull nomic-embed-text
GEN_MODEL = "llama3"
SIMILARITY_THRESHOLD = 0.80
FIELD_WEIGHTS = {"strengths": 0.30, "weaknesses": 0.30, "interests": 0.40}


@dataclass
class CachedMatch:
    row_id: int
    recommendation: str
    similarity: float


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


def find_best_match(conn, query_embeddings: dict[str, np.ndarray]) -> CachedMatch | None:
    rows = conn.execute(
        "SELECT id, recommendation, strengths_embedding, weaknesses_embedding, interests_embedding FROM matches"
    ).fetchall()
    if not rows:
        return None

    scores = np.zeros(len(rows), dtype=np.float32)
    for field, weight in FIELD_WEIGHTS.items():
        matrix = np.array([json.loads(row[f"{field}_embedding"]) for row in rows], dtype=np.float32)
        scores += weight * cosine_similarity_matrix(query_embeddings[field], matrix)

    best_idx = int(np.argmax(scores))
    best_score = float(scores[best_idx])
    print(f"   (closest cached profile scored {best_score:.3f}, threshold is {SIMILARITY_THRESHOLD})")

    if best_score >= SIMILARITY_THRESHOLD:
        row = rows[best_idx]
        return CachedMatch(row["id"], row["recommendation"], best_score)
    return None


def save_to_cache(conn, strengths, weaknesses, interests, recommendation, embeddings):
    with conn:
        conn.execute('''
            INSERT INTO matches (strengths, weaknesses, interests, recommendation,
                strengths_embedding, weaknesses_embedding, interests_embedding)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        ''', (
            strengths, weaknesses, interests, recommendation,
            json.dumps(embeddings["strengths"].tolist()),
            json.dumps(embeddings["weaknesses"].tolist()),
            json.dumps(embeddings["interests"].tolist()),
        ))


def extract_career_name(strengths: str, weaknesses: str, interests: str) -> str:
    """AI's only job: name ONE career. Everything else is written by our own template."""
    system_role = (
        "You are a career-matching engine, not a writer. Respond with ONLY the name of "
        "ONE specific career title. No punctuation, no quotes, no explanation. "
        "Example valid outputs: Software Engineer / Technical Writer / UX Designer"
    )
    response = ollama.chat(model=GEN_MODEL, messages=[
        {"role": "system", "content": system_role},
        {"role": "user", "content": f"Strengths: {strengths}\nWeaknesses: {weaknesses}\nInterests: {interests}"},
    ])
    return clean_career_name(response["message"]["content"])


def clean_career_name(raw: str) -> str:
    cleaned = raw.strip().splitlines()[0].strip(' "\'.,-').strip()
    if len(cleaned) > 60:
        cleaned = cleaned.split(",")[0].split(".")[0][:60].strip()
    return cleaned or "Career Explorer"


def get_career_advice(conn, strengths: str, weaknesses: str, interests: str) -> str:
    strengths, weaknesses, interests = strengths.strip(), weaknesses.strip(), interests.strip()
    query_embeddings = embed_fields(strengths, weaknesses, interests)

    match = find_best_match(conn, query_embeddings)
    if match:
        conn.execute("UPDATE matches SET hit_count = hit_count + 1 WHERE id = ?", (match.row_id,))
        conn.commit()
        print(f"\n⚡ [CACHE HIT] Similarity {match.similarity:.2f} — serving instant answer.")
        return match.recommendation

    print("\n🤖 [AI GENERATION] No close match found. Querying local Llama3...")
    career_name = extract_career_name(strengths, weaknesses, interests)
    recommendation = (
        f'Your perfect career is "{career_name}" which is suitable for you, '
        f'based on your strengths in {strengths}, your interest in {interests}, '
        f'while working around challenges with {weaknesses}.'
    )
    save_to_cache(conn, strengths, weaknesses, interests, recommendation, query_embeddings)
    return recommendation


if __name__ == "__main__":
    conn = get_connection()
    init_db(conn)
    print("=== AI Future Career Assistant (Milestone 1 Prototype) ===")

    s = input("Enter your core strengths (e.g. Coding, Math): ")
    w = input("Enter your core weaknesses (e.g. Procrastination): ")
    i = input("Enter your primary interests (e.g. Gaming, Open Source): ")
    print(f"\nResult:\n{get_career_advice(conn, s, w, i)}")

    print("\n---------------------------------------------------------")
    print("Testing cache with a REWORDED version of the same profile:")
    s2 = input("Enter strengths again (try different wording): ")
    w2 = input("Enter weaknesses again (try different wording): ")
    i2 = input("Enter interests again (try different wording): ")
    print(f"\nResult:\n{get_career_advice(conn, s2, w2, i2)}")

    conn.close()