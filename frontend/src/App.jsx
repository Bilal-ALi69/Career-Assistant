import React, { useState, useEffect, useRef } from "react";
import {
  Sparkles, Lock, Bookmark, Zap, BookOpen, TrendingUp, Sun, Moon,
  Briefcase, BarChart3, User, MapPin, GraduationCap, Heart, Flame,
  Accessibility, CheckCircle2, Circle, Shield, SlidersHorizontal,
  Activity, Pencil, Download, Trash2, ChevronDown,
  LogOut, ArrowDown, Loader2, Brain, Target, Languages as LanguagesIcon,
  XCircle, Save,
} from "lucide-react";
import { API_BASE, login, register, getAccount, deleteAccount, getProfile, updateProfile, fetchRecommendations, cancelRecommendation } from "./lib/api";
import { PROFILE_FIELD_GROUPS } from "./lib/profileFields";
import { loadSavedJobs, persistSavedJobs, jobId } from "./lib/savedJobs";
import { loadLocalProfile, saveLocalProfile, clearLocalProfile } from "./lib/localProfile";
import { loadJobHistory, appendJobHistory } from "./lib/jobHistory";
import PasswordStrengthMeter from "./components/PasswordStrengthMeter";
import SignupSurvey from "./components/SignupSurvey";
import ProfileField from "./components/ProfileField";
import PasswordInput from "./components/PasswordInput";
import {
  ChangePasswordModal, TwoFactorModal, SessionsModal, LanguageModal, EmailPreferencesModal,
} from "./components/AccountSettingsModal";

/* ---------------------------------------------------------
   DATA
--------------------------------------------------------- */

const SIGNIN_ITEMS = [
  { icon: Lock, title: "Unlock full profile analysis", desc: "Get deep AI insights about your skills and match accuracy." },
  { icon: Bookmark, title: "Save unlimited roadmaps", desc: "Create, save and access as many career roadmaps as you want." },
  { icon: Zap, title: "Get priority AI processing", desc: "Faster analysis and smarter recommendations." },
  { icon: BookOpen, title: "Access curated resources", desc: "Exclusive guides, courses and tools handpicked for you." },
  { icon: TrendingUp, title: "Track your career progress", desc: "Monitor growth, achievements and stay on track." },
];

const JOBS = [
  { match: 98, top: true, title: "Product Strategy Lead", salary: "$120k - $210k/yr", desc: "Drive product vision and strategy to deliver impactful solutions that solve real user problems." },
  { match: 92, title: "Data Science Manager", salary: "$115k - $190k/yr", desc: "Lead data initiatives and teams to build scalable models and insights that drive business growth." },
  { match: 90, title: "AI Solutions Architect", salary: "$130k - $200k/yr", desc: "Design and implement AI-powered solutions that solve complex business challenges." },
  { match: 87, title: "Machine Learning Engineer", salary: "$110k - $185k/yr", desc: "Build, train, and deploy machine learning models that create real world impact." },
  { match: 85, title: "Business Intelligence Analyst", salary: "$85k - $130k/yr", desc: "Transform data into actionable insights to support strategic decision making." },
  { match: 83, title: "UX Researcher", salary: "$90k - $140k/yr", desc: "Understand user needs and behaviors to shape intuitive and impactful product experiences." },
];

const SKILLS_TABS = ["Overview", "Personal", "Professional", "Preferences", "Personality", "Goals", "Other Info"];

// Signed-out visitors get the 3-field teaser below. Once signed in, the
// gate is unlocked (per SIGNIN_ITEMS' "Unlock full profile analysis") and
// Home shows the full Personality + Goals trait set instead — pre-filled
// from the user's saved profile survey where available.
const PERSONALITY_GROUP = PROFILE_FIELD_GROUPS.find((g) => g.key === "personality");
const GOALS_GROUP = PROFILE_FIELD_GROUPS.find((g) => g.key === "goals");
const SIGNED_IN_HOME_FIELDS = [...PERSONALITY_GROUP.fields, ...GOALS_GROUP.fields];

/* ---------------------------------------------------------
   THEME TOKENS
--------------------------------------------------------- */

function useTokens(dark) {
  return {
    bg: dark ? "bg-[#070A13]" : "bg-white",
    bgAlt: dark ? "bg-[#0B0F1C]" : "bg-gray-50",
    card: dark ? "bg-[#0F1526] border border-slate-800/80" : "bg-white border border-gray-200",
    cardAlt: dark ? "bg-[#0B0F1C] border border-slate-800/60" : "bg-gray-50 border border-gray-200",
    text: dark ? "text-slate-100" : "text-slate-900",
    textMuted: dark ? "text-slate-400" : "text-slate-500",
    textFaint: dark ? "text-slate-500" : "text-slate-400",
    border: dark ? "border-slate-800/80" : "border-gray-200",
    divide: dark ? "divide-slate-800/80" : "divide-gray-200",
    hover: dark ? "hover:bg-slate-800/40" : "hover:bg-gray-50",
    input: dark ? "bg-[#0B0F1C] border-slate-800 text-slate-100 placeholder-slate-500" : "bg-white border-gray-300 text-slate-900 placeholder-slate-400",
  };
}

const cx = (...a) => a.filter(Boolean).join(" ");

/* ---------------------------------------------------------
   SMALL PRIMITIVES
--------------------------------------------------------- */

function Pill({ children, dark, tone = "blue" }) {
  const tones = {
    blue: dark ? "bg-blue-500/10 text-blue-400 border-blue-500/20" : "bg-blue-50 text-blue-600 border-blue-200",
    green: dark ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" : "bg-emerald-50 text-emerald-600 border-emerald-200",
    red: dark ? "bg-red-500/10 text-red-400 border-red-500/20" : "bg-red-50 text-red-600 border-red-200",
  };
  return (
    <span className={cx("inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium border", tones[tone])}>
      {children}
    </span>
  );
}

function Button({ children, onClick, variant = "primary", className = "", dark, ...rest }) {
  const base = "inline-flex items-center justify-center gap-2 rounded-xl font-semibold transition-all duration-200 ease-[cubic-bezier(0.34,1.56,0.64,1)] active:scale-[0.97] focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2";
  const variants = {
    primary: "bg-blue-600 hover:bg-blue-500 text-white shadow-lg shadow-blue-600/20 hover:shadow-blue-500/30 hover:-translate-y-0.5 px-5 py-3",
    ghost: dark ? "text-slate-300 hover:bg-slate-800/60 px-4 py-2" : "text-slate-600 hover:bg-gray-100 px-4 py-2",
    danger: "text-red-500 hover:bg-red-500/10 px-4 py-2",
    outline: dark ? "border border-slate-700 text-slate-200 hover:bg-slate-800/60 px-4 py-2" : "border border-gray-300 text-slate-700 hover:bg-gray-50 px-4 py-2",
  };
  return (
    <button onClick={onClick} className={cx(base, variants[variant], className)} {...rest}>
      {children}
    </button>
  );
}

/* ---------------------------------------------------------
   AUTH MODAL — real calls to /auth/login and /auth/register
--------------------------------------------------------- */

