import { cache } from "react";
import { createClient } from "./server";

/**
 * Liefert den eingeloggten Nutzer und dedupliziert den (netzwerk-teuren)
 * getUser()-Aufruf pro Server-Request via React cache(). So fragen Layout
 * und Seite zusammen nur EINMAL beim Auth-Server an.
 */
export const getCachedUser = cache(async () => {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
});
