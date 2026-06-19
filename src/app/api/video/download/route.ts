import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseUserClientFromRequest, supabaseAdmin } from '@/lib/supabase';

export async function POST(request: NextRequest) {
  try {
    // 1. Validar o payload JSON da requisição
    let body;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { error: 'Corpo da requisição inválido. Deve ser um JSON válido.' },
        { status: 400 }
      );
    }

    const { job_id } = body;

    if (!job_id || typeof job_id !== 'string' || job_id.trim() === '') {
      return NextResponse.json(
        { error: 'O campo job_id é obrigatório e deve ser uma string.' },
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
    } catch {
      console.log('Nenhuma sessão ativa encontrada via cookies/auth headers.');
    }

    if (authError || !user) {
      // Em modo de desenvolvimento, se não houver usuário logado, usamos o usuário padrão de testes
      if (process.env.NODE_ENV === 'development' || !process.env.NODE_ENV) {
        console.log('🔧 [DEV MODE] Nenhuma sessão ativa detectada na renderização. Tentando buscar usuário padrão...');
        const { data: existingUsers } = await supabaseAdmin
          .from('profiles')
          .select('id, email')
          .limit(1);

        if (existingUsers && existingUsers.length > 0) {
          user = { id: existingUsers[0].id, email: existingUsers[0].email };
          console.log(`🔧 [DEV MODE] Usando usuário de testes: ${user.email} (${user.id})`);
        } else {
          return NextResponse.json(
            { error: 'Não autorizado. Nenhum usuário de testes configurado.' },
            { status: 401 }
          );
        }
      } else {
        return NextResponse.json(
          { error: 'Não autorizado. Faça login para renderizar vídeos.' },
          { status: 401 }
        );
      }
    }

    // 4. Buscar o job na tabela public.video_jobs do Supabase
    // Para respeitar as políticas de RLS, usamos o supabaseUser.
    // Se for um usuário padrão de desenvolvimento sem sessão ativa, usamos supabaseAdmin.
    const supabaseClientToUse = (authError || !user || user.email === 'dev-reelsflow-user@example.com') 
      ? supabaseAdmin 
      : supabaseUser;

    const { data: job, error: jobError } = await supabaseClientToUse
      .from('video_jobs')
      .select('*')
      .eq('id', job_id)
      .maybeSingle();

    if (jobError) {
      console.error('Erro ao buscar o job no Supabase:', jobError);
      return NextResponse.json(
        { error: 'Erro ao buscar o job no banco de dados.' },
        { status: 500 }
      );
    }

    if (!job) {
      return NextResponse.json(
        { error: 'Job de vídeo correspondente não encontrado.' },
        { status: 404 }
      );
    }

    // Extrair os dados de script_json
    const scriptJson = typeof job.script_json === 'string' 
      ? JSON.parse(job.script_json) 
      : job.script_json;

    const { video_urls, audio_url, subtitles } = scriptJson || {};

    if (!video_urls || !Array.isArray(video_urls) || video_urls.length === 0) {
      return NextResponse.json(
        { error: 'Dados do roteiro incompletos: video_urls ausente ou inválido.' },
        { status: 400 }
      );
    }

    if (!audio_url) {
      return NextResponse.json(
        { error: 'Dados do roteiro incompletos: audio_url ausente.' },
        { status: 400 }
      );
    }

    if (!subtitles || !Array.isArray(subtitles) || subtitles.length === 0) {
      return NextResponse.json(
        { error: 'Dados do roteiro incompletos: subtitles ausente ou inválido.' },
        { status: 400 }
      );
    }

    // 5. Atualizar o status do job para 'rendering'
    const { error: updateError } = await supabaseAdmin
      .from('video_jobs')
      .update({ status: 'rendering' })
      .eq('id', job_id);

    if (updateError) {
      console.error('Erro ao atualizar status do job para rendering:', updateError);
      return NextResponse.json(
        { error: 'Falha ao atualizar o status do job no banco de dados.' },
        { status: 500 }
      );
    }

    // 6. Enviar a requisição para o motor de renderização Remotion
    const remotionEngineUrl = process.env.REMOTION_ENGINE_URL;
    const remotionSecretToken = process.env.REMOTION_SECRET_TOKEN;

    if (!remotionEngineUrl) {
      console.error('ERRO: REMOTION_ENGINE_URL não configurado.');
      
      // Reembolsa créditos se falhar
      await supabaseAdmin.rpc('refund_video_credit', {
        p_user_id: user.id,
        p_job_id: job_id,
        p_error_txt: 'REMOTION_ENGINE_URL não configurado no servidor Next.js.'
      });

      return NextResponse.json(
        { error: 'Configuração do motor de renderização ausente no servidor. Seu crédito foi estornado.' },
        { status: 500 }
      );
    }

    // Determinar a URL de callback do n8n automaticamente a partir de N8N_WEBHOOK_URL se N8N_CALLBACK_URL não estiver configurada
    let callbackUrl = process.env.N8N_CALLBACK_URL;
    if (!callbackUrl && process.env.N8N_WEBHOOK_URL) {
      callbackUrl = process.env.N8N_WEBHOOK_URL.replace(/\/create$/, '/callback');
    }
    if (!callbackUrl) {
      // Fallback local se nenhuma das variáveis existir
      callbackUrl = `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000'}/api/webhooks/n8n-callback`;
    }

    try {
      const renderResponse = await fetch(`${remotionEngineUrl}/render`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(remotionSecretToken ? { 'Authorization': `Bearer ${remotionSecretToken}` } : {})
        },
        body: JSON.stringify({
          job_id,
          subtitles,
          audio_url,
          video_urls,
          callback_url: callbackUrl
        }),
      });

      if (!renderResponse.ok) {
        const errText = await renderResponse.text();
        throw new Error(`Motor Remotion retornou status ${renderResponse.status}: ${errText}`);
      }

      console.log(`Render disparado com sucesso para o job_id ${job_id}`);

    } catch (renderError: any) {
      console.error('Erro ao chamar motor Remotion:', renderError);

      // Reverter status para failed e reembolsar créditos via RPC
      await supabaseAdmin.rpc('refund_video_credit', {
        p_user_id: user.id,
        p_job_id: job_id,
        p_error_txt: `Erro ao acionar motor de renderização: ${renderError.message}`
      });

      return NextResponse.json(
        { error: 'Falha ao iniciar o processo de renderização com o motor externo. Seu crédito foi estornado.' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      message: 'Renderização iniciada com sucesso.',
      job_id,
      status: 'rendering'
    });

  } catch (error: any) {
    console.error('Erro interno na API /api/video/download:', error);
    return NextResponse.json(
      { error: 'Erro interno do servidor.' },
      { status: 500 }
    );
  }
}
