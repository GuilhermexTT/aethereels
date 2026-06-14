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
  const { credits, decrementCredits, videoState, setVideoState, activeTab, setActiveTab } = useDashboard();

  const [prompt, setPrompt] = useState('');
  const [blogUrl, setBlogUrl] = useState('');
  const [trendAudio, setTrendAudio] = useState('chill-synthwave');
  const [language, setLanguage] = useState<LanguageType>('pt');
  const [tone, setTone] = useState<ToneType>('envolvente');
  const [duration, setDuration] = useState<DurationType>('60s');

  const [loadingProgress, setLoadingProgress] = useState(0);
  const [loadingLog, setLoadingLog] = useState('');
  const [loadingStage, setLoadingStage] = useState(0);

  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [videoDuration, setVideoDuration] = useState(0);
  const [currentSubtitle, setCurrentSubtitle] = useState('');
  const [videoUrl, setVideoUrl] = useState('');

  const [audioUrl, setAudioUrl] = useState('');
  const [videoUrls, setVideoUrls] = useState<string[]>([]);
  const [isDynamicMode, setIsDynamicMode] = useState(false);
  const [scriptData, setScriptData] = useState<any>(null);

  console.log("DADOS DO SCRIPT_JSON ATUAL:", scriptData);

  const defaultSubtitles = [
    { start: 0, end: 2.5, text: 'DISCIPLINA' },
    { start: 2.5, end: 5.5, text: 'É FAZER HOJE' },
    { start: 5.5, end: 8.5, text: 'O QUE VOCÊ VAI' },
    { start: 8.5, end: 11.5, text: 'AGRADECER AMANHÃ.' }
  ];

  const fallbackVideos = ['https://media.w3.org/2010/05/sintel/trailer_hd.mp4'];
  const [subtitles, setSubtitles] = useState<any[]>(defaultSubtitles);

  const videoRef = useRef<HTMLVideoElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);
  const phoneContainerRef = useRef<HTMLDivElement>(null);
  const currentTimeRef = useRef(0);

  useEffect(() => {
    currentTimeRef.current = currentTime;
  }, [currentTime]);

  const subtitlesDuration = subtitles.length > 0 ? subtitles[subtitles.length - 1].end : 12;
  const totalDuration = (videoDuration && videoDuration > 2.0) ? videoDuration : (subtitlesDuration || 12);

  // Lógica reativa simplificada baseada no tempo do áudio master
  const getActiveVideoIndex = () => {
    if (videoUrls.length === 0) return 0;
    const activeSubIndex = subtitles.findIndex(sub => currentTime >= sub.start && currentTime <= sub.end);
    if (activeSubIndex !== -1) {
      return activeSubIndex % videoUrls.length;
    }
    const clipDuration = totalDuration / videoUrls.length;
    return Math.min(Math.max(0, Math.floor(currentTime / clipDuration)), videoUrls.length - 1);
  };

  const activeVideoIndex = isDynamicMode ? getActiveVideoIndex() : 0;

  const getActiveVideoSrc = () => {
    if (isDynamicMode && videoUrls.length > 0) {
      const url = videoUrls[activeVideoIndex];
      return typeof url === 'object' && url !== null ? String((url as any).url || (url as any).link || '') : String(url);
    }
    return videoUrl || "https://media.w3.org/2010/05/sintel/trailer_hd.mp4";
  };

  const activeVideoSrc = getActiveVideoSrc();

  // Loop de animação sincronizado exclusivamente com a tag de áudio master
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

      if (audio && !audio.paused && audio.currentTime > 0 && !audio.error) {
        nextTime = audio.currentTime;
      } else {
        nextTime = nextTime + delta;
      }

      if (nextTime >= totalDuration) {
        nextTime = 0;
        if (audio) {
          audio.currentTime = 0;
          audio.play().catch(e => console.log(e));
        }
      }

      currentTimeRef.current = nextTime;
      setCurrentTime(nextTime);

      const activeSub = subtitles.find(sub => nextTime >= sub.start && nextTime <= sub.end);
      setCurrentSubtitle(activeSub ? activeSub.text : '');

      animationFrameId = requestAnimationFrame(updateLoop);
    };

    animationFrameId = requestAnimationFrame(updateLoop);
    return () => cancelAnimationFrame(animationFrameId);
  }, [isPlaying, isDynamicMode, totalDuration, subtitles, videoUrls]);

  const handleTimeUpdate = (e: React.SyntheticEvent<HTMLMediaElement>) => {
    if (!isDynamicMode) {
      const time = e.currentTarget.currentTime;
      setCurrentTime(time);
      const activeSub = subtitles.find(sub => time >= sub.start && time <= sub.end);
      setCurrentSubtitle(activeSub ? activeSub.text : '');
    }
  };

  const handleLoadedMetadata = (e: React.SyntheticEvent<HTMLMediaElement>) => {
    setVideoDuration(e.currentTarget.duration);
  };

  const togglePlay = () => {
    const audio = audioRef.current;
    const video = videoRef.current;

    if (isDynamicMode && audio) {
      if (isPlaying) {
        audio.pause();
        if (video) video.pause();
        setIsPlaying(false);
      } else {
        audio.play().catch(e => console.log('Erro áudio:', e));
        if (video) video.play().catch(e => console.log('Erro vídeo:', e));
        setIsPlaying(true);
      }
    } else if (video) {
      if (isPlaying) {
        video.pause();
        setIsPlaying(false);
      } else {
        video.play().catch(e => console.log('Erro vídeo:', e));
        setIsPlaying(true);
      }
    }
  };

  const toggleMute = () => {
    if (isDynamicMode && audioRef.current) {
      audioRef.current.muted = !isMuted;
      setIsMuted(!isMuted);
    } else if (videoRef.current) {
      videoRef.current.muted = !isMuted;
      setIsMuted(!isMuted);
    }
  };

  const handleFullscreen = () => {
    if (phoneContainerRef.current?.requestFullscreen) {
      phoneContainerRef.current.style.transform = 'none'; // reset rotation/zoom if any
      phoneContainerRef.current.requestFullscreen();
    }
  };

  const handleGenerateAI = () => {
    if (activeTab === 'text-to-video') {
      setPrompt('Crie um reels cinemático sobre alta performance e constância. Foco na jornada do astronauta no espaço profundo.');
    }
  };

  const handleGenerateVideo = async () => {
    if (credits <= 0) return;
    if (activeTab === 'text-to-video' && !prompt.trim()) return;

    try {
      setVideoState('loading');
      setLoadingProgress(5);
      setLoadingLog('Conectando ao orquestrador...');

      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
      const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
      const supabase = createClient(supabaseUrl, supabaseAnonKey);

      const selectedLanguage = language === 'pt' ? 'Português' : language === 'en' ? 'Inglês' : 'Espanhol';
      const formattedPrompt = `${prompt.trim()} (Idioma: ${selectedLanguage}, Tom: ${tone}, Duração: ${duration})`;

      const { data: { session } } = await supabase.auth.getSession();
      const accessToken = session?.access_token;

      const response = await fetch('/api/video/generate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(accessToken ? { 'Authorization': `Bearer ${accessToken}` } : {})
        },
        body: JSON.stringify({ prompt_input: formattedPrompt }),
      });

      if (!response.ok) throw new Error('Falha ao solicitar geração.');
      const data = await response.json();
      const jobId = data.job_id;

      decrementCredits(1);
      setLoadingProgress(25);
      setLoadingLog('Processando roteiro e mídias...');

      const channel = supabase
        .channel(`job-progress-${jobId}`)
        .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'video_jobs', filter: `id=eq.${jobId}` }, (payload: any) => {
          const updatedJob = payload.new;

          if (updatedJob.status === 'ready') {
            setLoadingProgress(100);
            setLoadingLog('Pronto!');
            channel.unsubscribe();

            setTimeout(() => {
              let parsedScript: any = null;
              if (updatedJob.script_json) {
                parsedScript = typeof updatedJob.script_json === 'string' ? JSON.parse(updatedJob.script_json) : updatedJob.script_json;
              }

              if (parsedScript && (parsedScript.audio_url || parsedScript.video_urls)) {
                setScriptData(parsedScript);
                setIsDynamicMode(true);
                setAudioUrl(parsedScript.audio_url || '');
                setVideoUrls(parsedScript.video_urls || [updatedJob.video_url]);

                if (parsedScript.subtitles && parsedScript.subtitles.length > 0) {
                  const mapped = parsedScript.subtitles.map((sub: any) => ({
                    start: parseFloat(sub.start || sub.start_time || 0),
                    end: parseFloat(sub.end || sub.end_time || 3),
                    text: sub.text || sub.word || ''
                  }));
                  setSubtitles(mapped);
                }
              } else {
                setScriptData(null);
                setIsDynamicMode(false);
                setVideoUrl(updatedJob.video_url || '');
                setSubtitles(defaultSubtitles);
              }

              setVideoState('ready');
              setIsPlaying(false);
            }, 800);
          }
        })
        .subscribe();

    } catch (error: any) {
      setVideoState('idle');
      alert(error.message);
    }
  };

  return (
    <div className="grid grid-cols-12 gap-8 items-start">
      <section className="col-span-12 lg:col-span-8 flex flex-col gap-8">
        <div className="flex flex-col gap-2">
          <h1 className="font-display text-4xl font-extrabold text-white">Vamos criar seu próximo vídeo</h1>
        </div>

        <div className="bg-[#0b1329]/20 backdrop-blur-md border border-[#1e293b]/40 rounded-2xl p-8 flex flex-col gap-8 relative">
          <div className="grid grid-cols-3 rounded-xl bg-[#050b14] p-1 border border-[#1e293b]/30">
            <button onClick={() => setActiveTab('text-to-video')} className={`py-3 text-sm font-semibold rounded-lg ${activeTab === 'text-to-video' ? 'bg-slate-900/50 text-cyan-400 border-b border-cyan-400' : 'text-slate-400'}`}>Texto para Vídeo</button>
            <button disabled className="py-3 text-sm font-semibold text-slate-600 cursor-not-allowed">Link de Blog</button>
            <button disabled className="py-3 text-sm font-semibold text-slate-600 cursor-not-allowed">Áudio Trend</button>
          </div>

          <div className="relative rounded-xl border border-[#1e293b]/40 bg-[#050b14] p-4">
            <textarea value={prompt} onChange={(e) => setPrompt(e.target.value)} placeholder="Descreva sua ideia para o Reels..." className="w-full min-h-[160px] bg-transparent text-slate-100 text-sm outline-none resize-none" />
            <div className="flex items-center justify-between border-t border-[#1e293b]/20 pt-3 mt-2">
              <span className="text-[11px] text-slate-500">{prompt.length}/4000</span>
              <button onClick={handleGenerateAI} className="px-3 py-1.5 text-xs font-semibold bg-cyan-500/5 border border-cyan-500/20 text-cyan-400 rounded-lg hover:bg-cyan-500/10">Gerar com IA</button>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 border-t border-white/5 pt-6">
            <div className="flex flex-col gap-1.5">
              <span className="text-xs font-semibold text-slate-400">Idioma</span>
              <select value={language} onChange={(e) => setLanguage(e.target.value as LanguageType)} className="w-full bg-[#050b14] border border-[#1e293b]/40 rounded-xl px-4 py-3 text-sm text-slate-200 outline-none"><option value="pt">Português</option><option value="en">Inglês</option></select>
            </div>
            <div className="flex flex-col gap-1.5">
              <span className="text-xs font-semibold text-slate-400">Tom de voz</span>
              <select value={tone} onChange={(e) => setTone(e.target.value as ToneType)} className="w-full bg-[#050b14] border border-[#1e293b]/40 rounded-xl px-4 py-3 text-sm text-slate-200 outline-none"><option value="envolvente">Envolvente</option><option value="profissional">Profissional</option></select>
            </div>
            <div className="flex flex-col gap-1.5">
              <span className="text-xs font-semibold text-slate-400">Duração</span>
              <select value={duration} onChange={(e) => setDuration(e.target.value as DurationType)} className="w-full bg-[#050b14] border border-[#1e293b]/40 rounded-xl px-4 py-3 text-sm text-slate-200 outline-none"><option value="30s">30s</option><option value="60s">60s</option></select>
            </div>
          </div>

          <div className="border-t border-white/5 pt-6">
            <button onClick={handleGenerateVideo} disabled={videoState === 'loading'} className="w-full bg-gradient-to-r from-blue-600 to-cyan-400 py-4 rounded-xl font-bold text-white transition-all disabled:opacity-50">
              {videoState === 'loading' ? `Compilando... (${loadingProgress}%)` : 'Gerar Vídeo (1 crédito)'}
            </button>
          </div>
        </div>
      </section>

      <section className="col-span-12 lg:col-span-4 flex flex-col gap-6">
        <h2 className="text-lg font-bold text-white">Preview 9:16</h2>
        <div className="bg-[#0b1329]/20 backdrop-blur-md border border-[#1e293b]/40 rounded-3xl p-6 flex flex-col items-center justify-center min-h-[520px]">
          <div ref={phoneContainerRef} className="relative w-[250px] aspect-[9/16] rounded-[2.5rem] border-[6px] border-slate-800 bg-[#050b14] overflow-hidden shadow-2xl ring-1 ring-white/10 flex flex-col justify-end">
            
            {videoState === 'idle' && <div className="text-center p-4 text-xs text-slate-400">Seu vídeo aparecerá aqui após a renderização.</div>}
            
            {videoState === 'loading' && (
              <div className="w-full h-full flex flex-col justify-center items-center gap-2 p-4 text-center">
                <Loader2 className="h-8 w-8 text-cyan-400 animate-spin" />
                <span className="text-xs text-slate-200">{loadingLog}</span>
              </div>
            )}

            {videoState === 'ready' && (
              <div className="w-full h-full relative flex flex-col justify-end group/player">
                <video
                  ref={videoRef}
                  src={activeVideoSrc}
                  onTimeUpdate={handleTimeUpdate}
                  onLoadedMetadata={handleLoadedMetadata}
                  // ULTRA-SINCRONIZAÇÃO: Garante o Play imediato no milissegundo em que o arquivo de vídeo é trocado em tela
                  onLoadedData={() => { if (isDynamicMode && isPlaying && videoRef.current) videoRef.current.play().catch(() => {}); }}
                  onClick={togglePlay}
                  loop={!isDynamicMode}
                  playsInline
                  muted={isDynamicMode}
                  className="absolute inset-0 w-full h-full object-cover cursor-pointer bg-black"
                />

                {isDynamicMode && (
                  <audio ref={audioRef} src={audioUrl} onTimeUpdate={handleTimeUpdate} onLoadedMetadata={handleLoadedMetadata} onEnded={() => { setIsPlaying(false); setCurrentTime(0); }} />
                )}

                <div className="absolute inset-x-3 bottom-24 flex items-center justify-center z-30 pointer-events-none">
                  {currentSubtitle && (
                    <div className="bg-black/80 border border-white/10 px-3 py-2 rounded-lg text-center max-w-[95%]">
                      <p className="font-display font-black text-xs text-cyan-400 tracking-wider uppercase">{currentSubtitle}</p>
                    </div>
                  )}
                </div>

                <div className="relative z-30 flex flex-col gap-2 p-3 bg-gradient-to-t from-black via-black/40 to-transparent">
                  <div className="w-full h-1 bg-white/20 rounded-full overflow-hidden">
                    <div className="h-full bg-cyan-400" style={{ width: `${totalDuration ? (currentTime / totalDuration) * 100 : 0}%` }} />
                  </div>
                  <div className="flex items-center justify-between text-white text-[10px]">
                    <div className="flex items-center gap-2">
                      <button onClick={togglePlay}>{isPlaying ? <Pause className="h-3 w-3" /> : <Play className="h-3 w-3" />}</button>
                      <span>{Math.floor(currentTime)}s / {Math.floor(totalDuration)}s</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <button onClick={toggleMute}>{isMuted ? <VolumeX className="h-3 w-3" /> : <Volume2 className="h-3 w-3" />}</button>
                      <button onClick={handleFullscreen}><Maximize2 className="h-3 w-3" /></button>
                    </div>
                  </div>
                </div>

                <div className="absolute top-4 left-3 bg-black/6 border border-emerald-500 text-emerald-400 rounded-full px-2 py-0.5 text-[9px] font-bold">PRONTO</div>
              </div>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}
