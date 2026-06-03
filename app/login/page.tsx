"use client";

import { useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

const supabaseConfigured =
  !!process.env.NEXT_PUBLIC_SUPABASE_URL &&
  !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const supabase = createClient();
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      if (error) {
        setError(error.message);
      } else {
        router.push("/dashboard");
        router.refresh();
      }
    } catch {
      setError("Anmeldung fehlgeschlagen. Ist Supabase eingerichtet?");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="flex flex-1 flex-col items-center justify-center px-6 py-16">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex flex-col items-center">
          <Image
            src="/logo.png"
            alt="EDGECO Office"
            width={180}
            height={120}
            priority
            className="h-auto w-[160px]"
          />
        </div>

        {!supabaseConfigured && (
          <div className="mb-6 rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm text-amber-800">
            Supabase ist noch nicht eingerichtet. Bitte zuerst die Schritte in{" "}
            <code className="font-mono">SETUP.md</code> durchführen.
          </div>
        )}

        <form
          onSubmit={handleSubmit}
          className="rounded-xl border border-border bg-card p-6 shadow-sm"
        >
          <h1 className="mb-5 text-xl font-semibold">Anmelden</h1>

          <label className="mb-1 block text-sm font-medium">E-Mail</label>
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="mb-4 w-full rounded-lg border border-border px-3 py-2 outline-none focus:border-brand"
            placeholder="du@edgeco.de"
          />

          <label className="mb-1 block text-sm font-medium">Passwort</label>
          <input
            type="password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="mb-4 w-full rounded-lg border border-border px-3 py-2 outline-none focus:border-brand"
            placeholder="••••••••"
          />

          {error && <p className="mb-4 text-sm text-expense">{error}</p>}

          <button
            type="submit"
            disabled={loading}
            className="brand-gradient w-full rounded-lg py-2.5 font-semibold text-white transition hover:opacity-90 disabled:opacity-50"
          >
            {loading ? "Anmelden …" : "Anmelden"}
          </button>
        </form>
      </div>
    </main>
  );
}
