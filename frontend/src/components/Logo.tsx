type Props = {
  size?: "sm" | "md" | "lg";
  variant?: "full" | "icon";
};

const sizes = {
  sm: { height: 24, fontSize: 15 },
  md: { height: 32, fontSize: 20 },
  lg: { height: 48, fontSize: 30 },
};

export default function Logo({ size = "md", variant = "full" }: Props) {
  const { height, fontSize } = sizes[size];

  if (variant === "icon") {
    return (
      <svg
        width={height}
        height={height}
        viewBox="0 0 32 32"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        aria-label="GyanGrit"
      >
        {/* Book base */}
        <rect x="4" y="8" width="24" height="18" rx="3" fill="var(--brand-primary)" opacity="0.15" />
        <rect x="4" y="8" width="24" height="18" rx="3" stroke="var(--brand-primary)" strokeWidth="1.5" fill="none" />
        {/* Spine */}
        <line x1="16" y1="8" x2="16" y2="26" stroke="var(--brand-primary)" strokeWidth="1.5" />
        {/* Lines */}
        <line x1="19" y1="13" x2="25" y2="13" stroke="var(--brand-primary)" strokeWidth="1.2" strokeLinecap="round" />
        <line x1="19" y1="17" x2="25" y2="17" stroke="var(--brand-primary)" strokeWidth="1.2" strokeLinecap="round" />
        <line x1="19" y1="21" x2="23" y2="21" stroke="var(--brand-primary)" strokeWidth="1.2" strokeLinecap="round" />
        {/* Flame / spark — the "Grit" element */}
        <path
          d="M10 22 C10 18 13 16 12 13 C13.5 15 15 14 14 11 C16 13.5 15 17 13 19 C14.5 18 16 17 15 14.5 C17 17 15 21 12 22 Z"
          fill="var(--brand-primary)"
          opacity="0.9"
        />
      </svg>
    );
  }

  return (
    <div
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: "var(--space-2)",
        userSelect: "none",
      }}
      aria-label="GyanGrit"
    >
      <Logo size={size} variant="icon" />
      <span
        style={{
          fontFamily: "var(--font-display)",
          fontSize,
          fontWeight: 800,
          letterSpacing: "-0.04em",
          color: "var(--text-primary)",
          lineHeight: 1,
        }}
      >
        Gyan<span style={{ color: "var(--brand-primary)" }}>Grit</span>
      </span>
    </div>
  );
}