function AuthModal({ dark, tokens, onClose, onAuthed, onRegistered }) {
  const [mode, setMode] = useState("login"); // "login" | "register"
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const MIN_PASSWORD_LENGTH = 12;

  const submit = async (e) => {
    e.preventDefault();
    if (mode === "register" && password.length < MIN_PASSWORD_LENGTH) {
      setError(`Password must be at least ${MIN_PASSWORD_LENGTH} characters.`);
      return;
    }
    setLoading(true);
    setError("");
    try {
      const data = mode === "login" ? await login(email, password) : await register(email, password);
      const token = data.access_token || data.token;
      if (!token) throw new Error("No token returned by server");
      if (mode === "register") {
        onRegistered(token, email);
      } else {
        onAuthed(token, email);
      }
    } catch (err) {
      setError(err.message || "Something went wrong. Is your FastAPI server running?");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm px-4 animate-overlay-in" onClick={onClose}>
      <div
        className={cx("w-full max-w-sm rounded-2xl p-6 shadow-2xl animate-modal-in", dark ? "bg-[#0F1526] border border-slate-800" : "bg-white border border-gray-200")}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-2 mb-5">
          <button
            onClick={() => { setMode("login"); setError(""); }}
            className={cx("text-sm font-semibold pb-1 border-b-2", mode === "login" ? "border-blue-500 text-blue-500" : cx("border-transparent", tokens.textMuted))}
          >
            Sign In
          </button>
          <button
            onClick={() => { setMode("register"); setError(""); }}
            className={cx("text-sm font-semibold pb-1 border-b-2", mode === "register" ? "border-blue-500 text-blue-500" : cx("border-transparent", tokens.textMuted))}
          >
            Create Account
          </button>
        </div>

        <form onSubmit={submit} className="space-y-3">
          <LabeledInput label="Email" type="email" required value={email}
            onChange={(e) => setEmail(e.target.value)} tokens={tokens} />
          <div>
            <PasswordInput label="Password" required value={password}
              onChange={(e) => setPassword(e.target.value)} tokens={tokens}
              minLength={mode === "register" ? MIN_PASSWORD_LENGTH : undefined} />
            {mode === "register" && (
              <PasswordStrengthMeter password={password} dark={dark} tokens={tokens} minLength={MIN_PASSWORD_LENGTH} />
            )}
          </div>

          {error && <p className="text-xs text-red-500">{error}</p>}

          <Button className="w-full mt-2" disabled={loading}>
            {loading ? <Loader2 size={15} className="animate-spin" /> : null}
            {mode === "login" ? "Sign In" : "Create Account"}
          </Button>
        </form>

        <p className={cx("text-xs text-center mt-4", tokens.textFaint)}>
          Connects to {API_BASE}{mode === "login" ? "/auth/login" : "/auth/register"}
        </p>
      </div>
    </div>
  );
}

/* ---------------------------------------------------------
   CONFIRM POPUP — same shell/styling as the auth modal, reused
   for "want us to regenerate your job suggestions?" prompts.
--------------------------------------------------------- */

function ConfirmPopup({ dark, tokens, title, message, confirmLabel = "Yes", cancelLabel = "No", onConfirm, onCancel }) {
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm px-4 animate-overlay-in" onClick={onCancel}>
      <div
        className={cx("w-full max-w-sm rounded-2xl p-6 shadow-2xl animate-modal-in", dark ? "bg-[#0F1526] border border-slate-800" : "bg-white border border-gray-200")}
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className={cx("text-base font-semibold mb-2", tokens.text)}>{title}</h3>
        <p className={cx("text-sm mb-5", tokens.textMuted)}>{message}</p>
        <div className="flex gap-2">
          <Button variant="outline" dark={dark} className="flex-1" onClick={onCancel}>{cancelLabel}</Button>
          <Button className="flex-1" onClick={onConfirm}>{confirmLabel}</Button>
        </div>
      </div>
    </div>
  );
}

/* ---------------------------------------------------------
   SIGN-IN PROMO (dropdown / gated card)
--------------------------------------------------------- */

function SignInList({ dark, compact }) {
  return (
    <div className="space-y-4">
      {SIGNIN_ITEMS.map((item, i) => (
        <div key={i} className="flex items-start gap-3">
          <div className={cx("mt-0.5 h-7 w-7 shrink-0 rounded-lg flex items-center justify-center", dark ? "bg-blue-500/10 text-blue-400" : "bg-blue-50 text-blue-600")}>
            <item.icon size={15} />
          </div>
          <div>
            <p className={cx("text-sm font-medium", dark ? "text-slate-200" : "text-slate-800")}>{item.title}</p>
            {!compact && <p className={cx("text-xs mt-0.5", dark ? "text-slate-500" : "text-slate-500")}>{item.desc}</p>}
          </div>
        </div>
      ))}
    </div>
  );
}

function SignInDropdown({ dark, onSignIn, tokens }) {
  return (
    <div className={cx("absolute right-0 top-[calc(100%+10px)] w-80 rounded-2xl p-5 shadow-2xl z-50 animate-drop-in", tokens.card, "backdrop-blur-xl")}>
      <p className={cx("text-sm font-semibold mb-4", tokens.text)}>Why sign in?</p>
      <SignInList dark={dark} />
      <Button onClick={onSignIn} className="w-full mt-5">Sign In</Button>
    </div>
  );
}

function GatedCard({ dark, tokens, icon: Icon, title, subtitle, onSignIn }) {
  return (
    <div className="max-w-xl mx-auto text-center py-16 px-4">
      <div className={cx("mx-auto h-14 w-14 rounded-2xl flex items-center justify-center mb-6", dark ? "bg-blue-500/10 text-blue-400" : "bg-blue-50 text-blue-600")}>
        <Icon size={26} />
      </div>
      <h2 className={cx("text-2xl font-bold mb-2", tokens.text)}>{title}</h2>
      <p className={cx("text-sm mb-8", tokens.textMuted)}>{subtitle}</p>
      <div className={cx("rounded-2xl p-6 text-left", tokens.card)}>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {SIGNIN_ITEMS.map((item, i) => (
            <div key={i} className="flex items-center gap-2.5">
              <item.icon size={15} className={dark ? "text-blue-400" : "text-blue-600"} />
              <span className={cx("text-sm", dark ? "text-slate-300" : "text-slate-700")}>{item.title}</span>
            </div>
          ))}
        </div>
        <Button onClick={onSignIn} className="w-full mt-6">Sign In</Button>
      </div>
    </div>
  );
}

/* ---------------------------------------------------------
   NAVBAR
--------------------------------------------------------- */

function Navbar({ dark, setDark, page, setPage, signedIn, openAuth, signOut, tokens, trackAction, autoDropdown, hasResults }) {
  const [showDrop, setShowDrop] = useState(false);
  const [showTitleTip, setShowTitleTip] = useState(false);
  const [titleTipArmed, setTitleTipArmed] = useState(true);
  const dropVisible = showDrop || autoDropdown;
  useEffect(() => {
    if (autoDropdown && titleTipArmed) {
      setShowTitleTip(true);
      const t = setTimeout(() => setShowTitleTip(false), 4500);
      return () => clearTimeout(t);
    }
  }, [autoDropdown, titleTipArmed]);
  const navItems = [
    { key: "jobs-nav", label: "My Jobs", icon: Briefcase },
    { key: "skills", label: "Skills & Traits", icon: BarChart3 },
    { key: "account", label: "Account", icon: User },
  ];
  return (
    <header className={cx("sticky top-0 z-40 backdrop-blur-xl border-b", dark ? "bg-[#070A13]/80 border-slate-800/80" : "bg-white/80 border-gray-200")}>
      <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
        {signedIn ? (
          <span className={cx("text-lg font-bold tracking-tight", tokens.text)}>
            Career <span className="text-blue-500">Assistant</span>
          </span>
        ) : (
          <div className="relative">
            <button
              onClick={() => {
                setPage(hasResults ? "jobs" : "home");
                setShowTitleTip(false);
                setTitleTipArmed(false);
              }}
              className={cx("text-lg font-bold tracking-tight transition-all duration-200 hover:scale-110 hover:drop-shadow-[0_0_10px_rgba(59,130,246,0.6)]", tokens.text)}
            >
              Career <span className="text-blue-500">Assistant</span>
            </button>
            {showTitleTip && (
              <div className={cx("absolute left-1/2 -translate-x-1/2 top-[calc(100%+8px)] whitespace-nowrap rounded-xl px-4 py-2 text-xs font-medium shadow-xl z-50 animate-drop-in", dark ? "bg-slate-800 text-slate-200" : "bg-white text-slate-700 border border-gray-200")}>
                Tap to go to Home Screen
              </div>
            )}
          </div>
        )}

        <nav className="hidden md:flex items-center gap-1">
          {navItems.map((item) => (
            <button
              key={item.key}
              onClick={() => {
                trackAction();
                setPage(item.key);
                if (!signedIn) setTitleTipArmed(true);
              }}
              className={cx(
                "flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-sm font-medium transition-colors",
                page === item.key ? "text-blue-500" : cx(tokens.textMuted, tokens.hover)
              )}
            >
              <item.icon size={15} />
              {item.label}
            </button>
          ))}
        </nav>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setDark(!dark)}
            className={cx("h-9 w-9 rounded-lg flex items-center justify-center transition-colors", tokens.hover, tokens.textMuted)}
            aria-label="Toggle theme"
          >
            {dark ? <Sun size={16} /> : <Moon size={16} />}
          </button>

          {signedIn ? (
            <Button variant="outline" dark={dark} onClick={signOut}>
              <LogOut size={14} /> Sign Out
            </Button>
          ) : (
            <div className="relative">
              <Button onClick={() => setShowDrop((s) => !s)}>Sign In</Button>
              {dropVisible && (
                <SignInDropdown
                  dark={dark}
                  tokens={tokens}
                  onSignIn={() => { openAuth(); setShowDrop(false); }}
                />
              )}
            </div>
          )}
        </div>
      </div>
    </header>
  );
}

