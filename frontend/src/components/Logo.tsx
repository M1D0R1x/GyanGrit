// components.Logo — Chalk & Sunlight v3
type Props = {
  size?:    "xs" | "sm" | "md" | "lg";
  variant?: "full" | "icon";
};

const SIZES = {
  xs: { icon: 18, text: "0.875rem" },
  sm: { icon: 22, text: "1.0625rem" },
  md: { icon: 28, text: "1.25rem" },
  lg: { icon: 36, text: "1.5rem" },
};

export default function Logo({ size = "sm", variant = "full" }: Props) {
  const s = SIZES[size];

  return (
    <div className="logo" style={{ gap: variant === "full" ? 8 : 0 }}>
      {/* Icon mark — book with a spark */}
      <svg
        width={s.icon}
        height={s.icon}
        viewBox="0 0 32 32"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden="true"
        style={{ flexShrink: 0 }}
      >
        {/* Book body */}
        <rect x="4" y="4" width="18" height="24" rx="3" fill="var(--saffron)" opacity="0.15" />
        <rect x="4" y="4" width="18" height="24" rx="3" stroke="var(--saffron)" strokeWidth="1.8" />
        {/* Spine */}
        <line x1="4" y1="8" x2="22" y2="8" stroke="var(--saffron)" strokeWidth="1.4" opacity="0.5" />
        {/* Lines */}
        <line x1="8" y1="13" x2="18" y2="13" stroke="var(--saffron)" strokeWidth="1.4" strokeLinecap="round" />
        <line x1="8" y1="17" x2="16" y2="17" stroke="var(--saffron)" strokeWidth="1.4" strokeLinecap="round" />
        <line x1="8" y1="21" x2="18" y2="21" stroke="var(--saffron)" strokeWidth="1.4" strokeLinecap="round" />
        {/* Spark */}
        <circle cx="24" cy="8" r="5" fill="var(--saffron)" />
        <path d="M24 5.5v1.2M24 9.3v1.2M21.5 8h1.2M25.3 8h1.2M22.4 6.4l0.85 0.85M25.75 9.75l0.85 0.85M25.75 6.4l-0.85 0.85M22.4 9.75l-0.85 0.85"
          stroke="#fff" strokeWidth="1" strokeLinecap="round" />
      </svg>

      {variant === "full" && (
        <span className="logo__wordmark" style={{ fontSize: s.text }}>
          Gyan<span>Grit</span>
        </span>
      )}
    </div>
  );
}
