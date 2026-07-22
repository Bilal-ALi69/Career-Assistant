import { useEffect, useRef, useState } from "react";
import { checkPasswordStrength } from "../lib/api";

const cx = (...a) => a.filter(Boolean).join(" ");

const BAR_COLORS = [
  "bg-red-500",      // 0 - very weak
  "bg-orange-500",   // 1 - weak
  "bg-amber-400",    // 2 - fair
  "bg-lime-500",     // 3 - good
  "bg-emerald-500",  // 4 - strong
];

const TEXT_COLORS = [
  "text-red-500",
  "text-orange-500",
  "text-amber-500",
  "text-lime-600",
  "text-emerald-500",
];

export default function PasswordStrengthMeter({ password, dark, tokens, minLength = 12 }) {
  const [result, setResult] = useState(null);
  const [checking, setChecking] = useState(false);
  const debounceRef = useRef(null);
  const abortRef = useRef(null);

  useEffect(() => {
    if (!password) {
      setResult(null);
      setChecking(false);
      return;
    }
    clearTimeout(debounceRef.current);
    if (abortRef.current) abortRef.current.abort();

    setChecking(true);
    debounceRef.current = setTimeout(() => {
      const controller = new AbortController();
      abortRef.current = controller;
      checkPasswordStrength(password, controller.signal)
        .then((r) => { setResult(r); setChecking(false); })
        .catch((err) => {
          if (err.name === "AbortError") return;
          setResult(null);
          setChecking(false);
        });
    }, 250);

    return () => clearTimeout(debounceRef.current);
  }, [password]);

  if (!password) return null;

  const meetsLength = password.length >= minLength;

  // No score yet (still checking, or the backend call failed) — don't
  // fabricate a strength value, just show a neutral state.
  if (result == null) {
    return (
      <div className="mt-1.5">
        <p className={cx("text-xs", tokens?.textFaint || "text-slate-500")}>
          {checking ? "Checking password strength…" : !meetsLength ? `${minLength - password.length} more character${minLength - password.length === 1 ? "" : "s"} needed` : ""}
        </p>
      </div>
    );
  }

  const score = Math.max(0, Math.min(4, result.score ?? 0));

  return (
    <div className="mt-1.5 space-y-1.5">
      <div className="flex gap-1">
        {[0, 1, 2, 3].map((i) => (
          <div
            key={i}
            className={cx(
              "h-1.5 flex-1 rounded-full transition-colors duration-300",
              i <= score ? BAR_COLORS[score] : dark ? "bg-slate-800" : "bg-gray-200"
            )}
          />
        ))}
      </div>
      <div className="flex items-center justify-between">
        <span className={cx("text-xs font-medium", TEXT_COLORS[score])}>
          {result.label || "…"}
        </span>
        {!meetsLength && (
          <span className={cx("text-xs", tokens?.textFaint || "text-slate-500")}>
            {minLength - password.length} more character{minLength - password.length === 1 ? "" : "s"} needed
          </span>
        )}
      </div>
      {result.feedback && meetsLength && (
        <p className={cx("text-xs", tokens?.textFaint || "text-slate-500")}>{result.feedback}</p>
      )}
    </div>
  );
}