/* ---------------------------------------------------------
   HOME PAGE
--------------------------------------------------------- */

function HomePage({ dark, tokens, signedIn, openAuth, goAnalyze, profile, initialValues }) {
  // Signed-out teaser: exactly the original 3 quick fields.
  const [strengths, setStrengths] = useState(initialValues?.strengths || "");
  const [weaknesses, setWeaknesses] = useState(initialValues?.weaknesses || "");
  const [interests, setInterests] = useState(initialValues?.interests || "");

  // Signed-in: the unlocked, larger trait set (Personality + Goals fields),
  // pre-filled from the saved profile survey when the field is blank.
  const [signedInValues, setSignedInValues] = useState(() => {
    const v = {};
    SIGNED_IN_HOME_FIELDS.forEach((f) => { v[f.key] = initialValues?.[f.key] ?? profile?.[f.key] ?? ""; });
    return v;
  });
  const setSignedInValue = (key, value) => setSignedInValues((d) => ({ ...d, [key]: value }));

  const handleAnalyze = () => {
    if (signedIn) goAnalyze(signedInValues);
    else goAnalyze({ strengths, weaknesses, interests });
  };

  const fields = [
    { label: "Strengths", value: strengths, set: setStrengths, placeholder: "e.g. Problem solving, Leadership, Communication...", tone: "green", icon: Sparkles },
    { label: "Weaknesses", value: weaknesses, set: setWeaknesses, placeholder: "e.g. Public speaking, Time management, Perfectionism...", tone: "red", icon: Target },
    { label: "Interests", value: interests, set: setInterests, placeholder: "e.g. AI, Design, Startups, Data Science...", tone: "blue", icon: Brain },
  ];

  const toneClasses = {
    green: dark ? "border-emerald-800/60 focus-within:border-emerald-500" : "border-emerald-200 focus-within:border-emerald-500",
    red: dark ? "border-red-900/60 focus-within:border-red-500" : "border-red-200 focus-within:border-red-500",
    blue: dark ? "border-blue-900/60 focus-within:border-blue-500" : "border-blue-200 focus-within:border-blue-500",
  };
  const toneIcon = {
    green: dark ? "text-emerald-400" : "text-emerald-600",
    red: dark ? "text-red-400" : "text-red-600",
    blue: dark ? "text-blue-400" : "text-blue-600",
  };

  return (
    <div className="relative max-w-6xl mx-auto px-6 py-14 flex flex-col lg:flex-row items-center justify-center gap-12">
      <div className="flex-1 text-center lg:text-left">
        <Pill dark={dark} tone="blue">AI-POWERED</Pill>
        <h1 className={cx("text-4xl sm:text-5xl font-extrabold mt-5 leading-[1.1] tracking-tight", tokens.text)}>
          Your Career,<br />
          <span className="text-blue-500">Intelligently Guided.</span>
        </h1>
        <p className={cx("mt-4 text-base max-w-md mx-auto lg:mx-0", tokens.textMuted)}>
          Discover the right opportunities, built around your unique skills and goals.
        </p>
      </div>

      <div className={cx("flex-shrink-0 rounded-2xl p-6 w-full max-w-md text-left", tokens.card)}>
        <p className={cx("font-semibold mb-4", tokens.text)}>
          {signedIn ? "Tell us more about yourself" : "Tell us about yourself"}
        </p>

        {signedIn ? (
          <div className="space-y-3">
            {SIGNED_IN_HOME_FIELDS.map((f) => (
              <ProfileField key={f.key} field={f} value={signedInValues[f.key]} onChange={setSignedInValue} tokens={tokens} />
            ))}
          </div>
        ) : (
          <div className="space-y-3">
            {fields.map((f) => (
              <div key={f.label} className={cx("rounded-xl border-2 px-4 py-3 transition-colors", tokens.bgAlt, toneClasses[f.tone])}>
                <label className={cx("flex items-center gap-1.5 text-xs font-semibold mb-1", toneIcon[f.tone])}>
                  <f.icon size={13} /> {f.label}
                </label>
                <input
                  value={f.value}
                  onChange={(e) => f.set(e.target.value)}
                  placeholder={f.placeholder}
                  className={cx("w-full bg-transparent outline-none text-sm", tokens.text, dark ? "placeholder-slate-600" : "placeholder-slate-400")}
                />
              </div>
            ))}
          </div>
        )}

        <Button onClick={handleAnalyze} className="w-full mt-5">
          <Sparkles size={16} /> Analyze My Profile
        </Button>
      </div>
    </div>
  );
}

/* ---------------------------------------------------------
   ANALYZING PAGE
--------------------------------------------------------- */

