import { Check } from "lucide-react";

const cx = (...a) => a.filter(Boolean).join(" ");

export default function CustomCheckbox({ checked, onChange, label, dark, tokens }) {
  return (
    <label className="flex items-center gap-2.5 text-sm cursor-pointer select-none group">
      <span
        onClick={() => onChange(!checked)}
        className={cx(
          "relative h-[18px] w-[18px] rounded-[5px] border flex items-center justify-center shrink-0 transition-all duration-200",
          checked
            ? "bg-[var(--accent-500)] border-[var(--accent-500)]"
            : dark
              ? "border-zinc-600 bg-[#131313] group-hover:border-zinc-500"
              : "border-[#cbd5e1] bg-white group-hover:border-[#94a3b8]"
        )}
      >
        {checked && (
          <Check size={12} className="text-white" strokeWidth={3} />
        )}
      </span>
      <span onClick={() => onChange(!checked)} className={tokens.text}>{label}</span>
    </label>
  );
}
