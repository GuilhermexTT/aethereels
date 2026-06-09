import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { createClient } from '@supabase/supabase-js';

// 1. Carregador simples de variáveis de ambiente do .env.local
function loadEnv() {
  const envPath = path.join(process.cwd(), '.env.local');
  if (fs.existsSync(envPath)) {
    const envContent = fs.readFileSync(envPath, 'utf-8');
    envContent.split('\n').forEach((line) => {
      const trimmed = line.trim();
      if (trimmed && !trimmed.startsWith('#')) {
        const firstEquals = trimmed.indexOf('=');
        if (firstEquals !== -1) {
          const key = trimmed.slice(0, firstEquals).trim();
          const val = trimmed.slice(firstEquals + 1).trim().replace(/(^['"]|['"]$)/g, '');
          process.env[key] = val;
        }
      }
    });
    console.log('💡 Variáveis de ambiente carregadas do .env.local com sucesso!');
  } else {
    console.warn('⚠️ Arquivo .env.local não encontrado na raiz. O script dependerá do ambiente global.');
  }
}

loadEnv();

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const HMAC_SECRET = process.env.REELSFLOW_SIGNATURE_SECRET || '';
const API_BASE_URL = 'http://localhost:3000';

if (!SUPABASE_URL || !HMAC_SECRET) {
  console.error('❌ Configuração incompleta. Certifique-se de preencher NEXT_PUBLIC_SUPABASE_URL e REELSFLOW_SIGNATURE_SECRET.');
  process.exit(1);
}

// Inicializar clientes Supabase para o teste
const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false }
});

// Helper para gerar assinatura HMAC-SHA256
function computeHmac(payload: string): string {
  return crypto.createHmac('sha256', HMAC_SECRET).update(payload).digest('hex');
}

