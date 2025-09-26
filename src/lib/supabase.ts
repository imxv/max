import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.SUPABASE_KEY

if (!supabaseUrl) {
  throw new Error('Supabase URL is not set. Add SUPABASE_URL or NEXT_PUBLIC_SUPABASE_URL to your environment.')
}

if (!supabaseKey) {
  throw new Error('Supabase key is not set. Add SUPABASE_KEY or SUPABASE_SERVICE_ROLE_KEY to your environment.')
}

export const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: {
    persistSession: false,
  },
})

export default supabase
