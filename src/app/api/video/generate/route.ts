import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseUserClientFromRequest, supabaseAdmin, getSupabaseUserTokenFromRequest } from '@/lib/supabase';
import { generateHmacSignature } from '@/lib/crypto';

export async function POST(request: NextRequest) {
  try {
    // 1. Validar e decodificar o payload JSON da requisição
    let body;
    try {
      body = await request.json();
    } catch (err) {
      return NextResponse.json(
        { error: 'Corpo da requisição inválido. Deve ser um JSON válido.' },
        { status: 400 }
      );
    }

    const { prompt_input } = body;

    if (!prompt_input || typeof prompt_input !== 'string' || prompt_input.trim() === '') {
      return NextResponse.json(
        { error: 'O campo prompt_input é obrigatório e não pode ser vazio.' },
        { status: 400 }
      );
    }

    // 2. Obter o cliente Supabase associado ao usuário (respeita RLS)
    const supabaseUser = await getSupabaseUserClientFromRequest();
    const token = await getSupabaseUserTokenFromRequest();

    // 3. Obter dados do usuário autenticado a partir da sessão
    let user: any = null;
    let authError: any = null;
    try {
      const { data: { user: supabaseAuthUser }, error: err } = await supabaseUser.auth.getUser(token);
      user = supabaseAuthUser;
      authError = err;
    } catch (err) {
      console.log('Nenhuma sessão ativa encontrada via cookies/auth headers.');
    }

    if (authError || !user) {
      // Em modo de desenvolvimento, se não houver usuário logado, criamos/usamos um usuário padrão de testes
      if (process.env.NODE_ENV === 'development' || !process.env.NODE_ENV) {
        console.log('🔧 [DEV MODE] Nenhuma sessão ativa detectada. Criando/usando usuário padrão de testes...');
        
        // Verificar se existe algum usuário cadastrado na tabela de perfis
        const { data: existingProfiles } = await supabaseAdmin
          .from('profiles')
          .select('id, email')
          .limit(1);

        if (existingProfiles && existingProfiles.length > 0) {
          user = { id: existingProfiles[0].id, email: existingProfiles[0].email };
          console.log(`🔧 [DEV MODE] Usando usuário de testes existente em profiles: ${user.email} (${user.id})`);
        } else {
          // Se não houver, criamos um usuário padrão no Auth
          const testEmail = 'dev-reelsflow-user@example.com';
          const testPassword = 'PasswordDev123!';
          
          const { data: authUser, error: createUserError } = await supabaseAdmin.auth.admin.createUser({
            email: testEmail,
            password: testPassword,
            email_confirm: true
          });

          if (createUserError || !authUser.user) {
            console.error('Falha ao criar usuário de testes no Supabase Auth:', createUserError);
            return NextResponse.json(
              { error: 'Não autorizado. Falha ao gerar usuário padrão de testes.' },
              { status: 401 }
            );
          }

          user = authUser.user;
          console.log(`🔧 [DEV MODE] Novo usuário de testes criado no Auth: ${testEmail} (${user.id})`);

          // Criar registro na tabela legada users por compatibilidade
          await supabaseAdmin.from('users').insert({
            id: user.id,
            email: testEmail,
            credits_balance: 1000
          }).select('id');

          // Inserir na tabela public.profiles com saldo inicial para testes locais
          const { error: insertProfileError } = await supabaseAdmin
            .from('profiles')
            .insert({
              id: user.id,
              email: testEmail,
              credits: 1000 // Saldo generoso para testes de desenvolvimento
            });

          if (insertProfileError) {
            console.error('Erro ao inserir perfil do usuário de testes na tabela public.profiles:', insertProfileError);
            return NextResponse.json(
              { error: 'Não autorizado. Falha ao inicializar créditos do usuário padrão de testes.' },
              { status: 401 }
            );
          }
          console.log('🔧 [DEV MODE] Perfil criado na tabela public.profiles com 1000 créditos.');
        }
      } else {
        return NextResponse.json(
          { error: 'Não autorizado. Faça login para gerar vídeos.' },
          { status: 401 }
        );
      }
    }

    // 4. Garantir que o perfil do usuário existe na tabela public.profiles e obter saldo
    let { data: profile, error: profileError } = await supabaseAdmin
      .from('profiles')
      .select('id, credits')
      .eq('id', user.id)
      .maybeSingle();

    if (profileError) {
      console.error('Erro ao buscar perfil do usuário em public.profiles:', profileError);
    }

    // Se o perfil não existir, criamos um automaticamente com o saldo padrão inicial (5 créditos)
    if (!profile) {
      console.log(`🔧 [AUTH AUTO-SETUP] Perfil do usuário ${user.email} (${user.id}) não encontrado em public.profiles. Criando com saldo inicial de 5 créditos...`);
      
      // Criar também na tabela legada users por retrocompatibilidade de FK
      await supabaseAdmin.from('users').insert({
        id: user.id,
        email: user.email,
        credits_balance: 5
      }).select('id').maybeSingle();

      const { data: newProfile, error: insertError } = await supabaseAdmin
        .from('profiles')
        .insert({
          id: user.id,
          email: user.email,
          credits: 5 // Saldo padrão inicial de testes conforme requisito
        })
        .select('id, credits')
        .single();

      if (insertError) {
        console.error('Erro ao inserir perfil do usuário em public.profiles:', insertError);
        return NextResponse.json(
          { error: 'Falha ao inicializar o perfil e saldo de créditos do usuário.' },
          { status: 500 }
        );
      }
      profile = newProfile;
    }

    // 5. Trava de Segurança Server-Side: Verificar se o saldo de créditos é maior que 0
    if (profile.credits <= 0) {
      console.warn(`[TRAVA DE SEGURANÇA] Usuário ${user.email} (${user.id}) tentou gerar vídeo com saldo zerado (Saldo atual: ${profile.credits}).`);
      return NextResponse.json(
        { error: 'Saldo de créditos insuficiente. Faça um upgrade ou aguarde a recarga.' },
        { status: 403 }
      );
    }

    // 6. Criar o registro na tabela de video_jobs com status 'pending' para obter o job_id
    const { data: newJob, error: jobError } = await supabaseAdmin
      .from('video_jobs')
      .insert({
        user_id: user.id,
        status: 'pending',
        prompt_input: prompt_input.trim(),
        script_json: {}
      })
      .select('id')
      .single();

    if (jobError || !newJob) {
      console.error('Erro ao registrar o job de vídeo no Supabase:', jobError);
      return NextResponse.json(
        { error: 'Falha ao iniciar o job de vídeo no banco de dados.' },
        { status: 500 }
      );
    }

    const jobId = newJob.id;

    // 7. Preparar e enviar o payload para o n8n assinado via HMAC
    const n8nWebhookUrl = process.env.N8N_WEBHOOK_URL;
    const webhookPayload = {
      job_id: jobId,
      prompt_input: prompt_input.trim(),
      user_id: user.id
    };

    const payloadString = JSON.stringify(webhookPayload);

    // Gerar assinatura HMAC usando a chave secreta compartilhada
    let signature = '';
    try {
      signature = generateHmacSignature(payloadString);
    } catch (cryptoErr: any) {
      console.error('Erro de criptografia interna na geração da assinatura HMAC:', cryptoErr);
      
      // Marcar o job como falhado se falhar na assinatura
      await supabaseAdmin
        .from('video_jobs')
        .update({ status: 'failed' })
        .eq('id', jobId);

      return NextResponse.json(
        { error: 'Configuração interna do servidor inválida (chave secreta de assinatura ausente).' },
        { status: 500 }
      );
    }

    if (!n8nWebhookUrl) {
      console.error('ERRO: N8N_WEBHOOK_URL não configurada nas variáveis de ambiente.');
      
      // Atualizar o status do job para failed
      await supabaseAdmin
        .from('video_jobs')
        .update({ status: 'failed' })
        .eq('id', jobId);

      return NextResponse.json(
        { error: 'Falha ao processar o vídeo. Integração externa não configurada.' },
        { status: 500 }
      );
    }

    // Disparar a chamada para o n8n
    try {
      const response = await fetch(n8nWebhookUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-ReelsFlow-Signature': signature,
        },
        body: payloadString,
      });

      if (!response.ok) {
        throw new Error(`n8n retornou status ${response.status}`);
      }
    } catch (networkErr: any) {
      console.error(`Falha ao disparar webhook para o n8n. Marcando job ${jobId} como falhado. Erro: ${networkErr.message}`);
      
      // Se falhar o disparo para o n8n, marcamos o job como failed imediatamente
      // (Não debitamos créditos neste caso, pois o fluxo foi interrompido antes de consumir recursos na AWS/ElevenLabs)
      await supabaseAdmin
        .from('video_jobs')
        .update({ status: 'failed' })
        .eq('id', jobId);

      return NextResponse.json(
        { error: 'Erro de conexão com o motor de renderização. Nenhum crédito foi debitado.' },
        { status: 500 }
      );
    }

    // 8. Fluxo de Disparo com Sucesso -> Decrementar exatamente 1 crédito via RPC atômica
    const { error: decrementError } = await supabaseAdmin.rpc('decrement_profile_credits', {
      p_user_id: user.id,
      p_amount: 1
    });

    if (decrementError) {
      console.error(`Erro ao debitar crédito do usuário ${user.id} para o job ${jobId}:`, decrementError);
      // Mantemos o job em andamento, mas logamos o erro administrativo de créditos
    } else {
      console.log(`[DÉBITO BEM-SUCEDIDO] 1 crédito debitado do usuário ${user.id} pelo job ${jobId}.`);
    }

    // 9. Retornar sucesso contendo o id do job criado
    return NextResponse.json({
      job_id: jobId,
      status: 'pending'
    });

  } catch (error: any) {
    console.error('Erro geral na API /api/video/generate:', error);
    return NextResponse.json(
      { error: 'Erro interno do servidor.' },
      { status: 500 }
    );
  }
}
