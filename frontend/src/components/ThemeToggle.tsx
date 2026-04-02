import { useEffect, useState } from "react";

export function ThemeToggle() {
  const [theme, setTheme] = useState<"light" | "dark">(() => {
    const saved = localStorage.getItem("theme");
    return (saved === "dark") ? "dark" : "light";
  });

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    localStorage.setItem("theme", theme);
  }, [theme]);

  const toggle = () => setTheme(t => t === "light" ? "dark" : "light");

  return (
    <button
      onClick={toggle}
      className="nefee-glass"
      style={{
        position: "fixed",
        bottom: "var(--space-6)",
        left: "var(--space-4)",
        zIndex: 1000,
        width: 48,
        height: 48,
        borderRadius: "var(--radius-full)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        cursor: "pointer",
        color: "var(--ink-primary)",
        boxShadow: "var(--shadow-md)",
        transition: "all var(--transition-base)",
      }}
      aria-label="Toggle Theme"
    >
      <div style={{
        position: "relative",
        width: 24,
        height: 24,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        overflow: "hidden"
      }}>
        {/* Sun Icon */}
        <svg
          width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
          style={{
            position: "absolute",
            transition: "all var(--transition-base)",
            transform: theme === "light" ? "translateY(0) rotate(0)" : "translateY(24px) rotate(90deg)",
            opacity: theme === "light" ? 1 : 0,
          }}
        >
          <circle cx="12" cy="12" r="5"></circle>
          <line x1="12" y1="1" x2="12" y2="3"></line>
          <line x1="12" y1="21" x2="12" y2="23"></line>
          <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"></line>
          <line x1="18.36" y1="18.36" x2="19.78" y2="19.78"></line>
          <line x1="1" y1="12" x2="3" y2="12"></line>
          <line x1="21" y1="12" x2="23" y2="12"></line>
          <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"></line>
          <line x1="18.36" y1="5.64" x2="19.78" y2="4.22"></line>
        </svg>

        {/* Moon Icon */}
        <svg
          width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
          style={{
            position: "absolute",
            transition: "all var(--transition-base)",
            transform: theme === "dark" ? "translateY(0) rotate(0)" : "translateY(-24px) rotate(-90deg)",
            opacity: theme === "dark" ? 1 : 0,
          }}
        >
          <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path>
        </svg>
      </div>
    </button>
  );
}
