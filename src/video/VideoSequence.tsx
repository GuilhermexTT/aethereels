import React from 'react';
import { Sequence, Video } from 'remotion';
import { SubtitleItem } from './types';

interface VideoSequenceProps {
  video_urls: string[];
  subtitles: Omit<SubtitleItem, 'start_time' | 'duration'>[];
}

export const VideoSequence: React.FC<VideoSequenceProps> = ({ video_urls, subtitles }) => {
  if (video_urls.length === 0) return null;

  return (
    <>
      {subtitles.map((sub, i) => {
        const startFrame = Math.round(sub.start * 30);
        const durationInFrames = Math.max(1, Math.round((sub.end - sub.start) * 30));
        const videoSrc = video_urls[i % video_urls.length];

        return (
          <Sequence
            key={i}
            from={startFrame}
            durationInFrames={durationInFrames}
            layout="none"
          >
            <Video
              src={videoSrc}
              muted
              style={{
                width: '100%',
                height: '100%',
                objectFit: 'cover',
              }}
            />
          </Sequence>
        );
      })}
    </>
  );
};
