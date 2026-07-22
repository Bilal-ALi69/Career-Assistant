import { useState } from "react";
import {
  User, Briefcase, SlidersHorizontal, Brain, Target, FileText,
  ChevronLeft, ChevronRight, Loader2, CheckCircle2,
} from "lucide-react";
import { PROFILE_FIELD_GROUPS, defaultProfileValues } from "../lib/profileFields";
import ProfileField from "./ProfileField";

const cx = (...a) => a.filter(Boolean).join(" ");

const GROUP_ICONS = {
  personal: User,
  professional: Briefcase,
  preferences: SlidersHorizontal,
  personality: Brain,
  goals: Target,
  other: FileText,
};

// Survey steps mirror the shared profile field groups, so anything added
// in src/lib/profileFields.js automatically shows up here too.
const STEPS = PROFILE_FIELD_GROUPS.map((g) => ({ ...g, icon: GROUP_ICONS[g.key] || FileText }));

export default function SignupSurvey({ dark, tokens, onComplete, onSkip, submitting, submitError }) {
  const [stepIndex, setStepIndex] = useState(0);
  const [data, setData] = useState(defaultProfileValues);

  const step = STEPS[stepIndex];
  const isLast = stepIndex === STEPS.length - 1;
  const isFirst = stepIndex === 0;

  const setValue = (key, value) => setData((d) => ({ ...d, [key]: value }));

  const requiredMissing = step.fields.some(
    (f) => !f.optional && !String(data[f.key] ?? "").trim()
  );

  const next = () => {
    if (isLast) {
      onComplete(data);
    } else {
      setStepIndex((i) => i + 1);
    }
  };
  const back = () => setStepIndex((i) => Math.max(0, i - 1));

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm px-4 py-8 animate-overlay-in">
      <div className={cx("w-full max-w-xl rounded-2xl shadow-2xl flex flex-col max-h-[90vh] animate-modal-in", dark ? "bg-[#0F1526] border border-slate-800" : "bg-white border border-gray-200")}>
        {/* Progress */}
        <div className="px-6 pt-6">
          <div className="flex items-center gap-1.5">
            {STEPS.map((s, i) => (
              <div
                key={s.key}
                className={cx(
                  "h-1.5 flex-1 rounded-full transition-colors duration-300",
                  i < stepIndex ? "bg-blue-500" : i === stepIndex ? "bg-blue-500/60" : dark ? "bg-slate-800" : "bg-gray-200"
                )}
              />
            ))}
          </div>
          <p className={cx("text-xs mt-2", tokens.textFaint)}>Step {stepIndex + 1} of {STEPS.length}</p>
        </div>

        {/* Header */}
        <div className="px-6 pt-4 pb-2">
          <div className="flex items-center gap-2.5">
            <div className={cx("h-9 w-9 rounded-xl flex items-center justify-center", dark ? "bg-blue-500/10 text-blue-400" : "bg-blue-50 text-blue-600")}>
              <step.icon size={17} />
            </div>
            <div>
              <h2 className={cx("text-lg font-bold leading-tight", tokens.text)}>{step.title}</h2>
              <p className={cx("text-xs", tokens.textMuted)}>{step.subtitle}</p>
            </div>
          </div>
        </div>

        {/* Fields */}
        <div className="px-6 py-4 overflow-y-auto space-y-4">
          {step.fields.map((f) => (
            <ProfileField key={f.key} field={f} value={data[f.key]} onChange={setValue} tokens={tokens} />
          ))}
          {submitError && isLast && (
            <p className="text-xs text-red-500">{submitError}</p>
          )}
        </div>

        {/* Footer */}
        <div className={cx("px-6 py-4 border-t flex items-center justify-between", tokens.border)}>
          <button
            onClick={onSkip}
            className={cx("text-xs", tokens.textFaint, "hover:underline")}
          >
            Skip for now
          </button>
          <div className="flex items-center gap-2">
            {!isFirst && (
              <button
                onClick={back}
                className={cx("inline-flex items-center gap-1 rounded-xl px-4 py-2.5 text-sm font-semibold transition-colors", dark ? "text-slate-300 hover:bg-slate-800/60" : "text-slate-600 hover:bg-gray-100")}
              >
                <ChevronLeft size={14} /> Back
              </button>
            )}
            <button
              onClick={next}
              disabled={requiredMissing || submitting}
              className="inline-flex items-center gap-1.5 rounded-xl px-5 py-2.5 text-sm font-semibold bg-blue-600 hover:bg-blue-500 text-white shadow-lg shadow-blue-600/20 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
            >
              {submitting ? (
                <><Loader2 size={14} className="animate-spin" /> Saving…</>
              ) : isLast ? (
                <><CheckCircle2 size={14} /> Finish</>
              ) : (
                <>Next <ChevronRight size={14} /></>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
