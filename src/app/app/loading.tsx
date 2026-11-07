import { Loader2 } from "lucide-react";

/** Shown while a zone opens (on the website, the first visit also builds the demo company). */
export default function Loading() {
  return (
    <div className="flex min-h-dvh items-center justify-center gap-2.5 text-sm text-text-2">
      <Loader2 size={16} className="animate-spin" /> Loading the dashboard…
    </div>
  );
}
