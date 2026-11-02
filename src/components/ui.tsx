import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";

export const cn = (...c: (string | false | null | undefined)[]) => c.filter(Boolean).join(" ");

/* ── Buttons ── */

const btnBase =
  "inline-flex items-center justify-center gap-1.5 rounded-lg text-sm font-medium transition-colors disabled:opacity-50 disabled:pointer-events-none whitespace-nowrap";
const btnVariants = {
  primary: "bg-accent text-accent-ink hover:bg-accent-hover",
  secondary: "bg-card border border-border-strong text-text hover:bg-card-muted",
  ghost: "text-text-2 hover:text-text hover:bg-card-muted",
  danger: "bg-card border border-border-strong text-danger hover:bg-danger-soft",
  dark: "bg-text text-bg hover:opacity-90",
};
const btnSizes = { sm: "h-8 px-3 text-[13px]", md: "h-9 px-4", lg: "h-11 px-5 text-[15px]" };

type BtnStyle = { variant?: keyof typeof btnVariants; size?: keyof typeof btnSizes };

export function Button({ variant = "primary", size = "md", className, ...props }: ComponentProps<"button"> & BtnStyle) {
  return <button className={cn(btnBase, btnVariants[variant], btnSizes[size], className)} {...props} />;
}

export function ButtonLink({
  variant = "primary",
  size = "md",
  className,
  ...props
}: ComponentProps<typeof Link> & BtnStyle) {
  return <Link className={cn(btnBase, btnVariants[variant], btnSizes[size], className)} {...props} />;
}

/* ── Surfaces ── */

export function Card({ className, ...props }: ComponentProps<"div">) {
  return <div className={cn("rounded-xl border border-border bg-card", className)} {...props} />;
}

export function CardHeader({ title, description, action }: { title: ReactNode; description?: ReactNode; action?: ReactNode }) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-3 border-b border-border px-5 py-4">
      <div className="min-w-0">
        <h2 className="text-[15px] font-semibold">{title}</h2>
        {description && <p className="mt-0.5 text-[13px] text-text-2">{description}</p>}
      </div>
      {action}
    </div>
  );
}

export function PageHeader({ title, description, actions }: { title: ReactNode; description?: ReactNode; actions?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div className="min-w-0">
        <h1 className="font-serif text-[28px] leading-tight font-medium tracking-[-0.01em]">{title}</h1>
        {description && <p className="mt-1 max-w-2xl text-sm text-text-2">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

export function StatTile({ label, value, hint }: { label: string; value: ReactNode; hint?: ReactNode }) {
  return (
    <Card className="px-5 py-4">
      <div className="text-[13px] text-text-2">{label}</div>
      <div className="mt-1.5 text-[26px] leading-none font-semibold tracking-tight">{value}</div>
      {hint && <div className="mt-2 text-xs text-text-3">{hint}</div>}
    </Card>
  );
}

export function EmptyState({ title, children, action }: { title: string; children?: ReactNode; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center px-6 py-14 text-center">
      <div className="text-[15px] font-medium">{title}</div>
      {children && <div className="mt-1 max-w-md text-sm text-text-2">{children}</div>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

/* ── Badges ── */

const badgeTones = {
  neutral: "bg-card-muted text-text-2 border-border",
  accent: "bg-accent-soft text-accent border-transparent",
  ok: "bg-ok-soft text-ok border-transparent",
  warn: "bg-warn-soft text-warn border-transparent",
  danger: "bg-danger-soft text-danger border-transparent",
};

export function Badge({ tone = "neutral", children, className }: { tone?: keyof typeof badgeTones; children: ReactNode; className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-xs font-medium whitespace-nowrap", badgeTones[tone], className)}>
      {children}
    </span>
  );
}

/* ── Forms ── */

export function Label({ children, hint, htmlFor }: { children: ReactNode; hint?: ReactNode; htmlFor?: string }) {
  return (
    <label htmlFor={htmlFor} className="mb-1.5 block text-[13px] font-medium">
      {children}
      {hint && <span className="ml-1.5 font-normal text-text-3">{hint}</span>}
    </label>
  );
}

const fieldBase =
  "w-full rounded-lg border border-border-strong bg-card px-3 text-sm text-text placeholder:text-text-3 focus:border-focus focus:outline-none focus:ring-2 focus:ring-[color-mix(in_srgb,var(--focus)_25%,transparent)]";

export function Input({ className, ...props }: ComponentProps<"input">) {
  return <input className={cn(fieldBase, "h-9", className)} {...props} />;
}

export function Textarea({ className, ...props }: ComponentProps<"textarea">) {
  return <textarea className={cn(fieldBase, "py-2", className)} {...props} />;
}

export function Select({ className, ...props }: ComponentProps<"select">) {
  return <select className={cn(fieldBase, "h-9 pr-8", className)} {...props} />;
}

export function Field({ label, hint, children }: { label: string; hint?: ReactNode; children: ReactNode }) {
  return (
    <div>
      <Label hint={hint}>{label}</Label>
      {children}
    </div>
  );
}

/* ── Avatar ── */

const avatarHues = ["#b9532f", "#2a78d6", "#1b8f66", "#8a5cc2", "#b7791f", "#c2416b", "#3d7a8c"];

export function Avatar({ initials, seed, size = 32 }: { initials: string; seed: string; size?: number }) {
  let h = 0;
  for (const c of seed) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return (
    <span
      className="inline-flex shrink-0 items-center justify-center rounded-full font-semibold text-white"
      style={{ width: size, height: size, fontSize: size * 0.38, background: avatarHues[h % avatarHues.length] }}
      aria-hidden
    >
      {initials}
    </span>
  );
}

/* ── Table ── */

export function Table({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={cn("overflow-x-auto", className)}>
      <table className="w-full border-collapse text-sm">{children}</table>
    </div>
  );
}

export function Th({ children, className, align = "left" }: { children?: ReactNode; className?: string; align?: "left" | "right" }) {
  return (
    <th
      className={cn(
        "border-b border-border bg-card-muted px-4 py-2.5 text-xs font-medium whitespace-nowrap text-text-2",
        align === "right" ? "text-right" : "text-left",
        className,
      )}
    >
      {children}
    </th>
  );
}

export function Td({ children, className, align = "left" }: { children?: ReactNode; className?: string; align?: "left" | "right" }) {
  return (
    <td className={cn("border-b border-border px-4 py-3 align-middle", align === "right" && "text-right tabular", className)}>
      {children}
    </td>
  );
}

export function Notice({ tone = "neutral", children }: { tone?: "neutral" | "warn" | "danger" | "ok" | "accent"; children: ReactNode }) {
  const tones = {
    neutral: "bg-card-muted border-border text-text-2",
    warn: "bg-warn-soft border-transparent text-warn",
    danger: "bg-danger-soft border-transparent text-danger",
    ok: "bg-ok-soft border-transparent text-ok",
    accent: "bg-accent-soft border-transparent text-text",
  };
  return <div className={cn("rounded-lg border px-4 py-3 text-sm", tones[tone])}>{children}</div>;
}
