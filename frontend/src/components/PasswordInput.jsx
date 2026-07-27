import { useState } from "react";
import { Eye, EyeOff } from "lucide-react";

const cx = (...a) => a.filter(Boolean).join(" ");

// Same visual footprint as the plain LabeledInput, but with a show/hide
// toggle — used on the sign-in / create-account form and anywhere else a
// password is typed (e.g. the Change Password modal).
export default function PasswordInput({ label, value, onChange, tokens, className = "", ...rest }) {
  const [show, setShow] = useState(false);
  return (
    <div className={className}>
      {label && <label className={cx("block text-xs font-medium mb-1.5", tokens.textMuted)}>{label}</label>}
      <div className="relative">
        <input
          type={show ? "text" : "password"}
          value={value}
          onChange={onChange}
          className={cx(
            "w-full rounded-lg border px-3.5 py-2.5 pr-10 text-sm outline-none focus:border-[var(--accent-500)] transition-colors",
            tokens.input
          )}
          {...rest}
        />
        <button
          type="button"
          onClick={() => setShow((s) => !s)}
          tabIndex={-1}
          aria-label={show ? "Hide password" : "Show password"}
          className={cx(
            "absolute right-2.5 top-1/2 -translate-y-1/2 transition-colors",
            tokens.textFaint
          )}
        >
          {show ? <EyeOff size={16} /> : <Eye size={16} />}
        </button>
      </div>
    </div>
  );
}
