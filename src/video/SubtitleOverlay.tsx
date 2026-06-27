import React from 'react';
import { useCurrentFrame, useVideoConfig, interpolate } from 'remotion';
import { SubtitleItem, StyleConfig } from './types';

interface SubtitleOverlayProps {
  subtitles: Omit<SubtitleItem, 'start_time' | 'duration'>[];
  style_config?: StyleConfig;
}

export const SubtitleOverlay: React.FC<SubtitleOverlayProps> = ({ subtitles, style_config }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const currentTime = frame / fps;

  // Resolvendo configurações do template ou usando padrões
  const template = style_config?.template || 'viral_hyper';
  const fontFamily = style_config?.fontFamily || 
    (template === 'clean_business' ? '"Montserrat", sans-serif' : 
     template === 'cyber_aesthetic' ? '"Space Mono", monospace' : 
     '"Montserrat", "Poppins", sans-serif');
  
  const fontSize = style_config?.fontSize || 
    (template === 'clean_business' ? '70px' : 
     template === 'cyber_aesthetic' ? '76px' : 
     '84px');

  const textColor = style_config?.textColor || 
    (template === 'cyber_aesthetic' ? '#00F0FF' : '#FFFFFF');

  const highlightColor = style_config?.highlightColor || 
    (template === 'clean_business' ? '#6366F1' : 
     template === 'cyber_aesthetic' ? '#FF00FF' : 
     '#FFD700');

  const textGlow = style_config?.textGlow ?? (template === 'cyber_aesthetic');
  const emojiEnabled = style_config?.emojiEnabled ?? (template === 'viral_hyper');

  // Posição vertical (Safe Zones)
  // Clean & Business fica mais centralizado/alto (280px do fundo)
  // Cyber fica a 320px
  // Viral Hyper fica a 400px (acima dos botões e descrição)
  const paddingBottom = template === 'clean_business' ? '280px' : 
                        template === 'cyber_aesthetic' ? '320px' : 
                        '400px';

  // Encontra a legenda ativa no frame atual
  const activeSubtitle = subtitles.find(
    (sub) => currentTime >= sub.start && currentTime <= sub.end
  );

  if (!activeSubtitle || !activeSubtitle.text.trim()) return null;

  // Limpeza e processamento de Emojis
  // Se emojis estiverem desativados, removemos emojis do texto para o Clean & Business
  let textToRender = activeSubtitle.text.trim();
  if (!emojiEnabled) {
    // Regex simples para remover a maioria dos emojis comuns
    textToRender = textToRender.replace(/[\u2700-\u27BF]|[\uE000-\uF8FF]|\uD83C[\uDC00-\uDFFF]|\uD83D[\uDC00-\uDFFF]|[\u2011-\u26FF]|\uD83E[\uDD10-\uDDFF]/g, '');
  }

  const words = textToRender.split(/\s+/).filter(Boolean);
  const totalWords = words.length;
  const subtitleDuration = activeSubtitle.end - activeSubtitle.start;
  const elapsed = currentTime - activeSubtitle.start;

  // Calcula o índice da palavra ativa com base no tempo decorrido
  const activeWordIndex = totalWords > 1 && subtitleDuration > 0
    ? Math.min(
        Math.floor((elapsed / subtitleDuration) * totalWords),
        totalWords - 1
      )
    : 0;

  // Regra de Ouro: O Gancho dos 3 Segundos
  // Aumenta o tamanho da legenda em 20% nos primeiros 3 segundos do vídeo
  const isHookPeriod = currentTime < 3.0;
  const hookScale = isHookPeriod ? 1.20 : 1.0;

  // Estilos de sombra e contorno (Text Shadow)
  let textShadow = 'none';
  if (template === 'viral_hyper') {
    // Contorno preto pesado tradicional de retenção
    textShadow = `
      -4px -4px 0 #000,
       4px -4px 0 #000,
      -4px  4px 0 #000,
       4px  4px 0 #000,
       0px  6px 15px rgba(0, 0, 0, 0.9)
    `;
  } else if (template === 'clean_business') {
    // Sombra projetada elegante e suave
    textShadow = '0px 4px 12px rgba(0, 0, 0, 0.6)';
  } else if (template === 'cyber_aesthetic' && textGlow) {
    // Efeito de brilho neon (Glow)
    textShadow = `
      0 0 6px ${textColor},
      0 0 12px ${textColor},
      0 0 25px ${highlightColor}
    `;
  }

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
        paddingBottom,
        paddingLeft: '80px',
        paddingRight: '80px',
        pointerEvents: 'none',
        zIndex: 10,
        transform: `scale(${hookScale})`,
        transition: 'transform 0.3s cubic-bezier(0.16, 1, 0.3, 1)',
      }}
    >
      {/* Importação das fontes do Google Fonts */}
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Montserrat:wght@800;900&family=Poppins:wght@800;900&family=Space+Mono:wght@700&family=Share+Tech+Mono&display=swap');
      `}</style>

      <h1
        style={{
          fontFamily,
          fontSize,
          fontWeight: template === 'clean_business' ? 800 : 900,
          textTransform: template === 'clean_business' ? 'none' : 'uppercase',
          textAlign: 'center',
          lineHeight: 1.25,
          letterSpacing: template === 'cyber_aesthetic' ? '2.5px' : '1px',
          display: 'flex',
          flexWrap: 'wrap',
          justifyContent: 'center',
          rowGap: '10px',
          textShadow,
        }}
      >
        {words.map((word, index) => {
          const isActive = index === activeWordIndex;

          // 1. ANIMAÇÃO: CLEAN & BUSINESS
          // Palavras pretéritas ficam normais, ativa ganha cor da marca, futuras ficam semitransparentes
          if (template === 'clean_business') {
            const isFuture = index > activeWordIndex;
            return (
              <span
                key={index}
                style={{
                  color: isActive ? highlightColor : textColor,
                  opacity: isFuture ? 0.35 : 1.0,
                  marginRight: '20px',
                  display: 'inline-block',
                  transition: 'color 0.15s ease, opacity 0.2s ease',
                }}
              >
                {word}
              </span>
            );
          }

          // 2. ANIMAÇÃO: CYBER AESTHETIC (Máquina de Escrever)
          // Palavras futuras ficam completamente invisíveis (opacity 0)
          // Palavra atual pisca como se estivesse sendo digitada
          if (template === 'cyber_aesthetic') {
            const isFuture = index > activeWordIndex;
            if (isFuture) return null; // Não renderiza palavras no futuro para efeito máquina de escrever

            return (
              <span
                key={index}
                style={{
                  color: isActive ? highlightColor : textColor,
                  marginRight: '20px',
                  display: 'inline-block',
                  borderRight: isActive ? `3px solid ${highlightColor}` : 'none',
                  paddingRight: isActive ? '4px' : '0px',
                }}
              >
                {word}
              </span>
            );
          }

          // 3. ANIMAÇÃO: VIRAL HYPER (Pop de Escala com Destaque de Cor)
          const wordDuration = subtitleDuration / totalWords;
          const wordStart = activeSubtitle.start + index * wordDuration;
          const wordElapsed = currentTime - wordStart;
          const wordElapsedFrames = wordElapsed * fps;

          let scale = 1.0;
          if (isActive && wordElapsedFrames >= 0 && !isNaN(wordElapsedFrames) && isFinite(wordElapsedFrames)) {
            scale = interpolate(wordElapsedFrames, [0, 3, 6], [1.0, 1.25, 1.10], {
              extrapolateLeft: 'clamp',
              extrapolateRight: 'clamp',
            });
          }

          return (
            <span
              key={index}
              style={{
                color: isActive ? highlightColor : textColor,
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

