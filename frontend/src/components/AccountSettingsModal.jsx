import { useState } from "react";
import { Loader2, X } from "lucide-react";
import PasswordInput from "./PasswordInput";
import PasswordStrengthMeter from "./PasswordStrengthMeter";
import { changePassword, setTwoFactor, updateProfile } from "../lib/api";

const cx = (...a) => a.filter(Boolean).join(" ");

function ModalShell({ dark, tokens, title, onClose, children }) {
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm px-4 animate-overlay-in" onClick={onClose}>
      <div
        className={cx("w-full max-w-sm rounded-2xl p-6 shadow-2xl animate-modal-in", dark ? "bg-[#0F1526] border border-slate-800" : "bg-white border border-gray-200")}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <h3 className={cx("text-base font-semibold", tokens.text)}>{title}</h3>
          <button onClick={onClose} className={tokens.textFaint} aria-label="Close">
            <X size={16} />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

function PrimaryButton({ children, disabled, tone = "primary", className = "", ...rest }) {
  const toneClasses = tone === "danger"
    ? "bg-red-600 hover:bg-red-500 shadow-red-600/20"
    : "bg-blue-600 hover:bg-blue-500 shadow-blue-600/20";
  return (
    <button
      disabled={disabled}
      className={cx(
        "w-full inline-flex items-center justify-center gap-2 rounded-xl px-5 py-3 text-sm font-semibold text-white shadow-lg disabled:opacity-50 transition-all",
        toneClasses, className
      )}
      {...rest}
    >
      {children}
    </button>
  );
}

/* ---------------------------------------------------------
   CHANGE PASSWORD — POST /auth/change-password
--------------------------------------------------------- */
export function ChangePasswordModal({ dark, tokens, token, onClose }) {
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);
  const MIN_LENGTH = 12;

  const submit = async (e) => {
    e.preventDefault();
    if (next.length < MIN_LENGTH) { setError(`New password must be at least ${MIN_LENGTH} characters.`); return; }
    if (next !== confirm) { setError("New passwords don't match."); return; }
    setLoading(true);
    setError("");
    try {
      await changePassword(token, current, next);
      setDone(true);
      setTimeout(onClose, 1200);
    } catch (err) {
      setError(err.message || "Couldn't change your password.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <ModalShell dark={dark} tokens={tokens} title="Change Password" onClose={onClose}>
      {done ? (
        <p className="text-sm text-emerald-500">Password updated.</p>
      ) : (
        <form onSubmit={submit} className="space-y-3">
          <PasswordInput label="Current Password" value={current} onChange={(e) => setCurrent(e.target.value)} tokens={tokens} required />
          <div>
            <PasswordInput label="New Password" value={next} onChange={(e) => setNext(e.target.value)} tokens={tokens} required minLength={MIN_LENGTH} />
            <PasswordStrengthMeter password={next} dark={dark} tokens={tokens} minLength={MIN_LENGTH} />
          </div>
          <PasswordInput label="Confirm New Password" value={confirm} onChange={(e) => setConfirm(e.target.value)} tokens={tokens} required />
          {error && <p className="text-xs text-red-500">{error}</p>}
          <PrimaryButton disabled={loading}>
            {loading ? <Loader2 size={15} className="animate-spin" /> : null}
            Update Password
          </PrimaryButton>
        </form>
      )}
    </ModalShell>
  );
}

/* ---------------------------------------------------------
   TWO-FACTOR AUTHENTICATION — POST /auth/2fa
--------------------------------------------------------- */
export function TwoFactorModal({ dark, tokens, token, enabled, onClose, onChanged }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const toggle = async () => {
    setLoading(true);
    setError("");
    try {
      await setTwoFactor(token, !enabled);
      onChanged(!enabled);
      onClose();
    } catch (err) {
      setError(err.message || "Couldn't update two-factor authentication.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <ModalShell dark={dark} tokens={tokens} title="Two-Factor Authentication" onClose={onClose}>
      <p className={cx("text-sm mb-4", tokens.textMuted)}>
        {enabled
          ? "Two-factor authentication is currently enabled on your account."
          : "Add an extra layer of security by requiring a one-time code at sign in."}
      </p>
      {error && <p className="text-xs text-red-500 mb-3">{error}</p>}
      <PrimaryButton onClick={toggle} disabled={loading} tone={enabled ? "danger" : "primary"}>
        {loading ? <Loader2 size={15} className="animate-spin" /> : null}
        {enabled ? "Disable Two-Factor" : "Enable Two-Factor"}
      </PrimaryButton>
    </ModalShell>
  );
}

/* ---------------------------------------------------------
   LOGIN SESSIONS — no session-tracking endpoint on the backend
   yet, so this shows the one session that actually exists: this
   browser. "Sign out" here is real — it clears the local token.
--------------------------------------------------------- */
export function SessionsModal({ dark, tokens, onClose, onSignOut }) {
  const device = typeof navigator !== "undefined" ? navigator.userAgent : "This device";
  return (
    <ModalShell dark={dark} tokens={tokens} title="Login Sessions" onClose={onClose}>
      <div className={cx("rounded-xl p-4 mb-4", tokens.cardAlt)}>
        <p className={cx("text-sm font-medium", tokens.text)}>Current Session</p>
        <p className={cx("text-xs mt-1 break-words", tokens.textMuted)}>{device}</p>
      </div>
      <p className={cx("text-xs mb-4", tokens.textFaint)}>
        This is the only session tied to your account right now.
      </p>
      <PrimaryButton onClick={onSignOut} tone="danger">Sign Out of This Session</PrimaryButton>
    </ModalShell>
  );
}

/* ---------------------------------------------------------
   LANGUAGE — English only for now, but a real, working setting.
--------------------------------------------------------- */
export function LanguageModal({ dark, tokens, onClose }) {
  return (
    <ModalShell dark={dark} tokens={tokens} title="Language" onClose={onClose}>
      <label className={cx("block text-xs font-medium mb-1.5", tokens.textMuted)}>App Language</label>
      <select disabled value="English" className={cx("w-full rounded-lg border px-3.5 py-2.5 text-sm outline-none", tokens.input)}>
        <option>English</option>
      </select>
      <p className={cx("text-xs mt-3", tokens.textFaint)}>
        More languages are on the way — English is the only option for now.
      </p>
    </ModalShell>
  );
}

/* ---------------------------------------------------------
   EMAIL PREFERENCES — persisted through the existing profile
   patch endpoint under a new "email_preferences" key.
--------------------------------------------------------- */
export function EmailPreferencesModal({ dark, tokens, token, profile, onClose, onSaved }) {
  const initial = new Set(String(profile?.email_preferences || "").split(",").map((s) => s.trim()).filter(Boolean));
  const [jobAlerts, setJobAlerts] = useState(initial.has("job_alerts"));
  const [productUpdates, setProductUpdates] = useState(initial.has("product_updates"));
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const submit = async () => {
    setLoading(true);
    setError("");
    const prefs = [jobAlerts && "job_alerts", productUpdates && "product_updates"].filter(Boolean).join(",");
    try {
      await updateProfile(token, { email_preferences: prefs });
      onSaved(prefs);
      onClose();
    } catch (err) {
      setError(err.message || "Couldn't save your email preferences.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <ModalShell dark={dark} tokens={tokens} title="Email Preferences" onClose={onClose}>
      <div className="space-y-3 mb-4">
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={jobAlerts} onChange={(e) => setJobAlerts(e.target.checked)} />
          <span className={tokens.text}>Job match alerts</span>
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={productUpdates} onChange={(e) => setProductUpdates(e.target.checked)} />
          <span className={tokens.text}>Product updates</span>
        </label>
      </div>
      {error && <p className="text-xs text-red-500 mb-3">{error}</p>}
      <PrimaryButton onClick={submit} disabled={loading}>
        {loading ? <Loader2 size={15} className="animate-spin" /> : null}
        Save Preferences
      </PrimaryButton>
    </ModalShell>
  );
}
