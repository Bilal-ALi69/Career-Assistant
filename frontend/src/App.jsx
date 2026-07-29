import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  Sparkles, Lock, Bookmark, Zap, BookOpen, TrendingUp, Sun, Moon,
  Briefcase, BarChart3, User, MapPin, GraduationCap, Heart, Flame,
  Accessibility, Check, CheckCircle2, Circle, Shield, SlidersHorizontal,
  Activity, Pencil, Download, Trash2, ChevronDown,
  LogOut, ArrowDown, Loader2, Brain, Target, Languages as LanguagesIcon,
  XCircle, Save, Sunrise, Sunset, Clock, RefreshCw,
} from "lucide-react";
import { API_BASE, ApiError, login, register, getAccount, deleteAccount, getProfile, updateProfile, fetchRecommendations, fetchRegeneratedRecommendations, cancelRecommendation, fetchWorkdaySummary } from "./lib/api";
import { PROFILE_FIELD_GROUPS } from "./lib/profileFields";
import { loadSavedJobs, persistSavedJobs, jobId } from "./lib/savedJobs";
import { loadLocalProfile, saveLocalProfile, clearLocalProfile } from "./lib/localProfile";
import { loadJobHistory, appendJobHistory } from "./lib/jobHistory";
import { getWorkdaySummary, storeWorkdaySummary } from "./lib/workdayCache";
import PasswordStrengthMeter from "./components/PasswordStrengthMeter";
import SignupSurvey from "./components/SignupSurvey";
import ProfileField from "./components/ProfileField";
import CustomSelect from "./components/CustomSelect";
import ToastContainer, { showErrorToast, showSuccessToast } from "./components/ErrorToast";
import ErrorFallback from "./components/ErrorFallback";

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

const SKILLS_TABS = ["Overview", "Professional", "Preferences", "Personality", "Goals", "Other Info"];

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
    bg: dark ? "bg-[#20201f]" : "bg-white",
    bgAlt: dark ? "bg-[#2f2f2e]" : "bg-[#f1f5f9]",
    card: dark ? "bg-[#2f2f2e] border border-zinc-800/80 shadow-sm" : "bg-[#f8fafc] border border-[#e2e8f0] shadow-sm",
    cardAlt: dark ? "bg-[#2f2f2e] border border-zinc-800/60" : "bg-[#f1f5f9] border border-[#e2e8f0]",
    text: dark ? "text-slate-100" : "text-slate-800",
    textMuted: dark ? "text-slate-400" : "text-slate-500",
    textFaint: dark ? "text-slate-500" : "text-slate-400",
    border: dark ? "border-zinc-800/80" : "border-[#e2e8f0]",
    divide: dark ? "divide-zinc-800/80" : "divide-[#e2e8f0]",
    hover: dark ? "hover:bg-zinc-800/40" : "hover:bg-[#f1f5f9]",
    input: dark ? "bg-[#131313] border-zinc-800 text-slate-100 placeholder-slate-500" : "bg-white border-[#e2e8f0] text-slate-800 placeholder-slate-400",
  };
}

const cx = (...a) => a.filter(Boolean).join(" ");
const formatTag = (tag) => tag.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());

/* ---------------------------------------------------------
   SMALL PRIMITIVES
--------------------------------------------------------- */

