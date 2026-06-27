import React from 'react';
import { Sequence, Video, Img, useCurrentFrame, interpolate } from 'remotion';
import { SubtitleItem, StyleConfig } from './types';

interface VideoSequenceProps {
  video_urls: string[];
  subtitles: Omit<SubtitleItem, 'start_time' | 'duration'>[];
  style_config?: StyleConfig;
}

const SceneItem: React.FC<{
  src: string;
  durationInFrames: number;
  style_config?: StyleConfig;
}> = ({ src, durationInFrames, style_config }) => {
  const frame = useCurrentFrame();

  const safeDuration = isNaN(durationInFrames) || durationInFrames <= 0 ? 30 : durationInFrames;

  // Fade-in suave de 15 frames (0.5s a 30fps) no início de cada cena
  // No Cyber Aesthetic, as transições são cortes secos (sem fade-in)
  const isCyber = style_config?.template === 'cyber_aesthetic';
  const opacity = !isNaN(frame) 
    ? (isCyber ? 1 : interpolate(frame, [0, Math.min(15, safeDuration)], [0, 1], {
        extrapolateLeft: 'clamp',
        extrapolateRight: 'clamp',
      }))
    : 1;

  // Ajustes de Escala (Zoom) baseados no Template
  let scale = 1;
  if (!isNaN(frame)) {
    if (style_config?.template === 'viral_hyper') {
      // Viral Hyper: Começa com zoom de impacto e cresce mais agressivamente
      scale = interpolate(frame, [0, safeDuration], [1.06, 1.20], {
        extrapolateLeft: 'clamp',
        extrapolateRight: 'clamp',
      });
    } else if (style_config?.template === 'cyber_aesthetic') {
      // Cyber: Zoom-out sutil futurista
      scale = interpolate(frame, [0, safeDuration], [1.12, 1.03], {
        extrapolateLeft: 'clamp',
        extrapolateRight: 'clamp',
      });
    } else {
      // Clean & Business / Padrão: Ken Burns suave tradicional
      scale = interpolate(frame, [0, safeDuration], [1.0, 1.12], {
        extrapolateLeft: 'clamp',
        extrapolateRight: 'clamp',
      });
    }
  }

  // Filtros de imagem/vídeo para o Cyber Aesthetic (Dark Mode de alto contraste)
  const filter = isCyber 
    ? 'contrast(1.2) brightness(0.85) saturate(0.9) hue-rotate(-10deg)' 
    : 'none';

  if (!src) return null;

  const isImage = /\.(jpg|jpeg|png|webp|gif)($|\?)/i.test(src);

  const style: React.CSSProperties = {
    width: '100%',
    height: '100%',
    objectFit: 'cover',
    opacity,
    transform: `scale(${scale})`,
    filter,
  };

  if (isImage) {
    return <Img src={src} style={style} />;
  }

  return (
    <Video
      src={src}
      muted
      style={style}
    />
  );
};

export const VideoSequence: React.FC<VideoSequenceProps> = ({ video_urls, subtitles, style_config }) => {
  // Filter out invalid video urls or placeholders
  const validUrls = (video_urls || []).filter(url => typeof url === 'string' && url.trim().length > 0);
  
  if (validUrls.length === 0) return null;

  return (
    <>
      {subtitles.map((sub, i) => {
        const startFrame = Math.round(sub.start * 30);
        const durationInFrames = Math.max(1, Math.round((sub.end - sub.start) * 30));
        const videoSrc = validUrls[i % validUrls.length];

        if (isNaN(startFrame) || isNaN(durationInFrames) || !videoSrc) {
          return null;
        }

        return (
          <Sequence
            key={i}
            from={startFrame}
            durationInFrames={durationInFrames}
            layout="none"
          >
            <SceneItem src={videoSrc} durationInFrames={durationInFrames} style_config={style_config} />
          </Sequence>
        );
      })}
    </>
  );
};

