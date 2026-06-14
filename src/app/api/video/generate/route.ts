import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseUserClientFromRequest, supabaseAdmin } from '@/lib/supabase';
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

    // 3. Obter dados do usuário autenticado a partir da sessão
    let user: any = null;
    let authError: any = null;
    try {
      const { data: { user: supabaseAuthUser }, error: err } = await supabaseUser.auth.getUser();
      user = supabaseAuthUser;
      authError = err;
    } catch (err) {
      console.log('Nenhuma sessão ativa encontrada via cookies/auth headers.');
    }

    if (authError || !user) {
      // Em modo de desenvolvimento, se não houver usuário logado, criamos/usamos um usuário padrão de testes
      if (process.env.NODE_ENV === 'development' || !process.env.NODE_ENV) {
        console.log('🔧 [DEV MODE] Nenhuma sessão ativa detectada. Criando/usando usuário padrão de testes...');
        
        // Verificar se existe algum usuário cadastrado na tabela de usuários públicos
        const { data: existingUsers } = await supabaseAdmin
          .from('users')
          .select('id, email')
          .limit(1);

        if (existingUsers && existingUsers.length > 0) {
          user = { id: existingUsers[0].id, email: existingUsers[0].email };
          console.log(`🔧 [DEV MODE] Usando usuário de testes existente: ${user.email} (${user.id})`);
        } else {
          // Se não houver, criamos um usuário padrão
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

          // Inserir na tabela public.users com saldo inicial de créditos
          const { error: insertUserError } = await supabaseAdmin
            .from('users')
            .insert({
              id: user.id,
              email: testEmail,
              credits_balance: 1000 // Saldo para testes locais
            });

          if (insertUserError) {
            console.error('Erro ao inserir perfil do usuário de testes na tabela public.users:', insertUserError);
            return NextResponse.json(
              { error: 'Não autorizado. Falha ao inicializar créditos do usuário padrão de testes.' },
              { status: 401 }
            );
          }
          console.log('🔧 [DEV MODE] Perfil criado na tabela public.users com 1000 créditos.');
        }
      } else {
        return NextResponse.json(
          { error: 'Não autorizado. Faça login para gerar vídeos.' },
          { status: 401 }
        );
      }
    }

    // 4. Invocar a RPC para debitar crédito de forma atômica (previne Race Conditions)
    // Se for em modo de desenvolvimento sem sessão ativa, usamos supabaseAdmin para bypassar RLS da RPC
    const supabaseClientToUse = (authError || !user || user.email === 'dev-reelsflow-user@example.com') 
      ? supabaseAdmin 
      : supabaseUser;

    const { data: jobId, error: rpcError } = await supabaseClientToUse.rpc('debit_video_credit', {
      p_user_id: user.id,
      p_prompt_input: prompt_input.trim()
    });


    if (rpcError) {
      // O Supabase retorna códigos de erro PostgreSQL em 'code'.
      // Erro 22003 indica valor fora do intervalo (CHECK constraint de saldo insuficiente)
      // Erro 42501 indica privilégio insuficiente (tentativa de roubo de ID, etc.)
      const isInsufficientCredits = rpcError.code === '22003' || rpcError.message.includes('insuficiente');
      
      return NextResponse.json(
        { error: isInsufficientCredits ? 'Saldo de créditos insuficiente.' : rpcError.message },
        { status: isInsufficientCredits ? 400 : 500 }
      );
    }

    // 5. Preparar e enviar o payload para o n8n assinado via HMAC
    const n8nWebhookUrl = process.env.N8N_WEBHOOK_URL;
    
    // Payload enviado para o n8n
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
      // Se a chave não estiver configurada no servidor, reembolsamos o crédito imediatamente
      await supabaseAdmin.rpc('refund_video_credit', {
        p_user_id: user.id,
        p_job_id: jobId,
        p_error_txt: `Erro de criptografia interna: ${cryptoErr.message}`
      });
      return NextResponse.json(
        { error: 'Configuração interna do servidor inválida (chave secreta de assinatura ausente).' },
        { status: 500 }
      );
    }

    if (!n8nWebhookUrl) {
      // Se a URL do n8n não estiver configurada no backend, logamos e estornamos o crédito
      console.error('ERRO: N8N_WEBHOOK_URL não configurada nas variáveis de ambiente.');
      
      await supabaseAdmin.rpc('refund_video_credit', {
        p_user_id: user.id,
        p_job_id: jobId,
        p_error_txt: 'Webhook do n8n não configurado no servidor.'
      });

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
      // Se falhar o disparo para o n8n (Rede offline, DNS falhou, etc.), executamos a política de reembolso
      console.error(`Falha ao disparar webhook para o n8n. Iniciando reembolso para o job ${jobId}. Erro: ${networkErr.message}`);
      
      await supabaseAdmin.rpc('refund_video_credit', {
        p_user_id: user.id,
        p_job_id: jobId,
        p_error_txt: `Falha na requisição de rede para o n8n: ${networkErr.message}`
      });

      return NextResponse.json(
        { error: 'Erro de conexão com o motor de renderização. Seu crédito foi estornado.' },
        { status: 500 }
      );
    }

    // 6. Retornar sucesso contendo o id do job criado
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
