import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://dowqvqaubqeodzamzwxy.supabase.co'
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRvd3F2cWF1YnFlb2R6YW16d3h5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ5MjYwNTIsImV4cCI6MjA5MDUwMjA1Mn0.uslJiGo28E2U9eVV4O-GLeGviVkV3_1ok2UOn5g8aXA'

const supabase = createClient(supabaseUrl, supabaseAnonKey)

async function checkTable() {
  console.log('🔍 Verificando tabela whatsapp_bot_configs...')
  
  const timer = setTimeout(() => {
    console.error('❌ TIMEOUT: A consulta ao Supabase demorou mais de 10 segundos.')
    process.exit(1)
  }, 10000)

  try {
    const { data, error } = await supabase
      .from('whatsapp_bot_configs')
      .select('*')
      .limit(1)

    clearTimeout(timer)

    if (error) {
      if (error.code === '42P01') {
        console.error('❌ ERRO: A tabela `whatsapp_bot_configs` NÃO EXISTE.')
      } else {
        console.error(`⚠️ Erro inesperado: [${error.code}] ${error.message}`)
      }
    } else {
      console.log('✅ Tabela `whatsapp_bot_configs` encontrada com sucesso!')
      console.log('Dados:', data)
    }
  } catch (e) {
    console.error(`❌ Erro de execução: ${e.message}`)
  }
}

checkTable()
