"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { apiGet } from "@/lib/client";
import type { BillingTasksResult } from "@/lib/types";

const nav = [
  {
    href: "/",
    label: "Dashboard",
    icon: (
      <>
        <rect x="3" y="3" width="7" height="7" rx="1.5" />
        <rect x="14" y="3" width="7" height="7" rx="1.5" />
        <rect x="3" y="14" width="7" height="7" rx="1.5" />
        <rect x="14" y="14" width="7" height="7" rx="1.5" />
      </>
    ),
  },
  {
    href: "/users",
    label: "Profiles",
    icon: (
      <>
        <circle cx="9" cy="8" r="3.2" />
        <path d="M3.5 20a5.5 5.5 0 0 1 11 0" />
        <path d="M17 4.5a3 3 0 0 1 0 6M20.5 20a5.5 5.5 0 0 0-4-5.3" />
      </>
    ),
  },
  {
    href: "/protection",
    label: "Protection",
    icon: (
      <>
        <path d="M12 21s7-3 7-8V6l-7-3-7 3v7c0 5 7 8 7 8z" />
        <path d="M9.3 12l1.9 1.9 3.5-3.6" />
      </>
    ),
  },
  {
    href: "/billing",
    label: "Billing",
    icon: (
      <>
        <rect x="3" y="5" width="18" height="14" rx="2.2" />
        <path d="M3 10h18M7 15h4" />
      </>
    ),
  },
  {
    href: "/notifications",
    label: "Notifications",
    icon: (
      <>
        <path d="M18 8.5a6 6 0 0 0-12 0c0 6-2.5 7.5-2.5 7.5h17S18 14.5 18 8.5z" />
        <path d="M10.3 20a2 2 0 0 0 3.4 0" />
      </>
    ),
  },
];

function LogoMark() {
  return (
    <span className="inline-flex items-center justify-center w-8 h-8 rounded-lg bg-accent text-white flex-none">
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round">
        <rect x="5" y="11" width="14" height="10" rx="2.2" />
        <path d="M8 11V8a4 4 0 0 1 8 0v3" />
      </svg>
    </span>
  );
}

export default function Shell({
  children,
  initialDeadLetters = 0,
}: {
  children: React.ReactNode;
  /** Dead-lettered billing tasks at layout load (server-fetched); kept fresh below. */
  initialDeadLetters?: number;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  // The one number that must not go unseen: cancellations the automatic
  // machinery has given up on. Server-rendered first (the layout fetches it),
  // then re-polled so the badge does not fossilise — the layout never
  // re-renders on navigation.
  const [deadLetters, setDeadLetters] = useState(initialDeadLetters);

  useEffect(() => {
    let alive = true;
    const poll = async () => {
      try {
        const t = await apiGet<BillingTasksResult>("admin/billing-tasks");
        if (alive) setDeadLetters(t.deadLetter.length);
      } catch {
        /* badge is best-effort; the pages surface real errors */
      }
    };
    const iv = setInterval(poll, 60000);
    void poll();
    return () => {
      alive = false;
      clearInterval(iv);
    };
  }, []);

  function isActive(href: string) {
    if (href === "/") return pathname === "/";
    return pathname.startsWith(href);
  }

  async function logout() {
    setOpen(false);
    await fetch("/api/logout", { method: "POST" });
    router.replace("/login");
    router.refresh();
  }

  const panel = (
    <div className="flex flex-col h-full p-4">
      <div className="flex items-center gap-2.5 px-2 py-3 mb-4">
        <LogoMark />
        <div className="leading-tight">
          <div className="text-white font-bold text-[15px]">WeLockin</div>
          <div className="text-[11px] text-white/50 -mt-0.5">Admin console</div>
        </div>
      </div>

      <nav className="flex flex-col gap-1">
        {nav.map((n) => (
          <Link
            key={n.href}
            href={n.href}
            onClick={() => setOpen(false)}
            className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition ${
              isActive(n.href) ? "bg-white/10 text-white" : "text-white/60 hover:bg-white/5 hover:text-white/90"
            }`}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              {n.icon}
            </svg>
            {n.label}
            {n.href === "/billing" && deadLetters > 0 && (
              <span
                title={`${deadLetters} dead-lettered billing task${deadLetters === 1 ? "" : "s"} — a customer may still be being charged`}
                className="ml-auto inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 rounded-full bg-red-500 text-white text-[11px] font-bold"
              >
                {deadLetters}
              </span>
            )}
          </Link>
        ))}
      </nav>

      <div className="flex-1" />

      <button
        onClick={logout}
        className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-white/60 hover:bg-white/5 hover:text-white/90 transition"
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <path d="M15 12H4M8 8l-4 4 4 4" />
          <path d="M14 4h4a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-4" />
        </svg>
        Log out
      </button>
    </div>
  );

  return (
    <div className="min-h-screen md:flex bg-paper">
      {/* Mobile top bar */}
      <header className="md:hidden sticky top-0 z-20 flex items-center gap-3 h-14 px-4 bg-ink text-white">
        <button
          onClick={() => setOpen(true)}
          aria-label="Open menu"
          className="-ml-1 p-1.5 rounded-lg hover:bg-white/10 transition"
        >
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <path d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        </button>
        <LogoMark />
        <span className="font-bold text-[15px]">WeLockin</span>
      </header>

      {/* Desktop sidebar */}
      <aside className="hidden md:flex w-60 flex-none bg-ink text-white/80 flex-col sticky top-0 h-screen">
        {panel}
      </aside>

      {/* Mobile drawer + backdrop */}
      <div
        className={`md:hidden fixed inset-0 z-40 transition-opacity duration-200 ${
          open ? "opacity-100" : "opacity-0 pointer-events-none"
        }`}
      >
        <div className="absolute inset-0 bg-black/50" onClick={() => setOpen(false)} />
        <aside
          className={`absolute left-0 top-0 h-full w-64 max-w-[80vw] bg-ink text-white/80 shadow-2xl transition-transform duration-200 ${
            open ? "translate-x-0" : "-translate-x-full"
          }`}
        >
          {panel}
        </aside>
      </div>

      <main className="flex-1 min-w-0 overflow-x-hidden">{children}</main>
    </div>
  );
}
