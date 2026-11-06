import { Star } from "lucide-react";
import { GITHUB_URL } from "@/lib/site-mode";
import { GitHubIcon } from "./brand-icons";
import { cn } from "./ui";

const compact = (n: number) => (n >= 1000 ? `${(n / 1000).toFixed(n >= 10000 ? 0 : 1)}k` : String(n));

/** "Star on GitHub" with the live star count. */
export function StarButton({ count, size = "md", label = "Star on GitHub", className }: { count: number | null; size?: "sm" | "md" | "lg"; label?: string; className?: string }) {
  const sizes = { sm: "h-8 px-3 text-[13px]", md: "h-9 px-4 text-sm", lg: "h-11 px-5 text-[15px]" };
  return (
    <a
      href={GITHUB_URL}
      target="_blank"
      rel="noopener noreferrer"
      className={cn(
        "inline-flex items-center gap-2 rounded-lg border border-border-strong bg-card font-medium whitespace-nowrap text-text transition-colors hover:bg-card-muted",
        sizes[size],
        className,
      )}
    >
      <Star size={size === "sm" ? 14 : 16} className="fill-[#e3b341] text-[#e3b341]" />
      {label}
      {count !== null && <span className="rounded-md bg-card-muted px-1.5 py-0.5 text-xs text-text-2 tabular">{compact(count)}</span>}
    </a>
  );
}

/** Primary "Download from GitHub" button. */
export function DownloadButton({ size = "md", label = "Download from GitHub", className }: { size?: "sm" | "md" | "lg"; label?: string; className?: string }) {
  const sizes = { sm: "h-8 px-3 text-[13px]", md: "h-9 px-4 text-sm", lg: "h-11 px-5 text-[15px]" };
  return (
    <a
      href={GITHUB_URL}
      target="_blank"
      rel="noopener noreferrer"
      className={cn("inline-flex items-center gap-2 rounded-lg bg-accent font-medium whitespace-nowrap text-accent-ink transition-colors hover:bg-accent-hover", sizes[size], className)}
    >
      <GitHubIcon />
      {label}
    </a>
  );
}
