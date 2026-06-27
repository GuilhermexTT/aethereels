'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Play, Pause, Volume2, VolumeX, Maximize, Minimize } from 'lucide-react';
import { SubtitleItem, StyleConfig } from '@/video/types';

interface PlayerWrapperProps {
  audioUrl: string;
  videoUrls: string[];
  subtitles: SubtitleItem[];
  durationInFrames: number;
  styleConfig?: StyleConfig;
  onActiveSceneChange?: (index: number) => void;
}

export default function PlayerWrapper({ audioUrl, videoUrls, subtitles, styleConfig, onActiveSceneChange }: PlayerWrapperProps) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const videoRefs = useRef<(HTMLVideoElement | null)[]>([]);
  const currentTimeRef = useRef(0);
  const prevActiveVideoIndexRef = useRef<number>(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const progressBarRef = useRef<HTMLDivElement>(null);

  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [isMuted, setIsMuted] = useState(false);
  const [audioDuration, setAudioDuration] = useState(0);
  const [isFullscreen, setIsFullscreen] = useState(false);

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

  // Atalho da Barra de Espaço para Play/Pause
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'Space') {
        const active = document.activeElement;
        const isInput = active && (
          active.tagName === 'INPUT' || 
          active.tagName === 'TEXTAREA' || 
          active.hasAttribute('contenteditable')
        );
        
        if (!isInput) {
          e.preventDefault();
          togglePlay();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isPlaying, activeVideoIndex]);

  // Listener para mudança de tela cheia
  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);

  const toggleFullscreen = () => {
    if (!containerRef.current) return;
    if (!document.fullscreenElement) {
      containerRef.current.requestFullscreen().catch((err) => {
        console.error(`Erro ao ativar tela cheia: ${err.message}`);
      });
    } else {
      document.exitFullscreen();
    }
  };

  const syncVideoSeek = (time: number) => {
    const activeSubIndex = normalizedSubtitles.findIndex(
      (sub) => time >= sub.start && time <= sub.end
    );
    let activeIdx = 0;
    let timeInSub = time;
    if (activeSubIndex !== -1) {
      activeIdx = activeSubIndex % videoUrls.length;
      timeInSub = time - normalizedSubtitles[activeSubIndex].start;
    } else {
      const clipDuration = totalDuration / videoUrls.length;
      activeIdx = Math.min(Math.max(0, Math.floor(time / clipDuration)), videoUrls.length - 1);
      timeInSub = time % clipDuration;
    }

    for (let i = 0; i < videoUrls.length; i++) {
      const video = videoRefs.current[i];
      if (video) {
        if (i === activeIdx) {
          video.currentTime = timeInSub;
        } else {
          video.currentTime = 0;
        }
      }
    }
  };

  const seekToTime = (clientX: number) => {
    if (!progressBarRef.current || !totalDuration) return;
    const rect = progressBarRef.current.getBoundingClientRect();
    const clickX = clientX - rect.left;
    const percentage = Math.min(Math.max(0, clickX / rect.width), 1);
    const newTime = percentage * totalDuration;
    
    currentTimeRef.current = newTime;
    setCurrentTime(newTime);
    
    if (audioRef.current) {
      audioRef.current.currentTime = newTime;
    }
    
    syncVideoSeek(newTime);
  };

  const handleProgressMouseDown = (e: React.MouseEvent) => {
    seekToTime(e.clientX);
    
    const handleMouseMove = (moveEvent: MouseEvent) => {
      seekToTime(moveEvent.clientX);
    };
    
    const handleMouseUp = () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
    
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  };

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

  // Resolvendo configurações do template ou usando padrões
  const template = styleConfig?.template || 'viral_hyper';
  const fontFamily = styleConfig?.fontFamily || 
    (template === 'clean_business' ? '"Montserrat", sans-serif' : 
     template === 'cyber_aesthetic' ? '"Space Mono", monospace' : 
     '"Montserrat", "Poppins", sans-serif');

  const textColor = styleConfig?.textColor || 
    (template === 'cyber_aesthetic' ? '#00F0FF' : '#FFFFFF');

  const highlightColor = styleConfig?.highlightColor || 
    (template === 'clean_business' ? '#6366F1' : 
     template === 'cyber_aesthetic' ? '#FF00FF' : 
     '#FFD700');

  const textGlow = styleConfig?.textGlow ?? (template === 'cyber_aesthetic');
  const emojiEnabled = styleConfig?.emojiEnabled ?? (template === 'viral_hyper');

  // Helpers de escala proporcional para o Player (que é menor que 1080x1920)
  const getPlayerFontSize = () => {
    if (styleConfig?.fontSize) {
      const val = parseInt(styleConfig.fontSize);
      if (!isNaN(val)) return `${Math.round(val * 0.26)}px`;
    }
    return template === 'clean_business' ? '18px' : template === 'cyber_aesthetic' ? '20px' : '22px';
  };

  const getPlayerPaddingBottom = () => {
    return template === 'clean_business' ? '73px' : template === 'cyber_aesthetic' ? '83px' : '104px';
  };

  // Safe-zones: Estilos de sombra e contorno
  let textShadow = 'none';
  if (template === 'viral_hyper') {
    textShadow = '-1px -1px 0 #000, 1px -1px 0 #000, -1px 1px 0 #000, 1px 1px 0 #000, 0px 2px 5px rgba(0,0,0,0.8)';
  } else if (template === 'clean_business') {
    textShadow = '0px 1.5px 3px rgba(0, 0, 0, 0.6)';
  } else if (template === 'cyber_aesthetic' && textGlow) {
    textShadow = `0 0 2px ${textColor}, 0 0 4px ${textColor}, 0 0 8px ${highlightColor}`;
  }

  return (
    <div 
      ref={containerRef} 
      className="w-full h-full bg-black flex items-center justify-center relative rounded-[1.25rem] overflow-hidden group/player"
    >
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Montserrat:wght@800;900&family=Poppins:wght@800;900&family=Space+Mono:wght@700&family=Share+Tech+Mono&display=swap');
        
        @keyframes previewFadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes previewKenBurns {
          from { transform: scale(1.0); }
          to { transform: scale(1.12); }
        }
        @keyframes previewKenBurnsViral {
          from { transform: scale(1.06); }
          to { transform: scale(1.20); }
        }
        @keyframes previewKenBurnsCyber {
          from { transform: scale(1.12); }
          to { transform: scale(1.03); }
        }

        /* Estilos para manter proporção 9:16 em tela cheia */
        .group\/player:fullscreen {
          border-radius: 0 !important;
          background-color: black !important;
        }
        ::backdrop {
          background-color: black !important;
        }
      `}</style>

      {/* Viewport 9:16 Responsivo / Auto-ajustável */}
      <div 
        className="w-full h-full relative flex flex-col justify-end" 
        style={{
          maxWidth: 'calc(100vh * 9 / 16)',
          maxHeight: 'calc(100vw * 16 / 9)',
          aspectRatio: '9/16'
        }}
      >
        {/* Renderização das cenas de vídeos em paralelo */}
        {videoUrls.map((url, idx) => {
          const videoSrc = typeof url === 'object' && url !== null 
            ? String((url as any).url || (url as any).link || '') 
            : String(url);
          
          const isActive = idx === activeVideoIndex;
          
          const activeSubIndex = normalizedSubtitles.findIndex(sub => currentTime >= sub.start && currentTime <= sub.end);
          const activeSub = activeSubIndex !== -1 ? normalizedSubtitles[activeSubIndex] : null;
          const clipDuration = activeSub ? (activeSub.end - activeSub.start) : 3;

          const isCyber = template === 'cyber_aesthetic';
          const filter = isCyber 
            ? 'contrast(1.2) brightness(0.85) saturate(0.9) hue-rotate(-10deg)' 
            : 'none';

          const kenBurnsAnimation = template === 'viral_hyper' 
            ? 'previewKenBurnsViral' 
            : isCyber 
              ? 'previewKenBurnsCyber' 
              : 'previewKenBurns';

          const animationStyle = isActive
            ? `${isCyber ? '' : 'previewFadeIn 0.5s ease-out forwards, '}${kenBurnsAnimation} ${clipDuration}s linear forwards, previewDummy-${activeSubIndex} 0s`
            : 'none';

          return (
            <video
              key={idx}
              ref={(el) => { videoRefs.current[idx] = el; }}
              src={videoSrc}
              preload="auto"
              style={{
                opacity: isActive ? 1 : 0,
                pointerEvents: isActive ? 'auto' : 'none',
                animation: animationStyle,
                filter,
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

          // Filtro de Emojis
          let textToRender = activeSubtitle.text.trim();
          if (!emojiEnabled) {
            textToRender = textToRender.replace(/[\u2700-\u27BF]|[\uE000-\uF8FF]|\uD83C[\uDC00-\uDFFF]|\uD83D[\uDC00-\uDFFF]|[\u2011-\u26FF]|\uD83E[\uDD10-\uDDFF]/g, '');
          }

          const words = textToRender.split(/\s+/).filter(Boolean);
          const totalWords = words.length;
          const subtitleDuration = activeSubtitle.end - activeSubtitle.start;
          const elapsed = currentTime - activeSubtitle.start;

          const activeWordIndex = totalWords > 1 && subtitleDuration > 0
            ? Math.min(
                Math.floor((elapsed / subtitleDuration) * totalWords),
                totalWords - 1
              )
            : 0;

          const isHookPeriod = currentTime < 3.0;
          const hookScale = isHookPeriod ? 1.20 : 1.0;

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
                paddingBottom: getPlayerPaddingBottom(),
                paddingLeft: '20px',
                paddingRight: '20px',
                pointerEvents: 'none',
                zIndex: 30,
                transform: `scale(${hookScale})`,
                transition: 'transform 0.3s cubic-bezier(0.16, 1, 0.3, 1)',
              }}
            >
              <h1
                style={{
                  fontFamily,
                  fontSize: getPlayerFontSize(),
                  fontWeight: template === 'clean_business' ? 800 : 900,
                  textTransform: template === 'clean_business' ? 'none' : 'uppercase',
                  textAlign: 'center',
                  lineHeight: 1.25,
                  letterSpacing: template === 'cyber_aesthetic' ? '1.5px' : '0.5px',
                  display: 'flex',
                  flexWrap: 'wrap',
                  justifyContent: 'center',
                  textShadow,
                }}
              >
                {words.map((word: string, index: number) => {
                  const isActive = index === activeWordIndex;
                  
                  // 1. ANIMAÇÃO: CLEAN & BUSINESS
                  if (template === 'clean_business') {
                    const isFuture = index > activeWordIndex;
                    return (
                      <span
                        key={index}
                        style={{
                          color: isActive ? highlightColor : textColor,
                          opacity: isFuture ? 0.35 : 1.0,
                          marginRight: '5px',
                          display: 'inline-block',
                          transition: 'color 0.15s ease, opacity 0.2s ease',
                        }}
                      >
                        {word}
                      </span>
                    );
                  }

                  // 2. ANIMAÇÃO: CYBER AESTHETIC
                  if (template === 'cyber_aesthetic') {
                    const isFuture = index > activeWordIndex;
                    if (isFuture) return null;

                    return (
                      <span
                        key={index}
                        style={{
                          color: isActive ? highlightColor : textColor,
                          marginRight: '5px',
                          display: 'inline-block',
                          borderRight: isActive ? `2px solid ${highlightColor}` : 'none',
                          paddingRight: isActive ? '2px' : '0px',
                        }}
                      >
                        {word}
                      </span>
                    );
                  }

                  // 3. ANIMAÇÃO: VIRAL HYPER
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
                        color: isActive ? highlightColor : textColor,
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

        {/* Barra de Progresso Dinâmica do Estilo */}
        {styleConfig?.progressBar && (
          <div
            style={{
              position: 'absolute',
              bottom: '8px', // logo acima da barra de progresso interativa
              left: 0,
              height: '4px',
              width: `${totalDuration ? (currentTime / totalDuration) * 100 : 0}%`,
              background: `linear-gradient(90deg, ${highlightColor} 0%, ${textColor} 100%)`,
              zIndex: 25,
              boxShadow: `0 0 4px ${highlightColor}`,
            }}
          />
        )}

        {/* Barra de Progresso Interativa */}
        <div 
          ref={progressBarRef}
          onMouseDown={handleProgressMouseDown}
          className="absolute bottom-0 inset-x-0 h-2 bg-white/15 z-30 cursor-pointer group/slider select-none"
        >
          <div 
            className="h-full bg-gradient-to-r from-blue-500 to-[#7c3aed] relative" 
            style={{ width: `${totalDuration ? (currentTime / totalDuration) * 100 : 0}%` }}
          >
            {/* Handle flutuante no hover */}
            <div className="absolute right-0 top-1/2 -translate-y-1/2 w-3.5 h-3.5 rounded-full bg-white shadow-lg opacity-0 group-hover/slider:opacity-100 transition-opacity" />
          </div>
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

          <div className="flex items-center gap-1.5">
            <button 
              onClick={toggleMute}
              className="h-8.5 w-8.5 rounded-full bg-black/40 hover:bg-black/60 border border-white/10 backdrop-blur-md flex items-center justify-center text-white transition-all hover:scale-105 active:scale-95 cursor-pointer"
            >
              {isMuted ? <VolumeX className="h-3.5 w-3.5" /> : <Volume2 className="h-3.5 w-3.5" />}
            </button>
            
            <button 
              onClick={toggleFullscreen}
              className="h-8.5 w-8.5 rounded-full bg-black/40 hover:bg-black/60 border border-white/10 backdrop-blur-md flex items-center justify-center text-white transition-all hover:scale-105 active:scale-95 cursor-pointer"
              title={isFullscreen ? "Sair da Tela Cheia" : "Tela Cheia"}
            >
              {isFullscreen ? <Minimize className="h-3.5 w-3.5" /> : <Maximize className="h-3.5 w-3.5" />}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

