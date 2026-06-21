import React from 'react';
import { Composition } from 'remotion';
import { MainComposition } from './MainComposition';
import { RemotionVideoProps } from './types';

export const Root: React.FC = () => {
  return (
    <>
      <Composition
        id="Reels"
        component={MainComposition as any}
        fps={30}
        width={1080}
        height={1920}
        defaultProps={{
          audio_url: 'https://example.com/audio.mp3',
          video_urls: ['https://example.com/video1.mp4'],
          subtitles: [
            { text: 'EXPLORE O UNIVERSO', start: 0, end: 2.5 },
            { text: 'COM DISCIPLINA E FOCO', start: 2.5, end: 5.5 },
            { text: 'A JORNADA COMEÇA AGORA', start: 5.5, end: 8.5 }
          ]
        } as RemotionVideoProps}
        calculateMetadata={async ({ props }: { props: any }) => {
          const fps = 30;
          const subtitles = (props as RemotionVideoProps).subtitles || [];
          let totalDurationInSeconds = 12; // fallback de 12 segundos

          if (subtitles.length > 0) {
            const lastSub = subtitles[subtitles.length - 1];
            // Normalização rápida da última legenda para descobrir o ponto final
            const start = lastSub.start !== undefined 
              ? Number(lastSub.start) 
              : (lastSub.start_time !== undefined ? Number(lastSub.start_time) : 0);
            const end = lastSub.end !== undefined 
              ? Number(lastSub.end) 
              : (lastSub.duration !== undefined ? start + Number(lastSub.duration) : start + 3);

            totalDurationInSeconds = Math.max(totalDurationInSeconds, end);
          }

          // Adiciona 0.5s de buffer para não cortar áudio abruptamente
          const durationInFrames = Math.ceil((totalDurationInSeconds + 0.5) * fps);

          return {
            durationInFrames,
          };
        }}
      />
    </>
  );
};
