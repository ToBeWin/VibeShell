interface BrandMarkProps {
  compact?: boolean;
}

export function BrandMark({ compact = false }: BrandMarkProps) {
  const sizeClass = compact ? 'h-9 w-9' : 'h-10 w-10';

  return (
    <div
      className={`relative flex ${sizeClass} items-center justify-center overflow-hidden rounded-[18px] border border-cyan-300/18 shadow-[0_16px_34px_rgba(34,211,238,0.14)]`}
      style={{
        background:
          'linear-gradient(160deg, rgba(2,6,23,0.98), rgba(8,15,35,0.98) 52%, rgba(15,23,42,0.94) 100%)',
      }}
    >
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_24%_18%,rgba(103,232,249,0.26),transparent_36%)]" />
      <div className="absolute inset-[1px] rounded-[17px] border border-white/6" />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_74%_82%,rgba(56,189,248,0.18),transparent_28%)]" />
      <svg
        viewBox="0 0 48 48"
        className="relative z-10 h-6 w-6"
        fill="none"
        aria-hidden="true"
      >
        <path
          d="M13.5 15.5L22 24l-8.5 8.5"
          stroke="#E6FBFF"
          strokeWidth="3.4"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path
          d="M26.5 31.5h8.5"
          stroke="#E6FBFF"
          strokeWidth="3.2"
          strokeLinecap="round"
        />
        <circle cx="31.5" cy="16.5" r="2.5" fill="#67E8F9" />
        <path
          d="M28 14.75h7"
          stroke="#67E8F9"
          strokeOpacity="0.5"
          strokeWidth="1.6"
          strokeLinecap="round"
        />
      </svg>
    </div>
  );
}
