export function accentAttr() {
  if (typeof document === "undefined") return null;
  const el = document.querySelector("[data-accent]");
  return el ? el.getAttribute("data-accent") : null;
}
