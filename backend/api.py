"""HTTP API for the AI Future Career Assistant.

Run locally with ``uvicorn api:app --reload``.  A production deployment must
terminate HTTPS at the reverse proxy and set an explicit CORS allow-list there
or via CORSMiddleware below once the frontend origin is known.
"""

from contextlib import asynccontextmanager
import os
import sqlite3
import threading
from typing import Annotated

from fastapi import Depends, FastAPI, HTTPException, Request, Response, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from pydantic import BaseModel, ConfigDict, EmailStr, Field, field_validator
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from slowapi.util import get_remote_address
from email_validator import EmailNotValidError, validate_email
from dns.resolver import Resolver
import ollama

import accounts
import core


@asynccontextmanager
async def lifespan(_: FastAPI):
    """Create schemas once; connections themselves are never shared by requests."""
    cache_conn = core.get_connection()
    user_conn = accounts.get_user_connection()
    try:
        core.init_db(cache_conn)
        accounts.init_user_db(user_conn)
        yield
    finally:
        cache_conn.close()
        user_conn.close()


app = FastAPI(title="AI Future Career Assistant API", lifespan=lifespan)

FRONTEND_ORIGINS = [origin.strip() for origin in os.getenv("FRONTEND_ORIGINS", "").split(",") if origin.strip()]
if not FRONTEND_ORIGINS:
    FRONTEND_ORIGINS = ["http://localhost:5173", "http://127.0.0.1:5173"]
else:
    # Always allow the local Vite host variants if one is present.
    if "http://localhost:5173" in FRONTEND_ORIGINS and "http://127.0.0.1:5173" not in FRONTEND_ORIGINS:
        FRONTEND_ORIGINS.append("http://127.0.0.1:5173")
    if "http://127.0.0.1:5173" in FRONTEND_ORIGINS and "http://localhost:5173" not in FRONTEND_ORIGINS:
        FRONTEND_ORIGINS.append("http://localhost:5173")

app.add_middleware(
    CORSMiddleware,
    allow_origins=FRONTEND_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


def get_rate_limit_key(request: Request):
    authorization = request.headers.get("Authorization", "")
    if authorization.startswith("Bearer "):
        token = authorization.split(" ", 1)[1]
        user_id = accounts.decode_access_token(token)
        if user_id is not None:
            return f"user:{user_id}"
    return get_remote_address(request)

limiter = Limiter(key_func=get_rate_limit_key)
app.state.limiter = limiter


async def rate_limit_exception_handler(request: Request, exc: Exception):
    if isinstance(exc, RateLimitExceeded):
        return _rate_limit_exceeded_handler(request, exc)
    raise exc

app.add_exception_handler(RateLimitExceeded, rate_limit_exception_handler)


FRONTEND_ORIGINS_SET = set(FRONTEND_ORIGINS)

@app.middleware("http")
async def bypass_options(request: Request, call_next):
    if request.method == "OPTIONS":
        origin = request.headers.get("origin", "")
        response = Response(status_code=204)
        if origin in FRONTEND_ORIGINS_SET:
            response.headers["Access-Control-Allow-Origin"] = origin
            response.headers["Access-Control-Allow-Credentials"] = "true"
            response.headers["Access-Control-Allow-Methods"] = "*"
            response.headers["Access-Control-Allow-Headers"] = "*"
            response.headers["Access-Control-Max-Age"] = "600"
        return response
    return await call_next(request)


@app.middleware("http")
async def security_headers(request: Request, call_next):
    response = await call_next(request)
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["X-Frame-Options"] = "DENY"
    response.headers["Referrer-Policy"] = "no-referrer"
    response.headers["Cache-Control"] = "no-store"
    return response


def get_cache_db():
    conn = core.get_connection()
    try:
        yield conn
    finally:
        conn.close()


def get_user_db():
    conn = accounts.get_user_connection()
    try:
        yield conn
    finally:
        conn.close()


security_scheme = HTTPBearer(auto_error=False)


def get_current_user(
    credentials: HTTPAuthorizationCredentials | None = Depends(security_scheme),
    user_conn=Depends(get_user_db),
):
    if credentials is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Authentication required")
    user_id = accounts.decode_access_token(credentials.credentials)
    if user_id is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid or expired token")
    user = accounts.get_user_by_id(user_conn, user_id)
    if user is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid or expired token")
    return user


def get_current_user_optional(
    credentials: HTTPAuthorizationCredentials | None = Depends(security_scheme),
):
    if credentials is None:
        return None
    return accounts.decode_access_token(credentials.credentials)


_cancel_events: dict[int, threading.Event] = {}


def _get_cancel_event(user_id: int | None) -> threading.Event | None:
    if user_id is None:
        return None
    return _cancel_events.get(user_id)


def run_recommendation(action, *args, user_id=None, **extra_kwargs):
    """Run an Ollama generation with streaming-based cancellation support.

    The cancel_event is passed through to core.py which checks it between
    streaming chunks.  When cancelled, the Ollama HTTP connection is closed
    immediately, stopping the server from continuing generation.
    """
    cancel_event = threading.Event()
    if user_id is not None:
        _cancel_events[user_id] = cancel_event

    try:
        return action(*args, cancel_event=cancel_event, **extra_kwargs)
    except core.GenerationCancelled:
        raise HTTPException(status_code=499, detail="Generation cancelled")
    except (ollama.RequestError, ollama.ResponseError):
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="The recommendation service is temporarily unavailable.",
        )
    finally:
        if user_id is not None:
            _cancel_events.pop(user_id, None)


