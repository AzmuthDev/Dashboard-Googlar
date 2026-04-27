import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';

// Manual .env parsing
const envContent = fs.readFileSync('.env', 'utf8');
const env = {};
envContent.split('\n').forEach(line => {
    const [key, value] = line.split('=');
    if (key && value) {
        env[key.trim()] = value.trim().replace(/^["']|["']$/g, '');
    }
});

const supabaseUrl = env.VITE_SUPABASE_URL;
const supabaseKey = env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error('Missing Supabase config in .env');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkCompanies() {
    console.log('--- DEBUGGING COMPANIES ---');
    const { data, error } = await supabase.from('companies').select('*');
    if (error) {
        console.error('Error fetching companies:', error);
        return;
    }
    
    for (const c of data) {
        console.log(`\n🏢 Empresa: ${c.name}`);
        console.log(`   ID: ${c.id}`);
        console.log(`   tableName: ${c.tableName}`);
        
        if (c.tableName) {
            const { data: rows, error: countError } = await supabase.from(c.tableName).select('*').limit(1);
            if (countError) {
                console.log(`   ❌ Erro ao ler tabela [${c.tableName}]: ${countError.message}`);
            } else {
                const { count } = await supabase.from(c.tableName).select('*', { count: 'exact', head: true });
                console.log(`   ✅ Tabela [${c.tableName}] acessível. Total de registros: ${count}`);
            }
        } else {
            console.log(`   ⚠️ Esta empresa não tem uma tableName vinculada.`);
        }
    }
}

checkCompanies();
