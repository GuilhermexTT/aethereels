import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { verifyHmacSignature } from '@/lib/crypto';

export async function POST(req: NextRequest) {
  try {
    const rawBody = await req.clone().text();
    const signature = req.headers.get('X-ReelsFlow-Signature') || '';

    const isValid = verifyHmacSignature(rawBody, signature);
    if (!isValid) {
      console.warn('Tentativa de callback não autorizada no webhook do n8n (assinatura inválida ou ausente).');
      return NextResponse.json({ error: 'Não autorizado. Assinatura HMAC inválida.' }, { status: 401 });
    }

    let body: any;
    try {
      body = await req.json();
      console.log('📥 [n8n-callback] Payload recebido no webhook:', JSON.stringify(body, null, 2));
    } catch {
      return NextResponse.json({ error: 'Corpo da requisição inválido. Esperado um JSON válido.' }, { status: 400 });
    }

    const { job_id, status, audio_url, video_urls, subtitles, b_roll_videos, video_url, error_message, user_id } = body;

    if (!job_id || !status) {
      return NextResponse.json({ error: 'Os campos job_id e status são obrigatórios.' }, { status: 400 });
    }

    const validStatuses = ['scripting', 'rendering', 'ready', 'failed', 'draft', 'processing'];
    if (!validStatuses.includes(status)) {
      return NextResponse.json({ error: `Status inválido: ${status}` }, { status: 400 });
    }


    const { data: jobData, error: fetchError } = await supabaseAdmin
      .from('video_jobs')
      .select('user_id, script_json')
      .eq('id', job_id)
      .single();

    if (fetchError || !jobData) {
      return NextResponse.json({ error: 'Job de vídeo correspondente não encontrado.' }, { status: 404 });
    }

    if (status === 'failed') {
      await supabaseAdmin
        .from('video_jobs')
        .update({ status: 'failed' })
        .eq('id', job_id);
      return NextResponse.json({ message: 'Job atualizado para failed.', job_id, status: 'failed' });
    }

    const updateData: any = { status };
    if (video_url) {
      updateData.video_url = video_url;
    }

    // TRATAMENTO ANTI-SUJEIRA: Força a conversão correta de strings textuais vindo do n8n para arrays limpos
    let safeVideoUrls: string[] = [];
    let safeSubtitles: any[] = [];
    const rawVids = video_urls || b_roll_videos;

    if (rawVids) {
      if (typeof rawVids === 'string') {
        try {
          const parsed = JSON.parse(rawVids);
          safeVideoUrls = Array.isArray(parsed) ? parsed : [parsed];
        } catch {
          safeVideoUrls = [rawVids];
        }
      } else if (Array.isArray(rawVids)) {
        safeVideoUrls = rawVids;
      }
    }

    if (subtitles) {
      if (typeof subtitles === 'string') {
        try {
          safeSubtitles = JSON.parse(subtitles);
        } catch {
          safeSubtitles = [];
        }
      } else if (Array.isArray(subtitles)) {
        safeSubtitles = subtitles;
      }
    }

    // Monta a estrutura JSONB blindada e limpa para o Supabase
    updateData.script_json = {
      video_urls: safeVideoUrls,
      subtitles: safeSubtitles,
      audio_url: audio_url || ''
    };

    const { error: updateError } = await supabaseAdmin
      .from('video_jobs')
      .update(updateData)
      .eq('id', job_id);

    if (updateError) {
      console.error(`Erro ao atualizar status do job ${job_id}:`, updateError);
      return NextResponse.json({ error: 'Falha ao atualizar dados do job no banco.' }, { status: 500 });
    }

    return NextResponse.json({ message: `Status do job atualizado para ${status}.`, job_id, status });
  } catch (error: unknown) {
    return NextResponse.json({ error: 'Erro interno do servidor.' }, { status: 500 });
  }
}