ShortText = Annotated[str, Field(min_length=1, max_length=500)]
ProfileText = Annotated[str, Field(default="", max_length=1_000)]
Password = Annotated[str, Field(min_length=8, max_length=128)]
PasswordForCheck = Annotated[str, Field(min_length=0, max_length=128)]

# Keep a bounded resolver so a broken DNS server cannot tie up registration
# requests indefinitely. This verifies a deliverable *domain*, not a mailbox.
email_dns_resolver = Resolver(configure=True)
email_dns_resolver.timeout = 2
email_dns_resolver.lifetime = 4


class APIModel(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)


class ProfileSurveyRequest(APIModel):
    """Optional account-profile fields used for personalized recommendations."""
    full_name: ProfileText = ""
    phone_number: ProfileText = ""
    hobbies: ProfileText = ""
    disabilities: ProfileText = "None"
    country: ProfileText = "All"
    education: ProfileText = ""
    qualifications: ProfileText = ""
    work_experience: ProfileText = ""
    medical_conditions: ProfileText = ""
    preferred_work_environments: ProfileText = ""
    work_preference: ProfileText = ""
    weekly_availability: ProfileText = ""
    career_goals: ProfileText = ""
    background_constraints: ProfileText = ""
    date_of_birth: ProfileText = ""
    gender: ProfileText = ""
    current_address: ProfileText = ""
    languages: ProfileText = ""
    linkedin_url: ProfileText = ""
    portfolio_url: ProfileText = ""
    preferred_industries: ProfileText = ""
    extracurriculars: ProfileText = ""
    willing_to_relocate: ProfileText = ""
    salary_expectations: ProfileText = ""
    notice_period: ProfileText = ""
    values: ProfileText = ""
    work_authorization: ProfileText = ""
    accent_color: ProfileText = "gold"
    strengths: ProfileText = ""
    weaknesses: ProfileText = ""
    interests: ProfileText = ""
    # Backwards-compatible names accepted from the existing sample client.
    education_level: ProfileText = ""
    location: ProfileText = ""


class SpellcheckRequest(APIModel):
    text: ShortText


class RecommendationRequest(APIModel):
    strengths: ShortText
    weaknesses: ShortText
    interests: ShortText


class WorkdayRequest(APIModel):
    job_title: ShortText
    job_description: str = Field(default="", max_length=500)


class RegenerateRequest(RecommendationRequest):
    """Same traits as a normal recommendation request."""
    pass


