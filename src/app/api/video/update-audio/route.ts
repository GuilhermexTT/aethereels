import { NextRequest, NextResponse } from 'next/server';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import {
  getSupabaseUserClientFromRequest,
  getSupabaseUserTokenFromRequest,
  supabaseAdmin,
} from '@/lib/supabase';

// Mapear credenciais customizadas do .env.local para o S3
const s3Client = new S3Client({
  credentials: {
    accessKeyId: process.env.REMOTION_AWS_ACCESS_KEY_ID || '',
    secretAccessKey: process.env.REMOTION_AWS_SECRET_ACCESS_KEY || '',
  },
  region: process.env.REMOTION_AWS_REGION || 'us-east-2',
});

export async function POST(req: NextRequest) {
  try {
    // 1. Obter o cliente Supabase associado ao usuário
    const supabaseUser = await getSupabaseUserClientFromRequest();
    const token = await getSupabaseUserTokenFromRequest();

    // 2. Verificar sessão
    let user: any = null;
    try {
      const { data: { user: u } } = await supabaseUser.auth.getUser(token);
      user = u;
    } catch {
      // sem sessão
    }

    if (!user) {
      return NextResponse.json({ error: 'Não autorizado.' }, { status: 401 });
    }

    // 3. Ler parâmetros
    const body = await req.json();
    const { id, subtitles } = body;

    if (!id || !subtitles || !Array.isArray(subtitles)) {
      return NextResponse.json(
        { error: 'Parâmetros "id" e "subtitles" (array) são obrigatórios.' },
        { status: 400 }
      );
    }

    // 4. Verificar se o projeto pertence ao usuário
    let ownerId: string | null = null;
    let isDraftTable = false;
    let existingScriptJson: any = {};

    // Buscar no video_drafts
    const { data: draft } = await supabaseUser
      .from('video_drafts')
      .select('id, user_id, script_json')
      .eq('id', id)
      .maybeSingle();

    if (draft) {
      ownerId = draft.user_id;
      isDraftTable = true;
      existingScriptJson = draft.script_json || {};
    } else {
      // Fallback para video_jobs
      const { data: job } = await supabaseUser
        .from('video_jobs')
        .select('id, user_id, script_json')
        .eq('id', id)
        .maybeSingle();
        
      if (job) {
        ownerId = job.user_id;
        existingScriptJson = job.script_json || {};
      }
    }

    if (!ownerId) {
      return NextResponse.json({ error: 'Projeto não encontrado.' }, { status: 404 });
    }

    if (ownerId !== user.id) {
      return NextResponse.json({ error: 'Acesso negado.' }, { status: 403 });
    }

    // 5. Configuração da ElevenLabs
    const elevenLabsApiKey = process.env.ELEVENLABS_API_KEY;
    const voiceId = process.env.ELEVENLABS_VOICE_ID || '21m00Tcm4TlvDq8ikWAM'; // Voz padrão Rachel

    if (!elevenLabsApiKey) {
      return NextResponse.json(
        { error: 'Chave de API da ElevenLabs (ELEVENLABS_API_KEY) não configurada no servidor.' },
        { status: 500 }
      );
    }

    const texts = subtitles.map((s: any) => s.text || '');
    const textToSpeak = texts.join(' . ');

    // 6. Chamar ElevenLabs com timestamps
    console.log(`[ElevenLabs] Gerando voz para o projeto ${id}. Tamanho: ${textToSpeak.length} caracteres.`);
    const response = await fetch(
      `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}/with-timestamps`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'xi-api-key': elevenLabsApiKey,
        },
        body: JSON.stringify({
          text: textToSpeak,
          model_id: 'eleven_multilingual_v2',
          voice_settings: {
            stability: 0.5,
            similarity_boost: 0.75,
          }
        }),
      }
    );

    if (!response.ok) {
      const errText = await response.text();
      console.error('[ElevenLabs API error]', errText);
      return NextResponse.json(
        { error: `Erro na ElevenLabs: ${errText}` },
        { status: response.status }
      );
    }

    const data = await response.json();
    const { audio_base64, alignment } = data;

    if (!audio_base64) {
      return NextResponse.json(
        { error: 'Nenhum áudio retornado pela ElevenLabs.' },
        { status: 500 }
      );
    }

    // 7. Salvar arquivo de áudio no S3
    const audioBuffer = Buffer.from(audio_base64, 'base64');
    const bucketName = process.env.REMOTION_AWS_BUCKET;
    if (!bucketName) {
      return NextResponse.json(
        { error: 'Configuração do S3Bucket (REMOTION_AWS_BUCKET) ausente.' },
        { status: 500 }
      );
    }

    const sanitizedFilename = `audio-update-${id}-${Date.now()}.mp3`;
    const s3Command = new PutObjectCommand({
      Bucket: bucketName,
      Key: `user-uploads/${sanitizedFilename}`,
      Body: audioBuffer,
      ContentType: 'audio/mpeg',
      ACL: 'public-read',
    });

    await s3Client.send(s3Command);
    const audioUrl = `https://${bucketName}.s3.${process.env.REMOTION_AWS_REGION || 'us-east-2'}.amazonaws.com/user-uploads/${sanitizedFilename}`;

    // 8. Recalcular tempos dos blocos (timestamps) usando os dados reais de alinhamento da ElevenLabs
    const startTimes = alignment?.character_start_times_seconds;
    const endTimes = alignment?.character_end_times_seconds;
    const alignChars = alignment?.characters || [];
    
    let cleanSubtitles = [];
    
    if (startTimes && endTimes && Array.isArray(startTimes) && Array.isArray(endTimes) && startTimes.length > 0) {
      console.log(`[ElevenLabs Sync] Sincronizando legendas com alinhamento real. Caracteres alinhados: ${startTimes.length}`);
      
      let alignIdx = 0;
      cleanSubtitles = subtitles.map((sub: any, i: number) => {
        const text = texts[i] || '';
        
        // Pular caracteres vazios no início
        while (alignIdx < alignChars.length && !alignChars[alignIdx].trim()) {
          alignIdx++;
        }
        
        // Pular pontuação de separação " . "
        while (alignIdx < alignChars.length && (alignChars[alignIdx] === '.' || alignChars[alignIdx] === ' ')) {
          alignIdx++;
        }
        
        const start = alignIdx < startTimes.length ? startTimes[alignIdx] : (startTimes[startTimes.length - 1] || 0);
        
        // Avançar pelo tamanho do texto da legenda correspondente
        let textCharCount = 0;
        const targetLen = text.length;
        while (alignIdx < alignChars.length && textCharCount < targetLen) {
          alignIdx++;
          textCharCount++;
        }
        
        const lastIndex = Math.max(0, alignIdx - 1);
        const end = lastIndex < endTimes.length ? endTimes[lastIndex] : (endTimes[endTimes.length - 1] || start + 1.5);
        
        return {
          ...sub,
          start,
          end,
          text
        };
      });
    } else {
      // Fallback robusto caso a ElevenLabs não retorne o alinhamento de caracteres
      console.warn('[ElevenLabs Sync] Alinhamento não disponível. Usando fallback de proporção linear.');
      let totalDuration = textToSpeak.length * 0.08; // Fallback: 80ms por caractere
      if (endTimes && Array.isArray(endTimes) && endTimes.length > 0) {
        totalDuration = endTimes[endTimes.length - 1];
      }
  
      const totalChars = texts.reduce((sum: number, t: string) => sum + t.length, 0);
      let currentStart = 0;
      cleanSubtitles = subtitles.map((sub: any, i: number) => {
        const textLen = texts[i].length;
        const ratio = totalChars > 0 ? textLen / totalChars : 1 / subtitles.length;
        const duration = totalDuration * ratio;
        const start = currentStart;
        const end = currentStart + duration;
        currentStart = end;
        return {
          ...sub,
          start,
          end,
          text: texts[i]
        };
      });
    }

    // 9. Atualizar script_json no Banco de Dados
    const updatedScriptJson = {
      ...existingScriptJson,
      audio_url: audioUrl,
      subtitles: cleanSubtitles
    };

    if (isDraftTable) {
      const { error: updateErr } = await supabaseAdmin
        .from('video_drafts')
        .update({ script_json: updatedScriptJson })
        .eq('id', id);

      if (updateErr) {
        console.error('Erro ao atualizar rascunho:', updateErr);
        return NextResponse.json({ error: 'Erro ao atualizar rascunho no banco.' }, { status: 500 });
      }
    } else {
      const { error: updateErr } = await supabaseAdmin
        .from('video_jobs')
        .update({ script_json: updatedScriptJson })
        .eq('id', id);

      if (updateErr) {
        console.error('Erro ao atualizar job:', updateErr);
        return NextResponse.json({ error: 'Erro ao atualizar projeto no banco.' }, { status: 500 });
      }
    }

    return NextResponse.json({
      success: true,
      audio_url: audioUrl,
      subtitles: cleanSubtitles
    });

  } catch (error: any) {
    console.error('Erro na API /api/video/update-audio:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