function AnalyzingPage({ dark, tokens, onDone, onCancel, formValues, signedIn, token }) {
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState("");
  const [cancelling, setCancelling] = useState(false);
  const [statusIdx, setStatusIdx] = useState(0);
  const [fade, setFade] = useState(true);
  const doneRef = useRef(false);

  const statuses = [
    "Connecting to AI...",
    "Analyzing your strengths...",
    "Evaluating weaknesses...",
    "Exploring interest areas...",
    "Matching career paths...",
    "Generating recommendations...",
    "Almost there...",
  ];

  useEffect(() => {
    const interval = setInterval(() => {
      setProgress((p) => {
        if (doneRef.current) return p;
        if (p < 15) return p + 0.8;
        if (p < 40) return p + 0.3;
        if (p < 60) return p + 0.15;
        if (p < 75) return p + 0.08;
        return Math.min(75, p + 0.04);
      });
    }, 200);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const fadeTimer = setInterval(() => {
      setFade(false);
      setTimeout(() => {
        setStatusIdx((i) => (i + 1) % statuses.length);
        setFade(true);
      }, 400);
    }, 2800);
    return () => clearInterval(fadeTimer);
  }, [statuses.length]);

  useEffect(() => {
    let cancelled = false;
    const controller = new AbortController();

    fetchRecommendations({ signedIn, token, formValues, signal: controller.signal })
      .then((data) => {
        if (cancelled) return;
        doneRef.current = true;
        setProgress(100);
        setTimeout(() => onDone(data), 800);
      })
      .catch((err) => {
        if (cancelled) return;
        if (err.name === "AbortError") return;
        doneRef.current = true;
        setProgress(100);
        setError(`${err.message}. Showing demo results instead — check your FastAPI server is running at ${API_BASE}.`);
        setTimeout(() => onDone(null), 1400);
      });

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [onDone, formValues, signedIn, token]);

  const cancelGeneration = () => {
    setCancelling(true);
    onCancel();
  };

  const circumference = 2 * Math.PI * 54;
  const offset = circumference * (1 - progress / 100);

  return (
    <div className="min-h-[calc(100vh-0px)] flex items-center justify-center px-6 py-16">
      <div className="max-w-lg w-full flex flex-col items-center text-center">
        <div className={cx("h-10 w-10 rounded-xl flex items-center justify-center mb-5", dark ? "bg-blue-500/10 text-blue-400" : "bg-blue-50 text-blue-600")}>
          <Sparkles size={20} />
        </div>
        <h1 className={cx("text-2xl font-bold", tokens.text)}>
          Career <span className="text-blue-500">Assistant</span>
        </h1>

        <div className="relative h-40 w-40 my-8">
          <svg className="h-full w-full -rotate-90" viewBox="0 0 120 120">
            <circle cx="60" cy="60" r="54" fill="none" stroke={dark ? "#1e293b" : "#e5e7eb"} strokeWidth="8" />
            <circle
              cx="60" cy="60" r="54" fill="none" stroke="#3b82f6" strokeWidth="8" strokeLinecap="round"
              strokeDasharray={circumference} strokeDashoffset={offset}
              style={{ transition: "stroke-dashoffset 0.2s linear" }}
            />
          </svg>
          <div className="absolute inset-0 flex items-center justify-center">
            <span className={cx("text-3xl font-bold", tokens.text)}>{Math.round(progress)}%</span>
          </div>
        </div>

        <div className={cx("h-6 text-sm transition-opacity duration-400", fade ? "opacity-100" : "opacity-0", tokens.textMuted)}>
          {statuses[statusIdx]}
        </div>

        {error && (
          <p className={cx("text-xs mt-6 max-w-xs", dark ? "text-amber-400" : "text-amber-600")}>{error}</p>
        )}

        <button
          onClick={cancelGeneration}
          disabled={cancelling}
          className={cx(
            "mt-9 inline-flex items-center gap-1.5 text-sm font-medium transition-colors disabled:opacity-50",
            dark ? "text-slate-400 hover:text-red-400" : "text-slate-500 hover:text-red-500"
          )}
        >
          <XCircle size={15} /> {cancelling ? "Cancelling…" : "Cancel"}
        </button>
      </div>
    </div>
  );
}

/* ---------------------------------------------------------
   JOBS PAGE
--------------------------------------------------------- */

function JobsPage({ dark, tokens, results, signedIn, openAuth, savedJobIds, onToggleSave, onReEnter, onRegenerate, formValues }) {
  const [showMoreMenu, setShowMoreMenu] = useState(false);
  const [showTraits, setShowTraits] = useState(false);
  const moreMenuRef = useRef(null);

  const toggleMoreMenu = () => {
    setShowMoreMenu((s) => {
      const next = !s;
      if (next) {
        setTimeout(() => {
          moreMenuRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
        }, 50);
      }
      return next;
    });
  };

  // Normalizes whatever shape your backend returns into { match, top, title, salary, desc }.
  // Adjust this mapping to match your actual /recommendations response fields.
  const jobs = results && Array.isArray(results.jobs) && results.jobs.length > 0
    ? results.jobs.map((j, i) => ({
        match: j.match ?? j.confidence ?? j.score ?? 90 - i,
        top: i === 0,
        title: j.title ?? j.job_title ?? j.name ?? "Untitled role",
        salary: j.salary ?? j.est_salary ?? "—",
        desc: j.justification ?? j.description ?? j.reason ?? "",
      }))
    : JOBS;

  const handleBookmark = (job) => {
    if (!signedIn) { openAuth(); return; }
    onToggleSave(job);
  };

  return (
    <div className="max-w-5xl mx-auto px-6 py-12">
      <h1 className={cx("text-2xl font-bold", tokens.text)}>Recommended Jobs For You</h1>
      <p className={cx("text-sm mt-1", tokens.textMuted)}>
        {results ? "Based on your skills and interests" : "Demo data — connect your backend to see real results"}
      </p>

      <button
        onClick={() => setShowTraits((s) => !s)}
        className={cx("mt-4 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors", tokens.hover, dark ? "text-slate-400" : "text-slate-500")}
      >
        <SlidersHorizontal size={13} />
        {showTraits ? "Hide traits" : "Show traits used"}
      </button>

      {showTraits && formValues && (
        <div className={cx("mt-3 rounded-xl p-4 max-w-md animate-drop-in", tokens.card)}>
          <p className={cx("text-xs font-semibold mb-3", tokens.textMuted)}>
            {signedIn ? "Full profile data used by AI" : "Traits you entered"}
          </p>
          <div className="space-y-2">
            {signedIn ? (
              SIGNED_IN_HOME_FIELDS.filter((f) => formValues[f.key]?.trim()).map((f) => (
                <div key={f.key}>
                  <span className={cx("text-xs font-medium", dark ? "text-slate-400" : "text-slate-500")}>{f.label}</span>
                  <p className={cx("text-sm", tokens.text)}>{formValues[f.key]}</p>
                </div>
              ))
            ) : (
              <>
                {formValues.strengths?.trim() && (
                  <div>
                    <span className="text-xs font-medium text-emerald-500">Strengths</span>
                    <p className={cx("text-sm", tokens.text)}>{formValues.strengths}</p>
                  </div>
                )}
                {formValues.weaknesses?.trim() && (
                  <div>
                    <span className="text-xs font-medium text-red-500">Weaknesses</span>
                    <p className={cx("text-sm", tokens.text)}>{formValues.weaknesses}</p>
                  </div>
                )}
                {formValues.interests?.trim() && (
                  <div>
                    <span className="text-xs font-medium text-blue-500">Interests</span>
                    <p className={cx("text-sm", tokens.text)}>{formValues.interests}</p>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      )}

      <div className="mt-8 space-y-4">
        {jobs.map((job, i) => {
          const id = jobId(job);
          const saved = savedJobIds.has(id);
          return (
            <div key={i} className={cx("rounded-2xl p-5 flex items-start justify-between gap-4 transition-all duration-200 ease-out hover:-translate-y-0.5 hover:shadow-lg", tokens.card)}>
              <div>
                <div className="flex items-center gap-2 mb-1.5">
                  <span className="text-blue-500 text-sm font-bold">{job.match}% Match</span>
                  {job.top && <Pill dark={dark} tone="blue">Top Match</Pill>}
                </div>
                <h3 className={cx("font-semibold text-lg", tokens.text)}>{job.title}</h3>
                <p className={cx("text-sm mt-1 max-w-xl", tokens.textMuted)}>{job.desc}</p>
              </div>
              <div className="text-right shrink-0 flex flex-col items-end gap-3">
                <div>
                  <p className={cx("text-xs", tokens.textFaint)}>Est. Salary</p>
                  <p className={cx("text-sm font-semibold", tokens.text)}>{job.salary}</p>
                </div>
                <button
                  onClick={() => handleBookmark({ ...job, id })}
                  aria-label={saved ? "Remove from saved jobs" : "Save job"}
                  className={cx("h-8 w-8 rounded-lg flex items-center justify-center transition-colors", tokens.hover, saved ? "text-blue-500" : tokens.textMuted)}
                >
                  <Bookmark size={16} fill={saved ? "currentColor" : "none"} />
                </button>
              </div>
            </div>
          );
        })}
      </div>

      <div ref={moreMenuRef} className="flex justify-center mt-8 relative">
        <Button variant="outline" dark={dark} onClick={toggleMoreMenu}>
          View More Opportunities <ChevronDown size={15} />
        </Button>
        {showMoreMenu && (
          <div className={cx("absolute top-[calc(100%+10px)] w-80 rounded-2xl p-2 shadow-2xl z-30 animate-drop-in", tokens.card)}>
            <button
              onClick={() => { setShowMoreMenu(false); onReEnter(); }}
              className={cx("w-full text-left px-4 py-3 rounded-xl text-sm font-medium transition-colors", tokens.hover, tokens.text)}
            >
              Re-enter skills &amp; traits
            </button>
            <button
              onClick={() => { setShowMoreMenu(false); onRegenerate(); }}
              className={cx("w-full text-left px-4 py-3 rounded-xl text-sm font-medium transition-colors", tokens.hover, tokens.text)}
            >
              Regenerate suggestions directly
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

/* ---------------------------------------------------------
   MY JOBS PAGE (gated)
--------------------------------------------------------- */

function MyJobsPage({ dark, tokens, signedIn, openAuth, onViewSession, results }) {
  const history = loadJobHistory();

  if (!signedIn) {
    if (results) {
      return (
        <div className="max-w-5xl mx-auto px-6 py-12">
          <h1 className={cx("text-2xl font-bold", tokens.text)}>My Jobs</h1>
          <p className={cx("text-sm mt-1", tokens.textMuted)}>Sign in to save and track your job sessions.</p>
          <div className="mt-6">
            <Button onClick={() => onViewSession(results)}>
              <Briefcase size={14} /> View Current Results
            </Button>
          </div>
        </div>
      );
    }
    return <GatedCard dark={dark} tokens={tokens} icon={Briefcase} title="Sign in to view your jobs"
      subtitle="Create and manage your custom job profiles, track progress and revisit your opportunities."
      onSignIn={openAuth} />;
  }
  if (!history.length) {
    return (
      <div className="max-w-3xl mx-auto px-6 py-20 text-center">
        <Briefcase size={28} className={cx("mx-auto mb-4", tokens.textFaint)} />
        <h2 className={cx("text-xl font-bold", tokens.text)}>No job sessions yet</h2>
        <p className={cx("text-sm mt-2", tokens.textMuted)}>Generate job recommendations to see them here.</p>
      </div>
    );
  }
  return (
    <div className="max-w-5xl mx-auto px-6 py-12">
      <h1 className={cx("text-2xl font-bold", tokens.text)}>My Job Sessions</h1>
      <p className={cx("text-sm mt-1", tokens.textMuted)}>Past job recommendation sessions. Tap to view results.</p>

      <div className="mt-8 space-y-3">
        {history.map((session) => {
          const d = new Date(session.date);
          const label = d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
          const time = d.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
          const jobCount = Array.isArray(session.results?.jobs) ? session.results.jobs.length : 0;
          return (
            <div key={session.id} className={cx("rounded-2xl p-5 flex items-center justify-between gap-4", tokens.card)}>
              <div>
                <p className={cx("text-sm font-semibold", tokens.text)}>{label} at {time}</p>
                <p className={cx("text-xs mt-1", tokens.textMuted)}>{jobCount ? `${jobCount} jobs recommended` : "Results available"}</p>
              </div>
              <Button onClick={() => onViewSession(session.results)}>
                <Briefcase size={14} /> View Results
              </Button>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ---------------------------------------------------------
   SKILLS & TRAITS PAGE
--------------------------------------------------------- */

function InfoCard({ tokens, dark, icon: Icon, title, children, tone }) {
  const toneBorder = {
    green: dark ? "border-emerald-800/60" : "border-emerald-200",
    red: dark ? "border-red-900/60" : "border-red-200",
  };
  const toneTitle = {
    green: dark ? "text-emerald-400" : "text-emerald-600",
    red: dark ? "text-red-400" : "text-red-600",
  };
  return (
    <div className={cx("rounded-2xl p-5", tone ? cx(tokens.bgAlt, "border-2", toneBorder[tone]) : tokens.card)}>
      <div className={cx("flex items-center gap-2 text-sm font-semibold mb-3", tone ? toneTitle[tone] : tokens.text)}>
        <Icon size={15} /> {title}
      </div>
      {children}
    </div>
  );
}

function TagRow({ tags, dark, tone = "blue" }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {tags.map((t) => <Pill key={t} dark={dark} tone={tone}>{t}</Pill>)}
    </div>
  );
}

// Splits a comma/newline separated string into clean tags. Backend can send
// either a string ("Python, SQL") or an array — both are handled.
function toTags(value) {
  if (!value) return [];
  if (Array.isArray(value)) return value.filter(Boolean);
  return String(value).split(/[,\n]/).map((s) => s.trim()).filter(Boolean);
}

function SkillsOverview({ dark, tokens, profile }) {
  const p = profile || {};
  const hasAny = Object.values(p).some((v) => String(v ?? "").trim());

  if (!hasAny) {
    return (
      <div className={cx("rounded-2xl p-10 text-center", tokens.card)}>
        <User size={24} className={cx("mx-auto mb-3", tokens.textFaint)} />
        <p className={cx("text-sm font-semibold", tokens.text)}>No profile info yet</p>
        <p className={cx("text-sm mt-1", tokens.textMuted)}>Fill in the tabs on the left to help the AI understand you.</p>
      </div>
    );
  }

  return (
    <div className="grid sm:grid-cols-2 gap-4">
      <InfoCard tokens={tokens} dark={dark} icon={MapPin} title="Location">
        <p className={cx("text-sm", tokens.text)}>{p.location || "Not set"}</p>
        <p className={cx("text-xs mt-1", tokens.textMuted)}>
          {p.preferred_work_environments ? `Open to ${p.preferred_work_environments.toLowerCase()} work` : "Preference not set"}
        </p>
      </InfoCard>
      <InfoCard tokens={tokens} dark={dark} icon={GraduationCap} title="Education">
        <p className={cx("text-sm whitespace-pre-line", tokens.text)}>{p.education || "Not set"}</p>
      </InfoCard>
      <InfoCard tokens={tokens} dark={dark} icon={Heart} title="Hobbies">
        {toTags(p.hobbies).length ? (
          <ul className={cx("text-sm space-y-1", tokens.textMuted)}>
            {toTags(p.hobbies).map((h) => <li key={h}>• {h}</li>)}
          </ul>
        ) : <p className={cx("text-sm", tokens.textMuted)}>Not set</p>}
      </InfoCard>
      <InfoCard tokens={tokens} dark={dark} icon={Flame} title="Values">
        {toTags(p.values).length ? (
          <ul className={cx("text-sm space-y-1", tokens.textMuted)}>
            {toTags(p.values).map((h) => <li key={h}>• {h}</li>)}
          </ul>
        ) : <p className={cx("text-sm", tokens.textMuted)}>Not set</p>}
      </InfoCard>
      <InfoCard tokens={tokens} dark={dark} icon={Sparkles} title="Strengths" tone="green">
        {toTags(p.strengths).length ? <TagRow tags={toTags(p.strengths)} dark={dark} tone="green" /> : <p className={cx("text-sm", tokens.textMuted)}>Not set</p>}
      </InfoCard>
      <InfoCard tokens={tokens} dark={dark} icon={Target} title="Weaknesses" tone="red">
        {toTags(p.weaknesses).length ? <TagRow tags={toTags(p.weaknesses)} dark={dark} tone="red" /> : <p className={cx("text-sm", tokens.textMuted)}>Not set</p>}
      </InfoCard>
      <InfoCard tokens={tokens} dark={dark} icon={Brain} title="Interests">
        {toTags(p.interests).length ? <TagRow tags={toTags(p.interests)} dark={dark} tone="blue" /> : <p className={cx("text-sm", tokens.textMuted)}>Not set</p>}
      </InfoCard>
      <InfoCard tokens={tokens} dark={dark} icon={Briefcase} title="Work Preferences">
        <ul className={cx("text-sm space-y-1", tokens.textMuted)}>
          <li>• {p.work_preference || "Not set"}</li>
          <li>• {p.weekly_availability ? `${p.weekly_availability} hrs/week` : "Availability not set"}</li>
          <li>• {p.preferred_work_environments || "No environment preference set"}</li>
        </ul>
      </InfoCard>
      <InfoCard tokens={tokens} dark={dark} icon={LanguagesIcon} title="Languages">
        {toTags(p.languages).length ? <TagRow tags={toTags(p.languages)} dark={dark} tone="blue" /> : <p className={cx("text-sm", tokens.textMuted)}>Not set</p>}
      </InfoCard>
      <InfoCard tokens={tokens} dark={dark} icon={Accessibility} title="Disability (Optional)">
        <p className={cx("text-sm", tokens.textMuted)}>{p.disabilities || "None"}</p>
      </InfoCard>
    </div>
  );
}

function LabeledInput({ label, value, tokens, defaultValue, ...rest }) {
  const controlledProps = defaultValue !== undefined ? { defaultValue } : { value };
  return (
    <div>
      <label className={cx("block text-xs font-medium mb-1.5", tokens.textMuted)}>{label}</label>
      <input {...controlledProps} className={cx("w-full rounded-lg border px-3.5 py-2.5 text-sm outline-none focus:border-blue-500 transition-colors", tokens.input)} {...rest} />
    </div>
  );
}

// Generic editable form for one PROFILE_FIELD_GROUPS section. Reused for
// Personal / Professional / Preferences / Personality / Goals / Other Info.
function ProfileSectionForm({ tokens, dark, group, profile, onSave, saving, onGetSuggestions }) {
  const [draft, setDraft] = useState(() => {
    const initial = {};
    group.fields.forEach((f) => { initial[f.key] = profile?.[f.key] ?? f.defaultValue ?? ""; });
    return initial;
  });
  const [saved, setSaved] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [showSuggestionPrompt, setShowSuggestionPrompt] = useState(false);

  useEffect(() => {
    const initial = {};
    group.fields.forEach((f) => { initial[f.key] = profile?.[f.key] ?? f.defaultValue ?? ""; });
    setDraft(initial);
    setSaved(false);
    setSaveError("");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [group.key]);

  const setValue = (key, value) => { setDraft((d) => ({ ...d, [key]: value })); setSaved(false); setSaveError(""); };

  const save = async () => {
    const allowedKeys = new Set([
      "hobbies", "disabilities", "country", "education", "qualifications",
      "work_experience", "medical_conditions", "preferred_work_environments",
      "work_preference", "weekly_availability", "career_goals",
      "background_constraints", "education_level", "location",
    ]);
    const apiPayload = Object.fromEntries(
      Object.entries(draft).filter(([k, v]) => allowedKeys.has(k) && v !== "" && v != null)
    );
    try {
      await onSave(apiPayload, draft);
      setSaved(true);
      setSaveError("");
      setShowSuggestionPrompt(true);
    } catch (err) {
      setSaveError(err.message || "Failed to save. Is the server running?");
    }
  };

  return (
    <div className={cx("rounded-2xl p-6", tokens.card)}>
      <h2 className={cx("text-lg font-bold", tokens.text)}>{group.title}</h2>
      <p className={cx("text-sm mb-6", tokens.textMuted)}>{group.subtitle}</p>
      <div className="grid sm:grid-cols-2 gap-4">
        {group.fields.map((f) => (
          <div key={f.key} className={f.type === "textarea" ? "sm:col-span-2" : ""}>
            <ProfileField field={f} value={draft[f.key]} onChange={setValue} tokens={tokens} />
          </div>
        ))}
      </div>
      <div className="mt-6 flex items-center gap-3">
        <Button onClick={save} disabled={saving}>
          {saving ? <Loader2 size={15} className="animate-spin" /> : saved ? <CheckCircle2 size={15} /> : <Save size={15} />}
          {saved ? "Saved" : "Save Changes"}
        </Button>
        {saveError && <p className="text-xs text-red-500">{saveError}</p>}
      </div>

      {showSuggestionPrompt && (
        <ConfirmPopup
          dark={dark}
          tokens={tokens}
          title="Profile saved!"
          message="Would you like to get job suggestions based on your updated profile?"
          confirmLabel="Get Suggestions"
          cancelLabel="Not Now"
          onConfirm={() => { setShowSuggestionPrompt(false); onGetSuggestions(draft); }}
          onCancel={() => setShowSuggestionPrompt(false)}
        />
      )}
    </div>
  );
}

function SkillsTraitsPage({ dark, tokens, signedIn, openAuth, profile, onSaveProfile, onGetSuggestions }) {
  const [tab, setTab] = useState("Overview");
  const [saving, setSaving] = useState(false);

  if (!signedIn) {
    return <GatedCard dark={dark} tokens={tokens} icon={BarChart3} title="Sign in to manage your skills"
      subtitle="Build your skillset, get AI insights and improve your career recommendations."
      onSignIn={openAuth} />;
  }

  const activeGroup = PROFILE_FIELD_GROUPS.find((g) => g.tab === tab);

  const save = async (apiPayload, fullDraft) => {
    setSaving(true);
    try {
      await onSaveProfile(apiPayload, fullDraft);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="max-w-6xl mx-auto px-6 py-10 grid md:grid-cols-[200px_1fr] gap-8">
      <aside className="space-y-1">
        {SKILLS_TABS.map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={cx(
              "w-full text-left px-3.5 py-2.5 rounded-lg text-sm font-medium transition-colors",
              tab === t ? "bg-blue-600 text-white" : cx(tokens.textMuted, tokens.hover)
            )}
          >
            {t}
          </button>
        ))}
      </aside>
      <div>
        {tab === "Overview" && (
          <>
            <h1 className={cx("text-xl font-bold mb-1", tokens.text)}>Your Skills & Traits</h1>
            <p className={cx("text-sm mb-6", tokens.textMuted)}>Help our AI understand you better to find the perfect opportunities.</p>
            <SkillsOverview dark={dark} tokens={tokens} profile={profile} />
          </>
        )}
        {activeGroup && (
          <ProfileSectionForm dark={dark} tokens={tokens} group={activeGroup} profile={profile} onSave={save} saving={saving} onGetSuggestions={onGetSuggestions} />
        )}
      </div>
    </div>
  );
}

/* ---------------------------------------------------------
   ACCOUNT PAGE
--------------------------------------------------------- */

function SettingsRow({ tokens, label, value, valueClass, onClick }) {
  return (
    <button onClick={onClick} className={cx("w-full flex items-center justify-between py-2.5 text-sm text-left", tokens.hover, "rounded-lg px-1.5 -mx-1.5")}>
      <span className={tokens.textMuted}>{label}</span>
      <span className={cx("font-medium", valueClass || tokens.text)}>{value} ›</span>
    </button>
  );
}

function initials(name, email) {
  const source = (name || "").trim() || (email || "").split("@")[0] || "?";
  const parts = source.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return source.slice(0, 2).toUpperCase();
}

function formatJoinedDate(iso) {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString(undefined, { month: "long", year: "numeric" });
}

function AccountPage({ dark, setDark, tokens, signedIn, openAuth, profile, account, email, token, goToSkills, onDeleteAccount, onAccountUpdate, onProfileUpdate, signOut }) {
  const [deleting, setDeleting] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [deleteError, setDeleteError] = useState("");
  const [openModal, setOpenModal] = useState(null); // "password" | "2fa" | "sessions" | "language" | "email" | null

  if (!signedIn) {
    return <GatedCard dark={dark} tokens={tokens} icon={User} title="Sign in to access your account"
      subtitle="Personalize your experience and unlock all features."
      onSignIn={openAuth} />;
  }

  const p = profile || {};
  const a = account || {};
  const resolvedEmail = a.email || email;
  const displayName = p.full_name?.trim() || (resolvedEmail ? resolvedEmail.split("@")[0] : "Your Account");
  const joined = formatJoinedDate(a.created_at || a.joined_at);
  const closeModal = () => setOpenModal(null);

  const handleDelete = async () => {
    if (!confirmingDelete) { setConfirmingDelete(true); return; }
    setDeleting(true);
    setDeleteError("");
    try {
      await onDeleteAccount();
    } catch (err) {
      setDeleteError(err.message || "Couldn't delete your account. Try again.");
      setDeleting(false);
      setConfirmingDelete(false);
    }
  };

  const handleDownloadData = () => {
    const blob = new Blob([JSON.stringify({ account: a, profile: p }, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "my-account-data.json";
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="max-w-5xl mx-auto px-6 py-10">
      <h1 className={cx("text-xl font-bold", tokens.text)}>Account Settings</h1>
      <p className={cx("text-sm mb-6", tokens.textMuted)}>Manage your profile, security and preferences.</p>

      <div className={cx("rounded-2xl p-5 mb-5 flex items-center justify-between", tokens.card)}>
        <div className="flex items-center gap-4">
          <div className="h-12 w-12 rounded-full bg-blue-600 text-white flex items-center justify-center font-bold">
            {initials(p.full_name, resolvedEmail)}
          </div>
          <div>
            <p className={cx("font-semibold", tokens.text)}>{displayName}</p>
            <p className={cx("text-xs", tokens.textMuted)}>{resolvedEmail || "—"}{joined ? ` · Joined ${joined}` : ""}</p>
          </div>
        </div>
        <Button variant="outline" dark={dark} onClick={goToSkills}><Pencil size={13} /> Edit Profile</Button>
      </div>

      <div className="grid sm:grid-cols-2 gap-5">
        <InfoCard tokens={tokens} dark={dark} icon={Shield} title="Security">
          <SettingsRow tokens={tokens} label="Change Password" value="" onClick={() => setOpenModal("password")} />
          <SettingsRow
            tokens={tokens} label="Two-Factor Authentication"
            value={a.two_factor_enabled ? "Enabled" : "Not enabled"}
            valueClass={a.two_factor_enabled ? "text-emerald-500" : undefined}
            onClick={() => setOpenModal("2fa")}
          />
          <SettingsRow tokens={tokens} label="Login Sessions" value="" onClick={() => setOpenModal("sessions")} />
        </InfoCard>
        <InfoCard tokens={tokens} dark={dark} icon={SlidersHorizontal} title="Preferences">
          <SettingsRow tokens={tokens} label="Theme" value={dark ? "Dark" : "Light"} onClick={() => setDark(!dark)} />
          <SettingsRow tokens={tokens} label="Language" value="English" onClick={() => setOpenModal("language")} />
          <SettingsRow tokens={tokens} label="Email Preferences" value="" onClick={() => setOpenModal("email")} />
        </InfoCard>

        <InfoCard tokens={tokens} dark={dark} icon={Activity} title="Account Actions">
          <button onClick={handleDownloadData} className={cx("w-full flex items-center gap-2 py-2 text-sm", tokens.text)}>
            <Download size={14} /> Download My Data
          </button>
          <button
            onClick={handleDelete}
            disabled={deleting}
            className="w-full flex items-center gap-2 py-2 text-sm text-red-500 disabled:opacity-50"
          >
            <Trash2 size={14} />
            {deleting ? "Deleting…" : confirmingDelete ? "Click again to confirm" : "Delete Account"}
          </button>
          {deleteError && <p className="text-xs text-red-500 mt-1">{deleteError}</p>}
        </InfoCard>
      </div>

      {openModal === "password" && (
        <ChangePasswordModal dark={dark} tokens={tokens} token={token} onClose={closeModal} />
      )}
      {openModal === "2fa" && (
        <TwoFactorModal
          dark={dark} tokens={tokens} token={token} enabled={!!a.two_factor_enabled} onClose={closeModal}
          onChanged={(enabled) => onAccountUpdate({ two_factor_enabled: enabled })}
        />
      )}
      {openModal === "sessions" && (
        <SessionsModal dark={dark} tokens={tokens} onClose={closeModal} onSignOut={() => { closeModal(); signOut(); }} />
      )}
      {openModal === "language" && (
        <LanguageModal dark={dark} tokens={tokens} onClose={closeModal} />
      )}
      {openModal === "email" && (
        <EmailPreferencesModal
          dark={dark} tokens={tokens} token={token} profile={p} onClose={closeModal}
          onSaved={(prefs) => onProfileUpdate({ email_preferences: prefs })}
        />
      )}
    </div>
  );
}

/* ---------------------------------------------------------
   ROOT APP
--------------------------------------------------------- */

export default function CareerAssistantApp() {
  const [dark, setDark] = useState(false);
  const [page, setPage] = useState(() => localStorage.getItem("career_assistant_token") ? "skills" : "home");
  const [signedIn, setSignedIn] = useState(false);
  const [token, setToken] = useState(() => localStorage.getItem("career_assistant_token") || null);
  const [email, setEmail] = useState(() => localStorage.getItem("career_assistant_email") || "");
  const [account, setAccount] = useState(null);
  const [profile, setProfile] = useState(null);
  const [showAuth, setShowAuth] = useState(false);
  const [showSurvey, setShowSurvey] = useState(false);
  const [surveySubmitting, setSurveySubmitting] = useState(false);
  const [surveyError, setSurveyError] = useState("");
  const [formValues, setFormValues] = useState(() => {
    try { return JSON.parse(sessionStorage.getItem("career_formValues")); } catch { return null; }
  });
  const [results, setResults] = useState(() => {
    try { return JSON.parse(sessionStorage.getItem("career_results")); } catch { return null; }
  });
  const [actionCount, setActionCount] = useState(0);
  const [autoDropdown, setAutoDropdown] = useState(false);
  const [savedJobs, setSavedJobs] = useState(() => loadSavedJobs());
  const [showRegeneratePrompt, setShowRegeneratePrompt] = useState(false);
  const tokens = useTokens(dark);

  useEffect(() => { persistSavedJobs(savedJobs); }, [savedJobs]);
  useEffect(() => {
    if (results) sessionStorage.setItem("career_results", JSON.stringify(results));
    else sessionStorage.removeItem("career_results");
  }, [results]);
  useEffect(() => {
    if (formValues) sessionStorage.setItem("career_formValues", JSON.stringify(formValues));
    else sessionStorage.removeItem("career_formValues");
  }, [formValues]);
  const savedJobIds = new Set(savedJobs.map((j) => j.id));
  const toggleSaveJob = (job) => {
    setSavedJobs((prev) => (
      prev.some((j) => j.id === job.id) ? prev.filter((j) => j.id !== job.id) : [...prev, job]
    ));
  };
  const unsaveJob = (id) => setSavedJobs((prev) => prev.filter((j) => j.id !== id));

  useEffect(() => {
    if (token) {
      localStorage.setItem("career_assistant_token", token);
      setSignedIn(true);
      sessionStorage.removeItem("career_results");
      sessionStorage.removeItem("career_formValues");
    } else {
      localStorage.removeItem("career_assistant_token");
      setSignedIn(false);
      setProfile(null);
      setAccount(null);
    }
  }, [token]);

  useEffect(() => {
    if (email) localStorage.setItem("career_assistant_email", email);
    else localStorage.removeItem("career_assistant_email");
  }, [email]);

  // Pull the real signed-in user's account (GET /auth/me) and profile survey
  // (GET /auth/profile) as soon as we have a token, so Account / Skills &
  // Traits show actual data instead of placeholders.
  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    getAccount(token)
      .then((data) => {
        if (cancelled) return;
        setAccount(data || {});
        if (data?.email) setEmail(data.email);
        const em = data?.email || email;
        getProfile(token)
          .then((pData) => {
            if (cancelled) return;
            const local = loadLocalProfile(em);
            setProfile({ ...local, ...(pData || {}) });
          })
          .catch(() => { if (!cancelled) setProfile((p) => p || {}); });
      })
      .catch(() => { if (!cancelled) setAccount((a) => a || {}); });
    return () => { cancelled = true; };
  }, [token]);

  // Every 2 user actions (nav clicks, "Analyze" clicks) while signed out,
  // briefly auto-pop the "Why sign in?" dropdown from the navbar button.
  const trackAction = () => {
    setActionCount((c) => {
      const next = c + 1;
      if (!signedIn && next % 2 === 0) {
        setAutoDropdown(true);
        setTimeout(() => setAutoDropdown(false), 4500);
      }
      return next;
    });
  };

  const openAuth = () => setShowAuth(true);
  const handleAuthed = (tok, em) => { setToken(tok); setEmail(em); setShowAuth(false); setPage("skills"); };
  // Registration leads into the onboarding survey before the account is "done".
  const handleRegistered = (tok, em) => {
    setToken(tok);
    setEmail(em);
    setShowAuth(false);
    setSurveyError("");
    setShowSurvey(true);
  };
  const signOut = () => { clearLocalProfile(email); setToken(null); setEmail(""); setAccount(null); setPage("home"); };

  const removeAccount = async () => {
    await deleteAccount(token);
    signOut();
  };

  const submitSurvey = async (data) => {
    setSurveySubmitting(true);
    setSurveyError("");
    try {
      await updateProfile(token, data).catch(() => {});
      saveLocalProfile(email, data);
      setProfile((p) => ({ ...(p || {}), ...data }));
      setShowSurvey(false);
      goAnalyze(data);
    } catch (err) {
      setSurveyError(err.message || "Couldn't save your answers. You can finish this later from Skills & Traits.");
    } finally {
      setSurveySubmitting(false);
    }
  };
  const skipSurvey = () => { setShowSurvey(false); setSurveyError(""); setPage("skills"); };

  const saveProfilePatch = async (apiPayload, fullDraft) => {
    const updated = await updateProfile(token, apiPayload).catch(() => ({}));
    setProfile((p) => {
      const merged = { ...p, ...fullDraft, ...(updated || {}) };
      saveLocalProfile(email, merged);
      return merged;
    });
  };

  const confirmRegenerate = () => { setShowRegeneratePrompt(false); goAnalyze(formValues || {}); };
  const declineRegenerate = () => setShowRegeneratePrompt(false);

  const goAnalyze = (values) => { trackAction(); setFormValues(values); setResults(null); setPage("analyzing"); };
  const doneAnalyzing = (data) => { if (data) appendJobHistory(data); setResults(data); setPage("jobs"); };
  const cancelAnalyzing = () => { cancelRecommendation(token).catch(() => {}); setPage("skills"); };

  // Full-screen takeover while a generation is running: no navbar, so there's
  // nowhere else to accidentally tap that would strand the in-flight request.
  const isFullScreenPage = page === "analyzing";

  return (
    <div className={cx("min-h-screen transition-colors duration-300", tokens.bg, tokens.text)}>
      {!isFullScreenPage && (
        <Navbar
          dark={dark} setDark={setDark} page={page} setPage={setPage}
          signedIn={signedIn} openAuth={openAuth} signOut={signOut} tokens={tokens}
          trackAction={trackAction} autoDropdown={autoDropdown}
          hasResults={!!results}
        />
      )}

      {page === "home" && (
        <HomePage dark={dark} tokens={tokens} signedIn={signedIn} openAuth={openAuth} goAnalyze={goAnalyze} profile={profile} initialValues={formValues} />
      )}
      {page === "analyzing" && (
        <AnalyzingPage dark={dark} tokens={tokens} onDone={doneAnalyzing} onCancel={cancelAnalyzing} formValues={formValues} signedIn={signedIn} token={token} />
      )}
      {page === "jobs" && (
        <JobsPage
          dark={dark} tokens={tokens} results={results}
          signedIn={signedIn} openAuth={openAuth}
          savedJobIds={savedJobIds} onToggleSave={toggleSaveJob}
          onReEnter={() => setPage("skills")}
          onRegenerate={() => goAnalyze(formValues || {})}
          formValues={formValues}
        />
      )}
      {page === "jobs-nav" && (
        <MyJobsPage dark={dark} tokens={tokens} signedIn={signedIn} openAuth={openAuth} onViewSession={(data) => { setResults(data); setPage("jobs"); }} results={results} />
      )}
      {page === "skills" && (
        <SkillsTraitsPage dark={dark} tokens={tokens} signedIn={signedIn} openAuth={openAuth} profile={profile} onSaveProfile={saveProfilePatch} onGetSuggestions={(values) => {
          const recFields = new Set([
            "strengths", "weaknesses", "interests",
            "hobbies", "disabilities", "country", "education", "qualifications",
            "work_experience", "medical_conditions", "preferred_work_environments",
            "work_preference", "weekly_availability", "career_goals",
            "background_constraints",
            "date_of_birth", "gender", "current_address", "languages",
            "linkedin_url", "portfolio_url", "preferred_industries",
            "extracurriculars", "willing_to_relocate", "salary_expectations",
            "notice_period", "values", "work_authorization",
          ]);
          const filtered = {};
          for (const [k, v] of Object.entries({ ...profile, ...values })) {
            if (recFields.has(k) && v && String(v).trim()) filtered[k] = String(v).trim();
          }
          goAnalyze(filtered);
        }} />
      )}
      {page === "account" && (
        <AccountPage
          dark={dark} setDark={setDark} tokens={tokens} signedIn={signedIn} openAuth={openAuth}
          profile={profile} account={account} email={email} token={token}
          goToSkills={() => setPage("skills")} onDeleteAccount={removeAccount}
          onAccountUpdate={(patch) => setAccount((a) => ({ ...(a || {}), ...patch }))}
          onProfileUpdate={(patch) => setProfile((p) => ({ ...(p || {}), ...patch }))}
          signOut={signOut}
        />
      )}

      {showAuth && (
        <AuthModal dark={dark} tokens={tokens} onClose={() => setShowAuth(false)} onAuthed={handleAuthed} onRegistered={handleRegistered} />
      )}
      {showSurvey && (
        <SignupSurvey
          dark={dark} tokens={tokens}
          onComplete={submitSurvey} onSkip={skipSurvey}
          submitting={surveySubmitting} submitError={surveyError}
        />
      )}
      {showRegeneratePrompt && (
        <ConfirmPopup
          dark={dark} tokens={tokens}
          title="Update your job suggestions?"
          message="You just updated your info. Want fresh job suggestions based on the changes?"
          confirmLabel="Yes, regenerate"
          cancelLabel="Not now"
          onConfirm={confirmRegenerate}
          onCancel={declineRegenerate}
        />
      )}
    </div>
  );
}