class PersonalizedRecommendationRequest(RecommendationRequest):
    """Account flow: required traits plus optional context for this request.

    The profile fields are used for this recommendation only. Save them first
    through /auth/profile if the user wants them retained for later sessions.
    """
    hobbies: ProfileText = ""
    disabilities: ProfileText = "None"
    country: ProfileText = "All"
    education: ProfileText = ""
    qualifications: ProfileText = ""
    work_experience: ProfileText = ""
    medical_conditions: ProfileText = ""
    preferred_work_environments: ProfileText = ""
    work_preference: ProfileText = ""
    weekly_availability: ProfileText = ""
    career_goals: ProfileText = ""
    background_constraints: ProfileText = ""
    date_of_birth: ProfileText = ""
    gender: ProfileText = ""
    current_address: ProfileText = ""
    languages: ProfileText = ""
    linkedin_url: ProfileText = ""
    portfolio_url: ProfileText = ""
    preferred_industries: ProfileText = ""
    extracurriculars: ProfileText = ""
    willing_to_relocate: ProfileText = ""
    salary_expectations: ProfileText = ""
    notice_period: ProfileText = ""
    values: ProfileText = ""
    work_authorization: ProfileText = ""
    # Kept so the full profile-survey payload is always accepted here too,
    # matching ProfileSurveyRequest. They are not merged into the saved
    # profile unless actually sent in this request.
    full_name: ProfileText = ""
    phone_number: ProfileText = ""
    accent_color: ProfileText = "gold"
    education_level: ProfileText = ""
    location: ProfileText = ""

    def submitted_profile_fields(self) -> dict[str, str]:
        profile_fields = set(accounts.PROFILE_SURVEY_FIELDS)
        return {
            field: getattr(self, field)
            for field in self.model_fields_set & profile_fields
        }


class RegisterRequest(APIModel):
    email: EmailStr
    password: Password

    @field_validator("email")
    @classmethod
    def verify_email_domain(cls, value: str) -> str:
        try:
            validated = validate_email(
                value,
                check_deliverability=True,
                dns_resolver=email_dns_resolver,
            )
            # email-validator deliberately permits DNS timeouts/no-nameserver
            # responses. Registration is stricter: do not issue an account
            # unless an MX (or permitted A/AAAA fallback) was actually found.
            if not getattr(validated, "mx", None):
                raise ValueError("The email domain could not be verified.")
            return validated.normalized
        except EmailNotValidError as error:
            raise ValueError("Enter an email address with a valid mail domain.") from error


class LoginRequest(APIModel):
    email: EmailStr
    password: Password


class PasswordCheckRequest(APIModel):
    password: PasswordForCheck


@app.post("/auth/register", status_code=status.HTTP_201_CREATED)
@limiter.limit("5/minute")
def register(request: Request, req: RegisterRequest, user_conn=Depends(get_user_db)):
    if not accounts.password_meets_policy(req.password):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Use at least 12 characters and at least three of: lowercase, uppercase, number, symbol.",
        )
    try:
        user_id = accounts.create_user(user_conn, req.email, req.password)
    except sqlite3.IntegrityError:
        # Do not reveal whether an address is already registered.
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Unable to create account")
    return {"access_token": accounts.create_access_token(user_id), "token_type": "bearer"}


@app.post("/auth/login")
@limiter.limit("5/minute")
def login(request: Request, req: LoginRequest, user_conn=Depends(get_user_db)):
    user = accounts.get_user_by_email(user_conn, req.email)
    if not user or not accounts.verify_password(req.password, user["password_hash"]):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Incorrect email or password")
    return {"access_token": accounts.create_access_token(user["id"]), "token_type": "bearer"}


@app.post("/auth/password-strength")
@limiter.limit("30/minute")
def password_strength(request: Request, req: PasswordCheckRequest):
    return accounts.password_strength_score(req.password)


@app.get("/auth/me")
@limiter.limit("20/minute")
def get_me(request: Request, current_user=Depends(get_current_user)):
    return {"id": current_user["id"], "email": current_user["email"], "created_at": current_user["created_at"]}


