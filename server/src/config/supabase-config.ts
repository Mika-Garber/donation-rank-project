export function isSupabaseConfigured(): boolean {
  return Boolean(process.env.SUPABASE_URL?.trim() && process.env.SUPABASE_SERVICE_ROLE_KEY?.trim())
}

export function getSupabaseUrl(): string {
  const url = process.env.SUPABASE_URL?.trim()
  if (!url) {
    throw new Error("SUPABASE_URL is not configured.")
  }
  return url
}

export function getSupabaseServiceRoleKey(): string {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()
  if (!key) {
    throw new Error("SUPABASE_SERVICE_ROLE_KEY is not configured.")
  }
  return key
}
