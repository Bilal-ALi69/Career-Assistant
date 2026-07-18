"""Accounts / authentication logic.

Deliberately a SEPARATE database file from career_cache.db — personal data
(email, password) should never live in the same store as anonymous trait
combos, matching the original privacy design (two-DB split)."""

import json
import os
import sqlite3
import time
from pathlib import Path
import jwt
import bcrypt
from dotenv import load_dotenv

load_dotenv()

USER_DB_FILE = Path(__file__).with_name("user_data.db")

JWT_SECRET = os.getenv("JWT_SECRET")
if not JWT_SECRET:
    raise RuntimeError(
        "JWT_SECRET is not set. Create a .env file in this folder with a line like:\n"
        "JWT_SECRET=<random value>\n"
        "Generate one with: python -c \"import secrets; print(secrets.token_hex(32))\""
    )

JWT_ALGORITHM = "HS256"
TOKEN_EXPIRY_SECONDS = int(os.getenv("TOKEN_EXPIRY_SECONDS", str(60 * 60 * 24)))

PROFILE_DEFAULTS = {
    "hobbies": "",
    "disabilities": "None",
    "country": "All",
    "education": "",
    "qualifications": "",
    "work_experience": "",
    "medical_conditions": "",
    "preferred_work_environments": "",
    "work_preference": "",
    "weekly_availability": "",
    "career_goals": "",
    "background_constraints": "",
    # Kept so profiles saved by the previous API version remain readable.
    "education_level": "",
    "location": "",
}
PROFILE_SURVEY_FIELDS = tuple(PROFILE_DEFAULTS)


def get_user_connection():
    conn = sqlite3.connect(USER_DB_FILE, timeout=10)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA journal_mode=WAL")
    conn.execute("PRAGMA foreign_keys=ON")
    conn.execute("PRAGMA busy_timeout=10000")
    return conn


def init_user_db(conn):
    with conn:
        conn.execute('''
            CREATE TABLE IF NOT EXISTS users (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                email TEXT UNIQUE NOT NULL,
                password_hash TEXT NOT NULL,
                created_at INTEGER NOT NULL
            )
        ''')
        conn.execute('''
            CREATE TABLE IF NOT EXISTS profile_surveys (
                user_id INTEGER PRIMARY KEY,
                survey_data TEXT NOT NULL DEFAULT '{}',
                updated_at INTEGER NOT NULL,
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
            )
        ''')


def password_strength_score(password: str) -> dict:
    """Simple heuristic scorer — no external service, no network call.
    Good enough for 'nudge the user toward a better password', not meant to
    be a research-grade estimator like zxcvbn (which is the real thing to
    reach for later if you want proper entropy-based scoring)."""
    score = 0
    if len(password) >= 8:
        score += 1
    if len(password) >= 12:
        score += 1
    if any(c.isupper() for c in password):
        score += 1
    if any(c.islower() for c in password):
        score += 1
    if any(c.isdigit() for c in password):
        score += 1
    if any(not c.isalnum() for c in password):
        score += 1

    labels = ["Very Weak", "Weak", "Fair", "Good", "Strong", "Very Strong"]
    label = labels[min(score, len(labels) - 1)]
    return {"score": score, "max_score": 6, "label": label}


def password_meets_policy(password: str) -> bool:
    """Require a usable baseline while allowing passphrases and password managers."""
    categories = sum((
        any(c.islower() for c in password),
        any(c.isupper() for c in password),
        any(c.isdigit() for c in password),
        any(not c.isalnum() for c in password),
    ))
    return len(password) >= 12 and categories >= 3


def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode(), bcrypt.gensalt()).decode()


def verify_password(password: str, password_hash: str) -> bool:
    return bcrypt.checkpw(password.encode(), password_hash.encode())


def create_user(conn, email: str, password: str) -> int:
    with conn:
        cursor = conn.execute(
            "INSERT INTO users (email, password_hash, created_at) VALUES (?, ?, ?)",
            (email.lower().strip(), hash_password(password), int(time.time())),
        )
        return cursor.lastrowid


def get_user_by_email(conn, email: str):
    return conn.execute("SELECT * FROM users WHERE email = ?", (email.lower().strip(),)).fetchone()


def get_user_by_id(conn, user_id: int):
    return conn.execute("SELECT * FROM users WHERE id = ?", (user_id,)).fetchone()


def delete_user(conn, user_id: int):
    with conn:
        conn.execute("DELETE FROM users WHERE id = ?", (user_id,))


def create_access_token(user_id: int) -> str:
    now = int(time.time())
    payload = {
        "sub": str(user_id),
        "iat": now,
        "nbf": now,
        "exp": now + TOKEN_EXPIRY_SECONDS,
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)


def decode_access_token(token: str) -> int | None:
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        return int(payload["sub"])
    except jwt.PyJWTError:
        return None


def empty_profile_survey() -> dict[str, str]:
    return PROFILE_DEFAULTS.copy()


def normalize_profile_survey(data: dict | None) -> dict[str, str]:
    survey = empty_profile_survey()
    if not isinstance(data, dict):
        return survey
    for field in PROFILE_SURVEY_FIELDS:
        value = data.get(field, PROFILE_DEFAULTS[field])
        survey[field] = value.strip() if isinstance(value, str) else PROFILE_DEFAULTS[field]
    return survey


def has_active_profile_survey(profile: dict[str, str] | None) -> bool:
    if not profile:
        return False
    return any(
        value.strip() and value != PROFILE_DEFAULTS[field]
        for field, value in profile.items()
        if field in PROFILE_DEFAULTS and isinstance(value, str)
    )


def get_user_profile_survey(conn, user_id: int) -> dict[str, str]:
    row = conn.execute(
        "SELECT survey_data FROM profile_surveys WHERE user_id = ?",
        (user_id,),
    ).fetchone()
    if row is None:
        return empty_profile_survey()
    try:
        stored = json.loads(row["survey_data"])
    except json.JSONDecodeError:
        return empty_profile_survey()
    return normalize_profile_survey(stored)


def save_user_profile_survey(conn, user_id: int, survey_data: dict) -> dict[str, str]:
    survey = normalize_profile_survey(survey_data)
    with conn:
        conn.execute('''
            INSERT INTO profile_surveys (user_id, survey_data, updated_at)
            VALUES (?, ?, ?)
            ON CONFLICT(user_id) DO UPDATE SET
                survey_data = excluded.survey_data,
                updated_at = excluded.updated_at
        ''', (user_id, json.dumps(survey), int(time.time())))
    return survey
