export function isClientSupabaseConfigured(): boolean {
  return Boolean(import.meta.env.VITE_SUPABASE_URL?.trim() && import.meta.env.VITE_SUPABASE_ANON_KEY?.trim())
}

export function getClientSupabaseUrl(): string | null {
  return import.meta.env.VITE_SUPABASE_URL?.trim() || null
}

export function getClientSupabaseAnonKey(): string | null {
  return import.meta.env.VITE_SUPABASE_ANON_KEY?.trim() || null
}
