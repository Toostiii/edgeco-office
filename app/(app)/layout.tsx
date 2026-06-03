/**
 * Layout für den auth-geschützten App-Bereich.
 * Server Component: prüft die Session und leitet sonst zum Login.
 */
import { redirect } from "next/navigation";
import { getCachedUser } from "@/lib/supabase/user";
import AppShell from "@/components/AppShell";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getCachedUser();

  if (!user) {
    redirect("/login");
  }

  return <AppShell user={user.email ?? "Angemeldet"}>{children}</AppShell>;
}
