import React from 'react';
import { useCurrentFrame, useVideoConfig, interpolate } from 'remotion';
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

  // Divide o texto em palavras para o efeito de Karaokê
  const words = activeSubtitle.text.trim().split(/\s+/);
  const totalWords = words.length;
  const subtitleDuration = activeSubtitle.end - activeSubtitle.start;
  
  // Calcula o elapsed time dentro da legenda ativa
  const elapsed = currentTime - activeSubtitle.start;

  // Calcula o índice da palavra ativa com base no tempo decorrido proporcionalmente
  const activeWordIndex = totalWords > 1 && subtitleDuration > 0
    ? Math.min(
        Math.floor((elapsed / subtitleDuration) * totalWords),
        totalWords - 1
      )
    : 0;

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
        alignItems: 'flex-end',
        paddingBottom: '400px', // Posiciona a legenda a ~75-80% de altura (1920px total)
        paddingLeft: '80px',
        paddingRight: '80px',
        pointerEvents: 'none',
        zIndex: 10,
      }}
    >
      {/* Importação das fontes Montserrat e Poppins */}
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Montserrat:wght@900&family=Poppins:wght@800;900&display=swap');
      `}</style>

      <h1
        style={{
          fontFamily: '"Montserrat", "Poppins", "Arial Black", sans-serif',
          fontSize: '84px',
          fontWeight: 900,
          textTransform: 'uppercase',
          textAlign: 'center',
          lineHeight: 1.25,
          letterSpacing: '1.5px',
          display: 'flex',
          flexWrap: 'wrap',
          justifyContent: 'center',
          rowGap: '10px',
          // Efeito premium de contorno preto forte (text-shadow de 4 direções) e sombra projetada marcante
          textShadow: `
            -4px -4px 0 #000,
             4px -4px 0 #000,
            -4px  4px 0 #000,
             4px  4px 0 #000,
             0px  6px 15px rgba(0, 0, 0, 0.9)
          `,
        }}
      >
        {words.map((word, index) => {
          const isActive = index === activeWordIndex;

          // Calcula a duração estimada de cada palavra e quando ela começa a ficar ativa
          const wordDuration = subtitleDuration / totalWords;
          const wordStart = activeSubtitle.start + index * wordDuration;
          const wordElapsed = currentTime - wordStart;
          const wordElapsedFrames = wordElapsed * fps;

          // Efeito de "Pop" no tamanho da palavra ativa:
          // Escala rapidamente de 1.0 para 1.25 nos primeiros 3 frames (0.1s),
          // depois suaviza para 1.10 nos próximos 3 frames e permanece em 1.10
          let scale = 1.0;
          if (isActive && wordElapsedFrames >= 0) {
            scale = interpolate(wordElapsedFrames, [0, 3, 6], [1.0, 1.25, 1.10], {
              extrapolateLeft: 'clamp',
              extrapolateRight: 'clamp',
            });
          }

          return (
            <span
              key={index}
              style={{
                color: isActive ? '#FFD700' : '#FFFFFF', // Amarelo vivo para a palavra ativa, branco para o resto
                marginRight: '20px',
                display: 'inline-block',
                transform: `scale(${scale})`,
                transition: isActive ? 'none' : 'transform 0.15s ease-out',
              }}
            >
              {word}
            </span>
          );
        })}
      </h1>
    </div>
  );
};
