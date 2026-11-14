import { createClient } from '@supabase/supabase-js';
import { installSupabaseMock } from './supabaseMock';
export const supabase = createClient('https://test.supabase.co', 'test-anon-key');
installSupabaseMock(supabase);
