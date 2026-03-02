import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { Database } from './types';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || '';
const SUPABASE_PUBLISHABLE_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || '';

let supabase: SupabaseClient<Database>;

if (SUPABASE_URL && SUPABASE_PUBLISHABLE_KEY) {
  supabase = createClient<Database>(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
    auth: {
      storage: typeof window !== 'undefined' ? localStorage : undefined,
      persistSession: true,
      autoRefreshToken: true,
    },
  });
} else {
  console.warn(
    '[Supabase] VITE_SUPABASE_URL ou VITE_SUPABASE_PUBLISHABLE_KEY nao definidas. ' +
    'Criando client com URL placeholder - as chamadas a API nao funcionarao.'
  );
  supabase = createClient<Database>(
    'https://placeholder.supabase.co',
    'placeholder-key'
  );
}

export { supabase };
