/**
 * Aktualisiert die Supabase-Session bei jedem Request (Token-Refresh).
 *
 * Solange die Supabase-Umgebungsvariablen noch nicht gesetzt sind (vor dem
 * Setup), wird die Middleware übersprungen — so läuft die Landing-Page sofort.
 */
import { type NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";

export async function proxy(request: NextRequest) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  // Noch kein Supabase konfiguriert → nichts tun.
  if (!url || !anonKey) {
    return NextResponse.next({ request });
  }

  const supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(url, anonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value, options }) =>
          supabaseResponse.cookies.set(name, value, options),
        );
      },
    },
  });

  // Wichtig: getUser() refresht das Token und schreibt die Cookies.
  await supabase.auth.getUser();

  return supabaseResponse;
}

export const config = {
  matcher: [
    // Alles außer statischen Assets.
    "/((?!_next/static|_next/image|favicon.ico|logo.png|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
