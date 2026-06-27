import { createClient, type SupabaseClient } from "@supabase/supabase-js"
import { getClientSupabaseAnonKey, getClientSupabaseUrl, isClientSupabaseConfigured } from "../config/shared-data-config"

let client: SupabaseClient | null = null

export function getBrowserSupabaseClient(): SupabaseClient | null {
  if (!isClientSupabaseConfigured()) return null

  if (!client) {
    client = createClient(getClientSupabaseUrl()!, getClientSupabaseAnonKey()!, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
      },
    })
  }

  return client
}
