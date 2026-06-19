import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const query = searchParams.get('query') || 'tecnologia';
    const type = searchParams.get('type') || 'video'; // 'video' or 'image'

    const apiKey = process.env.PEXELS_API_KEY;

    // Se a chave da API do Pexels não estiver configurada, retornamos mock assets de altíssima qualidade
    if (!apiKey) {
      console.warn('⚠️ [Pexels API] Chave PEXELS_API_KEY ausente no .env.local. Retornando assets mockados.');
      
      if (type === 'video') {
        const mockVideos = [
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

        // Filtro simples de query
        const filtered = mockVideos.filter(v => 
          v.user.name.toLowerCase().includes(query.toLowerCase()) || 
          query.toLowerCase() === 'tecnologia' || 
          query.length > 0
        );

        return NextResponse.json({ videos: filtered.length > 0 ? filtered : mockVideos });
      } else {
        const mockImages = [
          {
            id: 101,
            src: { medium: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=600&auto=format&fit=crop&q=80' },
            photographer: 'SpaceArt'
          },
          {
            id: 102,
            src: { medium: 'https://images.unsplash.com/photo-1634017839464-5c339ebe3cb4?w=600&auto=format&fit=crop&q=80' },
            photographer: 'FluidArt'
          },
          {
            id: 103,
            src: { medium: 'https://images.unsplash.com/photo-1519501025264-65ba15a82390?w=600&auto=format&fit=crop&q=80' },
            photographer: 'CyberCity'
          },
          {
            id: 104,
            src: { medium: 'https://images.unsplash.com/photo-1555066931-4365d14bab8c?w=600&auto=format&fit=crop&q=80' },
            photographer: 'DevCode'
          }
        ];
        return NextResponse.json({ photos: mockImages });
      }
    }

    // Faz a chamada real à API do Pexels
    if (type === 'video') {
      const response = await fetch(`https://api.pexels.com/videos/search?query=${encodeURIComponent(query)}&per_page=12&orientation=portrait`, {
        headers: { Authorization: apiKey }
      });
      if (!response.ok) throw new Error('Falha ao buscar vídeos no Pexels');
      const data = await response.json();
      
      // Mapear para um formato limpo
      const videos = (data.videos || []).map((v: any) => {
        // Obter arquivo de vídeo vertical de qualidade razoável
        const file = v.video_files.find((f: any) => f.width >= 360 && f.width <= 720) || v.video_files[0];
        return {
          id: v.id,
          url: file?.link || '',
          image: v.image,
          duration: v.duration,
          user: { name: v.user?.name || 'Pexels' }
        };
      });
      return NextResponse.json({ videos });
    } else {
      const response = await fetch(`https://api.pexels.com/v1/search?query=${encodeURIComponent(query)}&per_page=12&orientation=portrait`, {
        headers: { Authorization: apiKey }
      });
      if (!response.ok) throw new Error('Falha ao buscar imagens no Pexels');
      const data = await response.json();
      return NextResponse.json({ photos: data.photos || [] });
    }

  } catch (error: any) {
    console.error('Erro na rota de proxy do Pexels:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
