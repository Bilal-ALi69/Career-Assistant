import { AlertTriangle, RefreshCw } from "lucide-react";

const cx = (...a) => a.filter(Boolean).join(" ");

/* ---------------------------------------------------------
   ERROR FALLBACK CARD
   A styled placeholder shown when a data section or API call
   fails to load. Features a clear "Try Again" action.
--------------------------------------------------------- */

export default function ErrorFallback({ dark, tokens, title, message, onRetry, className = "" }) {
  return (
    <div className={cx("rounded-2xl p-8 flex flex-col items-center text-center", tokens.card, className)}>
      <div className={cx("h-12 w-12 rounded-xl flex items-center justify-center mb-4", dark ? "bg-red-500/10" : "bg-red-50")}>
        <AlertTriangle size={22} className="text-red-500" />
      </div>
      <h3 className={cx("text-base font-semibold mb-1.5", tokens.text)}>{title || "Something went wrong"}</h3>
      <p className={cx("text-sm max-w-xs mb-5", tokens.textMuted)}>
        {message || "We couldn't load this section. Please try again."}
      </p>
      {onRetry && (
        <button
          onClick={onRetry}
          className={cx(
            "inline-flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-semibold transition-all duration-200",
            "active:scale-[0.97] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-500)] focus-visible:ring-offset-2",
            dark
              ? "bg-zinc-800 text-slate-200 hover:bg-zinc-700 border border-zinc-700"
              : "bg-white text-slate-700 hover:bg-[#f1f5f9] border border-[#e2e8f0] shadow-sm",
          )}
        >
          <RefreshCw size={14} /> Try Again
        </button>
      )}
    </div>
  );
}