@app.delete("/auth/me", status_code=status.HTTP_204_NO_CONTENT)
@limiter.limit("5/minute")
def delete_me(
    request: Request,
    req: PasswordCheckRequest,
    current_user=Depends(get_current_user),
    user_conn=Depends(get_user_db),
):
    if not accounts.verify_password(req.password, current_user["password_hash"]):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Incorrect email or password")
    accounts.delete_user(user_conn, current_user["id"])
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@app.post("/auth/profile")
@limiter.limit("20/minute")
def update_profile(
    request: Request,
    req: ProfileSurveyRequest,
    current_user=Depends(get_current_user),
    user_conn=Depends(get_user_db),
):
    accounts.save_user_profile_survey(user_conn, current_user["id"], req.model_dump())
    return {"status": "success", "message": "Profile updated successfully"}


@app.get("/auth/profile")
@limiter.limit("20/minute")
def get_profile(request: Request, current_user=Depends(get_current_user), user_conn=Depends(get_user_db)):
    return accounts.get_user_profile_survey(user_conn, current_user["id"])


@app.post("/spellcheck")
@limiter.limit("60/minute")
def spellcheck(request: Request, req: SpellcheckRequest):
    return core.spellcheck_text(req.text)


@app.post("/recommendations")
@limiter.limit("10/minute")
def recommendations(request: Request, req: RecommendationRequest, cache_conn=Depends(get_cache_db)):
    return run_recommendation(
        core.get_baseline_recommendations, cache_conn, req.strengths, req.weaknesses, req.interests
    )


@app.post("/recommendations/personalized")
@limiter.limit("10/minute")
def personalized_recommendations(
    request: Request,
    req: PersonalizedRecommendationRequest,
    current_user=Depends(get_current_user),
    user_conn=Depends(get_user_db),
    cache_conn=Depends(get_cache_db),
):
    user_id = current_user["id"]
    profile = accounts.get_user_profile_survey(user_conn, user_id)
    # Explicit request values override saved values without silently storing
    # sensitive information submitted only for this recommendation.
    profile.update(req.submitted_profile_fields())
    if not accounts.has_active_profile_survey(profile):
        return run_recommendation(
            core.get_baseline_recommendations, cache_conn, req.strengths, req.weaknesses, req.interests,
            user_id=user_id,
        )
    return run_recommendation(
        core.get_personalized_career_advice, req.strengths, req.weaknesses, req.interests, profile,
        user_id=user_id,
    )


@app.post("/recommendations/cancel")
@limiter.limit("30/minute")
def cancel_recommendation(
    request: Request,
    current_user=Depends(get_current_user),
):
    user_id = current_user["id"]
    event = _cancel_events.get(user_id)
    if event:
        event.set()
    return {"status": "cancelled"}


@app.post("/recommendations/workday")
@limiter.limit("20/minute")
def workday_summary(request: Request, req: WorkdayRequest, conn=Depends(get_cache_db)):
    return run_recommendation(
        core.get_workday_summary, req.job_title, req.job_description, conn=conn
    )


@app.post("/recommendations/regenerate")
@limiter.limit("10/minute")
def regenerate_recommendations(
    request: Request,
    req: RegenerateRequest,
    current_user=Depends(get_current_user_optional),
    user_conn=Depends(get_user_db),
    cache_conn=Depends(get_cache_db),
):
    profile = None
    user_id = current_user
    if user_id is not None:
        saved = accounts.get_user_profile_survey(user_conn, user_id)
        if accounts.has_active_profile_survey(saved):
            profile = saved
    return run_recommendation(
        core.get_regenerated_recommendations,
        cache_conn,
        req.strengths,
        req.weaknesses,
        req.interests,
        profile,
        user_id=user_id,
    )


@app.get("/health")
@limiter.limit("60/minute")
def health(request: Request):
    """Confirms the API is running; model availability is checked on generation."""
    return {"status": "ok"}


'''from fastapi.staticfiles import StaticFiles

# Mount after your other API endpoints
app.mount("/", StaticFiles(directory="static", html=True), name="static")'''
