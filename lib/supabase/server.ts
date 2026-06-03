/**
 * Supabase-Client für Server Components / Route Handlers.
 * Liest und schreibt die Session-Cookies über die Next.js cookies()-API.
 */
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options),
            );
          } catch {
            // In Server Components kann set fehlschlagen — die Middleware
            // aktualisiert die Session, daher hier ignorierbar.
          }
        },
      },
    },
  );
}