function Pill({ children, dark, tone = "blue" }) {
  const tones = {
    blue: dark ? "bg-[var(--accent-500)]/10 text-[var(--accent-400)] border-[var(--accent-500)]/20" : "bg-[var(--accent-50)] text-[var(--accent-600)] border-[var(--accent-200)]",
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
  const base = "inline-flex items-center justify-center gap-2 rounded-xl font-semibold transition-all duration-200 ease-[cubic-bezier(0.34,1.56,0.64,1)] active:scale-[0.97] active:opacity-80 focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-500)] focus-visible:ring-offset-2 touch-active-primary";
  const variants = {
    primary: "bg-[var(--accent-600)] hover:bg-[var(--accent-500)] text-white px-5 py-3",
    ghost: dark ? "text-slate-300 hover:bg-zinc-800/60 px-4 py-2" : "text-slate-600 hover:bg-[#e2e8f0] px-4 py-2",
    danger: "text-red-500 hover:bg-red-500/10 px-4 py-2",
    outline: dark ? "border border-zinc-700 text-slate-200 hover:bg-zinc-800/60 px-4 py-2" : "border border-[#cbd5e1] text-slate-700 hover:bg-[#e9edf2] px-4 py-2",
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
  const [showPassword, setShowPassword] = useState(false);
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
      setError(err instanceof ApiError ? err.userMessage : (err.message || "Something went wrong. Is your FastAPI server running?"));
    } finally {
      setLoading(false);
    }
  };

  const isLogin = mode === "login";

  return (
    <div className="fixed inset-0 z-[100] flex items-end md:items-center justify-center bg-black/60 backdrop-blur-sm px-0 md:px-4 animate-overlay-in" onClick={onClose}>
      <div
        className={cx(
          "w-full md:max-w-sm rounded-t-[20px] md:rounded-[20px] p-8 pb-7 md:shadow-[0_30px_60px_-20px_rgba(0,0,0,0.6)] animate-modal-in",
          "max-h-[90vh] md:max-h-none overflow-y-auto",
          dark ? "bg-[#2f2f2e] md:border md:border-zinc-800/80" : "bg-[#f8fafc] md:border md:border-[#e2e8f0] md:shadow-sm"
        )}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Brand mark */}
        <div className="w-10 h-10 rounded-xl bg-[var(--accent-600)] flex items-center justify-center mb-5">
          <span className="text-white font-bold text-sm">CA</span>
        </div>

        {/* Heading */}
        <h2 className={cx("text-lg font-semibold", tokens.text)}>
          {isLogin ? "Welcome back" : "Create your account"}
        </h2>
        <p className={cx("text-sm mt-1 mb-6", tokens.textMuted)}>
          {isLogin
            ? "Sign in to access your career dashboard."
            : "Get started with your personalized career insights."}
        </p>

        {/* OAuth buttons */}
        <div className="grid grid-cols-3 gap-3 mb-6">
          <button
            type="button"
            className="flex items-center justify-center h-11 rounded-[10px] border border-zinc-800/80 bg-[#131313] hover:bg-zinc-800 hover:-translate-y-0.5 active:scale-95 active:opacity-80 transition-all duration-200 touch-active-primary"
          >
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
              <path d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844a4.14 4.14 0 01-1.796 2.716v2.259h2.908c1.702-1.567 2.684-3.875 2.684-6.615z" fill="#4285F4"/>
              <path d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 009 18z" fill="#34A853"/>
              <path d="M3.964 10.71A5.41 5.41 0 013.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 000 9c0 1.452.348 2.827.957 4.042l3.007-2.332z" fill="#FBBC05"/>
              <path d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 00.957 4.958L3.964 7.29C4.672 5.163 6.656 3.58 9 3.58z" fill="#EA4335"/>
            </svg>
          </button>
          <button
            type="button"
            className="flex items-center justify-center h-11 rounded-[10px] border border-zinc-800/80 bg-[#131313] hover:bg-zinc-800 hover:-translate-y-0.5 active:scale-95 active:opacity-80 transition-all duration-200 touch-active-primary"
          >
            <svg width="16" height="18" viewBox="0 0 16 18" fill="none">
              <path d="M13.17 9.51c-.03-2.2 1.8-3.26 1.88-3.31-1.03-1.5-2.62-1.7-3.19-1.73-1.35-.14-2.64.8-3.32.8-.69 0-1.75-.78-2.87-.76-1.47.02-2.83.85-3.58 2.17-1.53 2.66-.39 6.59 1.09 8.75.73 1.05 1.6 2.23 2.74 2.19 1.11-.04 1.53-.72 2.87-.72 1.33 0 1.71.72 2.86.7 1.18-.02 1.93-1.07 2.65-2.12.84-1.21 1.18-2.39 1.2-2.45-.03-.01-2.3-.89-2.33-3.53l-.06-.02zM11.07 3.11c.6-.73 1.01-1.75.9-2.76-.87.04-1.92.58-2.54 1.31-.55.65-1.03 1.69-.9 2.69.97.08 1.96-.49 2.54-1.24z" fill="white"/>
            </svg>
          </button>
          <button
            type="button"
            className="flex items-center justify-center h-11 rounded-[10px] border border-zinc-800/80 bg-[#131313] hover:bg-zinc-800 hover:-translate-y-0.5 active:scale-95 active:opacity-80 transition-all duration-200 touch-active-primary"
          >
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
              <rect x="0" y="0" width="8.5" height="8.5" fill="#F25022"/>
              <rect x="9.5" y="0" width="8.5" height="8.5" fill="#7FBA00"/>
              <rect x="0" y="9.5" width="8.5" height="8.5" fill="#00A4EF"/>
              <rect x="9.5" y="9.5" width="8.5" height="8.5" fill="#FFB900"/>
            </svg>
          </button>
        </div>

        {/* Divider */}
        <div className="flex items-center gap-3 mb-6">
          <div className={cx("flex-1 h-px", dark ? "bg-zinc-800/80" : "bg-[#e2e8f0]")} />
          <span className={cx("text-xs", tokens.textMuted)}>or continue with email</span>
          <div className={cx("flex-1 h-px", dark ? "bg-zinc-800/80" : "bg-[#e2e8f0]")} />
        </div>

        <form onSubmit={submit} className="space-y-4">
          {/* Email */}
          <div>
            <label className={cx("block text-xs font-medium mb-1.5", tokens.textMuted)}>Email</label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              className={cx(
                "w-full rounded-[10px] border px-3.5 py-2.5 text-sm outline-none transition-all duration-200",
                "focus:shadow-[0_0_0_3px_rgba(var(--accent-rgb),0.15)] focus:border-[var(--accent-500)]",
                tokens.input
              )}
            />
          </div>

          {/* Password */}
          <div>
            <label className={cx("block text-xs font-medium mb-1.5", tokens.textMuted)}>Password</label>
            <div className="relative">
              <input
                type={showPassword ? "text" : "password"}
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                minLength={isLogin ? undefined : MIN_PASSWORD_LENGTH}
                className={cx(
                  "w-full rounded-[10px] border px-3.5 py-2.5 pr-16 text-sm outline-none transition-all duration-200",
                  "focus:shadow-[0_0_0_3px_rgba(var(--accent-rgb),0.15)] focus:border-[var(--accent-500)]",
                  tokens.input
                )}
              />
              <button
                type="button"
                onClick={() => setShowPassword((s) => !s)}
                tabIndex={-1}
                className={cx(
                  "absolute right-3 top-1/2 -translate-y-1/2 text-xs font-medium px-1.5 py-0.5 rounded transition-colors duration-200",
                  dark ? "text-slate-400 hover:text-slate-200" : "text-slate-500 hover:text-slate-700"
                )}
              >
                {showPassword ? "Hide" : "Show"}
              </button>
            </div>
            {!isLogin && (
              <PasswordStrengthMeter password={password} dark={dark} tokens={tokens} minLength={MIN_PASSWORD_LENGTH} />
            )}
          </div>

          {isLogin && (
            <div className="flex justify-end">
              <button type="button" className={cx("text-xs transition-colors duration-200 hover:text-[var(--accent-500)]", tokens.textMuted)}>
                Forgot password?
              </button>
            </div>
          )}

          {error && <p className="text-xs text-red-500">{error}</p>}

          {/* Submit */}
          <button
            type="submit"
            disabled={loading}
            className={cx(
              "w-full inline-flex items-center justify-center gap-2 rounded-xl font-semibold transition-all duration-200",
              "bg-[var(--accent-600)] hover:bg-[var(--accent-500)] text-white shadow-lg shadow-[var(--accent-600)]/20 hover:shadow-[var(--accent-500)]/30 hover:-translate-y-0.5",
              "px-5 py-3 active:scale-[0.97] active:opacity-80 focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-500)] focus-visible:ring-offset-2 touch-active-primary",
              "disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:translate-y-0 disabled:hover:shadow-lg"
            )}
          >
            {loading ? <Loader2 size={15} className="animate-spin" /> : null}
            {isLogin ? "Sign In" : "Create Account"}
          </button>
        </form>

        {/* Footer */}
        <p className={cx("text-xs text-center mt-5", tokens.textMuted)}>
          {isLogin ? "Don't have an account?" : "Already have an account?"}{" "}
          <button
            type="button"
            onClick={() => { setMode(isLogin ? "register" : "login"); setError(""); }}
            className="text-[var(--accent-500)] font-medium hover:underline transition-colors duration-200"
          >
            {isLogin ? "Create one" : "Sign in"}
          </button>
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
        className={cx("w-full max-w-sm rounded-2xl p-6 shadow-2xl animate-modal-in", dark ? "bg-[#2f2f2e] border border-zinc-800" : "bg-[#f8fafc] border border-[#e2e8f0] shadow-sm")}
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
   RE-ENTER TRAITS MODAL — shown to signed-out users when
   they tap "Re-enter skills & traits" on the Jobs page.
--------------------------------------------------------- */

function ReEnterTraitsModal({ dark, tokens, onClose, onConfirm, initialValues }) {
  const [strengths, setStrengths] = useState(initialValues?.strengths || "");
  const [weaknesses, setWeaknesses] = useState(initialValues?.weaknesses || "");
  const [interests, setInterests] = useState(initialValues?.interests || "");
  const [fieldError, setFieldError] = useState("");

  const toneClasses = {
    green: dark ? "border-emerald-800/60 focus-within:border-emerald-500" : "border-emerald-200 focus-within:border-emerald-500",
    red: dark ? "border-red-900/60 focus-within:border-red-500" : "border-red-200 focus-within:border-red-500",
    blue: dark ? "border-[var(--accent-900)]/60 focus-within:border-[var(--accent-500)]" : "border-[var(--accent-200)] focus-within:border-[var(--accent-500)]",
  };
  const toneIcon = {
    green: dark ? "text-emerald-400" : "text-emerald-600",
    red: dark ? "text-red-400" : "text-red-600",
    blue: dark ? "text-[var(--accent-400)]" : "text-[var(--accent-600)]",
  };
  const fields = [
    { label: "Strengths", value: strengths, set: setStrengths, placeholder: "e.g. Problem solving, Leadership, Communication...", tone: "green", icon: Sparkles },
    { label: "Weaknesses", value: weaknesses, set: setWeaknesses, placeholder: "e.g. Public speaking, Time management...", tone: "red", icon: Target },
    { label: "Interests", value: interests, set: setInterests, placeholder: "e.g. AI, Design, Startups, Data Science...", tone: "blue", icon: Brain },
  ];

  const handleSubmit = () => {
    if (!strengths.trim() || !weaknesses.trim() || !interests.trim()) { setFieldError("Please fill in all three fields."); return; }
    setFieldError("");
    onConfirm({ strengths, weaknesses, interests });
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm px-4 animate-overlay-in" onClick={onClose}>
      <div
        className={cx("w-full max-w-sm rounded-2xl p-6 shadow-2xl animate-modal-in", dark ? "bg-[#2f2f2e] border border-zinc-800" : "bg-[#f8fafc] border border-[#e2e8f0] shadow-sm")}
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className={cx("text-base font-semibold mb-1", tokens.text)}>Re-enter your traits</h3>
        <p className={cx("text-xs mb-4", tokens.textMuted)}>Update strengths, weaknesses, and interests to get fresh suggestions.</p>

        <div className="space-y-3">
          {fields.map((f) => (
            <div key={f.label} className={cx("rounded-xl border-2 px-4 py-3 transition-colors overflow-hidden", dark ? "bg-[#131313]" : tokens.bgAlt, toneClasses[f.tone])}>
              <label className={cx("flex items-center gap-1.5 text-xs font-semibold mb-1", toneIcon[f.tone])}>
                <f.icon size={13} /> {f.label} <span className="text-red-500">*</span>
              </label>
              <textarea
                rows={1}
                value={f.value}
                onChange={(e) => { f.set(e.target.value); e.target.style.height = "auto"; e.target.style.height = e.target.scrollHeight + "px"; }}
                placeholder={f.placeholder}
                className={cx("w-full bg-transparent outline-none text-sm resize-none overflow-hidden transition-[height] duration-200 ease-out", tokens.text, dark ? "placeholder-slate-600" : "placeholder-slate-400")}
              />
            </div>
          ))}
        </div>

        {fieldError && <p className="text-xs text-red-500 mt-2">{fieldError}</p>}
        <Button className="w-full mt-5" onClick={handleSubmit}>
          <Sparkles size={16} /> Give Suggestions
        </Button>
      </div>
    </div>
  );
}

/* ---------------------------------------------------------
   WORKDAY TIMELINE — parses raw text into structured phases
   with icons, headings, and bullet points.
--------------------------------------------------------- */

const PHASE_ICONS = [Sunrise, Sun, Sunset, Clock, Target, Zap];
const PHASE_TITLES = ["Morning Kickoff", "Mid-Day Sync", "Afternoon Execution", "Late-Day Wrap-Up", "Evening Wind-Down"];

function parseWorkday(text) {
  if (!text || typeof text !== "string") {
    return PHASE_TITLES.map((title, i) => ({ title, bullets: ["No details available."], Icon: PHASE_ICONS[i] }));
  }
  const lines = text.split("\n").map((l) => l.trim()).filter(Boolean);
  if (lines.length === 0) {
    return PHASE_TITLES.map((title, i) => ({ title, bullets: ["No details available."], Icon: PHASE_ICONS[i] }));
  }

  const phases = [];
  let current = null;

  for (const line of lines) {
    const isHeading =
      (line.endsWith(":") && line.length < 80) ||
      /^\d{1,2}:\d{2}\s*(AM|PM)?/i.test(line) ||
      /^(Morning|Mid-?day|Afternoon|Evening|Late|Night|Lunch|Start|End|Begin|Close)/i.test(line);

    if (isHeading) {
      if (current) phases.push(current);
      const title = line.replace(/:$/, "").trim();
      current = { title, bullets: [] };
    } else {
      const bullet = line.replace(/^[-•*]\s*/, "").trim();
      if (bullet) {
        if (current) current.bullets.push(bullet);
        else { current = { title: null, bullets: [bullet] }; }
      }
    }
  }
  if (current) phases.push(current);

  // If parsing failed or only got unstructured text, force into 5 phases
  if (phases.length === 0 || (phases.length === 1 && !phases[0].title)) {
    const allSentences = text
      .split(/[.\n]+/)
      .map((s) => s.replace(/^[-•*]\s*/, "").trim())
      .filter(Boolean);
    const perPhase = Math.max(1, Math.ceil(allSentences.length / PHASE_TITLES.length));
    return PHASE_TITLES.map((title, i) => ({
      title,
      bullets: allSentences.slice(i * perPhase, (i + 1) * perPhase).length > 0
        ? allSentences.slice(i * perPhase, (i + 1) * perPhase)
        : ["See next phase for details."],
      Icon: PHASE_ICONS[i],
    }));
  }

  return phases.map((p, i) => ({
    title: p.title || PHASE_TITLES[i] || `Phase ${i + 1}`,
    bullets: p.bullets,
    Icon: PHASE_ICONS[i % PHASE_ICONS.length],
  }));
}

function WorkdayTimeline({ text, dark, tokens }) {
  const phases = parseWorkday(text);

  return (
    <div className="space-y-0">
      {phases.map((phase, i) => {
        const isLast = i === phases.length - 1;
        const Icon = phase.Icon;
        return (
          <div key={i} className="relative flex gap-3">
            {/* Timeline rail */}
            <div className="flex flex-col items-center shrink-0">
              <div className={cx(
                "h-8 w-8 rounded-full flex items-center justify-center shrink-0",
                dark ? "bg-[var(--accent-500)]/15 text-[var(--accent-400)]" : "bg-[var(--accent-50)] text-[var(--accent-600)]"
              )}>
                <Icon size={14} />
              </div>
              {!isLast && (
                <div className={cx("w-px flex-1 my-1", dark ? "bg-zinc-700/60" : "bg-[#e2e8f0]")} />
              )}
            </div>

            {/* Phase content */}
            <div className={cx("pb-5", isLast && "pb-0")}>
              <p className={cx("text-sm font-semibold mb-1.5", tokens.text)}>
                {phase.title}
              </p>
              {phase.bullets.length > 0 && (
                <ul className="space-y-1">
                  {phase.bullets.map((b, j) => (
                    <li key={j} className={cx("flex items-start gap-2 text-sm", tokens.textMuted)}>
                      <CheckCircle2 size={12} className={cx("shrink-0 mt-1", dark ? "text-[var(--accent-400)]/60" : "text-[var(--accent-500)]/60")} />
                      {b}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

/* ---------------------------------------------------------
   EXPANDED JOB CARD — full-screen overlay with progressive
   blur/darken, match breakdown, and "Simulate Workday".
--------------------------------------------------------- */

function ExpandedCard({ dark, tokens, job, onClose }) {
  const [workday, setWorkday] = useState("");
  const [workdayLoading, setWorkdayLoading] = useState(false);
  const [workdayError, setWorkdayError] = useState("");
  const [showWorkday, setShowWorkday] = useState(false);
  const [closing, setClosing] = useState(false);

  const handleClose = () => {
    setClosing(true);
    setTimeout(onClose, 250);
  };

  const loadWorkday = async () => {
    if (showWorkday) { setShowWorkday(false); return; }
    const desc = job.fullDesc || job.desc;
    const cached = getWorkdaySummary(job.title, desc);
    if (cached) {
      setWorkday(cached);
      setShowWorkday(true);
      return;
    }
    setWorkdayLoading(true);
    setWorkdayError("");
    setShowWorkday(true);
    try {
      const data = await fetchWorkdaySummary(job.title, desc);
      const summary = data.summary || "No summary available.";
      setWorkday(summary);
      storeWorkdaySummary(job.title, desc, summary);
    } catch (err) {
      setWorkdayError(err instanceof ApiError ? err.userMessage : (err.message || "Failed to load workday summary."));
    } finally {
      setWorkdayLoading(false);
    }
  };

  const overlayClass = closing ? "animate-overlay-unblur" : "animate-overlay-blur";
  const cardClass = closing ? "animate-card-collapse" : "animate-card-blast";
  const blurBg = dark ? "bg-[#0d0d0f]/70" : "bg-black/30";

  return (
    <div
      className={cx("fixed inset-0 z-[90] flex items-center justify-center px-4 py-8", overlayClass, blurBg, "backdrop-blur-[8px]")}
      onClick={handleClose}
    >
      <div
        className={cx("w-full max-w-lg max-h-[85vh] overflow-y-auto rounded-2xl p-6 shadow-2xl", cardClass, dark ? "bg-[#2f2f2e] border border-zinc-800" : "bg-[#f8fafc] border border-[#e2e8f0] shadow-sm")}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3 mb-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-[var(--accent-500)] text-sm font-bold">{job.match}% Match</span>
              {job.top && <Pill dark={dark} tone="blue">Top Match</Pill>}
            </div>
            <h2 className={cx("text-xl font-bold", tokens.text)}>{job.title}</h2>
          </div>
          <button onClick={handleClose} className={cx("shrink-0 h-8 w-8 rounded-lg flex items-center justify-center transition-colors", tokens.hover, tokens.textMuted)}>
            <XCircle size={18} />
          </button>
        </div>

        <p className={cx("text-sm mb-4", tokens.textMuted)}>{job.desc}</p>

        {job.tags && job.tags.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mb-4">
            {job.tags.map((tag, i) => (
              <span
                key={i}
                className={cx(
                  "inline-block px-2.5 py-1 rounded-lg text-xs font-medium",
                  dark ? "bg-zinc-800 text-slate-300" : "bg-[#e2e8f0] text-slate-600"
                )}
                >
                  {formatTag(tag)}
                </span>
              ))}
            </div>
          )}

        <div className={cx("rounded-xl p-4 mb-4", dark ? "bg-[#131313]" : "bg-white border border-[#e2e8f0]")}>
          <p className={cx("text-xs font-semibold mb-2", tokens.textMuted)}>Est. Salary</p>
          <p className={cx("text-sm font-semibold", tokens.text)}>{job.salary}</p>
        </div>

        {job.breakdown && job.breakdown.length > 0 && (
          <div className={cx("rounded-xl p-4 mb-4 animate-slide-reveal", dark ? "bg-[#131313]" : "bg-white border border-[#e2e8f0]")}>
            <p className={cx("text-xs font-semibold mb-2", tokens.textMuted)}>Why this matches you</p>
            <ul className="space-y-2">
              {job.breakdown.map((bullet, i) => (
                <li key={i} className={cx("flex items-start gap-2 text-sm", tokens.text)}>
                  <CheckCircle2 size={14} className={cx("shrink-0 mt-0.5", dark ? "text-emerald-400" : "text-emerald-500")} />
                  {bullet}
                </li>
              ))}
            </ul>
          </div>
        )}

        <Button className="w-full" onClick={loadWorkday} disabled={workdayLoading}>
          {workdayLoading ? <Loader2 size={15} className="animate-spin" /> : <Zap size={15} />}
          {showWorkday ? "Hide Workday" : "Simulate Workday"}
        </Button>

        {showWorkday && (
          <div className={cx("mt-4 rounded-xl p-4 animate-slide-reveal", dark ? "bg-[#131313]" : "bg-white border border-[#e2e8f0]")}>
            {workdayLoading ? (
              <div className="flex items-center gap-2">
                <Loader2 size={14} className="animate-spin text-[var(--accent-500)]" />
                <span className={cx("text-sm", tokens.textMuted)}>Generating workday summary...</span>
              </div>
            ) : workdayError ? (
              <div className="flex flex-col items-center text-center py-2">
                <p className="text-sm text-red-500 mb-3">{workdayError}</p>
                <button
                  onClick={loadWorkday}
                  className={cx(
                    "inline-flex items-center gap-1.5 rounded-lg px-3.5 py-2 text-xs font-semibold transition-all duration-200 active:scale-[0.97]",
                    dark ? "bg-zinc-800 text-slate-200 hover:bg-zinc-700 border border-zinc-700" : "bg-white text-slate-700 hover:bg-[#f1f5f9] border border-[#e2e8f0] shadow-sm",
                  )}
                >
                  <RefreshCw size={12} /> Try Again
                </button>
              </div>
            ) : (
              <WorkdayTimeline text={workday} dark={dark} tokens={tokens} />
            )}
          </div>
        )}
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
          <div className={cx("mt-0.5 h-7 w-7 shrink-0 rounded-lg flex items-center justify-center", dark ? "bg-[var(--accent-500)]/10 text-[var(--accent-400)]" : "bg-[var(--accent-50)] text-[var(--accent-600)]")}>
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
    <div className={cx("absolute right-0 top-[calc(100%+10px)] w-56 sm:w-80 rounded-2xl p-4 sm:p-5 shadow-2xl z-50 animate-drop-in backdrop-blur-xl", dark ? "bg-[#2f2f2e] border border-zinc-800/80" : "bg-[#f8fafc] border border-[#e2e8f0] shadow-sm")}>
      <p className={cx("text-xs sm:text-sm font-semibold mb-3 sm:mb-4 text-center sm:text-left", tokens.text)}>Why sign in?</p>
      <SignInList dark={dark} />
      <Button onClick={onSignIn} className="w-full mt-5">Sign In</Button>
    </div>
  );
}

function GatedCard({ dark, tokens, icon: Icon, title, subtitle, onSignIn }) {
  return (
    <div className="max-w-xs sm:max-w-xl mx-auto text-center py-10 sm:py-16 px-4">
      <div className={cx("mx-auto h-12 w-12 sm:h-14 sm:w-14 rounded-2xl flex items-center justify-center mb-5 sm:mb-6", dark ? "bg-[var(--accent-500)]/10 text-[var(--accent-400)]" : "bg-[var(--accent-50)] text-[var(--accent-600)]")}>
        <Icon size={22} />
      </div>
      <h2 className={cx("text-xl sm:text-2xl font-bold mb-2", tokens.text)}>{title}</h2>
      <p className={cx("text-sm mb-6 sm:mb-8", tokens.textMuted)}>{subtitle}</p>
      <div className={cx("hidden sm:block rounded-2xl p-4 sm:p-6 text-center sm:text-left", dark ? "bg-[#2f2f2e] border border-zinc-800/80" : "bg-[#f8fafc] border border-[#e2e8f0] shadow-sm")}>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
          {SIGNIN_ITEMS.map((item, i) => (
            <div key={i} className="flex items-center justify-center sm:justify-start gap-2.5">
              <item.icon size={15} className={dark ? "text-[var(--accent-400)]" : "text-[var(--accent-600)]"} />
              <span className={cx("text-sm", dark ? "text-slate-300" : "text-slate-700")}>{item.title}</span>
            </div>
          ))}
        </div>
        <Button onClick={onSignIn} className="w-full mt-5 sm:mt-6">Sign In</Button>
      </div>
      <div className="sm:hidden">
        <SignInCarousel dark={dark} tokens={tokens} onSignIn={onSignIn} />
      </div>
    </div>
  );
}

/* ---------------------------------------------------------
   NAVBAR
--------------------------------------------------------- */

function Navbar({ dark, setDark, page, setPage, signedIn, openAuth, signOut, tokens, trackAction, autoDropdown, hasResults }) {
  const [showTitleTip, setShowTitleTip] = useState(false);
  const [titleTipArmed, setTitleTipArmed] = useState(true);
  const [alreadyOnTip, setAlreadyOnTip] = useState(null);
  const [tipKey, setTipKey] = useState(0);
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);
  useEffect(() => {
    if (autoDropdown && titleTipArmed) {
      setShowTitleTip(true);
      const t = setTimeout(() => setShowTitleTip(false), 4500);
      return () => clearTimeout(t);
    }
  }, [autoDropdown, titleTipArmed]);
  useEffect(() => {
    if (!alreadyOnTip) return;
    const t = setTimeout(() => setAlreadyOnTip(null), 3000);
    return () => clearTimeout(t);
  }, [alreadyOnTip, tipKey]);
  const showAlreadyOn = (label) => {
    setAlreadyOnTip(null);
    requestAnimationFrame(() => { setAlreadyOnTip(label); setTipKey((k) => k + 1); });
  };
  const navItems = [
    { key: "jobs-nav", label: "My Jobs", icon: Briefcase },
    { key: "skills", label: "Skills & Traits", icon: BarChart3 },
    { key: "account", label: "Account", icon: User },
  ];
  const tipStyle = dark ? "bg-[#131313] text-slate-200" : "bg-white text-slate-700 border border-[#e2e8f0]";
  const blurStyle = dark ? "bg-zinc-800/40" : "bg-white/40";

  const headerBg = dark
    ? (scrolled ? "rgba(32,32,31,0.75)" : "rgba(32,32,31,0.35)")
    : (scrolled ? "rgba(255,255,255,0.75)" : "rgba(255,255,255,0.35)");
  const headerBlur = scrolled ? "22px" : "14px";

  const gradientColor = dark ? "rgba(32,32,31,1)" : "rgba(255,255,255,1)";

  return (
    <>
      <header
        className="sticky top-0 z-40"
        style={{
          background: headerBg,
          WebkitBackdropFilter: `blur(${headerBlur})`,
          backdropFilter: `blur(${headerBlur})`,
          transition: "background 0.4s ease, backdrop-filter 0.4s ease",
        }}
      >
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">

            {signedIn ? (
              <span className={cx("text-lg font-bold tracking-tight", tokens.text)}>
                Career <span className="text-[var(--accent-500)]">Assistant</span>
              </span>
            ) : (
              <div className="relative">
                <button
                  onClick={() => {
                    if (page === "home") { showAlreadyOn("Home"); return; }
                    setPage(hasResults ? "jobs" : "home");
                    setShowTitleTip(false);
                    setTitleTipArmed(false);
                  }}
                  className={cx("text-lg font-bold tracking-tight transition-all duration-200 hover:scale-110 active:scale-110", tokens.text)}
                >
                  Career <span className="text-[var(--accent-500)]">Assistant</span>
                  <span className="inline-block ml-1.5 w-1.5 h-1.5 rounded-full bg-[var(--accent-500)] animate-logo-pulse align-middle" />
                </button>
                {showTitleTip && (
                  <div className={cx("absolute left-1/2 -translate-x-1/2 top-[calc(100%+8px)] whitespace-nowrap rounded-xl px-4 py-2 text-xs font-medium shadow-xl z-50 animate-drop-in", dark ? "bg-[#131313] text-slate-200" : "bg-white text-slate-700 border border-[#e2e8f0]")}>
                    Tap to go to Home Screen
                  </div>
                )}
              </div>
            )}
          </div>

          <nav className="hidden md:flex items-center gap-1 relative">
            {alreadyOnTip && (
              <div className="absolute left-1/2 -translate-x-1/2 top-[calc(100%+8px)] z-50" key={tipKey}>
                <div className="relative animate-tip-flash">
                  <div className={cx("absolute -inset-4 rounded-2xl backdrop-blur-[10px]", blurStyle)} />
                  <div className={cx("relative whitespace-nowrap rounded-xl px-5 py-3 text-sm font-semibold shadow-xl", tipStyle)}>
                    Already on {alreadyOnTip}
                  </div>
                </div>
              </div>
            )}
            {navItems.map((item) => (
              <button
                key={item.key}
                onClick={() => {
                  if (page === item.key) { showAlreadyOn(item.label); return; }
                  trackAction();
                  setPage(item.key);
                  if (!signedIn) setTitleTipArmed(true);
                }}
                className={cx(
                  "group relative flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-sm font-medium transition-colors duration-200 touch-active-nav",
                  page === item.key ? "text-[var(--accent-500)]" : cx(dark ? "text-[#c3c2b7]" : tokens.textMuted)
                )}
              >
                <item.icon size={15} />
                {item.label}
                {page !== item.key && (
                  <span className={cx(
                    "absolute left-3.5 right-3.5 -bottom-0.5 h-px origin-center scale-x-0 transition-transform duration-200 group-hover:scale-x-100",
                    "bg-[var(--accent-500)]"
                  )} />
                )}
              </button>
            ))}
          </nav>

          <div className="flex items-center gap-2">
            {!signedIn && (
              <button
                onClick={() => setDark((d) => !d)}
                className={cx(
                  "h-9 w-9 rounded-lg flex items-center justify-center transition-colors duration-200 touch-active-toggle",
                  dark ? "text-slate-300 hover:bg-zinc-800/60" : "text-slate-500 hover:bg-[#e2e8f0]"
                )}
                title={dark ? "Switch to light mode" : "Switch to dark mode"}
              >
                {dark ? <Sun size={17} /> : <Moon size={17} />}
              </button>
            )}
            {signedIn ? (
              <Button variant="outline" dark={dark} onClick={signOut}>
                <LogOut size={14} /> Sign Out
              </Button>
            ) : (
              <div className="relative">
                <button
                  onClick={openAuth}
                  className={cx(
                    "inline-flex items-center justify-center gap-2 rounded-full px-5 py-2 text-sm font-semibold transition-all duration-200 active:scale-95 active:opacity-80 touch-active-primary",
                    "border",
                    dark
                      ? "border-white/15 text-slate-200 hover:bg-[var(--accent-500)]/10 hover:border-[var(--accent-500)]/40"
                      : "border-[#cbd5e1] text-slate-700 hover:bg-[var(--accent-500)]/10 hover:border-[var(--accent-400)]/40"
                  )}
                >
                  Sign In
                </button>
                {autoDropdown && (
                  <div className="hidden md:block" onClick={(e) => e.stopPropagation()}>
                    <SignInDropdown
                      dark={dark}
                      tokens={tokens}
                      onSignIn={() => openAuth()}
                    />
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </header>

      <div
        className="pointer-events-none fixed top-16 left-0 right-0 z-30 h-10"
        style={{
          background: `linear-gradient(to bottom, ${gradientColor}, transparent)`,
        }}
      />
    </>
  );
}

/* ---------------------------------------------------------
   MOBILE BOTTOM TAB BAR
--------------------------------------------------------- */

function MobileTabBar({ dark, page, setPage, trackAction }) {
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);
  const tabs = [
    { key: "jobs-nav", label: "My Jobs", icon: Briefcase },
    { key: "skills", label: "Skills", icon: BarChart3 },
    { key: "account", label: "Account", icon: User },
  ];

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-50 md:hidden"
      style={{
        paddingBottom: "max(env(safe-area-inset-bottom), 1.5rem)",
        background: dark
          ? (scrolled ? "rgba(32,32,31,0.85)" : "rgba(32,32,31,0.45)")
          : (scrolled ? "rgba(255,255,255,0.85)" : "rgba(255,255,255,0.45)"),
        backdropFilter: scrolled ? "blur(22px)" : "blur(16px)",
        WebkitBackdropFilter: scrolled ? "blur(22px)" : "blur(16px)",
        transition: "background 0.4s ease, backdrop-filter 0.4s ease",
      }}
    >
      <div className="flex items-center justify-around py-2 px-2">
        {tabs.map((t) => {
          const isActive = page === t.key;
          return (
            <button
              key={t.key}
              onClick={() => { trackAction(); setPage(t.key); }}
              className={cx(
                "flex flex-col items-center gap-0.5 py-1.5 px-5 rounded-xl transition-colors duration-200 touch-active-nav",
                isActive ? "text-[var(--accent-500)]" : dark ? "text-[#c3c2b7]" : "text-slate-500"
              )}
            >
              <t.icon size={20} />
              <span className="text-[10px] font-medium leading-tight">{t.label}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}

/* ---------------------------------------------------------
   SIGN-IN CAROUSEL (mobile)
--------------------------------------------------------- */

function SignInCarousel({ dark, tokens, onSignIn }) {
  const [activeIndex, setActiveIndex] = useState(0);
  const scrollRef = useRef(null);

  const handleScroll = () => {
    if (!scrollRef.current) return;
    const idx = Math.round(scrollRef.current.scrollLeft / scrollRef.current.clientWidth);
    setActiveIndex(idx);
  };

  return (
    <div className="md:hidden">
      <div
        ref={scrollRef}
        onScroll={handleScroll}
        className="flex overflow-x-auto snap-x snap-mandatory scroll-smooth gap-4 pb-4 -mx-4 px-4"
        style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
      >
        {SIGNIN_ITEMS.map((item, i) => (
          <div key={i} className="snap-center shrink-0 w-[80vw] max-w-xs">
            <div className={cx(
              "rounded-2xl p-6 flex flex-col items-center text-center min-h-[200px]",
              dark ? "bg-[#2f2f2e] border border-zinc-800/80" : "bg-[#f8fafc] border border-[#e2e8f0] shadow-sm"
            )}>
              <div className={cx(
                "h-12 w-12 rounded-2xl flex items-center justify-center mb-4",
                dark ? "bg-[var(--accent-500)]/10 text-[var(--accent-400)]" : "bg-[var(--accent-50)] text-[var(--accent-600)]"
              )}>
                <item.icon size={22} />
              </div>
              <h3 className={cx("text-base font-bold mb-1", tokens.text)}>{item.title}</h3>
              <p className={cx("text-sm", tokens.textMuted)}>{item.desc}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="flex justify-center gap-2 mt-2 mb-5">
        {SIGNIN_ITEMS.map((_, i) => (
          <button
            key={i}
            onClick={() => {
              scrollRef.current?.children[i]?.scrollIntoView({ behavior: "smooth", inline: "center", block: "nearest" });
            }}
            className={cx(
              "h-2 rounded-full transition-all duration-300",
              i === activeIndex ? "w-6 bg-[var(--accent-500)]" : "w-2 bg-zinc-600/30"
            )}
            aria-label={`Go to slide ${i + 1}`}
          />
        ))}
      </div>

      <Button onClick={onSignIn} className="w-full">
        Sign In
      </Button>
    </div>
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
  const [fieldError, setFieldError] = useState("");

  // Signed-in: the unlocked, larger trait set (Personality + Goals fields),
  // pre-filled from the saved profile survey when the field is blank.
  const [signedInValues, setSignedInValues] = useState(() => {
    const v = {};
    SIGNED_IN_HOME_FIELDS.forEach((f) => { v[f.key] = initialValues?.[f.key] ?? profile?.[f.key] ?? ""; });
    return v;
  });
  const setSignedInValue = (key, value) => setSignedInValues((d) => ({ ...d, [key]: value }));

  const handleAnalyze = () => {
    if (signedIn) {
      const missing = ["strengths", "weaknesses", "interests"].filter((k) => !signedInValues[k]?.trim());
      if (missing.length) { setFieldError("Please fill in strengths, weaknesses, and interests."); return; }
      setFieldError("");
      goAnalyze(signedInValues);
    } else {
      if (!strengths.trim() || !weaknesses.trim() || !interests.trim()) { setFieldError("Please fill in all three fields."); return; }
      setFieldError("");
      goAnalyze({ strengths, weaknesses, interests });
    }
  };

  const fields = [
    { label: "Strengths", value: strengths, set: setStrengths, placeholder: "e.g. Problem solving, Leadership, Communication...", tone: "green", icon: Sparkles },
    { label: "Weaknesses", value: weaknesses, set: setWeaknesses, placeholder: "e.g. Public speaking, Time management...", tone: "red", icon: Target },
    { label: "Interests", value: interests, set: setInterests, placeholder: "e.g. AI, Design, Startups, Data Science...", tone: "blue", icon: Brain },
  ];

  const toneClasses = {
    green: dark
      ? "border border-zinc-800/80 focus-within:-translate-y-1 focus-within:shadow-lg focus-within:shadow-emerald-500/20 focus-within:border-emerald-500"
      : "border border-[#e2e8f0] focus-within:-translate-y-1 focus-within:shadow-lg focus-within:shadow-emerald-500/20 focus-within:border-emerald-500",
    red: dark
      ? "border border-zinc-800/80 focus-within:-translate-y-1 focus-within:shadow-lg focus-within:shadow-red-500/20 focus-within:border-red-500"
      : "border border-[#e2e8f0] focus-within:-translate-y-1 focus-within:shadow-lg focus-within:shadow-red-500/20 focus-within:border-red-500",
    blue: dark
      ? "border border-zinc-800/80 focus-within:-translate-y-1 focus-within:shadow-lg focus-within:shadow-[var(--accent-500)]/20 focus-within:border-[var(--accent-500)]"
      : "border border-[#e2e8f0] focus-within:-translate-y-1 focus-within:shadow-lg focus-within:shadow-[var(--accent-500)]/20 focus-within:border-[var(--accent-500)]",
  };
  const toneIcon = {
    green: dark ? "text-emerald-400" : "text-emerald-600",
    red: dark ? "text-red-400" : "text-red-600",
    blue: dark ? "text-[var(--accent-400)]" : "text-[var(--accent-600)]",
  };

  return (
    <div className="relative max-w-6xl mx-auto px-6 py-14 flex flex-col lg:flex-row items-center justify-center gap-12">
      <div className="flex-1 text-center lg:text-left">
        <Pill dark={dark} tone="blue">AI-POWERED</Pill>
        <h1 className={cx("text-4xl sm:text-5xl font-extrabold mt-5 leading-[1.1] tracking-tight", tokens.text)}>
          Your Career,<br />
          <span className="text-[var(--accent-500)]">Intelligently Guided.</span>
        </h1>
        <p className={cx("mt-4 text-base max-w-md mx-auto lg:mx-0", tokens.textMuted)}>
          Discover the right opportunities, built around your unique skills and goals.
        </p>
      </div>

      <div className={cx("flex-shrink-0 rounded-2xl p-6 w-full max-w-md text-left border shadow-xl shadow-black/40", dark ? "bg-[#2f2f2e] border-zinc-800/80" : "bg-[#f8fafc] border-[#e2e8f0]")}>
        <p className={cx("font-semibold mb-6", tokens.text)}>
          {signedIn ? "Tell us more about yourself" : "Tell us about yourself"}
        </p>

        {signedIn ? (
          <div className="space-y-4">
            {SIGNED_IN_HOME_FIELDS.map((f) => (
              <ProfileField key={f.key} field={f} value={signedInValues[f.key]} onChange={setSignedInValue} tokens={tokens} dark={dark} />
            ))}
          </div>
        ) : (
          <div className="space-y-4">
            {fields.map((f) => (
              <div key={f.label} className={cx("rounded-xl px-4 py-3 transition-all duration-200 ease-out overflow-hidden", dark ? "bg-[#131313]" : tokens.bgAlt, toneClasses[f.tone])}>
                <label className={cx("flex items-center gap-1.5 text-xs font-semibold mb-1", toneIcon[f.tone])}>
                  <f.icon size={13} /> {f.label} <span className="text-red-500">*</span>
                </label>
                <textarea
                  rows={1}
                  value={f.value}
                  onChange={(e) => { f.set(e.target.value); e.target.style.height = "auto"; e.target.style.height = e.target.scrollHeight + "px"; }}
                  placeholder={f.placeholder}
                  className={cx("w-full bg-transparent outline-none text-sm resize-none overflow-hidden transition-[height] duration-200 ease-out", tokens.text, dark ? "placeholder-slate-600" : "placeholder-slate-400")}
                />
              </div>
            ))}
          </div>
        )}

        {fieldError && <p className="text-xs text-red-500 mt-2">{fieldError}</p>}
        <Button onClick={handleAnalyze} className="w-full mt-7 shadow-lg shadow-[var(--accent-600)]/25">
          <Sparkles size={16} /> Analyze My Profile
        </Button>
      </div>
    </div>
  );
}

/* ---------------------------------------------------------
   ANALYZING PAGE
--------------------------------------------------------- */

function AnalyzingPage({ dark, tokens, onDone, onCancel, formValues, signedIn, token, regenerateMode }) {
  const [_progress, setProgress] = useState(0);
  const [error, setError] = useState("");
  const [cancelling, setCancelling] = useState(false);
  const [statusIdx, setStatusIdx] = useState(0);
  const [fade, setFade] = useState(true);
  const doneRef = useRef(false);
  const [apiData, setApiData] = useState(null);
  const [retryCount, setRetryCount] = useState(0);

  const searchingText = regenerateMode
    ? "Checking for alternate career matches..."
    : "Searching database for similar jobs...";

  const processingTexts = regenerateMode
    ? [
        "Scanning cached career paths...",
        "Generating fresh alternatives...",
        "Re-evaluating your profile...",
        "Trying different career angles...",
        "Almost there...",
      ]
    : [
        "Analyzing your strengths...",
        "Identifying growth areas...",
        "Exploring interest patterns...",
        "Matching career pathways...",
        "Building recommendations...",
        "Almost there...",
      ];

  const allStatuses = [searchingText, ...processingTexts, "Arranging Jobs..."];

  // Manual status advancement — each text stays visible long enough to feel
  // like real work is happening. The first ("searching database") gets extra
  // time so the backend has a head-start on the actual API call.
  useEffect(() => {
    if (statusIdx >= allStatuses.length - 1) return;
    const delay = statusIdx === 0 ? 3200 : 2900;

    const timer = setTimeout(() => {
      setFade(false);
      setTimeout(() => {
        setStatusIdx((i) => i + 1);
        setFade(true);
      }, 350);
    }, delay);

    return () => clearTimeout(timer);
  }, [statusIdx, allStatuses.length]);

  // When API data arrives, skip straight to "Arranging Jobs..." if we
  // aren't already there (or past it).
  useEffect(() => {
    if (!apiData) return;
    const arrangingIdx = allStatuses.length - 1;
    if (statusIdx < arrangingIdx) {
      setFade(false);
      setTimeout(() => {
        setStatusIdx(arrangingIdx);
        setFade(true);
      }, 300);
    }
  }, [apiData, statusIdx, allStatuses.length]);

  // Once "Arranging Jobs..." is visible and data is ready, hold for a beat
  // then transition to the jobs page so the reveal feels deliberate.
  useEffect(() => {
    const arrangingIdx = allStatuses.length - 1;
    if (apiData && statusIdx === arrangingIdx && fade) {
      const timer = setTimeout(() => onDone(apiData), 2200);
      return () => clearTimeout(timer);
    }
  }, [apiData, statusIdx, fade, allStatuses.length, onDone]);

  // Progress bar
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

  // Fire the actual recommendation fetch — re-runs on retry
  useEffect(() => {
    let cancelled = false;
    const controller = new AbortController();
    doneRef.current = false;

    const fetcher = (regenerateMode && !signedIn) ? fetchRegeneratedRecommendations : fetchRecommendations;
    fetcher({ signedIn, token, formValues, signal: controller.signal })
      .then((data) => {
        if (cancelled) return;
        doneRef.current = true;
        setProgress(100);
        setApiData(data);
      })
      .catch((err) => {
        if (cancelled) return;
        if (err.name === "AbortError") return;
        doneRef.current = true;
        setProgress(100);
        const userMsg = err instanceof ApiError ? err.userMessage : err.message;
        setError(`${userMsg} Check your FastAPI server is running at ${API_BASE}.`);
      });

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [onDone, formValues, signedIn, token, regenerateMode, retryCount]);

  const cancelGeneration = () => {
    setCancelling(true);
    onCancel();
  };

  return (
    <div className="min-h-[calc(100vh-0px)] flex items-center justify-center px-6 py-16">
      <div className="max-w-2xl w-full">

        {error ? (
          /* ── ERROR STATE — replaces the loading screen entirely ── */
          <div className="flex flex-col items-center text-center animate-fade-in-up">
            <div className={cx("h-14 w-14 rounded-2xl flex items-center justify-center mb-6", dark ? "bg-red-500/10" : "bg-red-50")}>
              <XCircle size={28} className="text-red-500" />
            </div>
            <h1 className={cx("text-2xl font-bold mb-2", tokens.text)}>Something went wrong</h1>
            <p className={cx("text-sm max-w-sm mb-2", tokens.textMuted)}>
              We couldn't generate your career recommendations right now.
            </p>
            <div className={cx("rounded-xl p-4 mb-6 max-w-sm w-full border", dark ? "bg-red-950/30 border-red-900/40" : "bg-red-50 border-red-200")}>
              <p className={cx("text-xs leading-relaxed", dark ? "text-red-300" : "text-red-600")}>{error}</p>
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={() => { setError(""); setProgress(0); setStatusIdx(0); setFade(true); setApiData(null); setRetryCount((c) => c + 1); }}
                className={cx(
                  "inline-flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-semibold transition-all duration-200 active:scale-[0.97]",
                  "bg-[var(--accent-600)] hover:bg-[var(--accent-500)] text-white shadow-lg shadow-[var(--accent-600)]/20",
                )}
              >
                <RefreshCw size={14} /> Try Again
              </button>
              <button
                onClick={cancelGeneration}
                className={cx(
                  "inline-flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-semibold transition-all duration-200 active:scale-[0.97]",
                  dark ? "bg-zinc-800 text-slate-300 hover:bg-zinc-700 border border-zinc-700" : "bg-white text-slate-600 hover:bg-[#f1f5f9] border border-[#e2e8f0] shadow-sm",
                )}
              >
                <XCircle size={14} /> Close
              </button>
            </div>
          </div>
        ) : (
          /* ── LOADING STATE ── */
          <>
            <div className="flex flex-col items-center text-center mb-10">
              <div className={cx("h-10 w-10 rounded-xl flex items-center justify-center mb-5", dark ? "bg-[var(--accent-500)]/10 text-[var(--accent-400)]" : "bg-[var(--accent-50)] text-[var(--accent-600)]")}>
                <Sparkles size={20} />
              </div>
              <h1 className={cx("text-2xl font-bold", tokens.text)}>
                Career <span className="text-[var(--accent-500)]">Assistant</span>
              </h1>
              <div className={cx("h-6 text-sm mt-3 transition-opacity duration-400", fade ? "opacity-100" : "opacity-0", tokens.textMuted)}>
                {allStatuses[statusIdx]}
              </div>
            </div>

            <div className="space-y-4">
              {[0, 1, 2].map((i) => (
                <div
                  key={i}
                  className={cx(
                    "rounded-2xl p-5 transition-all duration-300",
                    tokens.card,
                    i === 0 && "ring-1 ring-[var(--accent-500)]/20"
                  )}
                  style={{ animationDelay: `${i * 120}ms` }}
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <div className="skeleton h-4 w-16" />
                        {i === 0 && <div className="skeleton h-4 w-14 rounded-full" />}
                      </div>
                      <div className="skeleton h-5 w-3/4 mb-2" />
                      <div className="skeleton h-4 w-full mb-1" />
                      <div className="skeleton h-4 w-2/3 mb-3" />
                      <div className="flex gap-1.5">
                        <div className="skeleton h-5 w-16 rounded-md" />
                        <div className="skeleton h-5 w-20 rounded-md" />
                        <div className="skeleton h-5 w-14 rounded-md" />
                      </div>
                    </div>
                    <div className="shrink-0 flex flex-col items-end gap-3">
                      <div className="skeleton h-4 w-20" />
                      <div className="skeleton h-8 w-8 rounded-lg" />
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div className="flex justify-center mt-8">
              <button
                onClick={cancelGeneration}
                disabled={cancelling}
                className={cx(
                  "inline-flex items-center gap-1.5 text-sm font-medium transition-colors disabled:opacity-50",
                  dark ? "text-slate-400 hover:text-red-400" : "text-slate-500 hover:text-red-500"
                )}
              >
                <XCircle size={15} /> {cancelling ? "Cancelling…" : "Cancel"}
              </button>
            </div>
          </>
        )}

      </div>
    </div>
  );
}

/* ---------------------------------------------------------
   JOBS PAGE
--------------------------------------------------------- */

function JobsPage({ dark, tokens, results, signedIn, openAuth, savedJobIds, onToggleSave, onReEnter, onRegenerate, formValues, onOpenReEnter, onGoToSkills, expandedCard, onExpandCard, showMoreMenu, setShowMoreMenu, onShowTraits }) {

  // Normalizes whatever shape your backend returns into card-ready fields.
  const jobs = results && Array.isArray(results.jobs) && results.jobs.length > 0
    ? results.jobs.map((j, i) => ({
        match: j.match ?? j.confidence ?? j.score ?? 90 - i,
        top: i === 0,
        title: j.title ?? j.job_title ?? j.name ?? "Untitled role",
        salary: j.estimated_salary ?? j.salary ?? j.est_salary ?? "—",
        desc: j.justification ?? j.description ?? j.reason ?? "",
        fullDesc: j.description ?? "",
        breakdown: j.match_breakdown ?? [],
        tags: j.action_tags ?? [],
      }))
    : JOBS;

  const handleBookmark = (job) => {
    if (!signedIn) { openAuth(); return; }
    onToggleSave(job);
  };

  return (
    <div className="max-w-5xl mx-auto md:px-6 px-4 py-12">
      <h1 className={cx("text-2xl font-bold", tokens.text)}>Recommended Jobs For You</h1>
      <p className={cx("text-sm mt-1", tokens.textMuted)}>
        {results ? "Based on your skills and interests" : "Demo data — connect your backend to see real results"}
      </p>

      <button
        onClick={() => { if (signedIn) { onGoToSkills(); } else { onShowTraits(); } }}
        className={cx("mt-4 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors", tokens.hover, dark ? "text-slate-400" : "text-slate-500")}
      >
        <SlidersHorizontal size={13} />
        Show traits used
      </button>

      <div className="mt-8 space-y-4">
        {jobs.map((job, i) => {
          const id = jobId(job);
          const saved = savedJobIds.has(id);
          return (
            <div
              key={i}
              onClick={() => onExpandCard(job)}
              className={cx("group rounded-2xl md:p-5 p-5 flex items-start justify-between gap-4 transition-all duration-300 ease-out hover:-translate-y-1 hover:shadow-[0_8px_30px_-4px_rgba(var(--accent-rgb),0.15)] cursor-pointer", tokens.card)}
            >
              <div className="min-w-0">
                <div className="flex items-center gap-2 mb-1.5">
                  <span className="text-[var(--accent-500)] text-sm font-bold">{job.match}% Match</span>
                  {job.top && <Pill dark={dark} tone="blue">Top Match</Pill>}
                </div>
                <h3 className={cx("font-semibold text-lg", tokens.text)}>{job.title}</h3>
                <p className={cx("text-sm mt-1 md:max-w-xl", tokens.textMuted)}>{job.desc}</p>
                {job.tags && job.tags.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mt-2.5">
                    {job.tags.map((tag, ti) => (
                      <span
                        key={ti}
                        className={cx(
                          "inline-block px-2 py-0.5 rounded-md text-[11px] font-medium transition-colors",
                          dark ? "bg-zinc-800/80 text-slate-300 group-hover:bg-zinc-700/80" : "bg-[#e2e8f0] text-slate-600 group-hover:bg-[#cbd5e1]"
                        )}
                      >
                        {formatTag(tag)}
                      </span>
                    ))}
                  </div>
                )}
              </div>
              <div className="text-right shrink-0 flex flex-col items-end gap-3">
                <div>
                  <p className={cx("text-xs", tokens.textFaint)}>Est. Salary</p>
                  <p className={cx("text-sm font-semibold", tokens.text)}>{job.salary}</p>
                </div>
                <button
                  onClick={(e) => { e.stopPropagation(); handleBookmark({ ...job, id }); }}
                  aria-label={saved ? "Remove from saved jobs" : "Save job"}
                  className={cx("h-8 w-8 rounded-lg flex items-center justify-center transition-colors", tokens.hover, saved ? "text-[var(--accent-500)]" : tokens.textMuted)}
                >
                  <Bookmark size={16} fill={saved ? "currentColor" : "none"} />
                </button>
              </div>
            </div>
          );
        })}
      </div>

      <div className="flex justify-center mt-8">
        <Button onClick={() => setShowMoreMenu(true)}>
          View More Opportunities <ChevronDown size={15} />
        </Button>
      </div>

    </div>
  );
}

/* ---------------------------------------------------------
   MY JOBS PAGE (gated)
--------------------------------------------------------- */

function MyJobsPage({ dark, tokens, signedIn, openAuth, onViewSession, results, email }) {
  const history = loadJobHistory(email);

  if (!signedIn) {
    if (results) {
      return (
        <div className="max-w-5xl mx-auto md:px-6 px-4 py-12">
          <h1 className={cx("text-2xl font-bold", tokens.text)}>My Jobs</h1>
          <p className={cx("text-sm mt-1", tokens.textMuted)}>Sign in to save and track your job sessions.</p>
          <div className="mt-6">
            <Button dark={dark} onClick={() => onViewSession(results)}>
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
        {(() => {
          const groups = [];
          let currentDate = null;
          history.forEach((session) => {
            const d = new Date(session.date);
            const dateKey = d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
            if (dateKey !== currentDate) {
              currentDate = dateKey;
              groups.push({ date: dateKey, sessions: [] });
            }
            groups[groups.length - 1].sessions.push(session);
          });
          return groups.map((group) => (
            <div key={group.date}>
              <p className={cx("text-xs font-semibold uppercase tracking-wider mb-2 ml-1", tokens.textMuted)}>{group.date}</p>
              <div className="space-y-3">
                {group.sessions.map((session) => {
                  const d = new Date(session.date);
                  const time = d.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
                  const jobCount = Array.isArray(session.results?.jobs) ? session.results.jobs.length : 0;
                  return (
                    <div key={session.id} className={cx("rounded-2xl p-5 flex items-center justify-between gap-4", tokens.card)}>
                      <div>
                        <p className={cx("text-sm font-semibold", tokens.text)}>{time}</p>
                        <p className={cx("text-xs mt-1", tokens.textMuted)}>{jobCount ? `${jobCount} jobs recommended` : "Results available"}</p>
                      </div>
                      <Button dark={dark} onClick={() => onViewSession(session.results)}>
                        <Briefcase size={14} /> View Results
                      </Button>
                    </div>
                  );
                })}
              </div>
            </div>
          ));
        })()}
      </div>
    </div>
  );
}

/* ---------------------------------------------------------
   SKILLS & TRAITS PAGE
--------------------------------------------------------- */

function InfoCard({ tokens, dark, icon: Icon, title, children }) {
  return (
    <div className={cx("rounded-2xl p-5", tokens.card)}>
      <div className={cx("flex items-center gap-2 text-sm font-semibold mb-3", tokens.text)}>
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

const PROFILE_KEY_FIELDS = [
  { key: "location", label: "Location", tab: "Personal", icon: MapPin },
  { key: "education", label: "Education", tab: "Professional", icon: GraduationCap },
  { key: "languages", label: "Languages", tab: "Personal", icon: LanguagesIcon },
  { key: "strengths", label: "Strengths", tab: "Personality", icon: Sparkles },
  { key: "weaknesses", label: "Weaknesses", tab: "Personality", icon: Target },
  { key: "interests", label: "Interests", tab: "Personality", icon: Brain },
  { key: "work_preference", label: "Work Type", tab: "Preferences", icon: Briefcase },
  { key: "preferred_work_environments", label: "Environment", tab: "Preferences", icon: MapPin },
  { key: "values", label: "Values", tab: "Personality", icon: Flame },
  { key: "hobbies", label: "Hobbies", tab: "Personality", icon: Heart },
  { key: "disabilities", label: "Accessibility", tab: "Other Info", icon: Accessibility },
];

function profileCompletion(p) {
  let filled = 0;
  const details = PROFILE_KEY_FIELDS.map((f) => {
    const v = p?.[f.key];
    const isFilled = !!(v && String(v).trim() && String(v).trim() !== "None");
    if (isFilled) filled++;
    return { ...f, isFilled };
  });
  return { filled, total: PROFILE_KEY_FIELDS.length, pct: Math.round((filled / PROFILE_KEY_FIELDS.length) * 100), details };
}

function readinessLevel(pct) {
  if (pct >= 70) return { label: "Strong", color: "emerald", desc: "Your profile is well-optimized for AI matching." };
  if (pct >= 40) return { label: "Moderate", color: "amber", desc: "Fill a few more sections to improve matches." };
  return { label: "Getting Started", color: "slate", desc: "Complete your profile for better job suggestions." };
}

function OverviewSection({ title, children }) {
  return (
    <div className="mb-8 last:mb-0">
      <h3 className={cx("text-xs font-semibold uppercase tracking-wider mb-3", "text-slate-500")}>{title}</h3>
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">{children}</div>
    </div>
  );
}

function OverviewCardEmpty({ tokens, dark, icon: Icon, label, tab, onNav }) {
  return (
    <button
      onClick={() => onNav(tab)}
      className={cx(
        "rounded-2xl p-5 border-2 border-dashed flex flex-col items-center justify-center gap-2 min-h-[140px] transition-all duration-200 group cursor-pointer",
        dark
          ? "border-zinc-700/60 hover:border-[var(--accent-500)]/50 hover:bg-[var(--accent-500)]/5"
          : "border-[#e2e8f0] hover:border-[var(--accent-400)]/50 hover:bg-[var(--accent-50)]"
      )}
    >
      <div className={cx(
        "h-9 w-9 rounded-xl flex items-center justify-center transition-colors duration-200",
        dark ? "bg-zinc-800/60 group-hover:bg-[var(--accent-500)]/15" : "bg-[#f1f5f9] group-hover:bg-[var(--accent-50)]"
      )}>
        <Icon size={16} className={cx("transition-colors duration-200", dark ? "text-slate-500 group-hover:text-[var(--accent-400)]" : "text-slate-400 group-hover:text-[var(--accent-600)]")} />
      </div>
      <span className={cx("text-xs font-medium transition-colors duration-200", dark ? "text-slate-500 group-hover:text-[var(--accent-400)]" : "text-slate-400 group-hover:text-[var(--accent-600)]")}>
        + Add {label}
      </span>
    </button>
  );
}

function OverviewCardFilled({ tokens, dark, icon: Icon, label, tab, onNav, children }) {
  return (
    <button
      onClick={() => onNav(tab)}
      className={cx(
        "rounded-2xl p-5 text-left transition-all duration-200 group cursor-pointer w-full",
        tokens.card,
        dark ? "hover:border-[var(--accent-500)]/40 hover:shadow-[0_0_20px_-4px_rgba(var(--accent-rgb),0.12)]" : "hover:border-[var(--accent-300)]"
      )}
    >
      <div className={cx("flex items-center justify-between mb-3")}>
        <div className={cx("flex items-center gap-2 text-sm font-semibold", tokens.text)}>
          <Icon size={15} /> {label}
        </div>
        <span className={cx("text-[10px] font-medium opacity-0 group-hover:opacity-100 transition-opacity", dark ? "text-[var(--accent-400)]" : "text-[var(--accent-600)]")}>Edit →</span>
      </div>
      {children}
    </button>
  );
}

function SummaryWidget({ tokens, dark, icon: Icon, title, subtitle, children, accent }) {
  return (
    <div className={cx("rounded-2xl p-5", tokens.card)}>
      <div className="flex items-start gap-3">
        <div className={cx(
          "h-9 w-9 rounded-xl flex items-center justify-center shrink-0",
          accent ? (dark ? "bg-[var(--accent-500)]/15 text-[var(--accent-400)]" : "bg-[var(--accent-50)] text-[var(--accent-600)]")
                 : (dark ? "bg-zinc-800 text-slate-400" : "bg-[#f1f5f9] text-slate-500")
        )}>
          <Icon size={16} />
        </div>
        <div className="min-w-0 flex-1">
          <p className={cx("text-sm font-semibold", tokens.text)}>{title}</p>
          <p className={cx("text-xs mt-0.5", tokens.textMuted)}>{subtitle}</p>
        </div>
      </div>
      {children && <div className="mt-3">{children}</div>}
    </div>
  );
}

function SkillsOverview({ dark, tokens, profile, onNav }) {
  const p = profile || {};
  const { filled, total, pct, details } = profileCompletion(p);
  const readiness = readinessLevel(pct);

  const strengthTags = toTags(p.strengths);
  const interestTags = toTags(p.interests);
  const missing = details.filter((d) => !d.isFilled);

  const sections = [
    {
      title: "Core Identity",
      cards: [
        { field: PROFILE_KEY_FIELDS[0], render: () => <p className={cx("text-sm", tokens.text)}>{p.location}</p> },
        { field: PROFILE_KEY_FIELDS[1], render: () => <p className={cx("text-sm whitespace-pre-line leading-relaxed", tokens.textMuted)}>{p.education}</p> },
        { field: PROFILE_KEY_FIELDS[2], render: () => <TagRow tags={toTags(p.languages)} dark={dark} /> },
      ],
    },
    {
      title: "Professional DNA",
      cards: [
        { field: PROFILE_KEY_FIELDS[3], render: () => <TagRow tags={strengthTags} dark={dark} /> },
        { field: PROFILE_KEY_FIELDS[4], render: () => <TagRow tags={toTags(p.weaknesses)} dark={dark} /> },
        { field: PROFILE_KEY_FIELDS[5], render: () => <TagRow tags={interestTags} dark={dark} /> },
        { field: PROFILE_KEY_FIELDS[6], render: () => (
          <div className={cx("text-sm space-y-1", tokens.textMuted)}>
            <p>{p.work_preference}</p>
            <p>{p.weekly_availability ? `${p.weekly_availability} hrs/week` : null}</p>
          </div>
        )},
        { field: PROFILE_KEY_FIELDS[7], render: () => <p className={cx("text-sm", tokens.textMuted)}>{p.preferred_work_environments ? `${p.preferred_work_environments}` : null}</p> },
      ],
    },
    {
      title: "Goals & Values",
      cards: [
        { field: PROFILE_KEY_FIELDS[8], render: () => <TagRow tags={toTags(p.values)} dark={dark} /> },
        { field: PROFILE_KEY_FIELDS[9], render: () => <TagRow tags={toTags(p.hobbies)} dark={dark} /> },
        { field: PROFILE_KEY_FIELDS[10], render: () => <p className={cx("text-sm", tokens.textMuted)}>{p.disabilities}</p> },
      ],
    },
  ];

  return (
    <div>
      {/* ── Dashboard summary widgets ── */}
      <div className="grid sm:grid-cols-3 gap-4 mb-8">
        <SummaryWidget
          tokens={tokens} dark={dark}
          icon={readiness.color === "emerald" ? CheckCircle2 : readiness.color === "amber" ? Zap : Activity}
          title={`AI Readiness: ${readiness.label}`}
          subtitle={readiness.desc}
          accent
        >
          <div className="flex items-center gap-2">
            <div className={cx("h-1.5 flex-1 rounded-full overflow-hidden", dark ? "bg-zinc-800" : "bg-[#e2e8f0]")}>
              <div
                className={cx(
                  "h-full rounded-full transition-all duration-700 ease-out",
                  readiness.color === "emerald" ? "bg-emerald-500" : readiness.color === "amber" ? "bg-amber-500" : "bg-slate-400"
                )}
                style={{ width: `${pct}%` }}
              />
            </div>
            <span className={cx("text-xs font-bold tabular-nums", tokens.text)}>{pct}%</span>
          </div>
        </SummaryWidget>

        <SummaryWidget
          tokens={tokens} dark={dark}
          icon={Sparkles}
          title="Key Strengths"
          subtitle={strengthTags.length ? `${strengthTags.length} identified` : "Not yet defined"}
        >
          {strengthTags.length ? (
            <div className="flex flex-wrap gap-1.5">
              {strengthTags.slice(0, 4).map((t) => <Pill key={t} dark={dark}>{t}</Pill>)}
              {strengthTags.length > 4 && <span className={cx("text-[11px]", tokens.textFaint)}>+{strengthTags.length - 4}</span>}
            </div>
          ) : (
            <button onClick={() => onNav("Personality")} className={cx("text-xs font-medium", dark ? "text-[var(--accent-400)] hover:text-[var(--accent-300)]" : "text-[var(--accent-600)] hover:text-[var(--accent-700)]")}>
              + Add strengths
            </button>
          )}
        </SummaryWidget>

        <SummaryWidget
          tokens={tokens} dark={dark}
          icon={TrendingUp}
          title="Career Focus"
          subtitle={p.work_preference || p.preferred_work_environments ? "Preferences set" : "Not yet defined"}
        >
          {p.work_preference || p.preferred_work_environments ? (
            <div className="flex flex-wrap gap-1.5">
              {p.work_preference && <Pill dark={dark}>{p.work_preference}</Pill>}
              {p.preferred_work_environments && <Pill dark={dark}>{p.preferred_work_environments}</Pill>}
              {p.weekly_availability && <Pill dark={dark}>{p.weekly_availability}h/wk</Pill>}
            </div>
          ) : (
            <button onClick={() => onNav("Preferences")} className={cx("text-xs font-medium", dark ? "text-[var(--accent-400)] hover:text-[var(--accent-300)]" : "text-[var(--accent-600)] hover:text-[var(--accent-700)]")}>
              + Set preferences
            </button>
          )}
        </SummaryWidget>
      </div>

      {/* ── Missing essentials callout ── */}
      {missing.length > 0 && missing.length <= 5 && (
        <div className={cx(
          "rounded-2xl p-4 mb-8 flex items-center justify-between gap-4",
          dark ? "bg-zinc-800/40 border border-zinc-700/50" : "bg-[#f8fafc] border border-[#e2e8f0]"
        )}>
          <div className="flex items-center gap-3 min-w-0">
            <div className={cx("h-8 w-8 rounded-lg flex items-center justify-center shrink-0", dark ? "bg-amber-500/15" : "bg-amber-50")}>
              <Zap size={14} className={dark ? "text-amber-400" : "text-amber-600"} />
            </div>
            <div className="min-w-0">
              <p className={cx("text-sm font-medium", tokens.text)}>Almost there — {missing.length} section{missing.length !== 1 ? "s" : ""} left</p>
              <p className={cx("text-xs truncate", tokens.textMuted)}>
                {missing.map((m) => m.label).join(", ")}
              </p>
            </div>
          </div>
          <button
            onClick={() => onNav(missing[0].tab)}
            className={cx(
              "shrink-0 text-xs font-semibold px-3.5 py-1.5 rounded-lg transition-colors",
              dark ? "bg-[var(--accent-500)]/15 text-[var(--accent-400)] hover:bg-[var(--accent-500)]/25" : "bg-[var(--accent-50)] text-[var(--accent-600)] hover:bg-[var(--accent-100)]"
            )}
          >
            Complete
          </button>
        </div>
      )}

      {/* ── Sectioned card grid ── */}
      {sections.map((section) => (
        <OverviewSection key={section.title} title={section.title}>
          {section.cards.map(({ field, render }) => {
            const val = p[field.key];
            const isFilled = val && String(val).trim() && String(val).trim() !== "None";
            if (!isFilled) {
              return <OverviewCardEmpty key={field.key} tokens={tokens} dark={dark} icon={field.icon} label={field.label} tab={field.tab} onNav={onNav} />;
            }
            return (
              <OverviewCardFilled key={field.key} tokens={tokens} dark={dark} icon={field.icon} label={field.label} tab={field.tab} onNav={onNav}>
                {render(field)}
              </OverviewCardFilled>
            );
          })}
        </OverviewSection>
      ))}
    </div>
  );
}

// Generic editable form for one PROFILE_FIELD_GROUPS section. Reused for
// Personal / Professional / Preferences / Personality / Goals / Other Info.
function ProfileSectionForm({ tokens, dark, group, profile, onSave, onGetSuggestions }) {
  const isPersonal = group.key === "personal";
  const [draft, setDraft] = useState(() => {
    const initial = {};
    group.fields.forEach((f) => { initial[f.key] = profile?.[f.key] ?? f.defaultValue ?? ""; });
    return initial;
  });
  const [saveStatus, setSaveStatus] = useState(""); // "" | "saving" | "saved" | "error"
  const [saveError, setSaveError] = useState("");
  const timerRef = useRef(null);
  const lastSavedRef = useRef(null);

  useEffect(() => {
    const initial = {};
    group.fields.forEach((f) => { initial[f.key] = profile?.[f.key] ?? f.defaultValue ?? ""; });
    setDraft(initial);
    setSaveStatus("");
    setSaveError("");
    lastSavedRef.current = null;
    if (timerRef.current) clearTimeout(timerRef.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [group.key]);

  const autoSave = useCallback((draftData) => {
    const snapshot = JSON.stringify(draftData);
    if (snapshot === lastSavedRef.current) return;
    lastSavedRef.current = snapshot;

    const allowedKeys = new Set([
      "full_name", "date_of_birth", "gender", "phone_number", "country",
      "location", "current_address", "languages", "linkedin_url", "portfolio_url",
      "hobbies", "disabilities", "education", "qualifications",
      "work_experience", "medical_conditions", "preferred_work_environments",
      "work_preference", "weekly_availability", "career_goals",
      "background_constraints", "education_level", "preferred_industries",
      "extracurriculars", "willing_to_relocate", "salary_expectations",
      "notice_period", "values", "work_authorization", "strengths",
      "weaknesses", "interests",
    ]);
    const apiPayload = Object.fromEntries(
      Object.entries(draftData).filter(([k, v]) => allowedKeys.has(k) && v !== "" && v != null)
    );
    if (Object.keys(apiPayload).length === 0) return;

    setSaveStatus("saving");
    onSave(apiPayload, draftData)
      .then(() => { setSaveStatus("saved"); setSaveError(""); showSuccessToast("Profile saved successfully."); })
      .catch((err) => {
        const msg = err instanceof ApiError ? err.userMessage : (err.message || "Failed to save.");
        setSaveStatus("error");
        setSaveError(msg);
        showErrorToast(msg);
      });
  }, [onSave]);

  const setValue = (key, value) => {
    setDraft((d) => {
      const next = { ...d, [key]: value };
      if (isPersonal) {
        if (timerRef.current) clearTimeout(timerRef.current);
        timerRef.current = setTimeout(() => autoSave(next), 800);
      }
      return next;
    });
    setSaveStatus("");
    setSaveError("");
  };

  const handleSave = () => {
    const allowedKeys = new Set([
      "full_name", "date_of_birth", "gender", "phone_number", "country",
      "location", "current_address", "languages", "linkedin_url", "portfolio_url",
      "hobbies", "disabilities", "education", "qualifications",
      "work_experience", "medical_conditions", "preferred_work_environments",
      "work_preference", "weekly_availability", "career_goals",
      "background_constraints", "education_level", "preferred_industries",
      "extracurriculars", "willing_to_relocate", "salary_expectations",
      "notice_period", "values", "work_authorization", "strengths",
      "weaknesses", "interests",
    ]);
    const apiPayload = Object.fromEntries(
      Object.entries(draft).filter(([k, v]) => allowedKeys.has(k) && v !== "" && v != null)
    );
    setSaveStatus("saving");
    onSave(apiPayload, draft)
      .then(() => { setSaveStatus("saved"); setSaveError(""); showSuccessToast("Profile saved successfully."); })
      .catch((err) => {
        const msg = err instanceof ApiError ? err.userMessage : (err.message || "Failed to save.");
        setSaveStatus("error");
        setSaveError(msg);
        showErrorToast(msg);
      });
  };

  return (
    <div className={cx("rounded-2xl p-6", tokens.card)}>
      <div className="flex items-start justify-between mb-6">
        <div>
          <h2 className={cx("text-lg font-bold", tokens.text)}>{group.title}</h2>
          <p className={cx("text-sm", tokens.textMuted)}>{group.subtitle}</p>
        </div>
        {isPersonal && saveStatus === "saving" && (
          <span className={cx("text-xs flex items-center gap-1.5 transition-opacity duration-200", tokens.textFaint)}>
            <Loader2 size={11} className="animate-spin" /> Saving…
          </span>
        )}
        {isPersonal && saveStatus === "saved" && (
          <span className="text-xs flex items-center gap-1.5 text-emerald-500 animate-fade-in-up">
            <CheckCircle2 size={11} /> Saved
          </span>
        )}
        {!isPersonal && (
          <Button
            variant="primary"
            dark={dark}
            onClick={handleSave}
            disabled={saveStatus === "saving"}
            className="text-xs px-4 py-2"
          >
            {saveStatus === "saving" ? <><Loader2 size={12} className="animate-spin" /> Saving…</> : <><Save size={12} /> Save Changes</>}
          </Button>
        )}
        {saveStatus === "error" && (
          <span className="text-xs flex items-center gap-1.5 text-red-500 animate-fade-in-up">
            <XCircle size={11} /> {saveError}
          </span>
        )}
      </div>
      <div className="grid sm:grid-cols-2 gap-4">
        {group.fields.map((f) => (
          <div key={f.key} className={f.type === "textarea" ? "sm:col-span-2" : ""}>
            <ProfileField field={f} value={draft[f.key]} onChange={setValue} tokens={tokens} dark={dark} />
          </div>
        ))}
      </div>
    </div>
  );
}

function SkillsTraitsPage({ dark, tokens, signedIn, openAuth, profile, onSaveProfile, onGetSuggestions }) {
  const [tab, setTab] = useState("Overview");

  if (!signedIn) {
    return <GatedCard dark={dark} tokens={tokens} icon={BarChart3} title="Sign in to manage your skills"
      subtitle="Build your skillset, get AI insights and improve your career recommendations."
      onSignIn={openAuth} />;
  }

  const activeGroup = PROFILE_FIELD_GROUPS.find((g) => g.tab === tab);

  return (
    <div className="max-w-6xl mx-auto px-6 py-10 grid md:grid-cols-[200px_1fr] gap-8">
      <aside className="space-y-1">
        {SKILLS_TABS.map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={cx(
              "w-full text-left px-3.5 py-2.5 rounded-lg text-sm font-medium transition-colors",
              tab === t ? "bg-[var(--accent-600)] text-white" : cx(tokens.textMuted, tokens.hover)
            )}
          >
            {t}
          </button>
        ))}
      </aside>
      <div>
        {tab === "Overview" && (() => {
          const { filled, total, pct } = profileCompletion(profile);
          return (
          <div key="tab-overview" className="animate-page-enter">
            <div className="flex items-center justify-between mb-6">
              <div className="min-w-0 flex-1 mr-6">
                <h1 className={cx("text-xl font-bold mb-1", tokens.text)}>Your Skills & Traits</h1>
                <p className={cx("text-sm", tokens.textMuted)}>Help our AI understand you better to find the perfect opportunities.</p>
              </div>
              <Button
                variant="primary"
                dark={dark}
                onClick={() => onGetSuggestions(profile)}
                className="text-sm px-5 py-2.5 shrink-0"
              >
                <Sparkles size={16} /> Get Job Suggestions
              </Button>
            </div>
            <div className={cx("rounded-2xl p-4 mb-8", tokens.card)}>
              <div className="flex items-center justify-between mb-2">
                <span className={cx("text-xs font-medium", tokens.textMuted)}>Profile Completion</span>
                <span className={cx("text-xs font-semibold", tokens.text)}>{pct}%</span>
              </div>
              <div className={cx("w-full h-1.5 rounded-full overflow-hidden", dark ? "bg-zinc-800" : "bg-[#e2e8f0]")}>
                <div
                  className="h-full rounded-full bg-[var(--accent-500)] transition-all duration-700 ease-out"
                  style={{ width: `${pct}%` }}
                />
              </div>
              <p className={cx("text-[11px] mt-1.5", tokens.textFaint)}>{filled} of {total} sections completed</p>
            </div>
            <SkillsOverview dark={dark} tokens={tokens} profile={profile} onNav={(tabName) => setTab(tabName)} />
          </div>
          );
        })()}
        {activeGroup && (
          <div key={`tab-${activeGroup.key}`} className="animate-page-enter">
            <ProfileSectionForm dark={dark} tokens={tokens} group={activeGroup} profile={profile} onSave={onSaveProfile} onGetSuggestions={onGetSuggestions} />
          </div>
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

function formatJoinedDate(ts) {
  if (ts == null) return null;
  const d = typeof ts === "number"
    ? new Date(ts * (ts < 1e12 ? 1000 : 1))
    : new Date(ts);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString(undefined, { month: "long", year: "numeric" });
}

function AccountPage({ dark, setDark, accent, setAccent, tokens, signedIn, openAuth, profile, account, email, token, goToSkills, onDeleteAccount, onAccountUpdate, onProfileUpdate, onSaveProfile, signOut }) {
  const [deleting, setDeleting] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [deleteError, setDeleteError] = useState("");
  const [openModal, setOpenModal] = useState(null);
  const [showAppearance, setShowAppearance] = useState(false);
  const [showPersonalEdit, setShowPersonalEdit] = useState(false);

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
      setDeleteError(err instanceof ApiError ? err.userMessage : (err.message || "Couldn't delete your account. Try again."));
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

  if (showPersonalEdit) {
    const personalGroup = PROFILE_FIELD_GROUPS.find((g) => g.key === "personal");
    return (
      <div className="max-w-5xl mx-auto px-6 py-10 animate-page-enter">
        <button
          onClick={() => setShowPersonalEdit(false)}
          className={cx("flex items-center gap-1.5 text-sm font-medium mb-6 transition-colors", tokens.textMuted, tokens.hover, "rounded-lg px-2 py-1 -ml-2")}
        >
          ← Back to Account
        </button>
        <ProfileSectionForm
          dark={dark} tokens={tokens} group={personalGroup} profile={profile}
          onSave={(apiPayload, fullDraft) => onSaveProfile(apiPayload, fullDraft)}
          onGetSuggestions={() => { setShowPersonalEdit(false); }}
        />
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto px-6 py-10">
      <h1 className={cx("text-xl font-bold", tokens.text)}>Account Settings</h1>
      <p className={cx("text-sm mb-6", tokens.textMuted)}>Manage your profile, security and preferences.</p>

      <div className={cx("rounded-2xl p-6 mb-5 flex items-center justify-between", tokens.card)}>
        <div className="flex items-center gap-5">
          <div className="h-14 w-14 rounded-full bg-[var(--accent-600)] text-white flex items-center justify-center font-bold text-lg shrink-0">
            {initials(p.full_name, resolvedEmail)}
          </div>
          <div className="min-w-0">
            <p className={cx("font-semibold text-base", tokens.text)}>{displayName}</p>
            <p className={cx("text-xs mt-0.5", tokens.textMuted)}>
              {resolvedEmail || "—"}
              {joined && <><span className="mx-1.5 opacity-40">·</span>Joined {joined}</>}
            </p>
          </div>
        </div>
        <Button variant="outline" dark={dark} onClick={() => setShowPersonalEdit(true)}><Pencil size={13} /> Edit Profile</Button>
      </div>

      <div className="mb-5">
        <InfoCard tokens={tokens} dark={dark} icon={Sun} title="Appearance">
          <button
            onClick={() => setShowAppearance(!showAppearance)}
            className={cx("w-full flex items-center justify-between py-2.5 text-sm text-left", tokens.hover, "rounded-lg px-1.5 -mx-1.5 transition-colors")}
          >
            <span className={tokens.textMuted}>Theme & Accent</span>
            <span className={cx("font-medium flex items-center gap-1 transition-transform duration-300 ease-[cubic-bezier(0.16,1,0.3,1)]", tokens.text, showAppearance && "rotate-90")}>
              ›
            </span>
          </button>

          <div className={cx("accordion-content", showAppearance && "open")}>
            <div>
              <div className="pt-1 pb-1 pl-1">
                <div className="flex items-end gap-5">
                  <div className="min-w-[120px]">
                    <label className={cx("text-xs font-medium block mb-1.5", tokens.textMuted)}>Theme</label>
                    <CustomSelect
                      value={dark ? "dark" : "light"}
                      onChange={(val) => setDark(val === "dark")}
                      options={[
                        { value: "dark", label: "Dark" },
                        { value: "light", label: "Light" },
                      ]}
                      dark={dark}
                      tokens={tokens}
                    />
                  </div>

                  <div>
                    <label className={cx("text-xs font-medium block mb-1.5", tokens.textMuted)}>Accent Color</label>
                    <div className="flex items-center gap-2.5">
                      {[
                        { key: "blue",   color: "#3b82f6" },
                        { key: "green",  color: "#10b981" },
                        { key: "gold",   color: "#f59e0b" },
                        { key: "purple", color: "#a855f7" },
                        { key: "rose",   color: "#f43f5e" },
                        { key: "teal",   color: "#14b8a6" },
                      ].map((c) => (
                        <button
                          key={c.key}
                          onClick={() => setAccent(c.key)}
                          className={cx(
                            "relative h-8 w-8 rounded-full flex items-center justify-center transition-all duration-200 hover:scale-110",
                            accent === c.key
                              ? dark
                                ? "ring-2 ring-white ring-offset-2 ring-offset-[#2f2f2e] shadow-[0_0_12px_rgba(var(--accent-rgb),0.4)]"
                                : "ring-2 ring-gray-800 ring-offset-2 ring-offset-white shadow-md"
                              : dark
                                ? "ring-1 ring-white/10 hover:ring-white/25"
                                : "ring-1 ring-gray-200 hover:ring-gray-300"
                          )}
                          style={{ backgroundColor: c.color }}
                          title={c.key.charAt(0).toUpperCase() + c.key.slice(1)}
                        >
                          {accent === c.key && (
                            <Check size={14} className="text-white" strokeWidth={3} />
                          )}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="border-t border-white/5 mt-1 pt-1">
            <SettingsRow tokens={tokens} label="Language" value="English" onClick={() => setOpenModal("language")} />
            <SettingsRow tokens={tokens} label="Email Preferences" value="" onClick={() => setOpenModal("email")} />
          </div>
        </InfoCard>
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
        <InfoCard tokens={tokens} dark={dark} icon={SlidersHorizontal} title="Account Actions">
          <button onClick={handleDownloadData} className={cx("w-full flex items-center gap-2.5 py-2.5 text-sm font-medium rounded-lg transition-colors", tokens.hover, tokens.text)}>
            <Download size={14} className="opacity-70" /> Download My Data
          </button>
          <button
            onClick={handleDelete}
            disabled={deleting}
            className={cx("w-full flex items-center gap-2.5 py-2.5 text-sm font-medium rounded-lg transition-colors", dark ? "hover:bg-red-500/10 text-red-400" : "hover:bg-red-50 text-red-600", "disabled:opacity-50")}
          >
            <Trash2 size={14} className="opacity-70" />
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
  const accentKeyFor = (em) => `career_assistant_accent_${em || "default"}`;
  const [accent, setAccent] = useState(() => {
    const em = localStorage.getItem("career_assistant_email") || "";
    return localStorage.getItem(`career_assistant_accent_${em || "default"}`) || "gold";
  });
  const [page, setPage] = useState(() => localStorage.getItem("career_assistant_token") ? "skills" : "home");
  const [signedIn, setSignedIn] = useState(false);
  const [token, setToken] = useState(() => localStorage.getItem("career_assistant_token") || null);
  const [email, setEmail] = useState(() => localStorage.getItem("career_assistant_email") || "");
  const [account, setAccount] = useState(null);
  const [profile, setProfile] = useState(null);
  const [showAuth, setShowAuth] = useState(false);
  const [showReEnterModal, setShowReEnterModal] = useState(false);
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
  const [savedJobs, setSavedJobs] = useState(() => loadSavedJobs(localStorage.getItem("career_assistant_email") || ""));
  const [showRegeneratePrompt, setShowRegeneratePrompt] = useState(false);
  const [regenerateMode, setRegenerateMode] = useState(false);
  const [expandedCard, setExpandedCard] = useState(null);
  const [showMoreMenu, setShowMoreMenu] = useState(false);
  const [showTraits, setShowTraits] = useState(false);
  const tokens = useTokens(dark);

  useEffect(() => { persistSavedJobs(savedJobs, email); }, [savedJobs, email]);
  useEffect(() => {
    const em = localStorage.getItem("career_assistant_email") || "default";
    localStorage.setItem(`career_assistant_accent_${em}`, accent);
  }, [accent]);

  useEffect(() => {
    document.documentElement.style.backgroundColor = dark ? "#20201f" : "#ffffff";
    document.body.style.backgroundColor = dark ? "#20201f" : "#ffffff";
  }, [dark]);
  // Persist accent to the backend profile so each user keeps their own colour.
  useEffect(() => {
    if (!token || !signedIn || !profile) return;
    updateProfile(token, { ...profile, accent_color: accent }).catch(() => {});
  }, [accent, token, signedIn]);
  useEffect(() => {
    if (results) sessionStorage.setItem("career_results", JSON.stringify(results));
    else sessionStorage.removeItem("career_results");
  }, [results]);
  useEffect(() => {
    if (formValues) sessionStorage.setItem("career_formValues", JSON.stringify(formValues));
    else sessionStorage.removeItem("career_formValues");
  }, [formValues]);

  // Dismiss the auto-dropdown "Why sign in?" popup when clicking anywhere
  // outside the dropdown itself (the dropdown uses stopPropagation).
  // The 50ms delay prevents the same click that opened it from immediately
  // dismissing it (trackAction fires before the bubble reaches document).
  useEffect(() => {
    if (!autoDropdown) return;
    let handler;
    const timer = setTimeout(() => {
      handler = () => setAutoDropdown(false);
      document.addEventListener("click", handler);
    }, 50);
    return () => {
      clearTimeout(timer);
      if (handler) document.removeEventListener("click", handler);
    };
  }, [autoDropdown]);
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
            const merged = { ...local, ...(pData || {}) };
            setProfile(merged);
            if (merged.accent_color && merged.accent_color !== accent) {
              setAccent(merged.accent_color);
            }
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
  const signOut = () => { clearLocalProfile(email); setToken(null); setEmail(""); setAccount(null); setAccent("gold"); setPage("home"); };

  const removeAccount = async () => {
    await deleteAccount(token);
    signOut();
  };

  const submitSurvey = async (data) => {
    setSurveySubmitting(true);
    setSurveyError("");
    try {
      await updateProfile(token, data);
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
    const updated = await updateProfile(token, apiPayload);
    setProfile((p) => {
      const merged = { ...p, ...fullDraft, ...(updated || {}) };
      saveLocalProfile(email, merged);
      return merged;
    });
  };

  const confirmRegenerate = () => { setShowRegeneratePrompt(false); goAnalyze(formValues || {}, true); };
  const declineRegenerate = () => setShowRegeneratePrompt(false);

  const goAnalyze = (values, isRegen = false) => { trackAction(); setRegenerateMode(isRegen); setFormValues(values); setResults(null); setPage("analyzing"); };
  const doneAnalyzing = (data) => { if (data) appendJobHistory(data, email); setResults(data); setPage("jobs"); };
  const cancelAnalyzing = () => { cancelRecommendation(token).catch(() => {}); setPage(signedIn ? "skills" : "home"); };

  // Full-screen takeover while a generation is running: no navbar, so there's
  // nowhere else to accidentally tap that would strand the in-flight request.
  const isFullScreenPage = page === "analyzing";

  return (
    <div data-accent={accent} className={cx("flex flex-col md:block min-h-[100dvh] w-full overflow-x-hidden pb-40 md:pb-0 overscroll-y-none transition-colors duration-300", tokens.bg, tokens.text)}>
      <ToastContainer dark={dark} />
      {!isFullScreenPage && (
        <Navbar
          dark={dark} setDark={setDark} page={page} setPage={setPage}
          signedIn={signedIn} openAuth={openAuth} signOut={signOut} tokens={tokens}
          trackAction={trackAction} autoDropdown={autoDropdown}
          hasResults={!!results}
        />
      )}
      {!isFullScreenPage && (
        <MobileTabBar
          dark={dark} page={page} setPage={setPage}
          trackAction={trackAction}
        />
      )}

      {page === "home" && (
        <div key="page-home" className="animate-page-enter grow">
          <HomePage dark={dark} tokens={tokens} signedIn={signedIn} openAuth={openAuth} goAnalyze={goAnalyze} profile={profile} initialValues={formValues} />
        </div>
      )}
      {page === "analyzing" && (
        <div key="page-analyzing" className="animate-page-enter grow">
          <AnalyzingPage dark={dark} tokens={tokens} onDone={doneAnalyzing} onCancel={cancelAnalyzing} formValues={formValues} signedIn={signedIn} token={token} regenerateMode={regenerateMode} />
        </div>
      )}
      {page === "jobs" && (
        <div key="page-jobs" className="animate-page-enter grow">
          <JobsPage
            dark={dark} tokens={tokens} results={results}
            signedIn={signedIn} openAuth={openAuth}
            savedJobIds={savedJobIds} onToggleSave={toggleSaveJob}
            onReEnter={() => { if (signedIn) setPage("skills"); else setShowReEnterModal(true); }}
            onRegenerate={() => goAnalyze(formValues || {}, true)}
            formValues={formValues}
            onOpenReEnter={() => setShowReEnterModal(true)}
            onGoToSkills={() => setPage("skills")}
            expandedCard={expandedCard} onExpandCard={setExpandedCard}
            showMoreMenu={showMoreMenu} setShowMoreMenu={setShowMoreMenu}
            onShowTraits={() => setShowTraits(true)}
          />
        </div>
      )}
      {page === "jobs-nav" && (
        <div key="page-jobsnav" className="animate-page-enter grow">
          <MyJobsPage dark={dark} tokens={tokens} signedIn={signedIn} openAuth={openAuth} onViewSession={(data) => { setResults(data); setPage("jobs"); }} results={results} email={email} />
        </div>
      )}
      {page === "skills" && (
        <div key="page-skills" className="animate-page-enter grow">
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
        </div>
      )}
      {page === "account" && (
        <div key="page-account" className="animate-page-enter grow">
          <AccountPage
            dark={dark} setDark={setDark} accent={accent} setAccent={setAccent} tokens={tokens} signedIn={signedIn} openAuth={openAuth}
            profile={profile} account={account} email={email} token={token}
            goToSkills={() => setPage("skills")} onDeleteAccount={removeAccount}
            onAccountUpdate={(patch) => setAccount((a) => ({ ...(a || {}), ...patch }))}
            onProfileUpdate={(patch) => setProfile((p) => ({ ...(p || {}), ...patch }))}
            onSaveProfile={saveProfilePatch}
            signOut={signOut}
          />
        </div>
      )}

      {showAuth && (
        <AuthModal dark={dark} tokens={tokens} onClose={() => setShowAuth(false)} onAuthed={handleAuthed} onRegistered={handleRegistered} />
      )}
      {showReEnterModal && (
        <ReEnterTraitsModal
          dark={dark} tokens={tokens}
          onClose={() => setShowReEnterModal(false)}
          onConfirm={(values) => { setShowReEnterModal(false); goAnalyze(values); }}
          initialValues={formValues}
        />
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
      {expandedCard && (
        <ExpandedCard dark={dark} tokens={tokens} job={expandedCard} onClose={() => setExpandedCard(null)} />
      )}
      {showMoreMenu && (
        <div
          className="fixed inset-0 z-[80] flex items-center justify-center bg-black/30 backdrop-blur-[6px] animate-overlay-blur px-4"
          onClick={() => setShowMoreMenu(false)}
        >
          <div
            className={cx("w-full max-w-sm rounded-2xl p-5 shadow-2xl animate-card-blast", dark ? "bg-[#2f2f2e] border border-zinc-800" : "bg-[#f8fafc] border border-[#e2e8f0] shadow-sm")}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-3">
              <p className={cx("text-xs font-semibold", tokens.textMuted)}>More options</p>
              <button onClick={() => setShowMoreMenu(false)} className={cx("h-6 w-6 rounded-md flex items-center justify-center transition-colors", tokens.hover, tokens.textMuted)}>
                <XCircle size={14} />
              </button>
            </div>
            <div className="space-y-2">
              <button
                onClick={() => { setShowMoreMenu(false); if (signedIn) setPage("skills"); else setShowReEnterModal(true); }}
                className={cx("w-full text-left px-4 py-3 rounded-xl text-sm font-medium transition-colors", dark ? "hover:bg-zinc-700/60" : "hover:bg-[#f1f5f9]", tokens.text)}
              >
                Re-enter skills &amp; traits
              </button>
              <button
                onClick={() => { setShowMoreMenu(false); goAnalyze(formValues || {}, true); }}
                className={cx("w-full text-left px-4 py-3 rounded-xl text-sm font-medium transition-colors", dark ? "hover:bg-zinc-700/60" : "hover:bg-[#f1f5f9]", tokens.text)}
              >
                Regenerate suggestions directly
              </button>
            </div>
          </div>
        </div>
      )}
      {showTraits && formValues && (
        <div
          className="fixed inset-0 z-[80] flex items-center justify-center bg-black/30 backdrop-blur-[6px] animate-overlay-blur px-4"
          onClick={() => setShowTraits(false)}
        >
          <div
            className={cx("w-full max-w-sm rounded-2xl p-5 shadow-2xl animate-card-blast", dark ? "bg-[#2f2f2e] border border-zinc-800" : "bg-[#f8fafc] border border-[#e2e8f0] shadow-sm")}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-3">
              <p className={cx("text-xs font-semibold", tokens.textMuted)}>
                Traits you entered
              </p>
              <button onClick={() => setShowTraits(false)} className={cx("h-6 w-6 rounded-md flex items-center justify-center transition-colors", tokens.hover, tokens.textMuted)}>
                <XCircle size={14} />
              </button>
            </div>
            <div className="space-y-2">
              {formValues.strengths?.trim() && (
                <div>
                  <span className={cx("text-xs font-medium", dark ? "text-[#c3c2b7]" : "text-emerald-500")}>Strengths</span>
                  <p className={cx("text-sm", dark ? "text-[#c3c2b7]" : tokens.text)}>{formValues.strengths}</p>
                </div>
              )}
              {formValues.weaknesses?.trim() && (
                <div>
                  <span className={cx("text-xs font-medium", dark ? "text-[#c3c2b7]" : "text-red-500")}>Weaknesses</span>
                  <p className={cx("text-sm", dark ? "text-[#c3c2b7]" : tokens.text)}>{formValues.weaknesses}</p>
                </div>
              )}
              {formValues.interests?.trim() && (
                <div>
                  <span className={cx("text-xs font-medium", dark ? "text-[#c3c2b7]" : "text-[var(--accent-500)]")}>Interests</span>
                  <p className={cx("text-sm", dark ? "text-[#c3c2b7]" : tokens.text)}>{formValues.interests}</p>
                </div>
              )}
            </div>
            <Button
              className="w-full mt-4"
              onClick={() => { setShowTraits(false); setShowReEnterModal(true); }}
            >
              <Pencil size={13} /> Change Traits
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
