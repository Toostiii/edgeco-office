"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

type NavItem = { label: string; href: string; icon: string; ready?: boolean };

const NAV: NavItem[] = [
  { label: "Dashboard", href: "/dashboard", icon: "📊", ready: true },
  { label: "Einnahmen / Ausgaben", href: "/transactions", icon: "💶", ready: true },
  { label: "Belege", href: "/receipts", icon: "📎", ready: true },
  { label: "Rechnungen", href: "/invoices", icon: "🧾", ready: true },
  { label: "Kunden", href: "/customers", icon: "👥", ready: true },
  { label: "Shopify-Import", href: "/shopify", icon: "🛒", ready: true },
  { label: "Anlagen (AfA)", href: "/assets", icon: "🏭", ready: true },
  { label: "Auswertungen / EÜR", href: "/reports", icon: "📈", ready: true },
  { label: "Einstellungen", href: "/settings", icon: "⚙️", ready: true },
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
  const [mobileOpen, setMobileOpen] = useState(false);

  async function logout() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  function NavLinks({ onNavigate }: { onNavigate?: () => void }) {
    return (
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
              onClick={onNavigate}
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
    );
  }

  function UserFooter() {
    return (
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
    );
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
        <NavLinks />
        <UserFooter />
      </aside>

      {/* Mobiles Menü (Drawer) */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 sm:hidden">
          <div
            className="absolute inset-0 bg-black/40"
            onClick={() => setMobileOpen(false)}
            aria-hidden
          />
          <aside className="absolute left-0 top-0 flex h-full w-72 max-w-[80%] flex-col border-r border-border bg-card p-4 shadow-xl">
            <div className="mb-4 flex items-center justify-between">
              <Image
                src="/logo.png"
                alt="EDGECO Office"
                width={120}
                height={78}
                className="h-auto w-[110px]"
              />
              <button
                onClick={() => setMobileOpen(false)}
                aria-label="Menü schließen"
                className="rounded-lg px-2 py-1 text-xl text-muted hover:bg-black/5"
              >
                ✕
              </button>
            </div>
            <NavLinks onNavigate={() => setMobileOpen(false)} />
            <UserFooter />
          </aside>
        </div>
      )}

      {/* Inhalt */}
      <div className="flex min-w-0 flex-1 flex-col">
        {/* Mobile Topbar */}
        <header className="flex items-center justify-between border-b border-border bg-card px-4 py-3 sm:hidden">
          <Image
            src="/logo.png"
            alt="EDGECO Office"
            width={110}
            height={72}
            className="h-auto w-[100px]"
          />
          <button
            onClick={() => setMobileOpen(true)}
            aria-label="Menü öffnen"
            className="rounded-lg border border-border px-3 py-2 text-lg leading-none hover:bg-black/5"
          >
            ☰
          </button>
        </header>

        <main className="flex-1 p-4 sm:p-6">{children}</main>
      </div>
    </div>
  );
}
