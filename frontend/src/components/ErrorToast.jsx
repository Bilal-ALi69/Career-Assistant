import { useState, useEffect, useCallback, useRef } from "react";
import { AlertTriangle, CheckCircle2, Info, XCircle, X } from "lucide-react";

/* ---------------------------------------------------------
   TOAST NOTIFICATION SYSTEM
   Lightweight pub/sub — any component can call showToast()
   without prop drilling. The <ToastContainer /> renders them.
--------------------------------------------------------- */

let _id = 0;
const _listeners = new Set();

function emit(toasts) {
  _listeners.forEach((fn) => fn(toasts));
}

let _toasts = [];

function push(type, message, opts = {}) {
  const id = ++_id;
  const toast = { id, type, message, duration: opts.duration ?? (type === "error" ? 6000 : 4000) };
  _toasts = [..._toasts, toast];
  emit(_toasts);
  if (toast.duration > 0) {
    setTimeout(() => dismiss(id), toast.duration);
  }
  return id;
}

export function showToast(message, opts = {}) { return push("info", message, opts); }
export function showErrorToast(message, opts = {}) { return push("error", message, { duration: 7000, ...opts }); }
export function showSuccessToast(message, opts = {}) { return push("success", message, opts); }
export function showWarningToast(message, opts = {}) { return push("warning", message, opts); }

export function dismiss(id) {
  _toasts = _toasts.filter((t) => t.id !== id);
  emit(_toasts);
}

/* ---------------------------------------------------------
   TOAST CONTAINER — renders at bottom-right, subscribes
   to the pub/sub channel above.
--------------------------------------------------------- */

const cx = (...a) => a.filter(Boolean).join(" ");

const TOAST_CONFIG = {
  error:   { icon: XCircle,    darkBg: "bg-red-950/90 border-red-800/60",    lightBg: "bg-white border-red-200",    iconClass: "text-red-400",    lightIconClass: "text-red-500" },
  success: { icon: CheckCircle2, darkBg: "bg-emerald-950/90 border-emerald-800/60", lightBg: "bg-white border-emerald-200", iconClass: "text-emerald-400", lightIconClass: "text-emerald-500" },
  warning: { icon: AlertTriangle, darkBg: "bg-amber-950/90 border-amber-800/60",  lightBg: "bg-white border-amber-200",  iconClass: "text-amber-400",  lightIconClass: "text-amber-500" },
  info:    { icon: Info,        darkBg: "bg-zinc-800/90 border-zinc-700/60",   lightBg: "bg-white border-[#e2e8f0]",  iconClass: "text-[var(--accent-400)]", lightIconClass: "text-[var(--accent-600)]" },
};

function ToastItem({ toast, dark, onDismiss }) {
  const [exiting, setExiting] = useState(false);
  const config = TOAST_CONFIG[toast.type] || TOAST_CONFIG.info;
  const IconComp = config.icon;

  const handleDismiss = useCallback(() => {
    setExiting(true);
    setTimeout(() => onDismiss(toast.id), 180);
  }, [onDismiss, toast.id]);

  return (
    <div
      className={cx(
        "flex items-start gap-3 px-4 py-3 rounded-xl border shadow-lg max-w-sm w-full pointer-events-auto",
        exiting ? "animate-fade-out-down" : "animate-fade-in-up",
        dark ? config.darkBg : config.lightBg,
      )}
    >
      <IconComp size={16} className={cx("shrink-0 mt-0.5", dark ? config.iconClass : config.lightIconClass)} />
      <p className={cx("flex-1 text-sm leading-snug", dark ? "text-slate-200" : "text-slate-700")}>{toast.message}</p>
      <button onClick={handleDismiss} className={cx("shrink-0 mt-0.5 transition-colors", dark ? "text-slate-500 hover:text-slate-300" : "text-slate-400 hover:text-slate-600")}>
        <X size={14} />
      </button>
    </div>
  );
}

export default function ToastContainer({ dark }) {
  const [toasts, setToasts] = useState(_toasts);
  const mountedRef = useRef(false);

  useEffect(() => {
    mountedRef.current = true;
    _listeners.add(setToasts);
    return () => { _listeners.delete(setToasts); };
  }, []);

  if (toasts.length === 0) return null;

  return (
    <div className="fixed bottom-5 right-5 z-[200] flex flex-col gap-2 items-end pointer-events-none">
      {toasts.map((t) => (
        <ToastItem key={t.id} toast={t} dark={dark} onDismiss={dismiss} />
      ))}
    </div>
  );
}
