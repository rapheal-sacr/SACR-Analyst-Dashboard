import {
  createContext,
  useContext,
  useEffect,
  useLayoutEffect,
  useMemo,
  useState,
} from "react";
import type { ReactNode } from "react";

type EffectiveTheme = "light" | "dark";
const THEME_STORAGE_KEY = "sacr-theme";

type ThemeContextValue = {
  mode: EffectiveTheme;
  effectiveTheme: EffectiveTheme;
  toggleMode: () => void;
};

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined);

function getSystemTheme(): EffectiveTheme {
  if (typeof window === "undefined") {
    return "light";
  }

  return window.matchMedia("(prefers-color-scheme: dark)").matches
    ? "dark"
    : "light";
}

function readInitialTheme(): EffectiveTheme {
  if (typeof window === "undefined") {
    return "light";
  }

  const stored = window.localStorage.getItem(THEME_STORAGE_KEY);
  if (stored === "light" || stored === "dark") {
    return stored;
  }

  const detected = getSystemTheme();
  window.localStorage.setItem(THEME_STORAGE_KEY, detected);
  return detected;
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [mode, setMode] = useState<EffectiveTheme>(readInitialTheme);
  const effectiveTheme: EffectiveTheme = mode;

  useLayoutEffect(() => {
    if (typeof document === "undefined") {
      return;
    }
    document.documentElement.setAttribute("data-theme", effectiveTheme);
  }, [effectiveTheme]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }
    window.localStorage.setItem(THEME_STORAGE_KEY, mode);
  }, [mode]);

  const toggleMode = () => {
    setMode((current) => (current === "light" ? "dark" : "light"));
  };

  const value = useMemo(() => ({ mode, effectiveTheme, toggleMode }), [mode, effectiveTheme]);

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error("useTheme must be used within ThemeProvider.");
  }
  return context;
}
