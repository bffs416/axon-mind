
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://blwaxxacneipoaufpiag.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJsd2F4eGFjbmVpcG9hdWZwaWFnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTc5Mzg0ODgsImV4cCI6MjA3MzUxNDQ4OH0.MYorhHHAEOnFj5DPYZHozi5pyDZbtJQDBOeD2Te3WXU'
);

async function check() {
  const { data, error } = await supabase.from('polyglot_entries').select('language_id').limit(10);
  if (error) console.error(error);
  else console.log('Current language IDs in DB:', [...new Set(data.map(d => d.language_id))]);
}

check();
