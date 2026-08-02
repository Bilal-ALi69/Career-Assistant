import { useState, useRef, useEffect, useCallback } from "react";
import { createPortal } from "react-dom";
import { ChevronDown, ChevronLeft, ChevronRight } from "lucide-react";
import { accentAttr } from "../lib/portalAccent";

const cx = (...a) => a.filter(Boolean).join(" ");

const MONTHS = [
  "January","February","March","April","May","June",
  "July","August","September","October","November","December",
];
const MONTH_SHORT = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
const DAYS = ["Su","Mo","Tu","We","Th","Fr","Sa"];

function daysInMonth(year, month) {
  return new Date(year, month + 1, 0).getDate();
}

function parseDate(val) {
  if (!val) return null;
  const [y, m, d] = val.split("-").map(Number);
  if (!y || !m || !d) return null;
  return new Date(y, m - 1, d);
}

function formatDate(year, month, day) {
  return `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

export default function DatePicker({ value, onChange, dark, tokens, placeholder = "Select date" }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  const initial = parseDate(value);
  const [viewYear, setViewYear] = useState(initial?.getFullYear() ?? new Date().getFullYear());
  const [viewMonth, setViewMonth] = useState(initial?.getMonth() ?? new Date().getMonth());

  // "calendar" | "month" | "year"
  const [headerView, setHeaderView] = useState("calendar");
  const [yearInput, setYearInput] = useState(String(viewYear));

  const today = new Date();
  const selected = parseDate(value);

  const close = useCallback(() => {
    setOpen(false);
    setHeaderView("calendar");
  }, []);

  useEffect(() => {
    if (!open) return;
    const handler = (e) => {
      if (ref.current && !ref.current.contains(e.target)) close();
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open, close]);

  const pick = (day) => {
    onChange(formatDate(viewYear, viewMonth, day));
    close();
  };

  const prevMonth = () => {
    if (viewMonth === 0) { setViewMonth(11); setViewYear((y) => y - 1); }
    else setViewMonth((m) => m - 1);
  };

  const nextMonth = () => {
    if (viewMonth === 11) { setViewMonth(0); setViewYear((y) => y + 1); }
    else setViewMonth((m) => m + 1);
  };

  const selectMonth = (m) => {
    setViewMonth(m);
    setHeaderView("calendar");
  };

  const commitYear = () => {
    const n = parseInt(yearInput, 10);
    if (n >= 1900 && n <= 2100) setViewYear(n);
    setHeaderView("calendar");
  };

  const totalDays = daysInMonth(viewYear, viewMonth);
  const firstDow = new Date(viewYear, viewMonth, 1).getDay();

  const displayLabel = selected
    ? selected.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })
    : null;

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className={cx(
          "w-full flex items-center justify-between rounded-lg px-2.5 py-1.5 text-sm outline-none transition-colors border text-left cursor-pointer",
          tokens.input,
          dark ? "border-white/10" : "border-[#e2e8f0]"
        )}
      >
        <span className={cx(displayLabel ? tokens.text : "opacity-50", !displayLabel && tokens.textMuted)}>
          {displayLabel || placeholder}
        </span>
        <ChevronDown
          size={15}
          className={cx("shrink-0 transition-transform duration-200", tokens.textMuted, open && "rotate-180")}
        />
      </button>

      {open &&
        createPortal(
          <>
            <div
              className={cx("md:hidden fixed inset-0 z-[100]", dark ? "bg-black/60" : "bg-black/40")}
              onMouseDown={close}
              data-accent={accentAttr()}
            />
            <div
              onMouseDown={(e) => e.stopPropagation()}
              data-accent={accentAttr()}
              className={cx(
                "fixed md:absolute bottom-0 md:bottom-auto inset-x-0 md:inset-x-auto w-full md:w-[280px]",
                "z-[100] md:z-50 mt-0 md:mt-1.5 rounded-t-2xl md:rounded-xl border p-3",
                "animate-sheet-in md:animate-drop-in shadow-2xl md:shadow-xl",
                dark
                  ? "bg-[#2f2f2e] border-zinc-700/80 md:shadow-black/40"
                  : "bg-[#f8fafc] border-[#e2e8f0] md:shadow-black/10"
              )}
              style={{ paddingBottom: "max(env(safe-area-inset-bottom), 1rem)" }}
            >
              <div className="md:hidden">
                <div className="mx-auto mt-1 mb-3 h-1 w-10 rounded-full bg-current opacity-20" />
                <p className={cx("mb-3 px-1 text-xs font-semibold", tokens.textMuted)}>
                  {displayLabel ? `Edit ${displayLabel}` : placeholder}
                </p>
              </div>
          {/* ── Month picker grid ── */}
          {headerView === "month" && (
            <div>
              <div className="flex items-center justify-between mb-3">
                <span className={cx("text-sm font-semibold", tokens.text)}>Select Month</span>
                <button type="button" onClick={() => setHeaderView("calendar")} className={cx("text-xs", dark ? "text-[var(--accent-400)]" : "text-[var(--accent-600)]")}>
                  Back
                </button>
              </div>
              <div className="grid grid-cols-3 gap-1.5">
                {MONTHS.map((m, i) => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => selectMonth(i)}
                    className={cx(
                      "py-2 rounded-lg text-xs font-medium transition-all duration-150",
                      i === viewMonth
                        ? "bg-[var(--accent-500)] text-white shadow-[0_0_8px_rgba(var(--accent-rgb),0.3)]"
                        : dark
                          ? "text-slate-300 hover:bg-white/5"
                          : "text-slate-700 hover:bg-[#f1f5f9]"
                    )}
                  >
                    {MONTH_SHORT[i]}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* ── Year picker ── */}
          {headerView === "year" && (
            <div>
              <div className="flex items-center justify-between mb-3">
                <span className={cx("text-sm font-semibold", tokens.text)}>Select Year</span>
                <button type="button" onClick={() => setHeaderView("calendar")} className={cx("text-xs", dark ? "text-[var(--accent-400)]" : "text-[var(--accent-600)]")}>
                  Back
                </button>
              </div>
              <input
                type="text"
                value={yearInput}
                onChange={(e) => setYearInput(e.target.value.replace(/\D/g, "").slice(0, 4))}
                onKeyDown={(e) => { if (e.key === "Enter") commitYear(); }}
                onBlur={commitYear}
                autoFocus
                className={cx(
                  "w-full rounded-lg px-2.5 py-2 text-sm text-center outline-none border mb-2 transition-colors",
                  tokens.input,
                    dark ? "border-white/10 focus:border-[var(--accent-500)]" : "border-[#e2e8f0] focus:border-[var(--accent-500)]"
                )}
                placeholder="Type year…"
              />
              <div className="grid grid-cols-3 gap-1.5 max-h-[160px] overflow-y-auto">
                {Array.from({ length: 30 }).map((_, i) => {
                  const y = viewYear - 10 + i;
                  return (
                    <button
                      key={y}
                      type="button"
                      onClick={() => { setViewYear(y); setYearInput(String(y)); setHeaderView("calendar"); }}
                      className={cx(
                        "py-2 rounded-lg text-xs font-medium transition-all duration-150",
                        y === viewYear
                          ? "bg-[var(--accent-500)] text-white shadow-[0_0_8px_rgba(var(--accent-rgb),0.3)]"
                          : dark
                            ? "text-slate-300 hover:bg-white/5"
                            : "text-slate-700 hover:bg-[#f1f5f9]"
                      )}
                    >
                      {y}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* ── Calendar grid ── */}
          {headerView === "calendar" && (
            <>
              {/* Header — clickable month + year + nav arrows */}
              <div className="flex items-center justify-between mb-3">
                <button
                  type="button"
                  onClick={prevMonth}
                  className={cx("h-7 w-7 rounded-lg flex items-center justify-center transition-colors", tokens.hover, tokens.textMuted)}
                >
                  <ChevronLeft size={15} />
                </button>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => { setYearInput(String(viewYear)); setHeaderView("month"); }}
                    className={cx("text-sm font-semibold transition-colors rounded-md px-1.5 py-0.5 hover:bg-white/10", tokens.text)}
                  >
                    {MONTHS[viewMonth]}
                  </button>
                  <button
                    type="button"
                    onClick={() => { setYearInput(String(viewYear)); setHeaderView("year"); }}
                    className={cx("text-sm font-semibold transition-colors rounded-md px-1.5 py-0.5 hover:bg-white/10", tokens.text)}
                  >
                    {viewYear}
                  </button>
                </div>
                <button
                  type="button"
                  onClick={nextMonth}
                  className={cx("h-7 w-7 rounded-lg flex items-center justify-center transition-colors", tokens.hover, tokens.textMuted)}
                >
                  <ChevronRight size={15} />
                </button>
              </div>

              {/* Day-of-week labels */}
              <div className="grid grid-cols-7 mb-1">
                {DAYS.map((d) => (
                  <div key={d} className={cx("text-center text-[10px] font-medium py-1", tokens.textFaint)}>
                    {d}
                  </div>
                ))}
              </div>

              {/* Day grid */}
              <div className="grid grid-cols-7">
                {Array.from({ length: firstDow }).map((_, i) => (
                  <div key={`empty-${i}`} />
                ))}

                {Array.from({ length: totalDays }).map((_, i) => {
                  const day = i + 1;
                  const isToday =
                    day === today.getDate() &&
                    viewMonth === today.getMonth() &&
                    viewYear === today.getFullYear();
                  const isSelected =
                    selected &&
                    day === selected.getDate() &&
                    viewMonth === selected.getMonth() &&
                    viewYear === selected.getFullYear();

                  return (
                    <button
                      key={day}
                      type="button"
                      onClick={() => pick(day)}
                      className={cx(
                        "relative h-8 w-full flex items-center justify-center rounded-lg text-xs font-medium transition-all duration-150",
                        isSelected
                          ? "bg-[var(--accent-500)] text-white shadow-[0_0_8px_rgba(var(--accent-rgb),0.35)]"
                          : isToday
                            ? dark
                              ? "text-[var(--accent-400)] font-bold"
                              : "text-[var(--accent-600)] font-bold"
                            : dark
                              ? "text-slate-300 hover:bg-white/5"
                              : "text-slate-700 hover:bg-[#f1f5f9]"
                      )}
                    >
                      {day}
                      {isToday && !isSelected && (
                        <span className={cx(
                          "absolute bottom-1 left-1/2 -translate-x-1/2 h-[3px] w-3 rounded-full",
                          dark ? "bg-[var(--accent-400)]" : "bg-[var(--accent-500)]"
                        )} />
                      )}
                    </button>
                  );
                })}
              </div>

              {/* Today button */}
              <button
                type="button"
                onClick={() => {
                  setViewYear(today.getFullYear());
                  setViewMonth(today.getMonth());
                  onChange(formatDate(today.getFullYear(), today.getMonth(), today.getDate()));
                  close();
                }}
                className={cx(
                  "w-full mt-2 py-1.5 rounded-lg text-xs font-medium transition-colors",
                  dark ? "text-[var(--accent-400)] hover:bg-white/5" : "text-[var(--accent-600)] hover:bg-[#f1f5f9]"
                )}
              >
                Today
              </button>
            </>
          )}
            </div>
          </>,
          document.body
        )}
    </div>
  );
}
