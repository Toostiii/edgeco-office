/**
 * Layout für den auth-geschützten App-Bereich.
 * Server Component: prüft die Session und leitet sonst zum Login.
 */
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import AppShell from "@/components/AppShell";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  return <AppShell user={user.email ?? "Angemeldet"}>{children}</AppShell>;
}
