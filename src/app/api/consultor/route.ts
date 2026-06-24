import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseUserClientFromRequest, supabaseAdmin, getSupabaseUserTokenFromRequest } from '@/lib/supabase';

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

    const { message, chat_id } = body;

    if (!message || typeof message !== 'string' || message.trim() === '') {
      return NextResponse.json(
        { error: 'O campo "message" é obrigatório e não pode ser vazio.' },
        { status: 400 }
      );
    }

    if (!chat_id || typeof chat_id !== 'string' || chat_id.trim() === '') {
      return NextResponse.json(
        { error: 'O campo "chat_id" é obrigatório e não pode ser vazio.' },
        { status: 400 }
      );
    }

    // 2. Obter o cliente Supabase associado ao usuário
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
      console.log('Nenhuma sessão ativa encontrada via cookies/auth headers no consultor.');
    }

    if (authError || !user) {
      // Em modo de desenvolvimento, se não houver usuário logado, criamos/usamos um usuário padrão de testes
      if (process.env.NODE_ENV === 'development' || !process.env.NODE_ENV) {
        console.log('🔧 [DEV MODE] Nenhuma sessão ativa detectada. Criando/usando usuário padrão de testes para o consultor...');
        
        // Verificar se existe algum usuário cadastrado na tabela de perfis
        const { data: existingProfiles } = await supabaseAdmin
          .from('profiles')
          .select('id, email')
          .limit(1);

        if (existingProfiles && existingProfiles.length > 0) {
          user = { id: existingProfiles[0].id, email: existingProfiles[0].email };
          console.log(`🔧 [DEV MODE] Usando usuário de testes existente em profiles: ${user.email} (${user.id})`);
        } else {
          // Se não houver, cria um usuário padrão de testes
          const testEmail = 'dev-reelsflow-user@example.com';
          const testPassword = 'PasswordDev123!';
          
          const { data: authUser, error: createUserError } = await supabaseAdmin.auth.admin.createUser({
            email: testEmail,
            password: testPassword,
            email_confirm: true
          });

          if (createUserError || !authUser.user) {
            console.error('Falha ao criar usuário de testes no Supabase Auth para o consultor:', createUserError);
            return NextResponse.json(
              { error: 'Não autorizado. Falha ao gerar usuário padrão de testes.' },
              { status: 401 }
            );
          }

          user = authUser.user;
          console.log(`🔧 [DEV MODE] Novo usuário de testes criado no Auth para o consultor: ${testEmail} (${user.id})`);

          // Criar registro na tabela legada users por compatibilidade
          await supabaseAdmin.from('users').insert({
            id: user.id,
            email: testEmail,
            credits_balance: 1000
          }).select('id');

          // Inserir na tabela public.profiles com saldo inicial para testes locais
          await supabaseAdmin
            .from('profiles')
            .insert({
              id: user.id,
              email: testEmail,
              credits: 1000
            });
        }
      } else {
        return NextResponse.json(
          { error: 'Não autorizado. Faça login para utilizar o consultor.' },
          { status: 401 }
        );
      }
    }

    // 4. Buscar a URL do webhook do consultor nas variáveis de ambiente
    const n8nConsultorUrl = process.env.N8N_CONSULTOR_WEBHOOK_URL;
    if (!n8nConsultorUrl) {
      console.error('ERRO: N8N_CONSULTOR_WEBHOOK_URL não configurada nas variáveis de ambiente.');
      return NextResponse.json(
        { error: 'Erro de integração externa do consultor. Endpoint não configurado.' },
        { status: 500 }
      );
    }

    // 5. Preparar o payload exatamente conforme o esperado pelo n8n
    const payload = {
      message: message.trim(),
      chat_id: chat_id.trim(),
      user_id: user.id
    };

    console.log(`[Proxy Consultor] Enviando payload para o n8n:`, {
      chat_id: payload.chat_id,
      user_id: payload.user_id,
      message_preview: payload.message.substring(0, 50) + (payload.message.length > 50 ? '...' : '')
    });

    // 6. Chamar o webhook do n8n de forma síncrona
    try {
      const response = await fetch(n8nConsultorUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`Erro ao chamar o webhook do n8n do consultor: status ${response.status}`, errorText);
        throw new Error(`n8n webhook retornou status ${response.status}`);
      }

      // n8n devolve a resposta do Gemini de forma síncrona.
      // Pode ser JSON ou texto puro. Tratar de forma robusta e flexível.
      const responseText = await response.text();
      let responseData;
      try {
        responseData = JSON.parse(responseText);
      } catch (e) {
        responseData = responseText;
      }

      // Normaliza o retorno no formato { response: string }
      let finalOutput = '';
      if (typeof responseData === 'string') {
        finalOutput = responseData;
      } else if (Array.isArray(responseData)) {
        finalOutput = responseData[0]?.output || responseData[0]?.text || responseData[0]?.response || JSON.stringify(responseData[0]);
      } else if (responseData && typeof responseData === 'object') {
        finalOutput = responseData.output || responseData.text || responseData.response || responseData.message || JSON.stringify(responseData);
      } else {
        finalOutput = responseText;
      }

      return NextResponse.json({ response: finalOutput });

    } catch (networkErr: any) {
      console.error(`Falha ao disparar webhook para o n8n do consultor:`, networkErr);
      return NextResponse.json(
        { error: 'Erro de conexão com o motor de inteligência artificial do consultor.' },
        { status: 502 }
      );
    }

  } catch (error: any) {
    console.error('Erro geral na API /api/consultor:', error);
    return NextResponse.json(
      { error: 'Erro interno no servidor.' },
      { status: 500 }
    );
  }
}
