import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import {
  getSupabaseServiceKey,
  getSupabaseUrl,
  getSupabaseUrlError,
} from "@/lib/env";

export function createServiceClient(): SupabaseClient {
  const urlError = getSupabaseUrlError();
  if (urlError) {
    throw new Error(urlError);
  }

  const url = getSupabaseUrl();
  const key = getSupabaseServiceKey();

  if (!url || !key) {
    throw new Error(
      "Supabase is not configured. Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY (or SUPABASE_SECRET_KEY) in the environment."
    );
  }

  return createClient(url, key, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
    global: {
      fetch: async (input, init) => {
        try {
          return await fetch(input, init);
        } catch (err) {
          const cause = err instanceof Error ? (err as Error & { cause?: unknown }).cause : undefined;
          console.error("Supabase fetch failed:", {
            url: typeof input === "string" ? input : input instanceof Request ? input.url : String(input),
            message: err instanceof Error ? err.message : String(err),
            cause:
              cause instanceof Error
                ? {
                    name: cause.name,
                    message: cause.message,
                    code: (cause as NodeJS.ErrnoException).code,
                  }
                : cause,
          });
          throw err;
        }
      },
    },
  });
}
