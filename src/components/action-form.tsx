"use client";

import { useActionState, useTransition, type FormEvent, type ReactNode } from "react";
import type { ActionResult } from "@/lib/actions";
import { Button, cn } from "./ui";

/**
 * Runs a server action from a form's onSubmit instead of its action prop.
 * React resets uncontrolled fields after a form action, which would wipe what
 * people typed whenever a save fails; this keeps their input.
 */
export function useFormAction(action: (prev: ActionResult, fd: FormData) => Promise<ActionResult>) {
  const [state, formAction, actionPending] = useActionState(action, null);
  const [transitionPending, startTransition] = useTransition();
  const onSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    startTransition(() => formAction(fd));
  };
  return [state, onSubmit, actionPending || transitionPending] as const;
}

/**
 * Form wrapper for server actions: shows pending state and the result message.
 */
export function ActionForm({
  action,
  children,
  submitLabel,
  pendingLabel,
  className,
  submitVariant = "primary",
  footer,
}: {
  action: (prev: ActionResult, fd: FormData) => Promise<ActionResult>;
  children?: ReactNode;
  submitLabel: string;
  pendingLabel?: string;
  className?: string;
  submitVariant?: "primary" | "secondary" | "danger" | "dark";
  footer?: ReactNode;
}) {
  const [state, onSubmit, pending] = useFormAction(action);
  return (
    <form onSubmit={onSubmit} className={cn("space-y-4", className)}>
      {children}
      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit" variant={submitVariant} disabled={pending}>
          {pending ? pendingLabel ?? "Saving…" : submitLabel}
        </Button>
        {footer}
        {state?.message && (
          <p role="status" className={cn("text-sm", state.ok ? "text-ok" : "text-danger")}>
            {state.message}
          </p>
        )}
      </div>
    </form>
  );
}

/** A single button that runs a server action (e.g. "Sync now"). */
export function ActionButton({
  action,
  label,
  pendingLabel,
  variant = "secondary",
  size = "md",
}: {
  action: (prev: ActionResult) => Promise<ActionResult>;
  label: ReactNode;
  pendingLabel?: string;
  variant?: "primary" | "secondary" | "ghost" | "danger";
  size?: "sm" | "md";
}) {
  const [state, formAction, pending] = useActionState(action, null);
  return (
    <form action={formAction} className="flex flex-wrap items-center gap-3">
      <Button type="submit" variant={variant} size={size} disabled={pending}>
        {pending ? pendingLabel ?? "Working…" : label}
      </Button>
      {state?.message && (
        <span role="status" className={cn("max-w-md text-[13px]", state.ok ? "text-ok" : "text-danger")}>
          {state.message}
        </span>
      )}
    </form>
  );
}
