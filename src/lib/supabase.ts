import { createClient } from '@supabase/supabase-js';
const url = import.meta.env.VITE_SUPABASE_URL;
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || import.meta.env.VITE_SUPABASE_ANON_KEY;
export const supabase = url && key ? createClient(url, key, {auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}}) : null;
// Test fixtures are available only with explicit opt-in on the development server.
export const demoEnabled = import.meta.env.DEV && !supabase && import.meta.env.VITE_ENABLE_DEMO === 'true';
