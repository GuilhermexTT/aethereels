'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Play, Pause, Volume2, VolumeX } from 'lucide-react';
import { SubtitleItem } from '@/video/types';

interface PlayerWrapperProps {
  audioUrl: string;
  videoUrls: string[];
  subtitles: SubtitleItem[];
  durationInFrames: number;
  onActiveSceneChange?: (index: number) => void;
}

export default function PlayerWrapper({ audioUrl, videoUrls, subtitles, onActiveSceneChange }: PlayerWrapperProps) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const videoRefs = useRef<(HTMLVideoElement | null)[]>([]);
  const currentTimeRef = useRef(0);
  const prevActiveVideoIndexRef = useRef<number>(0);

  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [isMuted, setIsMuted] = useState(false);
  const [audioDuration, setAudioDuration] = useState(0);

  // Normalização das legendas
  const normalizedSubtitles = (subtitles || []).map((sub, index) => {
    let start = sub.start !== undefined 
      ? Number(sub.start) 
      : (sub.start_time !== undefined ? Number(sub.start_time) : index * 3);

    if (isNaN(start) || !isFinite(start)) {
      start = index * 3;
    }

    let end = sub.end !== undefined 
      ? Number(sub.end) 
      : (sub.duration !== undefined ? start + Number(sub.duration) : start + 3);

    if (isNaN(end) || !isFinite(end) || end <= start) {
      end = start + 3;
    }

    return {
      text: String(sub.text || sub.word || ''),
      start,
      end
    };
  });

  const subtitlesDuration = normalizedSubtitles.length > 0 ? normalizedSubtitles[normalizedSubtitles.length - 1].end : 12;
  const totalDuration = audioDuration && audioDuration > 2.0 ? audioDuration : subtitlesDuration;

  const getActiveVideoIndex = () => {
    if (videoUrls.length === 0) return 0;
    const activeSubIndex = normalizedSubtitles.findIndex(sub => currentTime >= sub.start && currentTime <= sub.end);
    if (activeSubIndex !== -1) {
      return activeSubIndex % videoUrls.length;
    }
    const clipDuration = totalDuration / videoUrls.length;
    return Math.min(Math.max(0, Math.floor(currentTime / clipDuration)), videoUrls.length - 1);
  };

  const activeVideoIndex = getActiveVideoIndex();

  useEffect(() => {
    if (onActiveSceneChange) {
      onActiveSceneChange(activeVideoIndex);
    }
  }, [activeVideoIndex, onActiveSceneChange]);

  useEffect(() => {
    currentTimeRef.current = currentTime;
  }, [currentTime]);

  // Forçar o recarregamento do áudio e resetar estados de reprodução ao alterar a URL do áudio (ex: no "Atualizar Voz")
  useEffect(() => {
    setIsPlaying(false);
    setCurrentTime(0);
    currentTimeRef.current = 0;
    setAudioDuration(0);
    
    if (audioRef.current) {
      audioRef.current.load();
    }

    videoRefs.current.forEach(video => {
      if (video) {
        video.pause();
        video.currentTime = 0;
      }
    });
  }, [audioUrl]);

  // Master update loop synchronized with the audio tag or running on requestAnimationFrame
  useEffect(() => {
    if (!isPlaying) return;

    let lastTime = performance.now();
    let animationFrameId: number;

    const updateLoop = () => {
      const now = performance.now();
      const delta = (now - lastTime) / 1000;
      lastTime = now;

      const audio = audioRef.current;
      let nextTime = currentTimeRef.current;

      if (audio && !audio.paused && audio.currentTime > 0 && !audio.error) {
        nextTime = audio.currentTime;
      } else {
        nextTime = nextTime + delta;
      }

      if (nextTime >= totalDuration) {
        nextTime = 0;
        if (audio) {
          audio.currentTime = 0;
          audio.play().catch(e => console.log('Erro de autoplay no loop:', e));
        }
      }

      currentTimeRef.current = nextTime;
      setCurrentTime(nextTime);

      animationFrameId = requestAnimationFrame(updateLoop);
    };

    animationFrameId = requestAnimationFrame(updateLoop);
    return () => cancelAnimationFrame(animationFrameId);
  }, [isPlaying, totalDuration]);

  // Control playing/pausing of background videos based on activeVideoIndex and isPlaying
  useEffect(() => {
    const prevActiveIndex = prevActiveVideoIndexRef.current;
    prevActiveVideoIndexRef.current = activeVideoIndex;
    
    for (let i = 0; i < videoUrls.length; i++) {
      const video = videoRefs.current[i];
      if (video) {
        if (i === activeVideoIndex) {
          if (isPlaying) {
            if (i !== prevActiveIndex) {
              video.currentTime = 0;
            }
            video.play().catch(() => {});
          } else {
            video.pause();
          }
        } else {
          video.pause();
          video.currentTime = 0;
        }
      }
    }
  }, [activeVideoIndex, isPlaying, videoUrls.length]);

  const togglePlay = () => {
    const audio = audioRef.current;
    const activeVideo = videoRefs.current[activeVideoIndex];

    if (isPlaying) {
      if (audio) audio.pause();
      if (activeVideo) activeVideo.pause();
      setIsPlaying(false);
    } else {
      if (audio) audio.play().catch(e => console.log('Erro áudio play:', e));
      if (activeVideo) activeVideo.play().catch(e => console.log('Erro vídeo play:', e));
      setIsPlaying(true);
    }
  };

  const toggleMute = () => {
    const audio = audioRef.current;
    if (audio) {
      audio.muted = !isMuted;
    }
    setIsMuted(!isMuted);
  };

  const handleTimeUpdate = (e: React.SyntheticEvent<HTMLMediaElement>) => {
    if (!isPlaying) {
      setCurrentTime(e.currentTarget.currentTime);
    }
  };

  return (
    <div className="w-full h-full relative flex flex-col justify-end group/player bg-black rounded-[1.25rem] overflow-hidden">
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Montserrat:wght@900&family=Poppins:wght@800;900&display=swap');
        
        @keyframes previewFadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes previewKenBurns {
          from { transform: scale(1.0); }
          to { transform: scale(1.12); }
        }
      `}</style>

      {/* Renderização das cenas de vídeos em paralelo */}
      {videoUrls.map((url, idx) => {
        const videoSrc = typeof url === 'object' && url !== null 
          ? String((url as any).url || (url as any).link || '') 
          : String(url);
        
        const isActive = idx === activeVideoIndex;
        
        const activeSubIndex = normalizedSubtitles.findIndex(sub => currentTime >= sub.start && currentTime <= sub.end);
        const activeSub = activeSubIndex !== -1 ? normalizedSubtitles[activeSubIndex] : null;
        const clipDuration = activeSub ? (activeSub.end - activeSub.start) : 3;

        return (
          <video
            key={idx}
            ref={(el) => { videoRefs.current[idx] = el; }}
            src={videoSrc}
            preload="auto"
            style={{
              opacity: isActive ? 1 : 0,
              pointerEvents: isActive ? 'auto' : 'none',
              animation: isActive
                ? `previewFadeIn 0.5s ease-out forwards, previewKenBurns ${clipDuration}s linear forwards, previewDummy-${activeSubIndex} 0s`
                : 'none',
            }}
            loop
            playsInline
            muted={true}
            className="absolute inset-0 w-full h-full object-cover bg-black"
          />
        );
      })}

      {/* Áudio de fundo sincronizado */}
      {audioUrl && (
        <audio
          ref={audioRef}
          src={audioUrl}
          onTimeUpdate={handleTimeUpdate}
          onLoadedMetadata={(e) => setAudioDuration(e.currentTarget.duration)}
          onEnded={() => {
            setIsPlaying(false);
            setCurrentTime(0);
          }}
        />
      )}

      {/* Legendas Dinâmicas */}
      {(() => {
        const activeSubtitle = normalizedSubtitles.find(
          (sub) => currentTime >= sub.start && currentTime <= sub.end
        );
        if (!activeSubtitle || !activeSubtitle.text.trim()) return null;

        const words = activeSubtitle.text.trim().split(/\s+/);
        const totalWords = words.length;
        const subtitleDuration = activeSubtitle.end - activeSubtitle.start;
        const elapsed = currentTime - activeSubtitle.start;

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
              paddingBottom: '85px',
              paddingLeft: '20px',
              paddingRight: '20px',
              pointerEvents: 'none',
              zIndex: 30,
            }}
          >
            <h1
              style={{
                fontFamily: '"Montserrat", "Poppins", "Arial Black", sans-serif',
                fontSize: '22px',
                fontWeight: 900,
                textTransform: 'uppercase',
                textAlign: 'center',
                lineHeight: 1.25,
                letterSpacing: '1.5px',
                display: 'flex',
                flexWrap: 'wrap',
                justifyContent: 'center',
                textShadow: '0 2px 4px rgba(0,0,0,0.8), 0 4px 10px rgba(0,0,0,0.4)',
              }}
            >
              {words.map((word: string, index: number) => {
                const isActive = index === activeWordIndex;
                
                const wordDuration = subtitleDuration / totalWords;
                const wordStart = activeSubtitle.start + index * wordDuration;
                const wordElapsed = currentTime - wordStart;
                const wordElapsedFrames = wordElapsed * 30; // 30fps mapping
                
                let scale = 1.0;
                if (isActive && wordElapsedFrames >= 0) {
                  if (wordElapsedFrames < 3) {
                    scale = 1.0 + (wordElapsedFrames / 3) * 0.25;
                  } else if (wordElapsedFrames < 6) {
                    scale = 1.25 - ((wordElapsedFrames - 3) / 3) * 0.15;
                  } else {
                    scale = 1.10;
                  }
                }

                return (
                  <span
                    key={index}
                    style={{
                      color: isActive ? '#FFD700' : '#FFFFFF',
                      marginRight: '5px',
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
      })()}

      {/* Barra de Progresso */}
      <div className="absolute bottom-0 inset-x-0 h-1 bg-white/15 z-30 select-none">
        <div 
          className="h-full bg-gradient-to-r from-blue-500 to-indigo-500" 
          style={{ width: `${totalDuration ? (currentTime / totalDuration) * 100 : 0}%` }}
        />
      </div>

      {/* Controles do Player */}
      <div className="absolute bottom-4 inset-x-4 flex items-center justify-between z-30 select-none pointer-events-auto">
        <button 
          onClick={togglePlay}
          className="h-8.5 w-8.5 rounded-full bg-black/40 hover:bg-black/60 border border-white/10 backdrop-blur-md flex items-center justify-center text-white transition-all hover:scale-105 active:scale-95 cursor-pointer"
        >
          {isPlaying ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5 fill-current ml-0.5" />}
        </button>

        <span className="text-[10px] text-white/95 font-bold bg-black/35 px-2.5 py-1 rounded-full border border-white/5 backdrop-blur-xs select-none">
          {Math.floor(currentTime / 60)}:{String(Math.floor(currentTime % 60)).padStart(2, '0')} / {Math.floor(totalDuration / 60)}:{String(Math.floor(totalDuration % 60)).padStart(2, '0')}
        </span>

        <button 
          onClick={toggleMute}
          className="h-8.5 w-8.5 rounded-full bg-black/40 hover:bg-black/60 border border-white/10 backdrop-blur-md flex items-center justify-center text-white transition-all hover:scale-105 active:scale-95 cursor-pointer"
        >
          {isMuted ? <VolumeX className="h-3.5 w-3.5" /> : <Volume2 className="h-3.5 w-3.5" />}
        </button>
      </div>
    </div>
  );
}
