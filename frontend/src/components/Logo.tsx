type Props = {
  size?: "sm" | "md" | "lg";
  variant?: "icon" | "full";
};

const sizes = {
  sm: { height: 28, fontSize: "var(--text-lg)" },
  md: { height: 36, fontSize: "var(--text-xl)" },
  lg: { height: 48, fontSize: "var(--text-2xl)" },
};

export default function Logo({ size = "md", variant = "full" }: Props) {
  const { height, fontSize } = sizes[size];

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: "var(--space-2)",
        textDecoration: "none",
        userSelect: "none",
        cursor: "default",
      }}
      aria-label="GyanGrit"
    >
      {/* Inline SVG — no file dependency */}
      <svg
        height={height}
        viewBox="0 0 32 32"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden="true"
        style={{ flexShrink: 0 }}
      >
        {/* Book */}
        <rect x="3" y="7" width="26" height="20" rx="3" fill="#3b82f6" opacity="0.15" />
        <rect x="3" y="7" width="26" height="20" rx="3" stroke="#3b82f6" strokeWidth="1.5" />
        <line x1="16" y1="7" x2="16" y2="27" stroke="#3b82f6" strokeWidth="1.5" />
        <line x1="19" y1="13" x2="25" y2="13" stroke="#3b82f6" strokeWidth="1.2" strokeLinecap="round" />
        <line x1="19" y1="17" x2="25" y2="17" stroke="#3b82f6" strokeWidth="1.2" strokeLinecap="round" />
        <line x1="19" y1="21" x2="23" y2="21" stroke="#3b82f6" strokeWidth="1.2" strokeLinecap="round" />
        {/* Flame */}
        <path
          d="M9 23 C9 19 12 17 11 14 C12.5 16 14 15 13 12 C15 14.5 14 18 12 20 C13.5 19 15 18 14 15.5 C16 18 14 22 11 23 Z"
          fill="#3b82f6"
        />
      </svg>

      {variant === "full" && (
        <span
          style={{
            fontSize,
            fontFamily: "var(--font-display)",
            fontWeight: 700,
            color: "var(--text-primary)",
            letterSpacing: "-0.02em",
            lineHeight: 1,
          }}
        >
          Gyan<span style={{ color: "var(--brand-primary)" }}>Grit</span>
        </span>
      )}
    </div>
  );
}