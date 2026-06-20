'use client';

import React, { Component, ErrorInfo, ReactNode } from 'react';
import { Player } from '@remotion/player';
import { MainComposition } from '@/video/MainComposition';
import { SubtitleItem } from '@/video/types';

interface Props {
  children?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("ErrorBoundary caught an error:", error, errorInfo);
  }

  public render() {
    if (this.state.hasError) {
      return (
        <div className="w-full h-full flex flex-col justify-center items-center gap-3 p-4 text-center bg-red-950/20 border border-red-500/30 rounded-2xl select-text overflow-y-auto">
          <span className="text-red-400 font-bold text-xs uppercase tracking-wide">Erro no Player</span>
          <p className="text-[11px] text-slate-300 font-mono leading-relaxed break-all">
            {this.state.error?.message || "Erro desconhecido"}
          </p>
          <button 
            onClick={() => this.setState({ hasError: false, error: null })}
            className="px-3 py-1.5 bg-red-900/60 hover:bg-red-800 text-white rounded-lg text-[10px] font-bold transition-all"
          >
            Tentar Novamente
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}

interface PlayerWrapperProps {
  audioUrl: string;
  videoUrls: string[];
  subtitles: SubtitleItem[];
  durationInFrames: number;
}

export default function PlayerWrapper({ audioUrl, videoUrls, subtitles, durationInFrames }: PlayerWrapperProps) {
  // Safe fallback if durationInFrames is invalid
  const safeDuration = (isNaN(durationInFrames) || durationInFrames <= 0) ? 30 : durationInFrames;

  return (
    <ErrorBoundary>
      <Player
        component={MainComposition}
        inputProps={{
          audio_url: audioUrl,
          video_urls: videoUrls,
          subtitles: subtitles
        }}
        durationInFrames={safeDuration}
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
    </ErrorBoundary>
  );
}
