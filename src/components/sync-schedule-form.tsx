"use client";

import { useEffect, useMemo, useState } from "react";
import type { ActionResult } from "@/lib/actions";
import { claudePublishTimeIn } from "@/lib/schedule-time";
import { useFormAction } from "./action-form";
import { Button, Field, Input, Select, cn } from "./ui";

export function SyncScheduleForm({
  action,
  current,
}: {
  action: (prev: ActionResult, fd: FormData) => Promise<ActionResult>;
  current: { enabled: boolean; time: string; timezone: string };
}) {
  const [state, onSubmit, pending] = useFormAction(action);
  const [enabled, setEnabled] = useState(current.enabled);
  const [timezone, setTimezone] = useState(current.timezone);
  const [browserTz, setBrowserTz] = useState<string | null>(null);
  useEffect(() => setBrowserTz(Intl.DateTimeFormat().resolvedOptions().timeZone), []);

  const zones = useMemo(() => {
    const all = typeof Intl.supportedValuesOf === "function" ? Intl.supportedValuesOf("timeZone") : [];
    return all.includes(current.timezone) ? all : [current.timezone, ...all];
  }, [current.timezone]);

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <label className="flex items-center gap-2.5 text-sm">
        <input type="checkbox" name="enabled" checked={enabled} onChange={(e) => setEnabled(e.target.checked)} className="accent-[var(--accent)]" />
        <span className="font-medium">Sync automatically every day</span>
      </label>
      <div className={cn("grid gap-4 sm:grid-cols-[160px_1fr]", !enabled && "opacity-50")}>
        <Field label="Time">
          <Input name="time" type="time" defaultValue={current.time} step={60} required />
        </Field>
        <Field label="Timezone">
          <Select name="timezone" value={timezone} onChange={(e) => setTimezone(e.target.value)}>
            {zones.map((z) => (
              <option key={z} value={z}>
                {z.replace(/_/g, " ")}
              </option>
            ))}
          </Select>
        </Field>
      </div>
      {browserTz && browserTz !== timezone && (
        <button type="button" onClick={() => setTimezone(browserTz)} className="text-[13px] text-accent hover:underline">
          Use my timezone ({browserTz.replace(/_/g, " ")})
        </button>
      )}
      <p className="text-[13px] text-text-3">
        Claude publishes each day&apos;s numbers around {claudePublishTimeIn(timezone)} in this timezone. A sync before then picks up the
        latest available day; the rest arrives on the next run.
      </p>
      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit" disabled={pending}>{pending ? "Saving…" : "Save schedule"}</Button>
        {state?.message && <span className={cn("text-sm", state.ok ? "text-ok" : "text-danger")}>{state.message}</span>}
      </div>
    </form>
  );
}
