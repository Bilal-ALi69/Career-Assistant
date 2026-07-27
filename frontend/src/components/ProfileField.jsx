import CustomSelect from "./CustomSelect";
import DatePicker from "./DatePicker";

const cx = (...a) => a.filter(Boolean).join(" ");

export default function ProfileField({ field, value, onChange, tokens, dark }) {
  const commonClass = cx(
    "w-full rounded-lg border px-3.5 py-2.5 text-sm outline-none focus:border-[var(--accent-500)] transition-colors",
    tokens.input
  );
  return (
    <div>
      <label className={cx("block text-xs font-medium mb-1.5", tokens.textMuted)}>
        {field.label} {field.required && <span className="text-red-500">*</span>} {field.optional && <span className={tokens.textFaint}>(optional)</span>}
      </label>
      {field.type === "textarea" ? (
        <textarea
          rows={3}
          value={value ?? ""}
          placeholder={field.placeholder}
          onChange={(e) => onChange(field.key, e.target.value)}
          className={cx(commonClass, "resize-none")}
        />
      ) : field.type === "select" ? (
        <CustomSelect
          value={value ?? ""}
          onChange={(val) => onChange(field.key, val)}
          options={field.options.map((o) => ({ value: o, label: o }))}
          placeholder="Select…"
          dark={dark}
          tokens={tokens}
        />
      ) : field.type === "date" ? (
        <DatePicker
          value={value ?? ""}
          onChange={(val) => onChange(field.key, val)}
          dark={dark}
          tokens={tokens}
          placeholder="Select date"
        />
      ) : (
        <input
          type={field.type}
          value={value ?? ""}
          placeholder={field.placeholder}
          onChange={(e) => onChange(field.key, e.target.value)}
          className={commonClass}
        />
      )}
    </div>
  );
}
