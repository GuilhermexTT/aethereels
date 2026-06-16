import { NextResponse } from 'next/server';
import { renderMediaOnLambda } from '@remotion/lambda-client';

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
    const { inputProps, compositionId = 'Reels' } = body;

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
