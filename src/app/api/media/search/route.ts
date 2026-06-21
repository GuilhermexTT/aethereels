import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const query = searchParams.get('query');

  if (!query) {
    return NextResponse.json({ error: 'Falta o parâmetro query' }, { status: 400 });
  }

  const pexelsApiKey = process.env.PEXELS_API_KEY;
  if (!pexelsApiKey) {
    return NextResponse.json({ error: 'Pexels API Key não configurada no servidor' }, { status: 500 });
  }

  try {
    const res = await fetch(
      `https://api.pexels.com/videos/search?query=${encodeURIComponent(query)}&orientation=portrait&per_page=20`,
      {
        headers: {
          Authorization: pexelsApiKey,
        },
      }
    );

    if (!res.ok) {
      throw new Error(`Erro na API do Pexels: ${res.status}`);
    }

    const data = await res.json();
    
    const formattedVideos = (data.videos || []).map((video: any) => {
      // Filtrar arquivos mp4
      const mp4Files = (video.video_files || []).filter(
        (f: any) => f.file_type === 'video/mp4'
      );

      // Encontrar o de melhor qualidade HD ou com maior resolução
      let bestFile = mp4Files.find((f: any) => f.quality === 'hd');
      if (!bestFile && mp4Files.length > 0) {
        bestFile = [...mp4Files].sort((a: any, b: any) => (b.width || 0) - (a.width || 0))[0];
      }

      return {
        id: video.id,
        image: video.image || (video.video_pictures && video.video_pictures[0]?.picture) || '',
        url: bestFile ? bestFile.link : '',
        duration: video.duration || 0,
        user: {
          name: video.user?.name || 'Criador Pexels',
        }
      };
    }).filter((v: any) => v.url);

    return NextResponse.json({ videos: formattedVideos });
  } catch (error: any) {
    console.error('Erro na busca do Pexels:', error);
    return NextResponse.json({ error: error.message || 'Falha ao buscar vídeos no Pexels' }, { status: 500 });
  }
}
