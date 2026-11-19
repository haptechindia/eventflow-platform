
import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY

console.info('EVENTFLOW PRODUCTION CHECK', {
  hasUrl: Boolean(url),
  hasKey: Boolean(key),
  correctProject: Boolean(url && url.includes('vdfgwpocjacvfqfhctua')),
  urlPlaceholder: Boolean(url && url.includes('YOUR_PROJECT')),
  keyPrefixCorrect: Boolean(key && key.startsWith('sb_publishable_')),
  isConfigured: Boolean(url && key && !url.includes('YOUR_PROJECT')),
})

export const isSupabaseConfigured = Boolean(
  url && key && !url.includes('YOUR_PROJECT')
)

export const supabase = isSupabaseConfigured
  ? createClient(url, key, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
    })
  : null
