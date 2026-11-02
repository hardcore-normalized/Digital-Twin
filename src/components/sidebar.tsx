"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import {
  BarChart3,
  ChevronsUpDown,
  CircleDollarSign,
  Cable,
  Database,
  KeyRound,
  ListChecks,
  LogOut,
  Menu,
  ScrollText,
  Settings,
  Sparkles,
  UserRound,
  Users,
  X,
} from "lucide-react";
import { authClient } from "@/lib/auth-client";
import { LogoMark } from "./logo";
import { cn } from "./ui";

type Zone = { slug: string; name: string; role: string };

export function Sidebar({
  zone,
  zones,
  canManage,
  hasSelf,
  user,
}: {
  zone: Zone;
  zones: Zone[];
  canManage: boolean;
  hasSelf: boolean;
  user: { name: string; email: string };
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [switcher, setSwitcher] = useState(false);
  const base = `/app/${zone.slug}`;

  const groups = canManage
    ? [
        {
          title: "Analytics",
          items: [
            { href: base, label: "Overview", icon: BarChart3, exact: true },
            { href: `${base}/usage`, label: "Usage & spend", icon: CircleDollarSign },
          ],
        },
        {
          title: "People",
          items: [
            { href: `${base}/people`, label: "People & twins", icon: Users },
            { href: `${base}/audit`, label: "Audit log", icon: ScrollText },
            ...(hasSelf ? [{ href: `${base}/me`, label: "My twin", icon: UserRound }] : []),
          ],
        },
        {
          title: "Settings",
          items: [
            { href: `${base}/setup`, label: "Setup (your keys)", icon: ListChecks },
            { href: `${base}/settings`, label: "General", icon: Settings, exact: true },
            { href: `${base}/settings/connections`, label: "Connections", icon: Cable },
            { href: `${base}/settings/storage`, label: "File storage", icon: Database },
            { href: `${base}/settings/ai`, label: "AI & privacy", icon: Sparkles },
            { href: `${base}/settings/access`, label: "Access", icon: KeyRound },
          ],
        },
      ]
    : [{ title: "You", items: [{ href: `${base}/me`, label: "My twin", icon: UserRound, exact: false }] }];

  const isActive = (href: string, exact?: boolean) => (exact ? pathname === href : pathname === href || pathname.startsWith(`${href}/`));

  const nav = (
    <nav className="flex h-full flex-col">
      <div className="relative px-3 pt-4 pb-3">
        <button
          onClick={() => setSwitcher((s) => !s)}
          className="flex w-full items-center gap-2.5 rounded-lg px-2 py-2 text-left hover:bg-card-muted"
          aria-expanded={switcher}
        >
          <LogoMark size={22} />
          <span className="min-w-0 flex-1">
            <span className="block truncate text-sm font-semibold">{zone.name}</span>
            <span className="block text-xs text-text-3 capitalize">{zone.role}</span>
          </span>
          <ChevronsUpDown size={15} className="text-text-3" />
        </button>
        {switcher && (
          <div className="absolute inset-x-3 top-full z-20 mt-1 rounded-lg border border-border bg-card p-1 shadow-lg">
            {zones.map((z) => (
              <Link
                key={z.slug}
                href={`/app/${z.slug}`}
                onClick={() => setSwitcher(false)}
                className={cn("block truncate rounded-md px-2.5 py-1.5 text-sm hover:bg-card-muted", z.slug === zone.slug && "font-medium")}
              >
                {z.name}
              </Link>
            ))}
            <div className="my-1 border-t border-border" />
            <Link href="/app/new" className="block rounded-md px-2.5 py-1.5 text-sm text-text-2 hover:bg-card-muted">
              + New zone
            </Link>
          </div>
        )}
      </div>

      <div className="flex-1 space-y-5 overflow-y-auto px-3 pb-4">
        {groups.map((g) => (
          <div key={g.title}>
            <div className="px-2.5 pb-1.5 text-[11px] font-medium tracking-wide text-text-3 uppercase">{g.title}</div>
            <ul className="space-y-0.5">
              {g.items.map((it) => {
                const active = isActive(it.href, it.exact);
                const Icon = it.icon;
                return (
                  <li key={it.href}>
                    <Link
                      href={it.href}
                      onClick={() => setOpen(false)}
                      aria-current={active ? "page" : undefined}
                      className={cn(
                        "flex items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-sm transition-colors",
                        active ? "bg-card font-medium text-text shadow-[0_0_0_1px_var(--border)]" : "text-text-2 hover:bg-card-muted hover:text-text",
                      )}
                    >
                      <Icon size={16} strokeWidth={1.75} />
                      {it.label}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </div>

      <div className="border-t border-border px-3 py-3">
        <div className="flex items-center gap-2 px-2">
          <Link href="/app/account" className="min-w-0 flex-1 rounded-md hover:opacity-80" title="Your account: sign-in methods and passkeys">
            <div className="truncate text-[13px] font-medium">{user.name}</div>
            <div className="truncate text-xs text-text-3">{user.email}</div>
          </Link>
          <button
            onClick={async () => {
              await authClient.signOut();
              router.push("/");
              router.refresh();
            }}
            className="rounded-md p-1.5 text-text-3 hover:bg-card-muted hover:text-text"
            title="Sign out"
            aria-label="Sign out"
          >
            <LogOut size={16} />
          </button>
        </div>
      </div>
    </nav>
  );

  return (
    <>
      {/* Mobile top bar */}
      <div className="sticky top-0 z-30 flex items-center justify-between border-b border-border bg-sidebar px-4 py-2.5 lg:hidden">
        <span className="flex items-center gap-2 text-sm font-semibold">
          <LogoMark size={20} /> {zone.name}
        </span>
        <button onClick={() => setOpen(true)} className="rounded-md p-1.5 hover:bg-card-muted" aria-label="Open menu">
          <Menu size={18} />
        </button>
      </div>
      {open && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div className="absolute inset-0 bg-black/30" onClick={() => setOpen(false)} />
          <div className="absolute inset-y-0 left-0 w-72 border-r border-border bg-sidebar">
            <button onClick={() => setOpen(false)} className="absolute top-4 right-3 rounded-md p-1.5 hover:bg-card-muted" aria-label="Close menu">
              <X size={18} />
            </button>
            {nav}
          </div>
        </div>
      )}
      <aside className="sticky top-0 hidden h-dvh w-64 shrink-0 border-r border-border bg-sidebar lg:block">{nav}</aside>
    </>
  );
}