async function runTests() {
  console.log('\n==================================================');
  console.log('🚀 INICIANDO TESTES DE SEGURANÇA E INTEGRIDADE');
  console.log('==================================================\n');

  let testUser: any = null;
  let testJobId: string = '';

  try {
    // -------------------------------------------------------------------------
    // TESTE 1: Callback Falso (Validar rejeição de assinaturas inválidas no Webhook)
    // -------------------------------------------------------------------------
    console.log('🔹 Teste 1: Enviando callback inválido para /api/webhooks/n8n-callback...');
    const fakePayload = JSON.stringify({
      job_id: '00000000-0000-0000-0000-000000000000',
      status: 'ready',
      video_url: 'https://example.com/video.mp4'
    });

    const resFakeCallback = await fetch(`${API_BASE_URL}/api/webhooks/n8n-callback`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-ReelsFlow-Signature': 'assinatura-falsa-hex-invalida'
      },
      body: fakePayload
    });

    if (resFakeCallback.status === 401) {
      console.log('✅ SUCESSO: Callback falso rejeitado com 401 Unauthorized.');
    } else {
      console.error(`❌ FALHA: O endpoint aceitou a assinatura inválida! Status retornado: ${resFakeCallback.status}`);
    }

    // -------------------------------------------------------------------------
    // TESTE 2: Callback Válido com Assinatura Correta (Verificar bypass RLS para Admin)
    // -------------------------------------------------------------------------
    console.log('\n🔹 Teste 2: Enviando callback legítimo (assinado via HMAC)...');
    const validSignature = computeHmac(fakePayload);

    const resValidCallback = await fetch(`${API_BASE_URL}/api/webhooks/n8n-callback`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-ReelsFlow-Signature': validSignature
      },
      body: fakePayload
    });

    // Como o job com ID de zeros não existe, a API deve retornar erro 404 de "job não encontrado",
    // mas NÃO deve barrar com 401 Unauthorized. Isso comprova que passou pelo HMAC de segurança!
    if (resValidCallback.status === 404 || resValidCallback.status === 200) {
      console.log('✅ SUCESSO: Assinatura HMAC aceita com sucesso (autenticação validada).');
    } else {
      console.error(`❌ FALHA: Callback legítimo rejeitado ou com erro inesperado! Status: ${resValidCallback.status}`);
      const text = await resValidCallback.text();
      console.error(`Detalhes: ${text}`);
    }

    // -------------------------------------------------------------------------
    // SETUP DE DADOS PARA TESTE DE RACE CONDITION & RLS
    // -------------------------------------------------------------------------
    console.log('\n🔹 Preparando cenário de teste de concorrência no banco de dados...');
    if (!SUPABASE_SERVICE_ROLE_KEY) {
      console.warn('⚠️ SUPABASE_SERVICE_ROLE_KEY ausente. Não é possível rodar testes de banco de dados locais.');
      console.warn('Pule a validação de Race Condition e RLS ou preencha o token.');
      return;
    }

    // Criar um usuário de teste único
    const testEmail = `test-reelsflow-${Date.now()}@example.com`;
    const testPassword = 'PasswordStrong123!';
    
    const { data: authUser, error: createUserError } = await supabaseAdmin.auth.admin.createUser({
      email: testEmail,
      password: testPassword,
      email_confirm: true
    });

    if (createUserError || !authUser.user) {
      throw new Error(`Falha ao criar usuário de teste no Supabase Auth: ${createUserError?.message}`);
    }

    testUser = authUser.user;
    console.log(`👤 Usuário de teste criado no Auth: ${testEmail} (ID: ${testUser.id})`);

    // Inserir registro correspondente na tabela public.users
    const { error: insertUserError } = await supabaseAdmin
      .from('users')
      .insert({
        id: testUser.id,
        email: testEmail,
        credits_balance: 1 // Começa com exatamente 1 crédito
      });

    if (insertUserError) {
      throw new Error(`Falha ao criar perfil do usuário na tabela public.users: ${insertUserError.message}`);
    }
    console.log('💳 Perfil inserido na tabela public.users com saldo: 1 crédito.');

    // Autenticar o usuário para obter seu token JWT de acesso
    const { data: sessionData, error: signInError } = await supabaseAdmin.auth.signInWithPassword({
      email: testEmail,
      password: testPassword
    });

    if (signInError || !sessionData.session) {
      throw new Error(`Falha ao fazer login do usuário de teste para obter JWT: ${signInError?.message}`);
    }

    const userJwt = sessionData.session.access_token;
    console.log('🔑 Token JWT do usuário de teste gerado com sucesso!');

    // -------------------------------------------------------------------------
    // TESTE 3: Race Condition (Testar lock pessimista de crédito com cliques simultâneos)
    // -------------------------------------------------------------------------
    console.log('\n🔹 Teste 3: Simulando ataque de Race Condition (10 cliques concorrentes com saldo = 1)...');

    const generatePayload = JSON.stringify({ prompt_input: 'Vídeo futurista sobre IA' });
    const requests = Array.from({ length: 10 }).map(() =>
      fetch(`${API_BASE_URL}/api/video/generate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${userJwt}`
        },
        body: generatePayload
      })
    );

    const responses = await Promise.all(requests);

    let successCount = 0;
    let insufficientCreditsCount = 0;
    let otherCount = 0;

    for (const res of responses) {
      if (res.status === 200) {
        successCount++;
        const data = await res.json();
        testJobId = data.job_id;
      } else if (res.status === 400) {
        const data = await res.json();
        if (data.error && data.error.includes('insuficiente')) {
          insufficientCreditsCount++;
        } else {
          otherCount++;
          console.log(`Mensagem de erro 400 inesperada: ${JSON.stringify(data)}`);
        }
      } else {
        otherCount++;
        console.error(`Resposta inesperada: Código HTTP ${res.status}`);
      }
    }

    console.log(`📊 Resultados do ataque simultâneo:`);
    console.log(`   - Sucesso (200): ${successCount}`);
    console.log(`   - Saldo Insuficiente (400): ${insufficientCreditsCount}`);
    console.log(`   - Outros Retornos: ${otherCount}`);

    // Validações do teste de Race Condition
    if (successCount === 1 && insufficientCreditsCount === 9) {
      console.log('✅ SUCESSO: Concorrência bloqueada! Apenas 1 débito autorizado e 9 rejeitados.');
    } else {
      console.error(`❌ FALHA: A proteção de concorrência falhou! Esperado 1 sucesso e 9 falhas de saldo.`);
    }

    // Verificar o saldo final no banco de dados
    const { data: dbUser, error: checkUserErr } = await supabaseAdmin
      .from('users')
      .select('credits_balance')
      .eq('id', testUser.id)
      .single();

    if (checkUserErr || !dbUser) {
      throw new Error(`Erro ao verificar saldo final do usuário: ${checkUserErr?.message}`);
    }

    console.log(`💳 Saldo final verificado no banco de dados: ${dbUser.credits_balance} créditos.`);
    if (dbUser.credits_balance === 0) {
      console.log('✅ SUCESSO: Saldo final do banco de dados é exatamente 0.');
    } else {
      console.error(`❌ FALHA: O saldo do usuário no banco é ${dbUser.credits_balance} (deveria ser 0).`);
    }

    // -------------------------------------------------------------------------
    // TESTE 4: Injeção de Segurança RLS (Usuário A acessando dados do Usuário B)
    // -------------------------------------------------------------------------
    console.log('\n🔹 Teste 4: Simulando injeção RLS (Usuário B tentando acessar dados do Usuário A)...');

    // Criar Usuário B
    const testEmailB = `test-reelsflow-b-${Date.now()}@example.com`;
    const { data: authUserB, error: createUserBError } = await supabaseAdmin.auth.admin.createUser({
      email: testEmailB,
      password: testPassword,
      email_confirm: true
    });

    if (createUserBError || !authUserB.user) {
      throw new Error(`Falha ao criar perfil do Usuário B no Auth: ${createUserBError?.message}`);
    }

    const testUserB = authUserB.user;

    // Inserir registro na tabela public.users para o Usuário B
    await supabaseAdmin.from('users').insert({
      id: testUserB.id,
      email: testEmailB,
      credits_balance: 5
    });

    // Obter cliente do Supabase com sessão autenticada do Usuário B
    const { data: sessionDataB } = await supabaseAdmin.auth.signInWithPassword({
      email: testEmailB,
      password: testPassword
    });

    const userClientB = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
      global: { headers: { Authorization: `Bearer ${sessionDataB.session?.access_token}` } }
    });

    // O Usuário B tenta ler o job_id gerado pelo Usuário A (testJobId)
    const { data: readJobData, error: readJobError } = await userClientB
      .from('video_jobs')
      .select('*')
      .eq('id', testJobId);

    // Devido ao RLS, o retorno deve ser vazio (usuário B não vê dados que não pertencem a ele),
    // e não deve levantar erro de banco de dados, apenas retornar 0 registros.
    if (readJobError) {
      console.error('❌ FALHA: Erro inesperado do banco de dados no RLS:', readJobError.message);
    } else if (!readJobData || readJobData.length === 0) {
      console.log('✅ SUCESSO: O Usuário B não conseguiu visualizar o job do Usuário A (RLS isolou os dados).');
    } else {
      console.error('❌ FALHA DE SEGURANÇA CRÍTICA: O Usuário B conseguiu ler o job de vídeo do Usuário A!');
      console.error(JSON.stringify(readJobData));
    }

    // Usuário B tenta atualizar o status do job do Usuário A
    const { data: updateJobData, error: updateJobError } = await userClientB
      .from('video_jobs')
      .update({ status: 'ready' })
      .eq('id', testJobId)
      .select();

    if (updateJobError) {
      console.error('❌ FALHA: Erro inesperado do banco ao tentar burlar RLS:', updateJobError.message);
    } else if (!updateJobData || updateJobData.length === 0) {
      console.log('✅ SUCESSO: O Usuário B foi impedido de atualizar o job do Usuário A (RLS ativo).');
    } else {
      console.error('❌ FALHA DE SEGURANÇA CRÍTICA: O Usuário B conseguiu atualizar o status de um job pertencente ao Usuário A!');
    }

    // Limpar os usuários criados para não encher a base
    console.log('\n🔹 Limpando banco de dados de teste...');
    await supabaseAdmin.auth.admin.deleteUser(testUser.id);
    await supabaseAdmin.auth.admin.deleteUser(testUserB.id);
    console.log('🧹 Limpeza realizada com sucesso!');

  } catch (error: any) {
    console.error('\n💥 ERRO EXECUTANDO OS TESTES:', error.message);
    // Tenta limpar em caso de falha parcial
    if (testUser?.id) {
      await supabaseAdmin.auth.admin.deleteUser(testUser.id).catch(() => {});
    }
  }

  console.log('\n==================================================');
  console.log('🏁 TESTES DE SEGURANÇA CONCLUÍDOS');
  console.log('==================================================\n');
}

runTests();
