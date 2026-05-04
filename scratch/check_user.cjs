const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

const envPath = path.join(__dirname, '..', '.env');
const env = Object.fromEntries(
  fs.readFileSync(envPath, 'utf8')
    .split('\n')
    .filter(l => l.includes('='))
    .map(l => {
      const parts = l.split('=');
      const key = parts[0].trim();
      const value = parts.slice(1).join('=').trim().replace(/^['"]|['"]$/g, '');
      return [key, value];
    })
);

const supabase = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY);

async function check() {
  console.log('Checking Supabase connection...');
  const { data, error } = await supabase.from('profiles').select('*').eq('email', 'joseeduardorms29@gmail.com');
  
  if (error) {
    console.error('Supabase Error:', error);
  } else {
    console.log('User Profile found:', JSON.stringify(data, null, 2));
  }
}

check();
