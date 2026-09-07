import { resolveSupabaseBrowserEnv } from '../src/lib/env.ts'

function assert(condition: unknown, message: string) {
  if (!condition) throw new Error(message)
}

const marketplace = resolveSupabaseBrowserEnv({
  NEXT_PUBLIC_SUPABASE_URL: 'https://abc.supabase.co',
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_test',
  SUPABASE_SECRET_KEY: 'should-not-be-used',
})
assert(marketplace.url === 'https://abc.supabase.co', 'maps Marketplace URL')
assert(marketplace.anonKey === 'sb_publishable_test', 'maps Marketplace publishable key')

const vitePrefersOwn = resolveSupabaseBrowserEnv({
  VITE_SUPABASE_URL: 'https://vite.supabase.co',
  VITE_SUPABASE_ANON_KEY: 'vite-anon',
  NEXT_PUBLIC_SUPABASE_URL: 'https://other.supabase.co',
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: 'other',
})
assert(vitePrefersOwn.url === 'https://vite.supabase.co', 'prefers VITE_ URL')
assert(vitePrefersOwn.anonKey === 'vite-anon', 'prefers VITE_ key')

const empty = resolveSupabaseBrowserEnv({})
assert(empty.url === '' && empty.anonKey === '', 'empty stays empty for local mode')

console.log('supabase env mapping: ok')
