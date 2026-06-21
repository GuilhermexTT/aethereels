import { NextResponse } from 'next/server';

const MOCK_VIDEOS = [
  {
    id: 1,
    url: 'https://assets.mixkit.co/videos/preview/mixkit-futuristic-subway-station-with-neon-lights-in-vertical-format-48227-large.mp4',
    image: 'https://images.unsplash.com/photo-1519501025264-65ba15a82390?w=300&q=80',
    duration: 15,
    user: { name: 'AetherStudio' }
  },
  {
    id: 2,
    url: 'https://assets.mixkit.co/videos/preview/mixkit-digital-animation-of-a-man-running-in-neon-colors-41604-large.mp4',
    image: 'https://images.unsplash.com/photo-1634017839464-5c339ebe3cb4?w=300&q=80',
    duration: 10,
    user: { name: 'CyberSpace' }
  },
  {
    id: 3,
    url: 'https://assets.mixkit.co/videos/preview/mixkit-glowing-vertical-neon-light-bars-abstract-background-48197-large.mp4',
    image: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=300&q=80',
    duration: 12,
    user: { name: 'AbstractArt' }
  },
  {
    id: 4,
    url: 'https://assets.mixkit.co/videos/preview/mixkit-woman-holding-a-smartphone-with-a-blue-and-pink-neon-screen-vertical-48866-large.mp4',
    image: 'https://images.unsplash.com/photo-1555066931-4365d14bab8c?w=300&q=80',
    duration: 14,
    user: { name: 'SmartDevices' }
  },
  {
    id: 5,
    url: 'https://assets.mixkit.co/videos/preview/mixkit-hands-of-a-programmer-typing-on-a-keyboard-in-a-dark-room-42045-large.mp4',
    image: 'https://images.unsplash.com/photo-1605379399642-870262d3d051?w=300&q=80',
    duration: 8,
    user: { name: 'DevCoder' }
  }
];

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const query = searchParams.get('query') || 'tecnologia';

  const pexelsApiKey = process.env.PEXELS_API_KEY;

  // Se a chave não estiver configurada no .env.local, retornamos mock assets de alta qualidade como fallback
  if (!pexelsApiKey) {
    console.warn('⚠️ [Pexels API] Chave PEXELS_API_KEY ausente no .env.local. Retornando assets mockados.');
    const filtered = MOCK_VIDEOS.filter(v => 
      v.user.name.toLowerCase().includes(query.toLowerCase()) || 
      query.toLowerCase() === 'tecnologia' || 
      query.length > 0
    );
    return NextResponse.json({ videos: filtered.length > 0 ? filtered : MOCK_VIDEOS, isMock: true });
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

      // Obter arquivo vertical de qualidade razoável
      let bestFile = mp4Files.find((f: any) => f.quality === 'hd');
      if (!bestFile && mp4Files.length > 0) {
        bestFile = mp4Files.find((f: any) => f.width >= 360 && f.width <= 720) || mp4Files[0];
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
    console.error('Erro na busca do Pexels. Retornando mocks como fallback:', error);
    return NextResponse.json({ videos: MOCK_VIDEOS, error: error.message, isMock: true });
  }
}
