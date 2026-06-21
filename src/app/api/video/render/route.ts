import { NextResponse, after } from 'next/server';
import { renderMediaOnLambda } from '@remotion/lambda-client';
import { supabaseAdmin } from '@/lib/supabase';

// Mapear credenciais customizadas do .env.local para as esperadas internamente pelo AWS SDK do Remotion
if (process.env.REMOTION_AWS_ACCESS_KEY_ID) {
  process.env.AWS_ACCESS_KEY_ID = process.env.REMOTION_AWS_ACCESS_KEY_ID;
}
if (process.env.REMOTION_AWS_SECRET_ACCESS_KEY) {
  process.env.AWS_SECRET_ACCESS_KEY = process.env.REMOTION_AWS_SECRET_ACCESS_KEY;
}
if (process.env.REMOTION_AWS_REGION) {
  process.env.AWS_REGION = process.env.REMOTION_AWS_REGION;
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    
    // inputProps conterá os dados dinâmicos do n8n/Supabase: url do áudio, legenda, etc.
    const { inputProps, compositionId = 'Reels', tempFilePaths = [], draftId } = body;

    if (!inputProps) {
      return NextResponse.json(
        { error: 'As propriedades de entrada (inputProps) são obrigatórias.' },
        { status: 400 }
      );
    }

    if (!process.env.REMOTION_AWS_FUNCTION || !process.env.REMOTION_AWS_SITE) {
      return NextResponse.json(
        { error: 'Configuração do Remotion Lambda ausente no servidor. Certifique-se de realizar o deploy e configurar REMOTION_AWS_FUNCTION e REMOTION_AWS_SITE no .env.local.' },
        { status: 500 }
      );
    }

    // 🚦 Trava de Concorrência - Semáforo baseada em Banco de Dados (Serverless-safe)
    if (supabaseAdmin) {
      const { count, error: countError } = await supabaseAdmin
        .from('video_jobs')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'rendering');

      if (countError) {
        console.error('Erro ao verificar fila de concorrência:', countError);
      } else if (count !== null && count >= 5) {
        return NextResponse.json(
          { error: 'Fila cheia, aguardando vaga...' },
          { status: 429 }
        );
      }
    }

    // Se um ID de rascunho/job foi enviado, atualiza o status imediatamente para 'rendering'
    // Isso garante que o slot na concorrência seja reservado imediatamente antes de iniciar a chamada da Lambda
    if (draftId && supabaseAdmin) {
      await supabaseAdmin
        .from('video_drafts')
        .update({ status: 'rendering' })
        .eq('id', draftId);
      
      await supabaseAdmin
        .from('video_jobs')
        .update({ status: 'rendering' })
        .eq('id', draftId);
    }

    // 🚀 Chama o supercomputador da AWS Lambda
    const renderOutput = await renderMediaOnLambda({
      region: (process.env.REMOTION_AWS_REGION as any) || 'us-east-2',
      functionName: process.env.REMOTION_AWS_FUNCTION!,
      serveUrl: process.env.REMOTION_AWS_SITE!,
      composition: compositionId,
      codec: 'h264',
      privacy: 'public', // Permite que o link final seja acessível pelo utilizador
      inputProps: inputProps, // Injeta o roteiro e mídias dentro do template do Remotion
      concurrency: process.env.REMOTION_AWS_CONCURRENCY
        ? parseInt(process.env.REMOTION_AWS_CONCURRENCY, 10)
        : 8, // Limita a 8 funções simultâneas para evitar estouro de limite de novas contas AWS (limite default 10)
    });

    // ⚡ Deleção Relâmpago pós-processamento (após 25 segundos)
    if (tempFilePaths && tempFilePaths.length > 0 && supabaseAdmin) {
      after(async () => {
        // Aguarda 25 segundos para que a AWS Lambda termine de baixar os arquivos para sua memória temporária
        await new Promise((resolve) => setTimeout(resolve, 25000));
        
        try {
          const { error: removeError } = await supabaseAdmin.storage
            .from('editor_temp_uploads')
            .remove(tempFilePaths);
          
          if (removeError) {
            console.error('Erro ao deletar arquivos temporários no Supabase:', removeError.message);
          } else {
            console.log('Deleção Relâmpago executada com sucesso para:', tempFilePaths);
          }
        } catch (err) {
          console.error('Falha inesperada ao remover arquivos temporários:', err);
        }
      });
    }

    // Retorna o ID da renderização para o frontend acompanhar o progresso
    return NextResponse.json({
      success: true,
      renderId: renderOutput.renderId,
      bucketName: renderOutput.bucketName,
    });

  } catch (error: any) {
    console.error('Erro ao disparar renderização na AWS:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
