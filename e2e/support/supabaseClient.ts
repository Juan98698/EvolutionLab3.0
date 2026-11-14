import { createClient } from '@supabase/supabase-js';
import { installSupabaseMock } from './supabaseMock';
import { observePasswordRecovery } from '../../src/lib/passwordRecovery';
export const supabase = createClient('https://test.supabase.co', 'test-anon-key');
installSupabaseMock(supabase);
supabase.auth.onAuthStateChange((event, session) => observePasswordRecovery(event, session?.user.id || null));
