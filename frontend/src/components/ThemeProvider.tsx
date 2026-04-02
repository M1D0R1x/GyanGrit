import { createContext, useContext, useEffect, useState } from "react";
import { flushSync } from "react-dom";

type ThemeContextType = {
  theme: "light" | "dark";
  toggleTheme: (event?: React.MouseEvent) => void;
};

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setTheme] = useState<"light" | "dark">(() => {
    return (localStorage.getItem("theme") === "dark") ? "dark" : "light";
  });

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    localStorage.setItem("theme", theme);
  }, [theme]);

  const toggleTheme = () => {
    const nextTheme = theme === "light" ? "dark" : "light";

    // Fallback for browsers that don't support View Transitions
    if (!document.startViewTransition) {
      setTheme(nextTheme);
      return;
    }

    // Trigger explicit flush to DOM by wrapping in flushSync
    document.startViewTransition(() => {
      flushSync(() => {
        setTheme(nextTheme);
      });
    });
  };

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be inside ThemeProvider");
  return ctx;
}
