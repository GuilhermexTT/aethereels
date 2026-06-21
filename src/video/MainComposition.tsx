import React from 'react';
import { Audio, getInputProps } from 'remotion';
import { RemotionVideoProps } from './types';
import { VideoSequence } from './VideoSequence';
import { SubtitleOverlay } from './SubtitleOverlay';

export const MainComposition: React.FC<RemotionVideoProps> = (propsFromPlayer) => {
  const propsFromCLI = getInputProps() as unknown as RemotionVideoProps;
  const audio_url = propsFromPlayer?.audio_url || propsFromCLI?.audio_url;
  const video_urls = propsFromPlayer?.video_urls || propsFromCLI?.video_urls;
  const subtitles = propsFromPlayer?.subtitles || propsFromCLI?.subtitles;

  // Normalização das legendas para garantir que todas possuam start e end definidos
  const normalizedSubtitles = (subtitles || []).map((sub, index) => {
    let start = sub.start !== undefined 
      ? Number(sub.start) 
      : (sub.start_time !== undefined ? Number(sub.start_time) : index * 3);

    if (isNaN(start) || !isFinite(start)) {
      start = index * 3;
    }

    let end = sub.end !== undefined 
      ? Number(sub.end) 
      : (sub.duration !== undefined ? start + Number(sub.duration) : start + 3);

    if (isNaN(end) || !isFinite(end) || end <= start) {
      end = start + 3;
    }

    return {
      text: String(sub.text || sub.word || ''),
      start,
      end
    };
  });

  return (
    <div style={{ flex: 1, backgroundColor: '#000', position: 'relative', width: '100%', height: '100%' }}>
      {/* 1. Áudio de fundo (ElevenLabs) */}
      {audio_url && <Audio src={audio_url} />}

      {/* 2. Sequenciador de clipes (Pexels) */}
      <VideoSequence video_urls={video_urls || []} subtitles={normalizedSubtitles} />

      {/* Camada uniforme preta de opacidade para contraste (40%) */}
      <div 
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.4)',
          zIndex: 5,
          pointerEvents: 'none',
        }}
      />

      {/* 3. Overlay de Legendas Dinâmicas */}
      <SubtitleOverlay subtitles={normalizedSubtitles} />
    </div>
  );
};
