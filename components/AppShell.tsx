"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

type NavItem = { label: string; href: string; icon: string; ready?: boolean };

const NAV: NavItem[] = [
  { label: "Dashboard", href: "/dashboard", icon: "📊", ready: true },
  { label: "Einnahmen / Ausgaben", href: "/transactions", icon: "💶", ready: true },
  { label: "Belege", href: "/receipts", icon: "📎", ready: true },
  { label: "Rechnungen", href: "/invoices", icon: "🧾" },
  { label: "Kunden", href: "/customers", icon: "👥", ready: true },
  { label: "Anlagen (AfA)", href: "/assets", icon: "🏭" },
  { label: "Auswertungen / EÜR", href: "/reports", icon: "📈" },
  { label: "Einstellungen", href: "/settings", icon: "⚙️" },
];

export default function AppShell({
  user,
  children,
}: {
  user: string;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();

  async function logout() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  return (
    <div className="flex min-h-screen flex-1">
      {/* Seitenleiste (Desktop) */}
      <aside className="hidden w-60 flex-shrink-0 flex-col border-r border-border bg-card p-4 sm:flex">
        <Image
          src="/logo.png"
          alt="EDGECO Office"
          width={140}
          height={90}
          className="mb-6 h-auto w-[130px]"
        />
        <nav className="flex flex-1 flex-col gap-1">
          {NAV.map((item) => {
            const active = pathname === item.href;
            const base =
              "flex items-center gap-2 rounded-lg px-3 py-2 text-sm transition";
            if (!item.ready) {
              return (
                <span
                  key={item.href}
                  className={`${base} cursor-default text-muted/60`}
                  title="Kommt in einer der nächsten Phasen"
                >
                  <span>{item.icon}</span>
                  {item.label}
                </span>
              );
            }
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`${base} ${
                  active
                    ? "bg-brand/10 font-semibold text-brand"
                    : "text-foreground hover:bg-black/5"
                }`}
              >
                <span>{item.icon}</span>
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="mt-4 border-t border-border pt-4">
          <p className="mb-2 truncate text-xs text-muted" title={user}>
            {user}
          </p>
          <button
            onClick={logout}
            className="w-full rounded-lg border border-border px-3 py-2 text-sm transition hover:bg-black/5"
          >
            Abmelden
          </button>
        </div>
      </aside>

      {/* Inhalt */}
      <div className="flex flex-1 flex-col">
        <main className="flex-1 p-6">{children}</main>
      </div>
    </div>
  );
}
