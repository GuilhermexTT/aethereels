import React from 'react';
import { useCurrentFrame, useVideoConfig } from 'remotion';
import { SubtitleItem } from './types';

interface SubtitleOverlayProps {
  subtitles: Omit<SubtitleItem, 'start_time' | 'duration'>[];
}

export const SubtitleOverlay: React.FC<SubtitleOverlayProps> = ({ subtitles }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const currentTime = frame / fps;

  // Acha a legenda ativa no frame atual
  const activeSubtitle = subtitles.find(
    (sub) => currentTime >= sub.start && currentTime <= sub.end
  );

  if (!activeSubtitle || !activeSubtitle.text.trim()) return null;

  return (
    <div
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        padding: '0 80px',
        pointerEvents: 'none',
        zIndex: 10,
      }}
    >
      <h1
        style={{
          fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
          fontSize: '84px',
          fontWeight: 900,
          textTransform: 'uppercase',
          color: '#FFFFFF',
          textAlign: 'center',
          lineHeight: 1.25,
          letterSpacing: '1.5px',
          // Efeito premium de contorno preto forte (text-shadow de 4 direções) e leve sombra projetada
          textShadow: `
            -3px -3px 0 #000,
             3px -3px 0 #000,
            -3px  3px 0 #000,
             3px  3px 0 #000,
             4px  4px 10px rgba(0, 0, 0, 0.8)
          `,
        }}
      >
        {activeSubtitle.text}
      </h1>
    </div>
  );
};
