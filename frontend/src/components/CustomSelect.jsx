import { useState, useRef, useEffect, useCallback } from "react";
import { createPortal } from "react-dom";
import { ChevronDown } from "lucide-react";

const cx = (...a) => a.filter(Boolean).join(" ");

export default function CustomSelect({
  value,
  onChange,
  options,
  placeholder = "Select…",
  disabled = false,
  dark,
  tokens,
  className = "",
}) {
  const [open, setOpen] = useState(false);
  const [highlighted, setHighlighted] = useState(-1);
  const ref = useRef(null);
  const listRef = useRef(null);

  const selected = options.find((o) => (typeof o === "object" ? o.value : o) === value);
  const label = selected ? (typeof selected === "object" ? selected.label : selected) : null;

  const close = useCallback(() => { setOpen(false); setHighlighted(-1); }, []);

  useEffect(() => {
    if (!open) return;
    const handler = (e) => {
      if (ref.current && !ref.current.contains(e.target)) close();
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open, close]);

  useEffect(() => {
    if (!open || highlighted < 0 || !listRef.current) return;
    const el = listRef.current.children[highlighted];
    if (el) el.scrollIntoView({ block: "nearest" });
  }, [open, highlighted]);

  const handleKey = (e) => {
    if (disabled) return;
    if (!open) {
      if (e.key === "ArrowDown" || e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        setOpen(true);
        setHighlighted(options.findIndex((o) => (typeof o === "object" ? o.value : o) === value));
      }
      return;
    }
    switch (e.key) {
      case "ArrowDown":
        e.preventDefault();
        setHighlighted((h) => (h + 1) % options.length);
        break;
      case "ArrowUp":
        e.preventDefault();
        setHighlighted((h) => (h - 1 + options.length) % options.length);
        break;
      case "Enter":
      case " ":
        e.preventDefault();
        if (highlighted >= 0) {
          const opt = options[highlighted];
          onChange(typeof opt === "object" ? opt.value : opt);
        }
        close();
        break;
      case "Escape":
        close();
        break;
      default:
        break;
    }
  };

  const select = (opt) => {
    onChange(typeof opt === "object" ? opt.value : opt);
    close();
  };

  return (
    <div ref={ref} className={cx("relative", className)}>
      <button
        type="button"
        disabled={disabled}
        onClick={() => { if (!disabled) setOpen(!open); }}
        onKeyDown={handleKey}
        className={cx(
          "w-full flex items-center justify-between rounded-lg px-2.5 py-1.5 text-sm outline-none transition-colors border text-left",
          tokens.input,
          disabled && "opacity-50 cursor-not-allowed",
          !disabled && "cursor-pointer",
          dark ? "border-white/10" : "border-[#e2e8f0]"
        )}
      >
        <span className={cx(label ? tokens.text : "opacity-50", !label && tokens.textMuted)}>
          {label || placeholder}
        </span>
        <ChevronDown
          size={15}
          className={cx(
            "shrink-0 transition-transform duration-200",
            tokens.textMuted,
            open && "rotate-180"
          )}
        />
      </button>

      {open && (
        <>
          <ul
            ref={listRef}
            className={cx(
              "hidden md:block absolute z-50 mt-1.5 w-full rounded-xl border overflow-y-auto py-1 max-h-[240px]",
              "animate-drop-in",
              dark
                ? "bg-[#2f2f2e] border-zinc-700/80 shadow-xl shadow-black/40"
                : "bg-[#f8fafc] border-[#e2e8f0] shadow-xl shadow-black/10"
            )}
          >
            {options.map((opt, i) => {
              const val = typeof opt === "object" ? opt.value : opt;
              const lbl = typeof opt === "object" ? opt.label : opt;
              const isSelected = val === value;
              const isHighlighted = i === highlighted;
              return (
                <li key={val}>
                  <button
                    type="button"
                    onClick={() => select(opt)}
                    onMouseEnter={() => setHighlighted(i)}
                    className={cx(
                      "w-full text-left px-3 py-2 text-sm transition-colors",
                      isSelected
                        ? dark
                          ? "text-[var(--accent-400)] font-medium"
                          : "text-[var(--accent-600)] font-medium"
                        : tokens.text,
                      isHighlighted && !isSelected && (dark ? "bg-white/5" : "bg-[#f1f5f9]"),
                      !isHighlighted && !isSelected && "bg-transparent"
                    )}
                  >
                    {lbl}
                  </button>
                </li>
              );
            })}
          </ul>
          {createPortal(
            <div className="md:hidden fixed inset-0 z-[100]" onMouseDown={close}>
              <div
                className={cx("absolute inset-0", dark ? "bg-black/60" : "bg-black/40")}
                onClick={close}
              />
              <div
                onMouseDown={(e) => e.stopPropagation()}
                className={cx(
                  "absolute bottom-0 left-0 right-0 z-[100] rounded-t-2xl border-t shadow-2xl animate-sheet-in",
                  dark ? "bg-[#2f2f2e] border-zinc-700/80" : "bg-[#f8fafc] border-[#e2e8f0]"
                )}
                style={{ paddingBottom: "max(env(safe-area-inset-bottom), 1rem)" }}
              >
                <div className="mx-auto mt-3 h-1 w-10 rounded-full bg-current opacity-20" />
                <p className={cx("px-5 pt-3 text-xs font-semibold", tokens.textMuted)}>
                  {label || placeholder}
                </p>
                <div className="mt-1 max-h-[50vh] overflow-y-auto pb-2">
                  {options.map((opt) => {
                    const val = typeof opt === "object" ? opt.value : opt;
                    const lbl = typeof opt === "object" ? opt.label : opt;
                    const isSelected = val === value;
                    return (
                      <button
                        key={val}
                        type="button"
                        onClick={() => select(opt)}
                        className={cx(
                          "w-full text-left px-5 py-3.5 text-sm transition-colors",
                          isSelected
                            ? dark
                              ? "text-[var(--accent-400)] font-medium"
                              : "text-[var(--accent-600)] font-medium"
                            : tokens.text
                        )}
                      >
                        {lbl}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>,
            document.body
          )}
        </>
      )}
    </div>
  );
}
