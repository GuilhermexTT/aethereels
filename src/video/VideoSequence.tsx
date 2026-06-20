import React from 'react';
import { Sequence, Video, Img, useCurrentFrame, interpolate } from 'remotion';
import { SubtitleItem } from './types';

interface VideoSequenceProps {
  video_urls: string[];
  subtitles: Omit<SubtitleItem, 'start_time' | 'duration'>[];
}

const SceneItem: React.FC<{
  src: string;
  durationInFrames: number;
}> = ({ src, durationInFrames }) => {
  const frame = useCurrentFrame();

  const safeDuration = isNaN(durationInFrames) || durationInFrames <= 0 ? 30 : durationInFrames;

  // Fade-in suave de 15 frames (0.5s a 30fps) no início de cada cena
  const opacity = !isNaN(frame) ? interpolate(frame, [0, Math.min(15, safeDuration)], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  }) : 1;

  // Efeito Ken Burns: Zoom-in sutil e contínuo de 1.0 a 1.12 ao longo de toda a duração da cena
  const scale = !isNaN(frame) ? interpolate(frame, [0, safeDuration], [1.0, 1.12], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  }) : 1;

  if (!src) return null;

  const isImage = /\.(jpg|jpeg|png|webp|gif)($|\?)/i.test(src);

  const style: React.CSSProperties = {
    width: '100%',
    height: '100%',
    objectFit: 'cover',
    opacity,
    transform: `scale(${scale})`,
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

export const VideoSequence: React.FC<VideoSequenceProps> = ({ video_urls, subtitles }) => {
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
            <SceneItem src={videoSrc} durationInFrames={durationInFrames} />
          </Sequence>
        );
      })}
    </>
  );
};
