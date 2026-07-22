const cx = (...a) => a.filter(Boolean).join(" ");

export default function ProfileField({ field, value, onChange, tokens }) {
  const commonClass = cx(
    "w-full rounded-lg border px-3.5 py-2.5 text-sm outline-none focus:border-blue-500 transition-colors",
    tokens.input
  );
  return (
    <div>
      <label className={cx("block text-xs font-medium mb-1.5", tokens.textMuted)}>
        {field.label} {field.optional && <span className={tokens.textFaint}>(optional)</span>}
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
        <select
          value={value ?? ""}
          onChange={(e) => onChange(field.key, e.target.value)}
          className={commonClass}
        >
          <option value="" disabled>Select…</option>
          {field.options.map((o) => <option key={o} value={o}>{o}</option>)}
        </select>
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
