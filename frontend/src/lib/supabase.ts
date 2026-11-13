import { createClient } from "@supabase/supabase-js";
const url = import.meta.env.VITE_SUPABASE_URL;
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
export const configured = Boolean(url && key && !key.includes("YOUR_"));
export const supabase = createClient(
  url || "http://127.0.0.1:54321",
  key || "not-configured",
  {
    auth: {
      flowType: "pkce",
      detectSessionInUrl: true,
      persistSession: true,
      autoRefreshToken: true,
    },
  },
);
export function check<T>(result: {
  data: T;
  error: { message: string; code?: string } | null;
}): T {
  if (result.error)
    throw new Error(
      result.error.code === "PGRST205"
        ? "Nuestro espacio todavía se está preparando. Intenta otra vez más tarde."
        : result.error.message,
    );
  return result.data;
}
