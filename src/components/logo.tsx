import Link from "next/link";

/** Two overlapping circles: a person and their twin. */
export function LogoMark({ size = 22 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden>
      <circle cx="9" cy="12" r="6.5" fill="var(--accent)" />
      <circle cx="15" cy="12" r="6.5" fill="none" stroke="var(--text)" strokeWidth="1.8" />
    </svg>
  );
}

export function Logo({ href = "/" }: { href?: string }) {
  return (
    <Link href={href} className="inline-flex items-center gap-2 font-serif text-[19px] font-medium tracking-tight whitespace-nowrap">
      <LogoMark />
      Digital Twin
    </Link>
  );
}
