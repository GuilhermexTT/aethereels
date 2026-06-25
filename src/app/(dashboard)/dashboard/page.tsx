'use client';

import React, { useState, useEffect, useRef, useLayoutEffect } from 'react';
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
  ChevronDown,
  Languages,
  Flame,
  Hourglass,
  Link2,
  Music,
  Type,
  Loader2,
  Download,
  X,
  TrendingUp,
  ShoppingBag,
  GraduationCap,
  Dumbbell,
  Mic,
  MicOff,
  Heart,
  MessageCircle,
  Share2,
  Video
} from 'lucide-react';
import { useDashboard } from '../../../context/DashboardContext';
import { TabType, LanguageType, ToneType, DurationType } from '../../../types/dashboard';
import { createClient } from '@supabase/supabase-js';
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
const supabase = createClient(supabaseUrl, supabaseAnonKey);

const parseConsultantResponse = (rawText: string) => {
  const marker = '{"script_ready"';
  const markerIndex = rawText.indexOf(marker);

  if (markerIndex === -1) {
    return {
      cleanText: rawText.trim(),
      recommendedPrompt: null
    };
  }

  // O JSON começa no markerIndex
  const jsonSubstring = rawText.substring(markerIndex);
  
  // Encontra o fechamento da chave '}'
  const endBraceIndex = jsonSubstring.lastIndexOf('}');
  
  let jsonString = jsonSubstring;
  if (endBraceIndex !== -1) {
    jsonString = jsonSubstring.substring(0, endBraceIndex + 1);
  }

  let recommendedPrompt: string | null = null;
  try {
    const parsed = JSON.parse(jsonString);
    if (parsed.script_ready && parsed.recommended_prompt) {
      recommendedPrompt = parsed.recommended_prompt;
    }
  } catch (e) {
    console.error('Falha ao fazer parse do JSON do prompt do consultor:', e);
    // Fallback de Regex caso o JSON esteja mal formatado
    const match = jsonString.match(/"recommended_prompt"\s*:\s*"([^"]+)"/);
    if (match) {
      recommendedPrompt = match[1];
    }
  }

  // Remove o bloco JSON do texto original
  const textBeforeJson = rawText.substring(0, markerIndex);
  
  // Limpeza agressiva do texto
  const cleanText = textBeforeJson
    .trim()
    .replace(/\n\s*\n/g, '\n')
    .trim();

  return {
    cleanText,
    recommendedPrompt
  };
};

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
  const [audioDuration, setAudioDuration] = useState(0);
  const [currentSubtitle, setCurrentSubtitle] = useState('');
  const [videoUrl, setVideoUrl] = useState('');

  const [audioUrl, setAudioUrl] = useState('');
  const [videoUrls, setVideoUrls] = useState<string[]>([]);
  const [isDynamicMode, setIsDynamicMode] = useState(false);
  const [scriptData, setScriptData] = useState<any>(null);

  const [isZoomed, setIsZoomed] = useState(false);
  const [zoomState, setZoomState] = useState<'idle' | 'zooming-in' | 'zoomed' | 'zooming-out'>('idle');
  const [transitionStyle, setTransitionStyle] = useState<React.CSSProperties>({});
  const sidebarWrapperRef = useRef<HTMLDivElement>(null);
  const modalPlaceholderRef = useRef<HTMLDivElement>(null);


  const [generationMode, setGenerationMode] = useState<'prompt' | 'consultant'>('prompt');
  const [chatMessages, setChatMessages] = useState<Array<{ id: string; sender: 'consultant' | 'user'; text: string }>>([
    {
      id: 'welcome',
      sender: 'consultant',
      text: '🤖 Consultor da Adisea: Olá! Sou o seu consultor estratégico privado. Vamos planejar o seu Reels de hoje usando o poder do Gemini 2.5? Me conte, qual é o seu nicho?'
    }
  ]);
  const [chatInput, setChatInput] = useState('');
  const [isConsultantLoading, setIsConsultantLoading] = useState(false);
  const [isSpeechSupported, setIsSpeechSupported] = useState(false);
  const [isPromptListening, setIsPromptListening] = useState(false);
  const [isChatListening, setIsChatListening] = useState(false);
  const promptRecognitionRef = useRef<any>(null);
  const chatRecognitionRef = useRef<any>(null);
  const [recommendedPrompt, setRecommendedPrompt] = useState<string | null>(null);
  const [chatId, setChatId] = useState('');
  const chatEndRef = useRef<HTMLDivElement>(null);

  const [isLangOpen, setIsLangOpen] = useState(false);
  const [isToneOpen, setIsToneOpen] = useState(false);
  const [isDurationOpen, setIsDurationOpen] = useState(false);

  const langRef = useRef<HTMLDivElement>(null);
  const toneRef = useRef<HTMLDivElement>(null);
  const durationRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (langRef.current && !langRef.current.contains(event.target as Node)) {
        setIsLangOpen(false);
      }
      if (toneRef.current && !toneRef.current.contains(event.target as Node)) {
        setIsToneOpen(false);
      }
      if (durationRef.current && !durationRef.current.contains(event.target as Node)) {
        setIsDurationOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    let id = localStorage.getItem('aether_chat_id');
    if (!id) {
      id = typeof crypto !== 'undefined' && crypto.randomUUID 
        ? crypto.randomUUID() 
        : `chat-${Math.random().toString(36).substring(2, 15)}-${Date.now()}`;
      localStorage.setItem('aether_chat_id', id);
    }
    setChatId(id);
  }, []);

  useEffect(() => {
    if (chatEndRef.current) {
      chatEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [chatMessages, isConsultantLoading]);

  useEffect(() => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (SpeechRecognition) {
      setIsSpeechSupported(true);
    }
    return () => {
      if (promptRecognitionRef.current) {
        promptRecognitionRef.current.stop();
      }
      if (chatRecognitionRef.current) {
        chatRecognitionRef.current.stop();
      }
    };
  }, []);

  const togglePromptListening = () => {
    if (isPromptListening) {
      promptRecognitionRef.current?.stop();
      setIsPromptListening(false);
      return;
    }

    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) return;

    if (isChatListening) {
      chatRecognitionRef.current?.stop();
      setIsChatListening(false);
    }

    const recognition = new SpeechRecognition();
    recognition.lang = 'pt-BR';
    recognition.interimResults = false;
    recognition.continuous = false;

    recognition.onstart = () => {
      setIsPromptListening(true);
    };

    recognition.onresult = (event: any) => {
      const resultText = event.results[0][0].transcript;
      if (resultText) {
        setPrompt(prev => {
          const base = prev.trim();
          return base ? `${base} ${resultText.trim()}` : resultText.trim();
        });
      }
    };

    recognition.onerror = (event: any) => {
      console.error('Prompt speech recognition error:', event.error);
      setIsPromptListening(false);
    };

    recognition.onend = () => {
      setIsPromptListening(false);
    };

    promptRecognitionRef.current = recognition;
    recognition.start();
  };

  const toggleChatListening = () => {
    if (isChatListening) {
      chatRecognitionRef.current?.stop();
      setIsChatListening(false);
      return;
    }

    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) return;

    if (isPromptListening) {
      promptRecognitionRef.current?.stop();
      setIsPromptListening(false);
    }

    const recognition = new SpeechRecognition();
    recognition.lang = 'pt-BR';
    recognition.interimResults = false;
    recognition.continuous = false;

    recognition.onstart = () => {
      setIsChatListening(true);
    };

    recognition.onresult = (event: any) => {
      const resultText = event.results[0][0].transcript;
      if (resultText) {
        setChatInput(prev => {
          const base = prev.trim();
          return base ? `${base} ${resultText.trim()}` : resultText.trim();
        });
      }
    };

    recognition.onerror = (event: any) => {
      console.error('Chat speech recognition error:', event.error);
      setIsChatListening(false);
    };

    recognition.onend = () => {
      setIsChatListening(false);
    };

    chatRecognitionRef.current = recognition;
    recognition.start();
  };

  const handleSendConsultantMessage = async () => {
    if (!chatInput.trim() || isConsultantLoading) return;

    const userText = chatInput.trim();
    const newMsgId = `user-${Date.now()}`;
    
    setChatMessages(prev => [...prev, { id: newMsgId, sender: 'user', text: userText }]);
    setChatInput('');
    setRecommendedPrompt(null);
    setIsConsultantLoading(true);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      const accessToken = session?.access_token;

      const currentChatId = chatId || `chat-${Math.random().toString(36).substring(2, 15)}-${Date.now()}`;
      const response = await fetch('/api/consultor', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(accessToken ? { 'Authorization': `Bearer ${accessToken}` } : {})
        },
        body: JSON.stringify({
          message: userText,
          chat_id: currentChatId
        })
      });

      if (!response.ok) {
        throw new Error('Falha ao receber resposta do consultor.');
      }

      const data = await response.json();
      const rawResponse = data.response || '';

      const { cleanText, recommendedPrompt: parsedPrompt } = parseConsultantResponse(rawResponse);

      setChatMessages(prev => [
        ...prev,
        { id: `consultant-${Date.now()}`, sender: 'consultant', text: cleanText || 'Roteiro e ideias processadas com sucesso!' }
      ]);

      if (parsedPrompt) {
        console.log('✨ Prompt estratégico recomendado recebido:', parsedPrompt);
        setRecommendedPrompt(parsedPrompt);
      }

    } catch (err: any) {
      console.error('Erro de comunicação com o consultor:', err);
      setChatMessages(prev => [
        ...prev,
        { id: `consultant-error-${Date.now()}`, sender: 'consultant', text: '🤖 Consultor da Adisea: Desculpe, encontrei uma falha de conexão ao me comunicar com o motor de inteligência artificial. Por favor, tente enviar a mensagem novamente.' }
      ]);
    } finally {
      setIsConsultantLoading(false);
    }
  };


  const handleTagClick = (tag: string) => {
    const prompts: Record<string, string> = {
      Marketing: "Crie um reels focado em marketing de atração e branding pessoal, com ganchos fortes para reter a atenção.",
      Produto: "Gere um reels demonstrando os benefícios de um produto de tecnologia premium, destacando design e utilidade no dia a dia.",
      Educação: "Escreva um roteiro educacional explicando um conceito complexo de inteligência artificial de forma super simples e visual.",
      Fitness: "Gere um vídeo motivacional de alta energia sobre foco, consistência nos treinos e superação de limites físicos.",
      Storytelling: "Crie uma narrativa inspiradora sobre superação na jornada empreendedora, focado em conexão emocional profunda."
    };
    if (prompts[tag]) {
      setPrompt(prompts[tag]);
    }
  };
  useEffect(() => {
    if (videoState === 'idle') {
      setVideoState('ready');
    }
  }, []);

  const handleZoomIn = () => {
    if (phoneContainerRef.current) {
      const rect = phoneContainerRef.current.getBoundingClientRect();
      setTransitionStyle({
        position: 'fixed',
        top: rect.top,
        left: rect.left,
        width: rect.width,
        height: rect.height,
        zIndex: 60,
        margin: 0,
        transition: 'none',
      });
      setIsZoomed(true);
      setZoomState('zooming-in');
    }
  };

  const handleZoomOut = () => {
    if (phoneContainerRef.current) {
      setZoomState('zooming-out');
      const targetRect = sidebarWrapperRef.current
        ? sidebarWrapperRef.current.getBoundingClientRect()
        : { top: 0, left: 0, width: 250, height: 444 };
      
      setTransitionStyle({
        position: 'fixed',
        top: targetRect.top,
        left: targetRect.left,
        width: targetRect.width,
        height: targetRect.height,
        zIndex: 60,
        margin: 0,
        transition: 'top 0.45s cubic-bezier(0.16, 1, 0.3, 1), left 0.45s cubic-bezier(0.16, 1, 0.3, 1), width 0.45s cubic-bezier(0.16, 1, 0.3, 1), height 0.45s cubic-bezier(0.16, 1, 0.3, 1)',
      });

      const timer = setTimeout(() => {
        setZoomState('idle');
        setIsZoomed(false);
        setTransitionStyle({});
      }, 450);

      return () => clearTimeout(timer);
    }
  };

  useLayoutEffect(() => {
    if (zoomState === 'zooming-in') {
      const placeholder = modalPlaceholderRef.current;
      const el = phoneContainerRef.current;
      if (placeholder && el) {
        const targetRect = placeholder.getBoundingClientRect();
        
        // Force reflow
        // eslint-disable-next-line @typescript-eslint/no-unused-expressions
        el.offsetHeight;

        setTransitionStyle({
          position: 'fixed',
          top: targetRect.top,
          left: targetRect.left,
          width: targetRect.width,
          height: targetRect.height,
          zIndex: 60,
          margin: 0,
          transition: 'top 0.45s cubic-bezier(0.16, 1, 0.3, 1), left 0.45s cubic-bezier(0.16, 1, 0.3, 1), width 0.45s cubic-bezier(0.16, 1, 0.3, 1), height 0.45s cubic-bezier(0.16, 1, 0.3, 1)',
        });

        const timer = setTimeout(() => {
          setZoomState('zoomed');
        }, 450);

        return () => clearTimeout(timer);
      }
    }
  }, [zoomState]);

  useEffect(() => {
    if (zoomState !== 'zoomed') return;
    const handleResize = () => {
      if (modalPlaceholderRef.current) {
        const rect = modalPlaceholderRef.current.getBoundingClientRect();
        setTransitionStyle({
          position: 'fixed',
          top: rect.top,
          left: rect.left,
          width: rect.width,
          height: rect.height,
          zIndex: 60,
          margin: 0,
          transition: 'none',
        });
      }
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [zoomState]);

  const [isDownloading, setIsDownloading] = useState(false);
  const [isRendering, setIsRendering] = useState(false);
  const [renderProgress, setRenderProgress] = useState(0);
  const [currentJobId, setCurrentJobId] = useState<string | null>(null);
  const [phoneTime, setPhoneTime] = useState('12:00');

  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      const hours = String(now.getHours()).padStart(2, '0');
      const minutes = String(now.getMinutes()).padStart(2, '0');
      setPhoneTime(`${hours}:${minutes}`);
    };
    updateTime();
    const interval = setInterval(updateTime, 60000);
    return () => clearInterval(interval);
  }, []);

  console.log("DADOS DO SCRIPT_JSON ATUAL:", scriptData);

  const defaultSubtitles = [
    { start: 0, end: 2.5, text: 'Disciplina' },
    { start: 2.5, end: 5.5, text: 'é fazer hoje' },
    { start: 5.5, end: 8.5, text: 'o que você vai' },
    { start: 8.5, end: 11.5, text: 'agradecer amanhã.' }
  ];

  const fallbackVideos = ['https://media.w3.org/2010/05/sintel/trailer_hd.mp4'];
  const [subtitles, setSubtitles] = useState<any[]>(defaultSubtitles);

  const videoRef = useRef<HTMLVideoElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);
  const videoRefs = useRef<(HTMLVideoElement | null)[]>([]);
  const phoneContainerRef = useRef<HTMLDivElement>(null);
  const currentTimeRef = useRef(0);
  const prevActiveVideoIndexRef = useRef<number>(0);

  const [phoneWidth, setPhoneWidth] = useState(250);

  useEffect(() => {
    const updateWidth = () => {
      if (phoneContainerRef.current) {
        setPhoneWidth(phoneContainerRef.current.offsetWidth);
      }
    };
    updateWidth();
    const timer = setTimeout(updateWidth, 500);
    window.addEventListener('resize', updateWidth);
    return () => {
      window.removeEventListener('resize', updateWidth);
      clearTimeout(timer);
    };
  }, [isZoomed, zoomState]);

  useEffect(() => {
    currentTimeRef.current = currentTime;
  }, [currentTime]);

  const subtitlesDuration = subtitles.length > 0 ? subtitles[subtitles.length - 1].end : 12;
  const totalDuration = isDynamicMode
    ? (audioDuration && audioDuration > 2.0 ? audioDuration : subtitlesDuration)
    : (videoDuration && videoDuration > 2.0 ? videoDuration : subtitlesDuration);

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

  // Control playing/pausing of B-roll videos based on activeVideoIndex and isPlaying
  useEffect(() => {
    if (!isDynamicMode) return;
    
    const prevActiveIndex = prevActiveVideoIndexRef.current;
    prevActiveVideoIndexRef.current = activeVideoIndex;
    
    for (let i = 0; i < videoUrls.length; i++) {
      const video = videoRefs.current[i];
      if (video) {
        if (i === activeVideoIndex) {
          if (isPlaying) {
            // Só reinicia o tempo se for uma transição de cena (troca de índice do clipe)
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
  }, [activeVideoIndex, isPlaying, isDynamicMode, videoUrls.length]);

  const handleTimeUpdate = (e: React.SyntheticEvent<HTMLMediaElement>) => {
    const time = e.currentTarget.currentTime;
    setCurrentTime(time);
    const activeSub = subtitles.find(sub => time >= sub.start && time <= sub.end);
    setCurrentSubtitle(activeSub ? activeSub.text : '');
  };

  const handleVideoLoadedMetadata = (e: React.SyntheticEvent<HTMLVideoElement>) => {
    setVideoDuration(e.currentTarget.duration);
  };

  const handleAudioLoadedMetadata = (e: React.SyntheticEvent<HTMLAudioElement>) => {
    setAudioDuration(e.currentTarget.duration);
  };

  const togglePlay = () => {
    const audio = audioRef.current;

    if (isDynamicMode && audio) {
      const activeVideo = videoRefs.current[activeVideoIndex];
      if (isPlaying) {
        audio.pause();
        if (activeVideo) activeVideo.pause();
        setIsPlaying(false);
      } else {
        audio.play().catch(e => console.log('Erro áudio:', e));
        if (activeVideo) activeVideo.play().catch(e => console.log('Erro vídeo:', e));
        setIsPlaying(true);
      }
    } else {
      const video = videoRef.current;
      if (video) {
        if (isPlaying) {
          video.pause();
          setIsPlaying(false);
        } else {
          video.play().catch(e => console.log('Erro vídeo:', e));
          setIsPlaying(true);
        }
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

  const handleDownload = async () => {
    if (!currentJobId) {
      alert('Nenhum job de vídeo gerado para renderização.');
      return;
    }
    setIsRendering(true);
    setRenderProgress(0);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const accessToken = session?.access_token;

      // 1. Disparar a Renderização na AWS Lambda chamando nossa Rota 1
      const response = await fetch('/api/video/render', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(accessToken ? { 'Authorization': `Bearer ${accessToken}` } : {})
        },
        body: JSON.stringify({
          compositionId: 'Reels',
          inputProps: {
            audio_url: audioUrl,
            video_urls: videoUrls,
            subtitles: subtitles
          }
        }),
      });

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData.error || 'Falha ao solicitar renderização do vídeo.');
      }

      const data = await response.json();
      if (!data.success) {
        throw new Error(data.error || 'Erro interno ao iniciar renderização.');
      }

      const { renderId, bucketName } = data;

      // Atualizar o status do job para 'rendering' no banco local
      await supabase
        .from('video_jobs')
        .update({ status: 'rendering' })
        .eq('id', currentJobId);

      // 2. Monitorizar o Progresso chamando nossa Rota 2 (Polling a cada 3s)
      const pollInterval = setInterval(async () => {
        try {
          const progressRes = await fetch(`/api/video/render/progress?renderId=${renderId}&bucketName=${bucketName}`, {
            headers: {
              ...(accessToken ? { 'Authorization': `Bearer ${accessToken}` } : {})
            }
          });
          
          if (!progressRes.ok) return;

          const progressData = await progressRes.json();

          if (progressData.status === 'done') {
            clearInterval(pollInterval);
            setIsRendering(false);
            setRenderProgress(100);

            const finalVideoUrl = progressData.videoUrl;
            setVideoUrl(finalVideoUrl);
            setIsDynamicMode(false); // Switch the player to the static compiled MP4!

            // Atualizar banco local com o link do vídeo finalizado
            await supabase
              .from('video_jobs')
              .update({ status: 'ready', video_url: finalVideoUrl })
              .eq('id', currentJobId);

            // Tentar download direto no navegador via Blob (funciona com CORS correto)
            try {
              const fileResponse = await fetch(finalVideoUrl);
              const blob = await fileResponse.blob();
              const blobUrl = URL.createObjectURL(blob);
              const a = document.createElement('a');
              a.href = blobUrl;
              a.download = `video-hd-${Date.now()}.mp4`;
              document.body.appendChild(a);
              a.click();
              document.body.removeChild(a);
              URL.revokeObjectURL(blobUrl);
              alert("Vídeo baixado com sucesso!");
            } catch (downloadErr) {
              console.error('Erro ao baixar arquivo renderizado:', downloadErr);
              // Se falhar o download direto (ex. CORS restrito), avisa o usuário para clicar de novo no botão (que agora vai abrir a URL no _blank de forma síncrona, evitando o bloqueador do navegador)
              alert("Vídeo renderizado com sucesso! Clique no botão 'Baixar MP4' novamente para abrir e salvar o vídeo.");
            }

          } else if (progressData.status === 'error') {
            clearInterval(pollInterval);
            setIsRendering(false);
            alert(`A renderização em alta definição falhou: ${progressData.error}`);
            
            await supabase
              .from('video_jobs')
              .update({ status: 'failed' })
              .eq('id', currentJobId);

          } else if (progressData.status === 'rendering') {
            setRenderProgress(progressData.progress || 0);
          }
        } catch (pollErr) {
          console.error('Erro ao consultar progresso de renderização:', pollErr);
        }
      }, 3000);

    } catch (error: any) {
      console.error('Erro ao renderizar/baixar vídeo:', error);
      setIsRendering(false);
      alert(error.message);
    }
  };

  const handleGenerateAI = () => {
    if (activeTab === 'text-to-video') {
      setPrompt('Crie um reels cinemático sobre alta performance e constância. Foco na jornada do astronauta no espaço profundo.');
    }
  };

  const handleGenerateVideo = async () => {
    if (credits <= 0) return;
    const activePrompt = generationMode === 'consultant' ? recommendedPrompt : prompt;
    if (!activePrompt || !activePrompt.trim()) return;

    try {
      setVideoState('loading');
      setLoadingProgress(5);
      setLoadingLog('Conectando ao orquestrador...');

      const selectedLanguage = language === 'pt' ? 'Português' : language === 'en' ? 'Inglês' : 'Espanhol';
      const formattedPrompt = `${activePrompt.trim()} (Idioma: ${selectedLanguage}, Tom: ${tone}, Duração: ${duration})`;

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
      setCurrentJobId(jobId);

      decrementCredits(1);
      setLoadingProgress(25);
      setLoadingLog('Processando roteiro e mídias...');

      const channel = supabase
        .channel(`job-progress-${jobId}`)
        .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'video_jobs', filter: `id=eq.${jobId}` }, (payload: any) => {
          const updatedJob = payload.new;
          console.log("🔄 [Realtime Event] Job atualizado no banco:", updatedJob);

          if (updatedJob.status === 'ready' || updatedJob.status === 'draft') {
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
                setVideoUrl(updatedJob.video_url || '');

                if (parsedScript.subtitles && parsedScript.subtitles.length > 0) {
                  let currentStart = 0;
                  const mapped = parsedScript.subtitles.map((sub: any) => {
                    const start = sub.start !== undefined 
                      ? parseFloat(sub.start) 
                      : (sub.start_time !== undefined ? parseFloat(sub.start_time) : currentStart);
                    const end = sub.end !== undefined 
                      ? parseFloat(sub.end) 
                      : (sub.end_time !== undefined ? parseFloat(sub.end_time) : (start + (parseFloat(sub.duration) || 3)));
                    currentStart = end;
                    return {
                      start,
                      end,
                      text: sub.text || sub.word || ''
                    };
                  });
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
    <div className="grid grid-cols-12 gap-8 items-start max-w-7xl mx-auto">
      {/* Coluna da Esquerda: Criador */}
      <section className="col-span-12 lg:col-span-8 flex flex-col gap-4">
        {/* Badge superior */}
        <div className="flex">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#0a1122]/80 border border-[#1e2d4a]/50 text-[10px] text-cyan-400 font-semibold select-none shadow-sm shadow-cyan-500/5">
            <Sparkles className="h-3 w-3 text-cyan-400" />
            <span>IA que entende sua ideia e cria vídeos incríveis</span>
          </div>
        </div>

        {/* Switcher de Modos: Neon Pills Tabs */}
        <div className="flex mt-2 select-none">
          <div className="flex p-1 rounded-full bg-[#060a13] border border-[#15233c]/60 shadow-[0_0_15px_rgba(59,130,246,0.05)]">
            <button
              onClick={() => setGenerationMode('prompt')}
              className={`flex items-center gap-1.5 px-4 py-1.5 rounded-full text-xs font-bold transition-all duration-300 ${
                generationMode === 'prompt'
                  ? 'bg-gradient-to-r from-blue-500/10 to-indigo-500/10 text-cyan-400 border border-cyan-500/30 shadow-[0_0_10px_rgba(34,211,238,0.2)]'
                  : 'text-slate-400 hover:text-slate-200 border border-transparent'
              }`}
            >
              <span>✨</span>
              <span>Prompt Direto</span>
            </button>
            <button
              onClick={() => setGenerationMode('consultant')}
              className={`flex items-center gap-1.5 px-4 py-1.5 rounded-full text-xs font-bold transition-all duration-300 ${
                generationMode === 'consultant'
                  ? 'bg-gradient-to-r from-indigo-500/10 to-purple-500/10 text-indigo-400 border border-indigo-500/30 shadow-[0_0_10px_rgba(99,102,241,0.2)]'
                  : 'text-slate-400 hover:text-slate-200 border border-transparent'
              }`}
            >
              <span>🤖</span>
              <span>Consultor de Conteúdo</span>
            </button>
          </div>
        </div>

        {/* Heading principal */}
        <div className="flex flex-col">
          <h1 className="font-display text-2xl sm:text-3xl font-extrabold text-white leading-tight">
            O que você quer transformar em <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 via-cyan-400 to-indigo-400">vídeo?</span>
          </h1>
        </div>

        {/* Container Principal do Formulário */}
        <div className="flex flex-col gap-4">
          {generationMode === 'prompt' ? (
            <div className="relative rounded-2xl border border-blue-500/80 shadow-[0_0_20px_rgba(59,130,246,0.12)] bg-[#060a13] p-3.5 transition-all duration-300">
              {/* Caixa de Texto do Prompt */}
              <textarea 
                value={prompt} 
                onChange={(e) => setPrompt(e.target.value)} 
                placeholder="Descreva sua ideia aqui..." 
                className="w-full min-h-[96px] bg-transparent text-slate-100 placeholder-slate-500 text-sm outline-none resize-none leading-relaxed" 
              />
              <div className="flex items-center justify-between border-t border-slate-900/40 pt-2.5 mt-1.5 select-none">
                {prompt.trim().length === 0 ? (
                  <span className="text-[10px] text-amber-500 font-bold tracking-wide">⚠️ Digite sua ideia para gerar o vídeo</span>
                ) : (
                  <span className="text-[11px] text-slate-500 font-semibold">{prompt.length}/4000</span>
                )}
                <div className="flex items-center gap-2">
                  {isSpeechSupported && (
                    <button
                      type="button"
                      onClick={togglePromptListening}
                      className={`h-8 w-8 flex items-center justify-center rounded-full transition-all duration-300 ${
                        isPromptListening
                          ? 'bg-red-500 animate-pulse text-white shadow-lg shadow-red-500/20'
                          : 'bg-[#15233c] text-slate-400 hover:text-white hover:bg-slate-800'
                      }`}
                      title={isPromptListening ? "Parar gravação" : "Gravar áudio"}
                    >
                      {isPromptListening ? <MicOff className="h-3.5 w-3.5" /> : <Mic className="h-3.5 w-3.5" />}
                    </button>
                  )}
                  <button 
                    onClick={handleGenerateVideo} 
                    disabled={videoState === 'loading' || !prompt.trim()} 
                    className="h-8 w-8 flex items-center justify-center rounded-full bg-gradient-to-br from-[#4f46e5] to-[#7c3aed] text-white hover:opacity-95 active:scale-95 transition-all shadow-md shadow-indigo-600/10 disabled:opacity-30 disabled:cursor-not-allowed"
                    title="Enviar Prompt"
                  >
                    <Send className="h-3.5 w-3.5 rotate-270 text-white" />
                  </button>
                </div>
              </div>
            </div>
          ) : (
            /* Interface do Consultor de Conteúdo */
            <div className="flex flex-col rounded-2xl border border-indigo-500/50 shadow-[0_0_20px_rgba(99,102,241,0.12)] bg-[#060a13] p-4 transition-all duration-300 h-[380px] justify-between">
              {/* Mensagens do Chat */}
              <div className="flex-1 overflow-y-auto pr-1 flex flex-col gap-3 scrollbar-thin scrollbar-thumb-indigo-500/20 scrollbar-track-transparent">
                {chatMessages.map((msg) => (
                  <div
                    key={msg.id}
                    className={`flex flex-col max-w-[80%] ${
                      msg.sender === 'user' ? 'self-end' : 'self-start'
                    }`}
                  >
                    <div
                      className={`px-4 py-2.5 rounded-2xl text-sm leading-relaxed ${
                        msg.sender === 'user'
                          ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-tr-none shadow-md shadow-indigo-600/10'
                          : 'bg-[#0c1426] border border-[#1e2d4a]/50 text-slate-100 rounded-tl-none'
                      }`}
                    >
                      <p className="whitespace-pre-wrap">{msg.text}</p>
                    </div>
                  </div>
                ))}
                {isConsultantLoading && (
                  <div className="self-start flex items-center gap-2 text-xs text-indigo-400 font-medium italic animate-pulse py-1">
                    <Loader2 className="h-3 w-3 animate-spin text-indigo-400" />
                    <span>🤖 Consultor está digitando...</span>
                  </div>
                )}
                <div ref={chatEndRef} />
              </div>

              {/* Input do Chat */}
              <div className="flex items-center gap-2 border-t border-slate-900/40 pt-3 mt-3 select-none">
                <input
                  type="text"
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      handleSendConsultantMessage();
                    }
                  }}
                  placeholder="Responda ao consultor..."
                  className="flex-1 bg-transparent text-slate-100 placeholder-slate-500 text-sm outline-none"
                  disabled={isConsultantLoading}
                />
                {isSpeechSupported && (
                  <button
                    type="button"
                    onClick={toggleChatListening}
                    disabled={isConsultantLoading}
                    className={`h-8 w-8 flex items-center justify-center rounded-full transition-all duration-300 ${
                      isChatListening
                        ? 'bg-red-500 animate-pulse text-white shadow-lg shadow-red-500/20'
                        : 'bg-[#15233c] text-slate-400 hover:text-white hover:bg-slate-800 disabled:opacity-30'
                    }`}
                    title={isChatListening ? "Parar gravação" : "Gravar áudio"}
                  >
                    {isChatListening ? <MicOff className="h-3.5 w-3.5" /> : <Mic className="h-3.5 w-3.5" />}
                  </button>
                )}
                <button
                  onClick={handleSendConsultantMessage}
                  disabled={isConsultantLoading || !chatInput.trim()}
                  className="h-8 w-8 flex items-center justify-center rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 text-white hover:opacity-95 active:scale-95 transition-all shadow-md shadow-indigo-600/10 disabled:opacity-30 disabled:cursor-not-allowed"
                  title="Enviar mensagem"
                >
                  <Send className="h-3.5 w-3.5 text-white" />
                </button>
              </div>
            </div>
          )}

          {/* Seção de Ideias Populares */}
          <div className="flex flex-col gap-1.5 select-none">
            <span className="text-[10px] text-slate-500 font-extrabold uppercase tracking-wider">Ideias populares</span>
            <div className="flex items-center gap-2 w-full overflow-x-auto pb-1 scrollbar-none">
              {[
                { label: 'Marketing', icon: TrendingUp },
                { label: 'Produto', icon: ShoppingBag },
                { label: 'Educação', icon: GraduationCap },
                { label: 'Fitness', icon: Dumbbell },
                { label: 'Storytelling', icon: Mic }
              ].map((tag) => {
                const Icon = tag.icon;
                return (
                  <button
                    key={tag.label}
                    onClick={() => handleTagClick(tag.label)}
                    className="flex items-center gap-2 px-3 py-1.5 bg-[#060a13] border border-[#15233c]/60 hover:border-blue-500/40 rounded-full text-xs font-semibold text-slate-300 transition-all hover:text-white hover:bg-slate-900/30 whitespace-nowrap"
                  >
                    <Icon className="h-3.5 w-3.5 text-slate-400 group-hover:text-white" />
                    <span>{tag.label}</span>
                  </button>
                );
              })}
              <button className="h-7.5 w-7.5 shrink-0 flex items-center justify-center rounded-full border border-[#15233c]/60 bg-[#060a13] text-slate-400 hover:text-white transition-all hover:border-blue-500/40">
                <ChevronRight className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>

          {/* Opções Avançadas da IA */}
          <div className="grid grid-cols-3 gap-3.5 bg-[#040812]/50 border border-[#16223f]/50 rounded-2xl p-3.5 select-none">
            {/* Idioma */}
            <div ref={langRef} className="flex flex-col gap-1.5 relative">
              <label className="text-[10px] text-slate-500 font-bold uppercase tracking-wider flex items-center gap-1">
                Idioma
                <span className="group relative inline-block cursor-help text-slate-555" aria-label="Ajuda sobre Idioma">
                  <span className="text-[9px] bg-slate-950 border border-slate-800/80 rounded-full h-3.5 w-3.5 flex items-center justify-center">?</span>
                  <span className="pointer-events-none absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-44 rounded-xl bg-slate-950 border border-[#16223f]/80 p-2.5 text-[9px] text-slate-350 font-medium leading-normal opacity-0 group-hover:opacity-100 transition-opacity duration-200 z-50 text-left shadow-2xl">
                    O idioma no qual a inteligência artificial criará o roteiro e narrará a voz do vídeo.
                  </span>
                </span>
              </label>
              <button
                type="button"
                onClick={() => setIsLangOpen(!isLangOpen)}
                className="w-full bg-slate-950/60 border border-[#16223f]/40 hover:border-slate-800 rounded-xl px-2.5 py-2 text-xs font-semibold text-slate-200 outline-none transition-colors cursor-pointer flex items-center justify-between"
              >
                <span>
                  {language === 'pt' ? '🇧🇷 Português' : language === 'en' ? '🇺🇸 Inglês' : '🇪🇸 Espanhol'}
                </span>
                <ChevronDown className={`h-3 w-3 text-slate-400 transition-transform duration-200 ${isLangOpen ? 'rotate-180' : ''}`} />
              </button>

              {isLangOpen && (
                <div className="absolute top-[calc(100%+4px)] left-0 w-full bg-slate-950 border border-[#16223f] rounded-xl overflow-hidden shadow-2xl z-50 py-1">
                  {[
                    { value: 'pt', label: '🇧🇷 Português' },
                    { value: 'en', label: '🇺🇸 Inglês' },
                    { value: 'es', label: '🇪🇸 Espanhol' }
                  ].map((opt) => (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => {
                        setLanguage(opt.value as LanguageType);
                        setIsLangOpen(false);
                      }}
                      className={`w-full text-left px-3 py-2 text-xs font-semibold transition-colors cursor-pointer flex items-center justify-between ${
                        language === opt.value
                          ? 'bg-indigo-600/20 text-cyan-400'
                          : 'text-slate-300 hover:bg-slate-900/60 hover:text-white'
                      }`}
                    >
                      <span>{opt.label}</span>
                      {language === opt.value && <span className="text-[10px] text-cyan-400">●</span>}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Tom de voz */}
            <div ref={toneRef} className="flex flex-col gap-1.5 relative">
              <label className="text-[10px] text-slate-500 font-bold uppercase tracking-wider flex items-center gap-1">
                Tom de voz
                <span className="group relative inline-block cursor-help text-slate-555" aria-label="Ajuda sobre Tom de voz">
                  <span className="text-[9px] bg-slate-950 border border-slate-800/80 rounded-full h-3.5 w-3.5 flex items-center justify-center">?</span>
                  <span className="pointer-events-none absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-44 rounded-xl bg-slate-950 border border-[#16223f]/80 p-2.5 text-[9px] text-slate-350 font-medium leading-normal opacity-0 group-hover:opacity-100 transition-opacity duration-200 z-50 text-left shadow-2xl">
                    Adapta a atitude e entonação da voz gerada (ex: enérgico, calmo, vendedor).
                  </span>
                </span>
              </label>
              <button
                type="button"
                onClick={() => setIsToneOpen(!isToneOpen)}
                className="w-full bg-slate-950/60 border border-[#16223f]/40 hover:border-slate-800 rounded-xl px-2.5 py-2 text-xs font-semibold text-slate-200 outline-none transition-colors cursor-pointer flex items-center justify-between"
              >
                <span className="capitalize">{tone}</span>
                <ChevronDown className={`h-3 w-3 text-slate-400 transition-transform duration-200 ${isToneOpen ? 'rotate-180' : ''}`} />
              </button>

              {isToneOpen && (
                <div className="absolute top-[calc(100%+4px)] left-0 w-full bg-slate-950 border border-[#16223f] rounded-xl overflow-hidden shadow-2xl z-50 py-1">
                  {[
                    { value: 'envolvente', label: 'Envolvente' },
                    { value: 'profissional', label: 'Profissional' },
                    { value: 'humorado', label: 'Humorado' },
                    { value: 'urgente', label: 'Urgente' }
                  ].map((opt) => (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => {
                        setTone(opt.value as ToneType);
                        setIsToneOpen(false);
                      }}
                      className={`w-full text-left px-3 py-2 text-xs font-semibold transition-colors cursor-pointer flex items-center justify-between ${
                        tone === opt.value
                          ? 'bg-indigo-600/20 text-cyan-400'
                          : 'text-slate-300 hover:bg-slate-900/60 hover:text-white'
                      }`}
                    >
                      <span>{opt.label}</span>
                      {tone === opt.value && <span className="text-[10px] text-cyan-400">●</span>}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Duração */}
            <div ref={durationRef} className="flex flex-col gap-1.5 relative">
              <label className="text-[10px] text-slate-500 font-bold uppercase tracking-wider flex items-center gap-1">
                Duração
                <span className="group relative inline-block cursor-help text-slate-555" aria-label="Ajuda sobre Duração">
                  <span className="text-[9px] bg-slate-950 border border-slate-800/80 rounded-full h-3.5 w-3.5 flex items-center justify-center">?</span>
                  <span className="pointer-events-none absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-44 rounded-xl bg-slate-950 border border-[#16223f]/80 p-2.5 text-[9px] text-slate-350 font-medium leading-normal opacity-0 group-hover:opacity-100 transition-opacity duration-200 z-50 text-left shadow-2xl">
                    Define o limite de tempo aproximado para a narração e roteiro gerados pela IA.
                  </span>
                </span>
              </label>
              <button
                type="button"
                onClick={() => setIsDurationOpen(!isDurationOpen)}
                className="w-full bg-slate-950/60 border border-[#16223f]/40 hover:border-slate-800 rounded-xl px-2.5 py-2 text-xs font-semibold text-slate-200 outline-none transition-colors cursor-pointer flex items-center justify-between"
              >
                <span>
                  {duration === '30s' ? '30 segundos' : duration === '60s' ? '60 segundos' : '90 segundos'}
                </span>
                <ChevronDown className={`h-3 w-3 text-slate-400 transition-transform duration-200 ${isDurationOpen ? 'rotate-180' : ''}`} />
              </button>

              {isDurationOpen && (
                <div className="absolute top-[calc(100%+4px)] left-0 w-full bg-slate-950 border border-[#16223f] rounded-xl overflow-hidden shadow-2xl z-50 py-1">
                  {[
                    { value: '30s', label: '30 segundos' },
                    { value: '60s', label: '60 segundos' },
                    { value: '90s', label: '90 segundos' }
                  ].map((opt) => (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => {
                        setDuration(opt.value as DurationType);
                        setIsDurationOpen(false);
                      }}
                      className={`w-full text-left px-3 py-2 text-xs font-semibold transition-colors cursor-pointer flex items-center justify-between ${
                        duration === opt.value
                          ? 'bg-indigo-600/20 text-cyan-400'
                          : 'text-slate-300 hover:bg-slate-900/60 hover:text-white'
                      }`}
                    >
                      <span>{opt.label}</span>
                      {duration === opt.value && <span className="text-[10px] text-cyan-400">●</span>}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Botão de Geração */}
          <div className="flex flex-col gap-2 mt-0.5 select-none">
            <button 
              onClick={handleGenerateVideo} 
              disabled={
                videoState === 'loading' || 
                (generationMode === 'prompt' ? !prompt.trim() : !recommendedPrompt)
              } 
              className={`w-full py-3.5 rounded-2xl font-bold text-white transition-all duration-200 active:scale-[0.99] disabled:opacity-50 disabled:cursor-not-allowed flex flex-col items-center justify-center gap-0.5 shadow-lg ${
                videoState === 'loading' || (generationMode === 'prompt' ? !prompt.trim() : !recommendedPrompt)
                  ? 'bg-gradient-to-r from-blue-600 to-[#7c3aed] opacity-50 cursor-not-allowed shadow-indigo-600/10'
                  : generationMode === 'consultant'
                    ? 'bg-gradient-to-r from-indigo-500 via-purple-600 to-pink-500 animate-pulse shadow-[0_0_20px_rgba(168,85,247,0.6)] border border-purple-500/30 hover:opacity-95'
                    : 'bg-gradient-to-r from-blue-600 to-[#7c3aed] hover:from-blue-700 hover:to-[#6d28d9] shadow-indigo-600/10'
              }`}
            >
              <span className="text-sm tracking-wide">
                {videoState === 'loading'
                  ? `Compilando... (${loadingProgress}%)`
                  : generationMode === 'consultant'
                    ? '✨ Gerar vídeo estratégico (n8n)'
                    : '✨ Gerar vídeo'}
              </span>
              <span className="text-[10px] text-white/70 font-semibold normal-case">
                {generationMode === 'consultant'
                  ? 'Roteiro inteligente pronto para processar via n8n • 1 crédito'
                  : '1 crédito será consumido'}
              </span>
            </button>
            <div className="flex items-center justify-center gap-1 text-[10px] text-amber-500/90 font-bold">
              <span>⚡</span>
              <span>Geração em ~2 minutos</span>
            </div>
          </div>
        </div>
      </section>

      {/* Coluna da Direita: Preview */}
      <section className="col-span-12 lg:col-span-4 flex flex-col items-center gap-4 relative select-none">
        
        {/* Title area for mockup */}
        <div className="text-center flex flex-col gap-1 mt-1">
          <h2 className="text-white font-bold text-base flex items-center justify-center gap-2 tracking-tight">
            <Sparkles className="h-4 w-4 text-purple-400" />
            Prévia do seu vídeo
          </h2>
          <p className="text-xs text-slate-400 font-semibold flex items-center justify-center gap-1">
            Veja como seu vídeo ficará
            <span className="group relative inline-block cursor-help text-slate-500" aria-label="Ajuda sobre o Preview">
              <span className="text-[10px] bg-slate-950 border border-slate-800 rounded-full h-4 w-4 flex items-center justify-center normal-case font-bold">i</span>
              <span className="pointer-events-none absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-44 rounded-xl bg-slate-950 border border-[#16223f]/80 p-2.5 text-[9px] text-slate-350 font-medium leading-normal opacity-0 group-hover:opacity-100 transition-opacity duration-200 z-50 text-left shadow-2xl normal-case">
                A prévia dinâmica simula legendas e áudio sincronizados para visualização do conteúdo final.
              </span>
            </span>
          </p>
        </div>

        {/* Sidebar wrapper that acts as the layout anchor and visual placeholder */}
        <div 
          ref={sidebarWrapperRef} 
          className="relative w-full max-w-[255px] aspect-[9/16] flex items-center justify-center"
        >
            {/* Visual dashed outline shown only when the phone has zoomed away */}
            {zoomState !== 'idle' && (
              <div className="absolute inset-0 rounded-[2.5rem] bg-slate-950/20 border-2 border-dashed border-slate-800/40 pointer-events-none flex flex-col items-center justify-center p-4 text-center">
                <span className="text-[10px] text-slate-500 font-bold tracking-wider uppercase">Visualizando</span>
              </div>
            )}

            {/* Mockup do Celular */}
            <div 
              ref={phoneContainerRef} 
              className={`aspect-[9/16] rounded-[2.5rem] border-[8px] border-slate-950 bg-[#050b14] overflow-hidden shadow-[0_20px_50px_rgba(0,0,0,0.75),0_0_30px_rgba(59,130,246,0.18)] ring-2 ring-slate-800/85 flex flex-col justify-end ${
                zoomState === 'idle' ? 'relative w-full h-full z-25' : ''
              }`}
              style={transitionStyle}
            >
              {/* Dynamic Island / Notch */}
              <div className="absolute top-2 left-1/2 -translate-x-1/2 w-20 h-4 bg-black rounded-full z-40 flex items-center justify-center pointer-events-none">
                <div className="w-1.5 h-1.5 bg-slate-900 rounded-full mr-1"></div>
                <div className="w-3.5 h-0.5 bg-slate-900 rounded-full mx-1"></div>
                <div className="w-1.5 h-1.5 bg-blue-900/40 rounded-full ml-1"></div>
              </div>

              {/* Status Bar */}
              <div className="absolute top-1.5 inset-x-0 h-6 px-6 flex items-center justify-between text-[8px] font-semibold text-white/95 z-40 pointer-events-none select-none">
                <span>{phoneTime}</span>
                <div className="flex items-center gap-1.5">
                  {/* Signal strength bar */}
                  <svg className="w-2 h-2 fill-current" viewBox="0 0 24 24">
                    <path d="M2 22h20V2z" />
                  </svg>
                  {/* Wifi */}
                  <svg className="w-2.5 h-2.5 fill-current" viewBox="0 0 24 24">
                    <path d="M12 21l-12-14.3c.3-.3 4.8-4.7 12-4.7s11.7 4.4 12 4.7l-12 14.3z" />
                  </svg>
                  {/* Battery */}
                  <div className="w-3.5 h-1.5 border border-white/80 rounded-2xs p-0.25 flex items-center">
                    <div className="h-full w-full bg-white rounded-3xs"></div>
                  </div>
                </div>
              </div>

              {/* Bottom Home Indicator Pill */}
              <div className="absolute bottom-1.5 left-1/2 -translate-x-1/2 w-20 h-1 bg-white/40 rounded-full z-40 pointer-events-none" />
              
              {videoState === 'idle' && (
                <div className="text-center p-6 text-xs text-slate-500 leading-relaxed font-semibold">
                  Carregando visualizador de vídeo...
                </div>
              )}
              
              {videoState === 'loading' && (
                <div className="w-full h-full flex flex-col justify-end p-4 relative select-none bg-[#02050c] overflow-hidden">
                  {/* Pulse background */}
                  <div className="absolute inset-0 bg-[#080c17]/60 animate-pulse-skeleton z-0" />
                  
                  {/* Subtle progress loading overlay */}
                  <div className="absolute top-9 left-4 z-30 select-none">
                    <div className="bg-[#0a1122]/90 border border-slate-700/50 backdrop-blur-md text-[9px] text-cyan-400 font-bold px-2.5 py-1 rounded-full flex items-center gap-1 shadow-md">
                      <Loader2 className="h-2.5 w-2.5 text-cyan-400 animate-spin" />
                      <span className="animate-pulse">{loadingLog} ({loadingProgress}%)</span>
                    </div>
                  </div>

                  {/* Reels layout skeletons */}
                  {/* Subtitles skeleton block */}
                  <div className="w-[80%] mx-auto h-12 flex flex-col items-center gap-1.5 mb-14 z-20">
                    <div className="h-4 w-[90%] rounded-md bg-[#16223f]/80 animate-pulse-skeleton" />
                    <div className="h-4 w-[65%] rounded-md bg-[#16223f]/80 animate-pulse-skeleton" />
                  </div>

                  {/* Floating Action buttons on the right side */}
                  <div className="absolute right-3.5 bottom-20 flex flex-col items-center gap-4.5 z-20">
                    <div className="flex flex-col items-center gap-1">
                      <div className="h-8.5 w-8.5 rounded-full bg-[#16223f]/80 animate-pulse-skeleton" />
                      <div className="h-2 w-5 rounded bg-[#16223f]/80 animate-pulse-skeleton" />
                    </div>
                    <div className="flex flex-col items-center gap-1">
                      <div className="h-8.5 w-8.5 rounded-full bg-[#16223f]/80 animate-pulse-skeleton" />
                      <div className="h-2 w-4 rounded bg-[#16223f]/80 animate-pulse-skeleton" />
                    </div>
                    <div className="flex flex-col items-center gap-1">
                      <div className="h-8.5 w-8.5 rounded-full bg-[#16223f]/80 animate-pulse-skeleton" />
                      <div className="h-2 w-4 rounded bg-[#16223f]/80 animate-pulse-skeleton" />
                    </div>
                  </div>

                  {/* Left user info shape */}
                  <div className="absolute left-3.5 bottom-6 flex flex-col gap-2 z-20 w-[60%]">
                    <div className="flex items-center gap-1.5">
                      <div className="h-7 w-7 rounded-full bg-[#16223f]/80 animate-pulse-skeleton" />
                      <div className="h-3 w-16 rounded bg-[#16223f]/80 animate-pulse-skeleton" />
                    </div>
                    <div className="h-2.5 w-full rounded bg-[#16223f]/80 animate-pulse-skeleton" />
                    <div className="h-2.5 w-[80%] rounded bg-[#16223f]/80 animate-pulse-skeleton" />
                  </div>

                  {/* Bottom play bar skeleton */}
                  <div className="absolute bottom-0 inset-x-0 h-1 bg-slate-900/60 z-20">
                    <div className="h-full bg-cyan-500/80 transition-all duration-300" style={{ width: `${loadingProgress}%` }} />
                  </div>
                </div>
              )}

              {isRendering && (
                <div className="absolute inset-0 bg-black/80 backdrop-blur-sm z-50 flex flex-col justify-center items-center gap-3 p-4 text-center select-none">
                  <Loader2 className="h-7 w-7 text-cyan-400 animate-spin" />
                  <span className="text-xs font-semibold text-slate-200 leading-normal animate-pulse">
                    Renderizando em HD... {renderProgress > 0 ? `(${renderProgress}%)` : ''}
                  </span>
                  <span className="text-[10px] text-slate-500">
                    Isso pode levar até 2 minutos
                  </span>
                </div>
              )}

              {videoState === 'ready' && (
                <div className="w-full h-full relative flex flex-col justify-end group/player">
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

                  {isDynamicMode ? (
                    videoUrls.map((url, idx) => {
                      const videoSrc = typeof url === 'object' && url !== null 
                        ? String((url as any).url || (url as any).link || '') 
                        : String(url);
                      
                      const isActive = idx === activeVideoIndex;
                      
                      // Encontra o index da legenda ativa correspondente a esta cena
                      const activeSubIndex = subtitles.findIndex(sub => currentTime >= sub.start && currentTime <= sub.end);
                      const activeSub = activeSubIndex !== -1 ? subtitles[activeSubIndex] : null;
                      const clipDuration = activeSub ? (activeSub.end - activeSub.start) : 3;

                      return (
                        <video
                          key={idx}
                          ref={(el) => { videoRefs.current[idx] = el; }}
                          src={videoSrc}
                          poster="/preview.jpg"
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
                    })
                  ) : (
                    <video
                      ref={videoRef}
                      src={videoUrl || "https://assets.mixkit.co/videos/preview/mixkit-futuristic-subway-station-with-neon-lights-in-vertical-format-48227-large.mp4"}
                      poster="/preview.jpg"
                      onTimeUpdate={handleTimeUpdate}
                      onLoadedMetadata={handleVideoLoadedMetadata}
                      onClick={togglePlay}
                      loop
                      playsInline
                      className="absolute inset-0 w-full h-full object-cover cursor-pointer bg-black"
                    />
                  )}

                  {isDynamicMode && (
                    <audio
                      ref={audioRef}
                      src={audioUrl}
                      onTimeUpdate={handleTimeUpdate}
                      onLoadedMetadata={handleAudioLoadedMetadata}
                      onEnded={() => {
                        setIsPlaying(false);
                        setCurrentTime(0);
                      }}
                    />
                  )}

                  {/* Legendas estilizadas com palavra-ativa dinâmica */}
                  {(() => {
                    const activeSubtitle = subtitles.find(
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
                          paddingBottom: `${phoneWidth * 0.370}px`,
                          paddingLeft: `${phoneWidth * 0.074}px`,
                          paddingRight: `${phoneWidth * 0.074}px`,
                          pointerEvents: 'none',
                          zIndex: 30,
                        }}
                      >
                        <h1
                          style={{
                            fontFamily: '"Montserrat", "Poppins", "Arial Black", sans-serif',
                            fontSize: `${phoneWidth * 0.0777}px`,
                            fontWeight: 900,
                            textTransform: 'uppercase',
                            textAlign: 'center',
                            lineHeight: 1.25,
                            letterSpacing: '1.5px',
                            display: 'flex',
                            flexWrap: 'wrap',
                            justifyContent: 'center',
                            rowGap: `${phoneWidth * 0.0092}px`,
                            textShadow: `
                              -${Math.max(1, Math.round(phoneWidth * 0.0037))}px -${Math.max(1, Math.round(phoneWidth * 0.0037))}px 0 #000,
                               ${Math.max(1, Math.round(phoneWidth * 0.0037))}px -${Math.max(1, Math.round(phoneWidth * 0.0037))}px 0 #000,
                              -${Math.max(1, Math.round(phoneWidth * 0.0037))}px  ${Math.max(1, Math.round(phoneWidth * 0.0037))}px 0 #000,
                               ${Math.max(1, Math.round(phoneWidth * 0.0037))}px  ${Math.max(1, Math.round(phoneWidth * 0.0037))}px 0 #000,
                               0px ${Math.round(phoneWidth * 0.0055)}px ${Math.round(phoneWidth * 0.0138)}px rgba(0, 0, 0, 0.9)
                            `,
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
                                  marginRight: `${phoneWidth * 0.0185}px`,
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

                  {/* Barra de Progresso do Player na Borda Inferior */}
                  <div className="absolute bottom-0 inset-x-0 h-1 bg-white/15 z-30 select-none">
                    <div 
                      className="h-full bg-gradient-to-r from-blue-500 to-indigo-500" 
                      style={{ width: `${totalDuration ? (currentTime / totalDuration) * 100 : 0}%` }}
                    />
                  </div>

                  {/* Controles Redondos Estilizados no Player */}
                  <div className="absolute bottom-4 inset-x-4 flex items-center justify-between z-30 select-none pointer-events-auto">
                    <button 
                      onClick={togglePlay}
                      className="h-8.5 w-8.5 rounded-full bg-black/40 hover:bg-black/60 border border-white/10 backdrop-blur-md flex items-center justify-center text-white transition-all hover:scale-105 active:scale-95"
                    >
                      {isPlaying ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5 fill-current ml-0.5" />}
                    </button>

                    <button 
                      onClick={toggleMute}
                      className="h-8.5 w-8.5 rounded-full bg-black/40 hover:bg-black/60 border border-white/10 backdrop-blur-md flex items-center justify-center text-white transition-all hover:scale-105 active:scale-95"
                    >
                      {isMuted ? <VolumeX className="h-3.5 w-3.5" /> : <Volume2 className="h-3.5 w-3.5" />}
                    </button>
                  </div>

                  {/* Overlay dos Ícones do TikTok/Reels na Lateral */}
                  <div className="absolute right-3.5 bottom-20 flex flex-col items-center gap-4 z-30 select-none">
                    <div className="flex flex-col items-center gap-0.5 cursor-pointer group/icon">
                      <div className="h-8.5 w-8.5 rounded-full bg-black/35 hover:bg-black/55 backdrop-blur-md flex items-center justify-center text-white border border-white/5 transition-all group-hover/icon:scale-110">
                        <Heart className="h-3.5 w-3.5" />
                      </div>
                      <span className="text-[9px] text-white/90 font-bold drop-shadow-[0_1px_2px_rgba(0,0,0,0.85)]">12.8K</span>
                    </div>

                    <div className="flex flex-col items-center gap-0.5 cursor-pointer group/icon">
                      <div className="h-8.5 w-8.5 rounded-full bg-black/35 hover:bg-black/55 backdrop-blur-md flex items-center justify-center text-white border border-white/5 transition-all group-hover/icon:scale-110">
                        <MessageCircle className="h-3.5 w-3.5" />
                      </div>
                      <span className="text-[9px] text-white/90 font-bold drop-shadow-[0_1px_2px_rgba(0,0,0,0.85)]">352</span>
                    </div>

                    <div className="flex flex-col items-center gap-0.5 cursor-pointer group/icon">
                      <div className="h-8.5 w-8.5 rounded-full bg-black/35 hover:bg-black/55 backdrop-blur-md flex items-center justify-center text-white border border-white/5 transition-all group-hover/icon:scale-110">
                        <Share2 className="h-3.5 w-3.5" />
                      </div>
                      <span className="text-[9px] text-white/90 font-bold drop-shadow-[0_1px_2px_rgba(0,0,0,0.85)]">2.1K</span>
                    </div>
                  </div>

                  {/* Badge de Status/Exemplo no Topo */}
                  <div className="absolute top-7 left-3.5 select-none z-30">
                    <div className="bg-[#0a1122]/90 border border-slate-700/50 backdrop-blur-md text-[9px] text-yellow-400 font-bold px-2.5 py-1 rounded-full flex items-center gap-1">
                      <span>✨</span>
                      <span>
                        {videoUrl && videoUrl !== "https://assets.mixkit.co/videos/preview/mixkit-futuristic-subway-station-with-neon-lights-in-vertical-format-48227-large.mp4" 
                          ? "PRONTO" 
                          : "Exemplo real gerado com IA"
                        }
                      </span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Informações Extras de Vídeo abaixo do Celular */}
          <div className="w-full max-w-[255px] bg-[#040812]/50 border border-slate-900 rounded-2xl p-2.5 px-3 flex justify-between items-center gap-1 select-none shrink-0 shadow-sm mt-0.5">
            {/* Formato */}
            <div className="flex items-center gap-1.5">
              <div className="h-6 w-6 rounded-lg bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400 shrink-0 text-[9px] font-extrabold select-none">
                9:16
              </div>
              <div className="flex flex-col text-left">
                <span className="text-[7.5px] text-slate-500 font-bold uppercase tracking-wide leading-none">Formato</span>
                <span className="text-[9px] text-slate-200 font-extrabold mt-0.5">Reels</span>
              </div>
            </div>

            {/* Separador vertical */}
            <div className="h-5 w-px bg-slate-900/60" />

            {/* Duração */}
            <div className="flex items-center gap-1.5">
              <div className="h-6 w-6 rounded-lg bg-purple-500/10 border border-purple-500/20 flex items-center justify-center text-purple-400 shrink-0">
                <Clock className="h-3 w-3" />
              </div>
              <div className="flex flex-col text-left">
                <span className="text-[7.5px] text-slate-500 font-bold uppercase tracking-wide leading-none">Duração</span>
                <span className="text-[9px] text-slate-200 font-extrabold mt-0.5">15s</span>
              </div>
            </div>

            {/* Separador vertical */}
            <div className="h-5 w-px bg-slate-900/60" />

            {/* Status */}
            <div className="flex items-center gap-1.5">
              <div className="h-6 w-6 rounded-lg bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400 shrink-0">
                <Video className="h-3 w-3" />
              </div>
              <div className="flex flex-col text-left">
                <span className="text-[7.5px] text-slate-500 font-bold uppercase tracking-wide leading-none">Status</span>
                <span className="text-[9px] text-indigo-400 font-extrabold mt-0.5 whitespace-nowrap">Pronto</span>
              </div>
            </div>
          </div>

          {/* Botões de Ação do Player */}
          {videoState === 'ready' && !isZoomed && (
            <div className="flex gap-3.5 w-full justify-center z-20 max-w-[255px] mt-0.5 select-none shrink-0">
              <button
                onClick={handleZoomIn}
                className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2.5 text-[11px] font-bold bg-[#15233c]/25 border border-[#15233c]/45 text-slate-250 rounded-xl hover:bg-[#1e293b] hover:text-white transition-all cursor-pointer shadow-sm shadow-black/25 active:scale-95"
              >
                <Maximize2 className="h-3.5 w-3.5 text-slate-400" />
                Aumentar
              </button>
              <button
                onClick={() => {
                  if (videoUrl && videoUrl.includes('amazonaws.com')) {
                    window.open(videoUrl, '_blank');
                  } else {
                    handleDownload();
                  }
                }}
                disabled={isDownloading || isRendering}
                className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2.5 text-[11px] font-extrabold bg-gradient-to-r from-[#2563eb] via-[#6366f1] to-[#a855f7] text-white rounded-xl hover:opacity-95 active:scale-95 transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed shadow-md shadow-indigo-500/10"
              >
                {isDownloading || isRendering ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Download className="h-3.5 w-3.5" />
                )}
                {isRendering ? `Criando...` : 'Baixar MP4'}
              </button>
            </div>
          )}

        {/* Modal Backdrop overlay */}
        {isZoomed && (
          <div 
            className={`fixed inset-0 z-40 bg-[#02050c]/90 pointer-events-auto cursor-pointer ${
              zoomState === 'zooming-out' ? 'animate-backdrop-out' : 'animate-backdrop-in'
            }`}
            onClick={handleZoomOut}
          />
        )}

        {/* Modal Card Centered container */}
        {isZoomed && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none">
            <div className={`bg-[#060a13] border border-[#15233c]/60 rounded-3xl p-8 flex flex-col items-center max-w-[480px] w-full relative shadow-2xl pointer-events-auto ${
              zoomState === 'zooming-out' ? 'animate-card-out' : 'animate-card-in'
            }`}>
              {/* Close button */}
              <button 
                onClick={handleZoomOut}
                className="absolute top-6 right-6 p-2 bg-white/5 hover:bg-white/10 border border-white/10 text-white rounded-full transition-all cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>

              {/* Header */}
              <div className="text-center mb-6">
                <h3 className="text-white font-bold text-lg">Preview 9:16</h3>
                <p className="text-slate-400 text-xs mt-1">Veja como seu vídeo ficará no formato vertical (9:16).</p>
              </div>

              {/* Modal Placeholder for the Phone mockup */}
              <div 
                ref={modalPlaceholderRef}
                className="w-[300px] sm:w-[340px] md:w-[370px] aspect-[9/16] bg-slate-950/20 border-2 border-dashed border-slate-800/20 rounded-[2.5rem] pointer-events-none mb-6"
              />

              {/* Buttons row */}
              {videoState === 'ready' && (
                <div className="flex gap-3 w-full justify-center mb-4 max-w-[370px]">
                  <button
                    onClick={() => {
                      if (videoUrl && videoUrl.includes('amazonaws.com')) {
                        window.open(videoUrl, '_blank');
                      } else {
                        handleDownload();
                      }
                    }}
                    disabled={isDownloading || isRendering}
                    className="flex-1 flex items-center justify-center gap-1.5 px-4 py-3 text-xs font-semibold bg-[#0c1426] border border-[#15233c]/60 hover:bg-[#15233c] text-white rounded-xl active:scale-95 transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
                  >
                    {isDownloading || isRendering ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Download className="h-3.5 w-3.5" />
                    )}
                    {isRendering ? `Criando... (${renderProgress}%)` : 'Baixar MP4'}
                  </button>
                  
                  <button
                    onClick={handleZoomOut}
                    className="flex-1 flex items-center justify-center gap-1.5 px-4 py-3 text-xs font-semibold bg-gradient-to-r from-blue-600 to-cyan-500 hover:from-blue-700 hover:to-cyan-600 text-white rounded-xl active:scale-95 transition-all cursor-pointer shadow-sm"
                  >
                    Fechar
                  </button>
                </div>
              )}

              {/* Info Text */}
              <p className="text-[10px] text-slate-500 text-center">
                Seu vídeo está pronto! Faça o download ou feche para continuar.
              </p>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
