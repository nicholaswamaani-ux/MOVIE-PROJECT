
import { createClient } from
  'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';

const SUPABASE_URL = 'https://vpakeuxsbycaeblodfwk.supabase.co';
const SUPABASE_KEY = 'sb_publishable_5Gg1TjcFOY6HUQTe5WAEZw_VamIRi3-';

export const supabase = createClient(
  SUPABASE_URL,
  SUPABASE_KEY
);

console.log('NICFLIX Supabase connected!');
