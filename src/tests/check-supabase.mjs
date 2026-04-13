import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://dowqvqaubqeodzamzwxy.supabase.co'
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRvd3F2cWF1YnFlb2R6YW16d3h5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ5MjYwNTIsImV4cCI6MjA5MDUwMjA1Mn0.uslJiGo28E2U9eVV4O-GLeGviVkV3_1ok2UOn5g8aXA'

const supabase = createClient(supabaseUrl, supabaseAnonKey)

async function runChecks() {
  console.log('='.repeat(60))
  console.log('🔍 VERIFICAÇÃO DE COMUNICAÇÃO COM SUPABASE')
  console.log('='.repeat(60))
  console.log(`🌐 URL: ${supabaseUrl}`)
  console.log('')

  // ── 1. Testar conexão básica ──────────────────────────────
  console.log('━'.repeat(40))
  console.log('1️⃣  Testando conexão básica...')
  try {
    const { error } = await supabase.from('profiles').select('count').limit(1)
    if (error) {
      if (error.code === 'PGRST301') {
        console.log('   ✅ Conexão OK (RLS bloqueou sem auth — esperado)')
      } else {
        console.log(`   ⚠️  Erro: ${error.message} (code: ${error.code})`)
      }
    } else {
      console.log('   ✅ Conexão com Supabase estabelecida!')
    }
  } catch (e) {
    console.log(`   ❌ Falha de rede: ${e.message}`)
  }

  // ── 2. Verificar tabela profiles ─────────────────────────
  console.log('')
  console.log('━'.repeat(40))
  console.log('2️⃣  Verificando tabela `profiles`...')
  const { data: profiles, error: profilesErr } = await supabase
    .from('profiles')
    .select('id, name, role, is_admin')
    .limit(5)

  if (profilesErr) {
    if (profilesErr.code === '42P01') {
      console.log('   ❌ Tabela `profiles` NÃO EXISTE!')
    } else if (profilesErr.code === 'PGRST301') {
      console.log('   ✅ Tabela `profiles` existe (RLS requer autenticação)')
    } else {
      console.log(`   ⚠️  Erro: [${profilesErr.code}] ${profilesErr.message}`)
    }
  } else {
    console.log(`   ✅ Tabela `profiles` acessível! (${profiles?.length ?? 0} registro(s) visível(is))`)
    if (profiles?.length) {
      profiles.forEach(p => console.log(`      → ${p.name} | ${p.role} | admin: ${p.is_admin}`))
    }
  }

  // ── 3. Verificar tabela campaign_terms ───────────────────
  console.log('')
  console.log('━'.repeat(40))
  console.log('3️⃣  Verificando tabela `campaign_terms`...')
  const { data: terms, error: termsErr } = await supabase
    .from('campaign_terms')
    .select('id, company_id, keyword, cost')
    .limit(3)

  if (termsErr) {
    if (termsErr.code === '42P01') {
      console.log('   ❌ Tabela `campaign_terms` NÃO EXISTE! Execute o SQL de criação.')
    } else if (termsErr.code === 'PGRST301') {
      console.log('   ✅ Tabela `campaign_terms` existe (RLS requer autenticação)')
    } else {
      console.log(`   ⚠️  Erro: [${termsErr.code}] ${termsErr.message}`)
    }
  } else {
    console.log(`   ✅ Tabela `campaign_terms` acessível! (${terms?.length ?? 0} reg(s) visível(is))`)
    if (terms?.length) {
      terms.forEach(t => console.log(`      → empresa: ${t.company_id} | ${t.keyword} | R$${t.cost}`))
    } else {
      console.log('   ℹ️  Tabela vazia (normal se ainda não sincronizou)')
    }
  }

  // ── 4. Testar autenticação anon ──────────────────────────
  console.log('')
  console.log('━'.repeat(40))
  console.log('4️⃣  Verificando sessão atual...')
  const { data: { session } } = await supabase.auth.getSession()
  if (session) {
    console.log(`   ✅ Sessão ativa: ${session.user.email}`)
  } else {
    console.log('   ℹ️  Nenhuma sessão ativa (esperado com persistSession: false)')
  }

  // ── 5. Teste de insert/delete na campaign_terms ──────────
  console.log('')
  console.log('━'.repeat(40))
  console.log('5️⃣  Testando insert sem autenticação...')
  const testRow = {
    id: 'test_connectivity_001',
    company_id: 'test_company',
    keyword: 'teste de conexão',
    cost: 0,
    synced_at: new Date().toISOString()
  }
  const { error: insertErr } = await supabase.from('campaign_terms').insert(testRow)
  if (insertErr) {
    if (insertErr.code === 'PGRST301' || insertErr.message.includes('row-level security')) {
      console.log('   ✅ RLS funcionando corretamente (bloqueou insert sem auth)')
    } else if (insertErr.code === '42P01') {
      console.log('   ❌ Tabela não existe')
    } else {
      console.log(`   ℹ️  Erro esperado ou inesperado: [${insertErr.code}] ${insertErr.message}`)
    }
  } else {
    console.log('   ⚠️  Insert sem auth funcionou! Verifique as políticas RLS.')
    // Limpar o registro de teste
    await supabase.from('campaign_terms').delete().eq('id', 'test_connectivity_001')
    console.log('   🧹 Registro de teste removido.')
  }

  // ── Resumo ───────────────────────────────────────────────
  console.log('')
  console.log('='.repeat(60))
  console.log('✅ Verificação concluída!')
  console.log('='.repeat(60))
}

runChecks().catch(console.error)
