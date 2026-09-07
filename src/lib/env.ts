/** First non-empty trimmed string. Marketplace and Vite use different names for the same values. */
export function firstNonEmpty(...values: Array<string | undefined | null>): string {
  for (const value of values) {
    const trimmed = value?.trim()
    if (trimmed) return trimmed
  }
  return ''
}

export type SupabaseBrowserEnv = {
  url: string
  anonKey: string
}

/**
 * Resolve the public Supabase URL and anon/publishable key.
 *
 * Vercel Marketplace injects NEXT_PUBLIC_SUPABASE_* (and unprefixed SUPABASE_*).
 * Vite only exposes VITE_* unless we also allow NEXT_PUBLIC_. Never use the
 * secret / service-role key here — that must stay on the server.
 */
export function resolveSupabaseBrowserEnv(
  env: Record<string, string | undefined>,
): SupabaseBrowserEnv {
  return {
    url: firstNonEmpty(env.VITE_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_URL),
    anonKey: firstNonEmpty(
      env.VITE_SUPABASE_ANON_KEY,
      env.VITE_SUPABASE_PUBLISHABLE_KEY,
      env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
      env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
      env.SUPABASE_PUBLISHABLE_KEY,
      env.SUPABASE_ANON_KEY,
    ),
  }
}
