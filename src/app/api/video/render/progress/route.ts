import { NextResponse } from 'next/server';
import { getRenderProgress } from '@remotion/lambda';

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

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const renderId = searchParams.get('renderId');
    const bucketName = searchParams.get('bucketName');

    if (!renderId || !bucketName) {
      return NextResponse.json(
        { error: 'Parâmetros renderId e bucketName são obrigatórios.' },
        { status: 400 }
      );
    }

    // 🔍 Consulta o estado atual da renderização na AWS
    const progress = await getRenderProgress({
      region: (process.env.REMOTION_AWS_REGION as any) || 'us-east-2',
      bucketName: bucketName,
      functionName: process.env.REMOTION_AWS_FUNCTION!,
      renderId: renderId,
    });

    // Se houver algum erro fatal no processamento do vídeo lá na nuvem
    if (progress.fatalErrorEncountered) {
      return NextResponse.json({
        status: 'error',
        error: progress.errors[0]?.message || 'Erro fatal na AWS Lambda',
      });
    }

    // Se terminar tudo, retorna o link final do vídeo hospedado no S3
    if (progress.done) {
      return NextResponse.json({
        status: 'done',
        progress: 100,
        videoUrl: progress.outKey, // Link direto do .mp4 pronto!
      });
    }

    // Se ainda estiver renderizando, calcula e envia a percentagem
    const percentage = Math.round(progress.overallProgress * 100);

    return NextResponse.json({
      status: 'rendering',
      progress: percentage,
    });

  } catch (error: any) {
    console.error('Erro ao verificar progresso:', error);
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }
}
