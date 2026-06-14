'use client';

import React, { useState, useEffect, useRef } from 'react';
import {
  Sparkles,
  Send,
  Play,
  Pause,
  Volume2,
  VolumeX,
  Maximize2,
  Clock,
  ChevronRight,
  Languages,
  Flame,
  Hourglass,
  Link2,
  Music,
  Type,
  Loader2,
  CheckCircle2
} from 'lucide-react';
import { useDashboard } from '../../../context/DashboardContext';
import { TabType, LanguageType, ToneType, DurationType } from '../../../types/dashboard';
import { createClient } from '@supabase/supabase-js';

export default function CreationDashboard() {
  const {
    credits,
    decrementCredits,
    videoState,
    setVideoState,
    activeTab,
    setActiveTab
  } = useDashboard();

  // Inputs state
  const [prompt, setPrompt] = useState('');
  const [blogUrl, setBlogUrl] = useState('');
  const [trendAudio, setTrendAudio] = useState('chill-synthwave');
  const [language, setLanguage] = useState<LanguageType>('pt');
  const [tone, setTone] = useState<ToneType>('envolvente');
  const [duration, setDuration] = useState<DurationType>('60s');

  // Simulated compilation states
  const [loadingProgress, setLoadingProgress] = useState(0);
  const [loadingLog, setLoadingLog] = useState('');
  const [loadingStage, setLoadingStage] = useState(0);

  // Video playback states
  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [videoDuration, setVideoDuration] = useState(0);
  const [currentSubtitle, setCurrentSubtitle] = useState('');
  const [videoUrl, setVideoUrl] = useState('');

  // Dynamic composition states
  const [audioUrl, setAudioUrl] = useState('');
  const [videoUrls, setVideoUrls] = useState<string[]>([]);
  const [isDynamicMode, setIsDynamicMode] = useState(false);

  // Default subtitles and fallback videos
  const defaultSubtitles = [
    { start: 0, end: 2.5, text: 'DISCIPLINA' },
    { start: 2.5, end: 5.5, text: 'É FAZER HOJE' },
    { start: 5.5, end: 8.5, text: 'O QUE VOCÊ VAI' },
    { start: 8.5, end: 11.5, text: 'AGRADECER AMANHÃ.' },
    { start: 11.5, end: 14.5, text: 'O ESPAÇO É O LIMITE' },
    { start: 14.5, end: 18.0, text: 'PARA QUEM NÃO TEM MEDO.' },
  ];

  const fallbackVideos = [
    'https://media.w3.org/2010/05/sintel/trailer_hd.mp4',
    'https://www.w3schools.com/html/mov_bbb.mp4',
    'https://www.w3schools.com/html/movie.mp4',
    'https://media.w3.org/2010/05/sintel/trailer_hd.mp4'
  ];

  const [subtitles, setSubtitles] = useState<{ start: number; end: number; text: string }[]>(defaultSubtitles);

  const videoRef = useRef<HTMLVideoElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);
  const videoRefs = useRef<(HTMLVideoElement | null)[]>([]);
  const phoneContainerRef = useRef<HTMLDivElement>(null);
  const loadingIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Calculate total subtitles duration as a fallback for the audio duration
  const subtitlesDuration = subtitles.length > 0 ? subtitles[subtitles.length - 1].end : 15;

  // Use subtitlesDuration as fallback if audio duration is not loaded or is shorter than 2.0 seconds (likely corrupted/undefined)
  const totalDuration = (videoDuration && videoDuration > 2.0) ? videoDuration : (subtitlesDuration || 18);

  // Dynamically calculate the active video index in loop mode based on currentTime
  const getActiveVideoIndex = () => {
    if (videoUrls.length === 0) return 0;
    const clipDuration = totalDuration / videoUrls.length;
    const index = Math.floor(currentTime / clipDuration);
    return Math.min(Math.max(0, index), videoUrls.length - 1);
  };

  const activeVideoIndex = isDynamicMode ? getActiveVideoIndex() : 0;

  // Keep track of current time in a ref to avoid recreating the animation frame loop on every tick
  const currentTimeRef = useRef(0);

  // Sync ref with state updates (e.g. when reset or manual seek happens)
  useEffect(() => {
    currentTimeRef.current = currentTime;
  }, [currentTime]);

  // Robust animation frame loop for dynamic mode to auto-increment time when audio fails or is loading
  useEffect(() => {
    if (!isDynamicMode || !isPlaying) return;

    let lastTime = performance.now();
    let animationFrameId: number;

    const updateLoop = () => {
      const now = performance.now();
      const delta = (now - lastTime) / 1000;
      lastTime = now;

      const audio = audioRef.current;
      let nextTime = currentTimeRef.current;

      // If audio is successfully playing and advancing, sync with it
      if (audio && !audio.paused && audio.currentTime > 0 && !audio.error) {
        nextTime = audio.currentTime;
      } else {
        // Otherwise use the robust high-precision timer fallback
        nextTime = nextTime + delta;
      }

      // Handle loop reset
      if (nextTime >= totalDuration) {
        nextTime = 0;
        if (audio) {
          audio.currentTime = 0;
          audio.play().catch(e => console.log('Audio loop play failed:', e));
        }
        videoRefs.current.forEach(v => {
          if (v) v.currentTime = 0;
        });
      }

      currentTimeRef.current = nextTime;
      setCurrentTime(nextTime);

      const activeSub = subtitles.find(sub => nextTime >= sub.start && nextTime <= sub.end);
      setCurrentSubtitle(activeSub ? activeSub.text : '');

      // Check active video and keep it playing
      const totalClips = videoUrls.length;
      if (totalClips > 0) {
        const clipDuration = totalDuration / totalClips;
        const activeIdx = Math.min(Math.max(0, Math.floor(nextTime / clipDuration)), totalClips - 1);
        const activeVid = videoRefs.current[activeIdx];
        if (activeVid && activeVid.paused && isPlaying) {
          activeVid.play().catch(e => console.log('Video play failed inside loop:', e));
        }
      }

      animationFrameId = requestAnimationFrame(updateLoop);
    };

    animationFrameId = requestAnimationFrame(updateLoop);
    return () => cancelAnimationFrame(animationFrameId);
  }, [isPlaying, isDynamicMode, totalDuration, subtitles, videoUrls]);

  // Sync plays/pauses for multiple background video preloaded elements
  useEffect(() => {
    if (!isDynamicMode) return;

    if (isPlaying) {
      const activeVid = videoRefs.current[activeVideoIndex];
      if (activeVid) {
        if (activeVid.paused) {
          activeVid.currentTime = 0;
        }
        activeVid.play().catch(e => console.log('Video play failed:', e));
      }
      // Pause others
      videoRefs.current.forEach((v, idx) => {
        if (idx !== activeVideoIndex && v) {
          v.pause();
        }
      });
    } else {
      // Pause all B-rolls
      videoRefs.current.forEach(v => {
        if (v) v.pause();
      });
    }
  }, [activeVideoIndex, isPlaying, isDynamicMode, videoUrls]);

  // Clean spare references when videoUrls changes to avoid memory leaks
  useEffect(() => {
    if (videoRefs.current.length > videoUrls.length) {
      videoRefs.current = videoRefs.current.slice(0, videoUrls.length);
    }
  }, [videoUrls]);

  // Compilation process simulator logs
  const stages = [
    { progress: 10, log: 'Analisando entrada e estruturando conceitos...' },
    { progress: 25, log: 'Escrevendo roteiro cinemático com IA (GPT-4)...' },
    { progress: 50, log: 'Sintetizando locução premium com ElevenLabs...' },
    { progress: 75, log: 'Gerando imagens e overlays visuais no Remotion...' },
    { progress: 90, log: 'Compilando e renderizando vídeo final (9:16)...' },
    { progress: 100, log: 'Vídeo compilado com sucesso!' }
  ];

  // Handle Tab Switch
  const handleTabChange = (tab: TabType) => {
    setActiveTab(tab);
  };

  // Simulated "Gerar com IA" helper
  const handleGenerateAI = () => {
    if (activeTab === 'text-to-video') {
      setPrompt('Crie um reels cinemático sobre alta performance e constância. Foco na jornada do astronauta no espaço profundo, luzes dramáticas de neon ciano e azul, com trilha sonora synthwave motivacional e locução profunda.');
    } else if (activeTab === 'blog-link') {
      setBlogUrl('https://aether-blog.tech/artigos/a-ciencia-da-alta-performance-e-disciplina');
    } else if (activeTab === 'trend-audio') {
      setTrendAudio('cosmic-ambient-focus');
    }
  };

  // Trigger Video Generation Pipeline via real API and Supabase Realtime
  const handleGenerateVideo = async () => {
    if (credits <= 0) {
      alert('Créditos insuficientes! Faça o upgrade para continuar.');
      return;
    }

    // Validate inputs
    if (activeTab === 'text-to-video' && !prompt.trim()) {
      alert('Por favor, descreva sua ideia ou use "Gerar com IA".');
      return;
    }
    if (activeTab === 'blog-link' && !blogUrl.trim()) {
      alert('Por favor, insira o link do post do blog.');
      return;
    }

    try {
      setVideoState('loading');
      setLoadingProgress(5);
      setLoadingStage(0);
      setLoadingLog('Conectando ao banco de dados...');

      // Conectar ao Supabase
      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
      const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

      if (!supabaseUrl || !supabaseAnonKey) {
        throw new Error('Supabase client não configurado na aplicação.');
      }

      const supabase = createClient(supabaseUrl, supabaseAnonKey);

      // Em desenvolvimento local, se o usuário do frontend não estiver autenticado,
      // realizamos o login automático para que o canal Realtime (que respeita RLS) possa receber as notificações.
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        setLoadingLog('Autenticando sessão de testes...');
        const { error: signInError } = await supabase.auth.signInWithPassword({
          email: 'dev-reelsflow-user@example.com',
          password: 'PasswordDev123!'
        });
        if (signInError) {
          console.warn('Erro ao autenticar sessão de testes local:', signInError.message);
        } else {
          console.log('🔧 [DEV MODE] Autenticado com sucesso no frontend para ouvir notificações do banco.');
        }
      }

      setLoadingProgress(10);
      setLoadingLog('Iniciando geração de vídeo no orquestrador...');

      // Construir o prompt completo a partir dos seletores para influenciar a IA no n8n
      const selectedLanguage = language === 'pt' ? 'Português' : language === 'en' ? 'Inglês' : 'Espanhol';
      const formattedPrompt = `${prompt.trim()} (Idioma: ${selectedLanguage}, Tom de voz: ${tone}, Duração: ${duration})`;

      // Chamar a API real do Next.js
      const response = await fetch('/api/video/generate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ prompt_input: formattedPrompt }),
      });

      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.error || 'Falha ao solicitar geração do vídeo.');
      }

      const data = await response.json();
      const jobId = data.job_id;

      decrementCredits(1);
      setLoadingProgress(25);
      setLoadingStage(1);
      setLoadingLog('Roteirizando com Inteligência Artificial...');

      const channel = supabase
        .channel(`job-progress-${jobId}`)
        .on(
          'postgres_changes',
          {
            event: 'UPDATE',
            schema: 'public',
            table: 'video_jobs',
            filter: `id=eq.${jobId}`,
          },
          (payload: any) => {
            const updatedJob = payload.new;
            console.log('Update de status em tempo real recebido:', updatedJob);

            if (updatedJob.status === 'scripting') {
              setLoadingProgress(50);
              setLoadingStage(2);
              setLoadingLog('Gerando locução e mídias de fundo...');
            } else if (updatedJob.status === 'rendering') {
              setLoadingProgress(80);
              setLoadingStage(4);
              setLoadingLog('Processando mídias...');
            } else if (updatedJob.status === 'ready') {
              setLoadingProgress(100);
              setLoadingStage(5);
              setLoadingLog('Vídeo pronto!');

              channel.unsubscribe();

              setTimeout(() => {
                let parsedScript: any = null;
                if (updatedJob.script_json) {
                  try {
                    parsedScript = typeof updatedJob.script_json === 'string'
                      ? JSON.parse(updatedJob.script_json)
                      : updatedJob.script_json;
                  } catch (e) {
                    console.error('Erro ao fazer parse do script_json:', e);
                  }
                }

                if (parsedScript && (parsedScript.audio_url || parsedScript.b_roll_videos || parsedScript.video_urls)) {
                  setIsDynamicMode(true);
                  setAudioUrl(parsedScript.audio_url || '');

                  // Combina as duas possibilidades para garantir compatibilidade com o n8n
                  const actualVideos = parsedScript.b_roll_videos || parsedScript.video_urls;

                  const clips = (actualVideos && actualVideos.length > 0)
                    ? actualVideos
                    : fallbackVideos;
                  setVideoUrls(clips);

                  if (parsedScript.subtitles && parsedScript.subtitles.length > 0) {
                    let currentStart = 0;
                    const mapped = parsedScript.subtitles.map((sub: any) => {
                      const duration = parseFloat(sub.duration) || 3;
                      const start = currentStart;
                      const end = currentStart + duration;
                      currentStart = end;
                      return {
                        start,
                        end,
                        text: sub.text
                      };
                    });
                    setSubtitles(mapped);
                  } else {
                    setSubtitles(defaultSubtitles);
                  }

                  setVideoUrl('');
                } else {
                  setIsDynamicMode(false);
                  setVideoUrl(updatedJob.video_url || '');
                  setSubtitles(defaultSubtitles);
                }

                setVideoState('ready');
                setIsPlaying(false);
              }, 800);
            } else if (updatedJob.status === 'failed') {
              channel.unsubscribe();
              setVideoState('idle');
              alert('A geração do vídeo falhou. Seus créditos foram estornados.');
            }
          }
        )
        .subscribe();

    } catch (error: any) {
      console.error('Erro ao gerar vídeo:', error);
      setVideoState('idle');
      alert(error.message || 'Ocorreu um erro ao gerar o vídeo.');
    }
  };

  // Master Time/Subtitles updates (supports both audio timing and video timing)
  const handleTimeUpdate = (e: React.SyntheticEvent<HTMLMediaElement>) => {
    const time = e.currentTarget.currentTime;
    setCurrentTime(time);

    // Find active subtitle
    const activeSub = subtitles.find(sub => time >= sub.start && time <= sub.end);
    setCurrentSubtitle(activeSub ? activeSub.text : '');
  };

  const handleLoadedMetadata = (e: React.SyntheticEvent<HTMLMediaElement>) => {
    setVideoDuration(e.currentTarget.duration);
  };

  const handleVideoError = (idx: number) => {
    console.warn(`Video failed to load at index ${idx}. Ativando fallback.`);
    setVideoUrls(prev => {
      const copy = [...prev];
      copy[idx] = fallbackVideos[idx % fallbackVideos.length];
      return copy;
    });
  };

  const togglePlay = () => {
    if (isDynamicMode) {
      if (!audioRef.current) return;
      if (isPlaying) {
        audioRef.current.pause();
        videoRefs.current.forEach(v => v?.pause());
        setIsPlaying(false);
      } else {
        audioRef.current.play().catch(e => console.log('Audio play failed:', e));
        const activeVid = videoRefs.current[activeVideoIndex];
        if (activeVid) {
          activeVid.play().catch(e => console.log('Video play failed:', e));
        }
        setIsPlaying(true);
      }
    } else {
      if (!videoRef.current) return;
      if (isPlaying) {
        videoRef.current.pause();
        setIsPlaying(false);
      } else {
        videoRef.current.play().catch(e => console.log('Video play failed:', e));
        setIsPlaying(true);
      }
    }
  };

  const toggleMute = () => {
    if (isDynamicMode) {
      if (!audioRef.current) return;
      audioRef.current.muted = !isMuted;
      setIsMuted(!isMuted);
    } else {
      if (!videoRef.current) return;
      videoRef.current.muted = !isMuted;
      setIsMuted(!isMuted);
    }
  };

  const handleFullscreen = () => {
    const el = phoneContainerRef.current;
    if (!el) return;
    if (el.requestFullscreen) {
      el.requestFullscreen();
    }
  };

  const handleAudioEnded = () => {
    if (isDynamicMode && audioRef.current) {
      audioRef.current.currentTime = 0;
      audioRef.current.play().catch(e => console.log('Audio loop play failed:', e));
      // Reset video times
      videoRefs.current.forEach(v => {
        if (v) v.currentTime = 0;
      });
    }
  };

  const triggerVerExemplo = () => {
    setIsDynamicMode(false);
    setVideoUrl('');
    setSubtitles(defaultSubtitles);
    setVideoState('ready');
    setIsPlaying(false);
    // Insert mock values
    setPrompt('Crie um reels cinemático sobre alta performance e constância. Foco na jornada do astronauta no espaço profundo, luzes dramáticas de neon ciano e azul, com trilha sonora synthwave motivacional e locução profunda.');
    setLanguage('pt');
    setTone('envolvente');
    setDuration('60s');
  };

  // Auto-pause video if state is changed
  useEffect(() => {
    if (videoState !== 'ready') {
      const timer = setTimeout(() => {
        setIsPlaying(false);
      }, 0);
      return () => clearTimeout(timer);
    }
  }, [videoState]);

  // Clean interval on unmount
  useEffect(() => {
    const currentInterval = loadingIntervalRef.current;
    return () => {
      if (currentInterval) clearInterval(currentInterval);
    };
  }, []);

  return (
    <div className="grid grid-cols-12 gap-8 items-start">

      {/* 4.1. Módulo Principal de Criação (65% width equivalent) */}
      <section className="col-span-12 lg:col-span-8 flex flex-col gap-8">

        {/* Bloco de Boas Vindas */}
        <div className="flex flex-col gap-2">
          <h1 className="font-display text-4xl md:text-5xl font-extrabold tracking-tight text-white">
            Vamos criar <br className="sm:hidden" />
            seu próximo <span className="bg-gradient-to-r from-blue-400 via-cyan-400 to-teal-400 bg-clip-text text-transparent drop-shadow-[0_0_15px_rgba(0,229,255,0.2)]">vídeo</span>
          </h1>
          <p className="text-slate-400 text-base md:text-lg max-w-xl font-medium leading-relaxed">
            Transforme suas ideias em vídeos virais para o Instagram.
          </p>
        </div>

        {/* Card de Workspace Principal */}
        <div className="bg-[#0b1329]/20 backdrop-blur-md border border-[#1e293b]/40 rounded-2xl p-8 flex flex-col gap-8 shadow-2xl relative overflow-hidden">
          <div className="absolute top-0 left-0 w-[500px] h-[500px] bg-blue-500/5 rounded-full blur-[120px] pointer-events-none -translate-x-1/2 -translate-y-1/2" />

          {/* Abas de Contexto */}
          <div className="relative z-10 grid grid-cols-3 rounded-xl bg-[#050b14] p-1 border border-[#1e293b]/30">

            <button
              onClick={() => handleTabChange('text-to-video')}
              className={`flex items-center justify-center gap-2 rounded-lg py-3 text-xs md:text-sm font-semibold transition-all duration-300 relative ${activeTab === 'text-to-video'
                  ? 'bg-slate-900/50 text-cyan-400 border-b border-cyan-400/80 shadow-[inset_0_-8px_12px_rgba(6,182,212,0.05)]'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/20'
                }`}
            >
              <Type className="h-4 w-4" />
              <span>Texto para Vídeo</span>
              {activeTab === 'text-to-video' && (
                <span className="absolute bottom-[-4px] left-1/4 right-1/4 h-[2px] bg-cyan-400 blur-[1px]"></span>
              )}
            </button>

            <button
              onClick={() => handleTabChange('blog-link')}
              className={`flex items-center justify-center gap-2 rounded-lg py-3 text-xs md:text-sm font-semibold transition-all duration-300 relative ${activeTab === 'blog-link'
                  ? 'bg-slate-900/50 text-cyan-400 border-b border-cyan-400/80 shadow-[inset_0_-8px_12px_rgba(6,182,212,0.05)]'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/20'
                }`}
            >
              <Link2 className="h-4 w-4" />
              <span>Link de Blog</span>
              {activeTab === 'blog-link' && (
                <span className="absolute bottom-[-4px] left-1/4 right-1/4 h-[2px] bg-cyan-400 blur-[1px]"></span>
              )}
            </button>

            <button
              onClick={() => handleTabChange('trend-audio')}
              className={`flex items-center justify-center gap-2 rounded-lg py-3 text-xs md:text-sm font-semibold transition-all duration-300 relative ${activeTab === 'trend-audio'
                  ? 'bg-slate-900/50 text-cyan-400 border-b border-cyan-400/80 shadow-[inset_0_-8px_12px_rgba(6,182,212,0.05)]'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/20'
                }`}
            >
              <Music className="h-4 w-4" />
              <span>Áudio Trend</span>
              {activeTab === 'trend-audio' && (
                <span className="absolute bottom-[-4px] left-1/4 right-1/4 h-[2px] bg-cyan-400 blur-[1px]"></span>
              )}
            </button>

          </div>

          {/* Área Dinâmica de Input baseada na Aba */}
          <div className="relative z-10 flex flex-col gap-2">

            {activeTab === 'text-to-video' && (
              <div className="relative rounded-xl border border-[#1e293b]/40 bg-[#050b14] p-4 focus-within:border-cyan-500/40 transition-all duration-300">
                <textarea
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value.slice(0, 4000))}
                  placeholder="Descreva sua ideia, tópico ou cole seu texto aqui..."
                  className="w-full min-h-[160px] bg-transparent text-slate-100 text-sm placeholder-slate-500 outline-none resize-none"
                />

                {/* Rodapé Interno do Input */}
                <div className="flex items-center justify-between border-t border-[#1e293b]/20 pt-3 mt-2">
                  <span className="text-[11px] text-slate-500 font-medium">
                    {prompt.length}/4000 caracteres
                  </span>

                  <button
                    onClick={handleGenerateAI}
                    className="flex items-center gap-1.5 rounded-lg bg-cyan-500/5 border border-cyan-500/20 px-3 py-1.5 text-xs font-semibold text-cyan-400 hover:bg-cyan-500/10 hover:border-cyan-500/40 active:scale-95 transition-all duration-200 shadow-[0_0_15px_rgba(6,182,212,0.05)]"
                  >
                    <Sparkles className="h-3.5 w-3.5" />
                    <span>Gerar com IA</span>
                  </button>
                </div>
              </div>
            )}

            {activeTab === 'blog-link' && (
              <div className="flex flex-col gap-4">
                <div className="relative rounded-xl border border-[#1e293b]/40 bg-[#050b14] p-3 flex items-center gap-3 focus-within:border-cyan-500/40 transition-all duration-300">
                  <Link2 className="h-5 w-5 text-slate-500 pl-1" />
                  <input
                    type="url"
                    value={blogUrl}
                    onChange={(e) => setBlogUrl(e.target.value)}
                    placeholder="Cole a URL do post do blog aqui (ex: https://meublog.com/post)"
                    className="w-full bg-transparent text-slate-100 text-sm placeholder-slate-500 outline-none"
                  />

                  <button
                    onClick={handleGenerateAI}
                    className="flex items-center gap-1.5 rounded-lg bg-cyan-500/5 border border-cyan-500/20 px-3 py-1.5 text-xs font-semibold text-cyan-400 whitespace-nowrap hover:bg-cyan-500/10 active:scale-95 transition-all"
                  >
                    <Sparkles className="h-3.5 w-3.5" />
                    <span>Gerar com IA</span>
                  </button>
                </div>

                <div className="relative rounded-xl border border-[#1e293b]/40 bg-[#050b14] p-4 focus-within:border-cyan-500/40 transition-all duration-300">
                  <textarea
                    placeholder="Instruções de tom ou cortes adicionais (opcional)..."
                    className="w-full min-h-[80px] bg-transparent text-slate-100 text-sm placeholder-slate-500 outline-none resize-none"
                  />
                  <div className="flex justify-end border-t border-[#1e293b]/10 pt-2 mt-2">
                    <span className="text-[10px] text-slate-500 font-medium">Extraído via IA</span>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'trend-audio' && (
              <div className="flex flex-col gap-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

                  {/* Select customizado de áudio trend */}
                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-semibold text-slate-400">Áudio do Momento</label>
                    <div className="relative">
                      <select
                        value={trendAudio}
                        onChange={(e) => setTrendAudio(e.target.value)}
                        className="w-full bg-[#050b14] border border-[#1e293b]/40 rounded-xl px-4 py-3 text-sm text-slate-200 outline-none focus:border-cyan-500/40 transition-all appearance-none cursor-pointer"
                      >
                        <option value="chill-synthwave">Chill Synthwave - Beats Virais (102.5k reels)</option>
                        <option value="cosmic-ambient-focus">Cosmic Ambient - Deep Focus (87.2k reels)</option>
                        <option value="cyberpunk-drum-bass">Cyberpunk Energy - D&B Drop (74.9k reels)</option>
                        <option value="lofi-hiphop-night">Midnight Lofi - Sleepy Rain (118.0k reels)</option>
                      </select>
                      <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400">
                        <ChevronRight className="h-4 w-4 rotate-90" />
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-col justify-end">
                    <button
                      onClick={handleGenerateAI}
                      className="w-full flex items-center justify-center gap-1.5 rounded-xl bg-cyan-500/5 border border-cyan-500/20 py-3 text-xs font-semibold text-cyan-400 hover:bg-cyan-500/10 transition-all active:scale-95 shadow-sm"
                    >
                      <Sparkles className="h-4 w-4" />
                      <span>Selecionar Melhor Áudio com IA</span>
                    </button>
                  </div>

                </div>

                <div className="relative rounded-xl border border-[#1e293b]/40 bg-[#050b14] p-4 focus-within:border-cyan-500/40 transition-all duration-300">
                  <textarea
                    placeholder="Descreva a ideia visual para sincronizar com a batida do áudio..."
                    className="w-full min-h-[85px] bg-transparent text-slate-100 text-sm placeholder-slate-500 outline-none resize-none"
                  />
                  <div className="flex justify-end border-t border-[#1e293b]/10 pt-2 mt-2">
                    <span className="text-[10px] text-slate-500 font-medium">Sincronização de batida inteligente</span>
                  </div>
                </div>
              </div>
            )}

          </div>

          {/* Barra de Ajustes Rápidos */}
          <div className="relative z-10 grid grid-cols-1 sm:grid-cols-3 gap-4 border-t border-white/5 pt-6">

            {/* Seletor Idioma */}
            <div className="flex flex-col gap-1.5">
              <span className="text-xs font-semibold text-slate-400 flex items-center gap-1.5">
                <Languages className="h-3.5 w-3.5 text-cyan-400" />
                Idioma
              </span>
              <div className="relative">
                <select
                  value={language}
                  onChange={(e) => setLanguage(e.target.value as LanguageType)}
                  className="w-full bg-[#050b14] border border-[#1e293b]/40 rounded-xl px-4 py-3 text-sm text-slate-200 outline-none focus:border-cyan-500/40 transition-all appearance-none cursor-pointer"
                >
                  <option value="pt">Português</option>
                  <option value="en">Inglês</option>
                  <option value="es">Espanhol</option>
                </select>
                <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-slate-500">
                  <ChevronRight className="h-4 w-4 rotate-90" />
                </div>
              </div>
            </div>

            {/* Seletor Tom de Voz */}
            <div className="flex flex-col gap-1.5">
              <span className="text-xs font-semibold text-slate-400 flex items-center gap-1.5">
                <Flame className="h-3.5 w-3.5 text-cyan-400" />
                Tom de voz
              </span>
              <div className="relative">
                <select
                  value={tone}
                  onChange={(e) => setTone(e.target.value as ToneType)}
                  className="w-full bg-[#050b14] border border-[#1e293b]/40 rounded-xl px-4 py-3 text-sm text-slate-200 outline-none focus:border-cyan-500/40 transition-all appearance-none cursor-pointer"
                >
                  <option value="envolvente">Envolvente</option>
                  <option value="profissional">Profissional</option>
                  <option value="humorado">Humorado</option>
                  <option value="inspirador">Inspirador</option>
                </select>
                <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-slate-500">
                  <ChevronRight className="h-4 w-4 rotate-90" />
                </div>
              </div>
            </div>

            {/* Seletor Duração */}
            <div className="flex flex-col gap-1.5">
              <span className="text-xs font-semibold text-slate-400 flex items-center gap-1.5">
                <Hourglass className="h-3.5 w-3.5 text-cyan-400" />
                Duração
              </span>
              <div className="relative">
                <select
                  value={duration}
                  onChange={(e) => setDuration(e.target.value as DurationType)}
                  className="w-full bg-[#050b14] border border-[#1e293b]/40 rounded-xl px-4 py-3 text-sm text-slate-200 outline-none focus:border-cyan-500/40 transition-all appearance-none cursor-pointer"
                >
                  <option value="30s">30s</option>
                  <option value="60s">60s</option>
                  <option value="90s">90s</option>
                </select>
                <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-slate-500">
                  <ChevronRight className="h-4 w-4 rotate-90" />
                </div>
              </div>
            </div>

          </div>

          {/* CTA Mestre (Botão Gerar) */}
          <div className="relative z-10 border-t border-white/5 pt-6 mt-2">
            <button
              onClick={handleGenerateVideo}
              disabled={videoState === 'loading'}
              className={`w-full relative overflow-hidden group rounded-xl bg-gradient-to-r from-blue-600 to-cyan-400 hover:from-blue-500 hover:to-cyan-300 py-4 px-6 font-bold text-white shadow-[0_0_30px_rgba(6,182,212,0.25)] hover:shadow-[0_0_35px_rgba(6,182,212,0.4)] active:scale-[0.98] transition-all duration-300 cursor-pointer disabled:opacity-75 disabled:cursor-not-allowed`}
            >
              <div className="flex items-center justify-center gap-3">
                {videoState === 'loading' ? (
                  <>
                    <Loader2 className="h-5 w-5 animate-spin" />
                    <span>Compilando vídeo... ({loadingProgress}%)</span>
                  </>
                ) : (
                  <>
                    <Send className="h-4.5 w-4.5 group-hover:translate-x-1 group-hover:-translate-y-0.5 transition-transform duration-200" />
                    <div className="flex flex-col items-center">
                      <span className="text-base tracking-wide">Gerar Vídeo</span>
                      <span className="text-[10px] text-cyan-100/80 font-semibold mt-0.5">1 crédito</span>
                    </div>
                  </>
                )}
              </div>
            </button>
          </div>

        </div>

      </section>

      {/* 4.2. Módulo Preview 9:16 (35% width equivalent) */}
      <section className="col-span-12 lg:col-span-4 flex flex-col gap-6 lg:h-full justify-start">

        {/* Topo do Preview */}
        <div className="flex items-center justify-between">
          <h2 className="font-display text-lg font-bold text-white tracking-tight">
            Preview 9:16
          </h2>

          <button
            onClick={triggerVerExemplo}
            className="rounded-lg border border-[#1e293b]/60 bg-slate-900/30 px-3.5 py-1.5 text-xs font-semibold text-slate-400 hover:text-slate-200 hover:border-[#1e293b] hover:bg-slate-900/60 active:scale-95 transition-all duration-200"
          >
            Ver exemplo
          </button>
        </div>

        {/* Smartphone Container Outline */}
        <div className="bg-[#0b1329]/20 backdrop-blur-md border border-[#1e293b]/40 rounded-3xl p-6 flex flex-col items-center justify-center shadow-xl relative min-h-[520px] overflow-hidden lg:flex-1">
          <div className="absolute top-0 right-0 w-[300px] h-[300px] bg-cyan-500/5 rounded-full blur-[80px] pointer-events-none translate-x-1/2 -translate-y-1/2" />

          {/* Corpo do Celular (Rigid Aspect Ratio 9:16) */}
          <div
            ref={phoneContainerRef}
            className="relative w-[250px] aspect-[9/16] rounded-[2.5rem] border-[6px] border-slate-800 bg-[#050b14] overflow-hidden shadow-2xl flex flex-col items-center justify-center ring-1 ring-white/10"
          >

            {/* Slot de alto-falante/câmera (Notch) */}
            <div className="absolute top-0 left-1/2 -translate-x-1/2 h-4 w-24 bg-slate-800 rounded-b-2xl z-40 border-b border-white/5" />

            {/* ESTADO 1: Idle */}
            {videoState === 'idle' && (
              <div className="flex flex-col items-center text-center p-6 gap-4 animate-fade-in relative z-20">
                <div className="h-12 w-12 rounded-2xl bg-slate-900/80 border border-[#1e293b]/50 flex items-center justify-center text-slate-400">
                  <Play className="h-6 w-6 ml-0.5" />
                </div>
                <div className="flex flex-col gap-1.5">
                  <p className="text-xs font-medium text-slate-400 leading-relaxed px-2">
                    Seu vídeo aparecerá aqui após a renderização.
                  </p>
                  <p className="text-[10px] font-bold text-cyan-500/80 tracking-wider">
                    FORMATO REELS (9:16)
                  </p>
                </div>
              </div>
            )}

            {/* ESTADO 2: Loading (Skeleton Shimmer) */}
            {videoState === 'loading' && (
              <div className="w-full h-full p-4 flex flex-col justify-between relative z-20">
                {/* Placeholder para o notch da tela de carregamento */}
                <div className="h-6" />

                {/* Spinner centralizado */}
                <div className="flex flex-col items-center justify-center gap-4 flex-1">
                  <div className="relative flex items-center justify-center">
                    <Loader2 className="h-10 w-10 text-cyan-400 animate-spin" />
                    <span className="absolute text-[9px] font-bold text-cyan-400">{loadingProgress}%</span>
                  </div>
                  <span className="text-[11px] font-bold text-white tracking-widest uppercase animate-pulse">
                    Renderizando
                  </span>
                </div>

                {/* Shimmer layout and live updates logs */}
                <div className="flex flex-col gap-2.5 bg-[#030712]/85 border border-[#1e293b]/40 rounded-xl p-3.5 shadow-lg backdrop-blur-sm">
                  {/* Faux progress bar */}
                  <div className="w-full h-1.5 rounded-full bg-slate-900 overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-blue-500 to-cyan-400 transition-all duration-200"
                      style={{ width: `${loadingProgress}%` }}
                    />
                  </div>

                  {/* Logs */}
                  <div className="flex flex-col gap-1">
                    <span className="text-[9px] text-slate-500 font-bold uppercase tracking-wider">
                      Status de Renderização
                    </span>
                    <span className="text-[10px] text-cyan-400 font-semibold line-clamp-1 transition-all duration-200">
                      {loadingLog}
                    </span>
                  </div>
                </div>
              </div>
            )}

            {/* ESTADO 3: Ready (Video Player with synced captions) */}
            {videoState === 'ready' && (
              <div className="w-full h-full relative z-20 group/player flex flex-col justify-end">
                {/* Mode 1: Static Video Player */}
                {!isDynamicMode && (
                  <video
                    ref={videoRef}
                    onTimeUpdate={handleTimeUpdate}
                    onLoadedMetadata={handleLoadedMetadata}
                    onClick={togglePlay}
                    loop
                    playsInline
                    src={videoUrl || "https://media.w3.org/2010/05/sintel/trailer_hd.mp4"}
                    className="absolute inset-0 w-full h-full object-cover cursor-pointer bg-black"
                  />
                )}

                {/* Mode 2: Dynamic Frontend Composition Player */}
                {isDynamicMode && (
                  <>
                    {/* Audio timing master */}
                    <audio
                      ref={audioRef}
                      src={audioUrl}
                      preload="auto"
                      onTimeUpdate={handleTimeUpdate}
                      onLoadedMetadata={handleLoadedMetadata}
                      onEnded={handleAudioEnded}
                      loop={false}
                    />

                    {/* Preloaded video B-rolls layers */}
                    {videoUrls.map((url, idx) => {
                      const isActive = idx === activeVideoIndex;
                      
                      // Detecta se o link veio como objeto ou string pura do banco
                      const videoSrc = typeof url === 'object' && url !== null 
                        ? (String((url as unknown as Record<string, unknown>).url || (url as unknown as Record<string, unknown>).link || '')) 
                        : String(url);

                      // Se por algum motivo o link ainda estiver vazio, não renderiza a tag para não quebrar o player
                      if (!videoSrc) return null;

                      return (
                        <video
                          key={`${videoSrc}-${idx}`}
                          ref={el => {
                            videoRefs.current[idx] = el;
                          }}
                          src={videoSrc}
                          onClick={togglePlay}
                          preload="auto"
                          onError={() => handleVideoError(idx)}
                          className={`absolute inset-0 w-full h-full object-cover cursor-pointer bg-black transition-opacity duration-700 ${isActive ? 'opacity-100 z-10' : 'opacity-0 z-0 pointer-events-none'
                            }`}
                          muted
                          playsInline
                          loop
                        />
                      );
                    })}
                  </>
                )}

                {/* Subtitle Overlay (Strictly styled like Reels, centered black box with bold text) */}
                <div className="absolute inset-x-3 bottom-24 flex items-center justify-center z-30 pointer-events-none">
                  {currentSubtitle && (
                    <div className="bg-black/80 border border-white/10 px-3 py-2 rounded-lg text-center max-w-[90%] shadow-2xl backdrop-blur-xs transition-all duration-150 transform scale-100">
                      <p className="font-display font-black text-xs md:text-sm text-cyan-400 tracking-wider uppercase leading-tight drop-shadow-[0_2px_4px_rgba(0,0,0,0.5)]">
                        {currentSubtitle}
                      </p>
                    </div>
                  )}
                </div>

                {/* Video Custom Controller Bar */}
                <div className="relative z-30 flex flex-col gap-2 p-3 bg-gradient-to-t from-black/95 via-black/70 to-transparent pt-12 opacity-100 lg:opacity-0 group-hover/player:opacity-100 transition-all duration-300">

                  {/* Synced Timeline Progress Bar */}
                  <div className="relative w-full h-1 bg-white/20 rounded-full overflow-hidden cursor-pointer">
                    <div
                      className="absolute left-0 top-0 h-full bg-cyan-400"
                      style={{ width: `${totalDuration ? (currentTime / totalDuration) * 100 : 0}%` }}
                    />
                  </div>

                  <div className="flex items-center justify-between gap-2 text-white">
                    {/* Controles de Play/Time */}
                    <div className="flex items-center gap-2">
                      <button
                        onClick={togglePlay}
                        className="p-1 hover:bg-white/10 rounded-md transition-colors"
                      >
                        {isPlaying ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}
                      </button>

                      {/* Time ticker */}
                      <span className="text-[9px] font-semibold text-slate-300">
                        {Math.floor(currentTime / 60)}:
                        {String(Math.floor(currentTime % 60)).padStart(2, '0')} / {Math.floor(totalDuration / 60)}:
                        {String(Math.floor(totalDuration % 60)).padStart(2, '0')}
                      </span>
                    </div>

                    {/* Controles de Áudio/Tamanho */}
                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={toggleMute}
                        className="p-1 hover:bg-white/10 rounded-md transition-colors"
                      >
                        {isMuted ? <VolumeX className="h-3.5 w-3.5" /> : <Volume2 className="h-3.5 w-3.5" />}
                      </button>
                      <button
                        onClick={handleFullscreen}
                        className="p-1 hover:bg-white/10 rounded-md transition-colors"
                      >
                        <Maximize2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>

                </div>

                {/* Status indicator pill top left of video */}
                <div className="absolute top-6 left-3.5 z-30 flex items-center gap-1 bg-black/60 border border-emerald-500/30 text-emerald-400 rounded-full px-2 py-0.5 text-[9px] font-bold tracking-wide backdrop-blur-xs">
                  <CheckCircle2 className="h-3 w-3" />
                  <span>PRONTO</span>
                </div>

              </div>
            )}

            {/* Faux notch outline on screen top */}
            <div className="absolute top-2 w-16 h-1 bg-slate-900 rounded-full z-40 pointer-events-none" />

          </div>

          {/* Rodapé descritivo */}
          <div className="mt-4 text-center">
            <p className="text-slate-500 text-xs font-semibold max-w-[260px] leading-relaxed">
              Seu vídeo aparecerá aqui após a renderização.
              <span className="block text-[10px] text-slate-600 font-medium mt-1">
                Formato otimizado para Reels (9:16).
              </span>
            </p>
          </div>

        </div>

      </section>

      {/* 4.3. Atalho Inferior de Histórico (Full Width) */}
      <section className="col-span-12 mt-4">
        <div className="bg-[#0b1329]/20 backdrop-blur-md border border-[#1e293b]/40 rounded-2xl p-6 flex flex-col sm:flex-row items-center justify-between gap-4 shadow-lg hover:border-slate-800 transition-all duration-300">

          <div className="flex items-center gap-4">
            <div className="h-10 w-10 rounded-xl bg-slate-900/60 border border-[#1e293b]/50 flex items-center justify-center text-slate-400 shrink-0 shadow-inner">
              <Clock className="h-5 w-5 text-cyan-400" />
            </div>
            <div className="flex flex-col gap-0.5">
              <h3 className="font-display text-sm font-bold text-white tracking-tight">
                Histórico de vídeos
              </h3>
              <p className="text-slate-400 text-xs font-medium leading-relaxed">
                Acesse e gerencie todos os seus vídeos já criados.
              </p>
            </div>
          </div>

          <button className="w-full sm:w-auto flex items-center justify-center gap-1.5 rounded-lg border border-[#1e293b]/60 bg-slate-900/30 hover:bg-slate-900/50 hover:border-[#1e293b] px-4 py-2 text-xs font-semibold text-slate-300 hover:text-white active:scale-95 transition-all duration-200">
            <span>Ver histórico</span>
            <ChevronRight className="h-3.5 w-3.5 text-slate-400" />
          </button>

        </div>
      </section>

    </div>
  );
}
