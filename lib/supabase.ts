import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const timedFetch: typeof fetch = (input, init) => {
  const timeout = AbortSignal.timeout(12000);
  const signal = init?.signal ? AbortSignal.any([init.signal, timeout]) : timeout;
  return fetch(input, { ...init, signal });
};
let browserClient: SupabaseClient | null = null;

export function getBrowserClient() {
  if (!url || !key) return null;
  browserClient ??= createClient(url, key, { global: { fetch: timedFetch } });
  return browserClient;
}

export function getServerClient(token: string) {
  if (!url || !key) return null;
  return createClient(url, key, {
    global: { fetch: timedFetch, headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
}
