'use client';

import React from 'react';
import { Player } from '@remotion/player';
import { MainComposition } from '@/video/MainComposition';
import { SubtitleItem } from '@/video/types';

interface PlayerWrapperProps {
  audioUrl: string;
  videoUrls: string[];
  subtitles: SubtitleItem[];
  durationInFrames: number;
}

export default function PlayerWrapper({ audioUrl, videoUrls, subtitles, durationInFrames }: PlayerWrapperProps) {
  return (
    <Player
      component={MainComposition}
      inputProps={{
        audio_url: audioUrl,
        video_urls: videoUrls,
        subtitles: subtitles
      }}
      durationInFrames={durationInFrames}
      fps={30}
      compositionWidth={1080}
      compositionHeight={1920}
      style={{
        width: '100%',
        height: '100%',
        borderRadius: '1.25rem',
        overflow: 'hidden',
        backgroundColor: '#000',
      }}
      controls
    />
  );
}
