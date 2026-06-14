import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { verifyHmacSignature } from '@/lib/crypto';

export async function POST(request: NextRequest) {
  try {
    // 1. Ler o corpo bruto da requisição como texto para validação HMAC
    const rawBody = await request.text();
    const signature = request.headers.get('X-ReelsFlow-Signature') || '';

    // 2. Validar assinatura HMAC-SHA256 para autenticação segura
    const isValid = verifyHmacSignature(rawBody, signature);
    
    if (!isValid) {
      console.warn('Tentativa de callback não autorizada no webhook do n8n (assinatura inválida ou ausente).');
      return NextResponse.json(
        { error: 'Não autorizado. Assinatura HMAC inválida.' },
        { status: 401 }
      );
    }


    // 3. Decodificar o JSON após a validação
    let payload;
    try {
      payload = JSON.parse(rawBody);
      console.log('📥 [n8n-callback] Payload recebido no webhook:', JSON.stringify(payload, null, 2));
    } catch (err) {
      return NextResponse.json(
        { error: 'Corpo da requisição inválido. Esperado um JSON válido.' },
        { status: 400 }
      );
    }

    const { 
      job_id, 
      status, 
      video_url, 
      error_message, 
      user_id,
      audio_url,
      b_roll_videos,
      video_urls,
      subtitles
    } = payload;
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

    // 4. Buscar o job de vídeo correspondente no banco de dados para segurança e mesclagem de dados
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

    // 5. Se o status for 'failed', executa a política de reembolso
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

    // 6. Atualizar o status do job e dados adicionais
    const updateData: Record<string, any> = { status };
    if (video_url) {
      updateData.video_url = video_url;
    }

    // Recuperar e fazer parse do script_json atual
    let currentScript: any = {};
    if (jobData.script_json) {
      try {
        currentScript = typeof jobData.script_json === 'string'
          ? JSON.parse(jobData.script_json)
          : jobData.script_json;
      } catch (e) {
        console.error('Erro ao fazer parse do script_json existente:', e);
      }
    }

    // Mesclar os novos dados se enviados no payload
    const vids = video_urls || b_roll_videos;

    const newScriptData = { ...currentScript };

    if (vids !== undefined) {
      newScriptData.video_urls = Array.isArray(vids) ? vids : [vids];
    }
    if (subtitles !== undefined) {
      newScriptData.subtitles = Array.isArray(subtitles) ? subtitles : [];
    }
    if (audio_url !== undefined) {
      newScriptData.audio_url = audio_url || "";
    }

    // Salvar o payload inteiro recebido nesta requisição para fins de depuração
    newScriptData.debug_last_payload = payload;

    updateData.script_json = newScriptData;

    // Como n8n atualiza em lote, usamos supabaseAdmin que ignora RLS
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

    // As atualizações salvas no banco são transmitidas automaticamente via Supabase Realtime 
    // se a tabela 'video_jobs' estiver adicionada na publicação do Realtime.

    return NextResponse.json({
      message: `Status do job atualizado com sucesso para ${status}.`,
      job_id,
      status
    });

  } catch (error: any) {
    console.error('Erro geral no webhook /api/webhooks/n8n-callback:', error);
    return NextResponse.json(
      { error: 'Erro interno do servidor.' },
      { status: 500 }
    );
  }
}
