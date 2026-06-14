import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { verifyHmacSignature } from '@/lib/crypto';

export async function POST(req: NextRequest) {
  try {
    // 1. Ler o corpo bruto da requisição como texto para validação HMAC usando clone()
    const rawBody = await req.clone().text();
    const signature = req.headers.get('X-ReelsFlow-Signature') || '';

    // 2. Validar assinatura HMAC-SHA256 para autenticação segura
    const isValid = verifyHmacSignature(rawBody, signature);
    
    if (!isValid) {
      console.warn('Tentativa de callback não autorizada no webhook do n8n (assinatura inválida ou ausente).');
      return NextResponse.json(
        { error: 'Não autorizado. Assinatura HMAC inválida.' },
        { status: 401 }
      );
    }

    // 3. Fazer o parse correto do body
    let body: {
      job_id?: string;
      status?: string;
      audio_url?: string;
      video_urls?: string[];
      subtitles?: unknown[];
      b_roll_videos?: string[];
      video_url?: string;
      error_message?: string;
      user_id?: string;
    };
    try {
      body = await req.json();
      console.log('📥 [n8n-callback] Payload recebido no webhook:', JSON.stringify(body, null, 2));
    } catch {
      return NextResponse.json(
        { error: 'Corpo da requisição inválido. Esperado um JSON válido.' },
        { status: 400 }
      );
    }

    // 4. Extrair os dados direto da raiz do body
    const { 
      job_id, 
      status, 
      audio_url, 
      video_urls, 
      subtitles, 
      b_roll_videos,
      video_url,
      error_message, 
      user_id 
    } = body;

    console.log(`📥 [n8n-callback] Campos extraídos: job_id=${job_id}, status=${status}, video_url=${video_url}`);

    if (!job_id || !status) {
      return NextResponse.json(
        { error: 'Os campos job_id e status são obrigatórios.' },
        { status: 400 }
      );
    }

    // Validar se o status recebido é um dos enums aceitos
    const validStatuses = ['scripting', 'rendering', 'ready', 'failed'];
    if (!validStatuses.includes(status)) {
      return NextResponse.json(
        { error: `Status inválido: ${status}. Escolha entre: ${validStatuses.join(', ')}` },
        { status: 400 }
      );
    }

    console.log(`Recebido callback do n8n para o job ${job_id} com status: ${status}`);

    // 5. Buscar o job de vídeo correspondente no banco de dados
    const { data: jobData, error: fetchError } = await supabaseAdmin
      .from('video_jobs')
      .select('user_id, script_json')
      .eq('id', job_id)
      .single();

    if (fetchError || !jobData) {
      console.error(`Falha ao recuperar o job ${job_id}:`, fetchError);
      return NextResponse.json(
        { error: 'Job de vídeo correspondente não encontrado no banco de dados.' },
        { status: 404 }
      );
    }

    // 6. Se o status for 'failed', executa a política de reembolso
    if (status === 'failed') {
      const finalUserId = user_id || jobData.user_id;

      // Invoca a RPC public.refund_video_credit no Supabase
      const { error: refundError } = await supabaseAdmin.rpc('refund_video_credit', {
        p_user_id: finalUserId,
        p_job_id: job_id,
        p_error_txt: error_message || 'Falha genérica no processamento da automação.'
      });

      if (refundError) {
        console.error(`Erro ao processar reembolso via RPC para o job ${job_id}:`, refundError);
        
        // Se for erro de violação de chave primária/reembolso duplicado
        if (refundError.code === '23505') {
          return NextResponse.json(
            { message: 'Reembolso já processado anteriormente para este job.' },
            { status: 200 }
          );
        }

        return NextResponse.json(
          { error: `Falha ao reembolsar créditos: ${refundError.message}` },
          { status: 500 }
        );
      }

      console.log(`Reembolso de 1 crédito processado com sucesso para o usuário ${finalUserId} no job ${job_id}`);
      return NextResponse.json({
        message: 'Job atualizado para failed e reembolso de créditos executado com sucesso.',
        job_id,
        status: 'failed'
      });
    }

    // 7. Atualizar o status do job e dados adicionais
    const updateData: {
      status: string;
      video_url?: string;
      script_json?: Record<string, unknown>;
    } = { status };

    if (video_url) {
      updateData.video_url = video_url;
    }

    // Recuperar e fazer parse do script_json atual
    let currentScript: Record<string, unknown> = {};
    if (jobData.script_json) {
      try {
        currentScript = typeof jobData.script_json === 'string'
          ? JSON.parse(jobData.script_json)
          : (jobData.script_json as Record<string, unknown>);
      } catch (e) {
        console.error('Erro ao fazer parse do script_json existente:', e);
      }
    }

    const newScriptData = { ...currentScript };

    // Mesclar os novos dados se enviados no payload (sem fallback de URLs fictícias)
    const vids = video_urls || b_roll_videos;

    if (vids !== undefined) {
      newScriptData.video_urls = Array.isArray(vids) ? vids : [vids];
    }
    if (subtitles !== undefined) {
      newScriptData.subtitles = Array.isArray(subtitles) ? subtitles : [];
    }
    if (audio_url !== undefined) {
      newScriptData.audio_url = audio_url;
    }

    // Salvar o payload inteiro recebido nesta requisição para fins de depuração
    newScriptData.debug_last_payload = body as Record<string, unknown>;

    updateData.script_json = newScriptData;

    // Atualizar no banco de dados usando supabaseAdmin
    const { error: updateError } = await supabaseAdmin
      .from('video_jobs')
      .update(updateData)
      .eq('id', job_id);

    if (updateError) {
      console.error(`Erro ao atualizar status do job ${job_id} para ${status}:`, updateError);
      return NextResponse.json(
        { error: 'Falha ao atualizar dados do job no banco de dados.' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      message: `Status do job atualizado com sucesso para ${status}.`,
      job_id,
      status
    });

  } catch (error: unknown) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    console.error('Erro geral no webhook /api/webhooks/n8n-callback:', errorMsg);
    return NextResponse.json(
      { error: 'Erro interno do servidor.' },
      { status: 500 }
    );
  }
}
