import React from 'react';
import { Audio, getInputProps } from 'remotion';
import { RemotionVideoProps } from './types';
import { VideoSequence } from './VideoSequence';
import { SubtitleOverlay } from './SubtitleOverlay';

export const MainComposition: React.FC = () => {
  const props = getInputProps() as unknown as RemotionVideoProps;
  const { audio_url, video_urls, subtitles } = props;

  // Normalização das legendas para garantir que todas possuam start e end definidos
  const normalizedSubtitles = (subtitles || []).map((sub, index) => {
    const start = sub.start !== undefined 
      ? Number(sub.start) 
      : (sub.start_time !== undefined ? Number(sub.start_time) : index * 3);
    const end = sub.end !== undefined 
      ? Number(sub.end) 
      : (sub.duration !== undefined ? start + Number(sub.duration) : start + 3);

    return {
      text: sub.text || '',
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

      {/* 3. Overlay de Legendas Dinâmicas */}
      <SubtitleOverlay subtitles={normalizedSubtitles} />
    </div>
  );
};
