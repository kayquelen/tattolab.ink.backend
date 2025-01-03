import { createClient } from '@supabase/supabase-js'
import { config } from '../config/env.js'

if (!config.supabase.url || !config.supabase.serviceRoleKey) {
  throw new Error('Missing Supabase environment variables');
}

export const supabase = createClient(
  config.supabase.url,
  config.supabase.serviceRoleKey,
  {
    auth: {
      autoRefreshToken: true,
      persistSession: false,
      detectSessionInUrl: false
    }
  }
);
