"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";

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
];

export default function Shell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();

  function isActive(href: string) {
    if (href === "/") return pathname === "/";
    return pathname.startsWith(href);
  }

  async function logout() {
    await fetch("/api/logout", { method: "POST" });
    router.replace("/login");
    router.refresh();
  }

  return (
    <div className="min-h-screen flex bg-paper">
      <aside className="w-60 flex-none bg-ink text-white/80 flex flex-col p-4 sticky top-0 h-screen">
        <div className="flex items-center gap-2.5 px-2 py-3 mb-4">
          <span className="inline-flex items-center justify-center w-8 h-8 rounded-lg bg-accent text-white">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round">
              <rect x="5" y="11" width="14" height="10" rx="2.2" />
              <path d="M8 11V8a4 4 0 0 1 8 0v3" />
            </svg>
          </span>
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
              className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition ${
                isActive(n.href) ? "bg-white/10 text-white" : "text-white/60 hover:bg-white/5 hover:text-white/90"
              }`}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                {n.icon}
              </svg>
              {n.label}
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
      </aside>

      <main className="flex-1 min-w-0 overflow-x-hidden">{children}</main>
    </div>
  );
}
