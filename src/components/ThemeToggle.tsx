import { useEffect, useState } from "react";
import { Moon, Sun } from "lucide-react";

const KEY = "ts-theme";

export function ThemeToggle() {
  const [dark, setDark] = useState(true);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const stored = window.localStorage.getItem(KEY);
    const isDark = stored ? stored === "dark" : true;
    setDark(isDark);
    document.documentElement.classList.toggle("dark", isDark);
    document.documentElement.classList.toggle("light", !isDark);
  }, []);

  const toggle = () => {
    const next = !dark;
    setDark(next);
    document.documentElement.classList.toggle("dark", next);
    document.documentElement.classList.toggle("light", !next);
    try { window.localStorage.setItem(KEY, next ? "dark" : "light"); } catch {}
  };

  return (
    <button
      onClick={toggle}
      aria-label={dark ? "Switch to light mode" : "Switch to dark mode"}
      className="relative inline-flex h-9 w-9 items-center justify-center rounded-full border border-white/10 bg-white/5 text-white transition-all hover:bg-white/10 hover:scale-105 overflow-hidden"
    >
      <Sun
        className={`h-4 w-4 absolute transition-all duration-500 ${dark ? "opacity-0 rotate-90 scale-0" : "opacity-100 rotate-0 scale-100 text-amber-300"}`}
      />
      <Moon
        className={`h-4 w-4 absolute transition-all duration-500 ${dark ? "opacity-100 rotate-0 scale-100 text-slate-200" : "opacity-0 -rotate-90 scale-0"}`}
      />
    </button>
  );
}