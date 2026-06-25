'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@supabase/supabase-js';
import { 
  Upload, 
  Play, 
  Pause, 
  Volume2, 
  VolumeX, 
  Sparkles, 
  Mic, 
  MicOff, 
  Send, 
  Loader2, 
  CheckCircle2, 
  ChevronLeft, 
  Plus, 
  Trash2, 
  Sliders, 
  FileVideo,
  Heart,
  MessageCircle,
  Share2
} from 'lucide-react';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
const supabase = createClient(supabaseUrl, supabaseAnonKey);

interface SubtitleItem {
  id: string;
  start: number;
  end: number;
  text: string;
}

export default function AutoEdicaoPage() {
  const router = useRouter();
  const [mounted, setMounted] = useState(false);

  // Estados de Configuração da Tela
  const [step, setStep] = useState<'upload' | 'processing' | 'editor'>('upload');
  const [activeTab, setActiveTab] = useState<'roteiro' | 'estilos'>('roteiro');
  const [dragActive, setDragActive] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [selectedFileName, setSelectedFileName] = useState<string | null>(null);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [credits, setCredits] = useState(0);
  const [userId, setUserId] = useState<string | null>(null);

  // Estados de Processamento
  const [processingStage, setProcessingStage] = useState(0);
  const [processingLog, setProcessingLog] = useState('');

  // Estados do Player de Vídeo
  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [videoDuration, setVideoDuration] = useState(0);
  const [phoneWidth, setPhoneWidth] = useState(250);

  // Estados de Customização de Legenda
  const [neonColor, setNeonColor] = useState('#FFD700'); // Amarelo Gold por padrão
  const [textSize, setTextSize] = useState<'small' | 'medium' | 'large'>('medium');
  const [fontFamily, setFontFamily] = useState('Montserrat');

  // Estados de Legendas/Transcrições
  const [subtitles, setSubtitles] = useState<SubtitleItem[]>([]);

  // Estados do Gerador de B-Rolls
  const [isGeneratingBRolls, setIsGeneratingBRolls] = useState(false);
  const [bRollStage, setBRollStage] = useState(0);
  const [bRollLog, setBRollLog] = useState('');
  const [bRollsActive, setBRollsActive] = useState(false);
  const [bRollUrls, setBRollUrls] = useState<string[]>([]);

  // Estados do Chat do Consultor
  const [chatInput, setChatInput] = useState('');
  const [isConsultantLoading, setIsConsultantLoading] = useState(false);
  const [chatMessages, setChatMessages] = useState<Array<{ id: string; sender: 'consultant' | 'user'; text: string }>>([
    {
      id: 'welcome',
      sender: 'consultant',
      text: '🤖 Olá! Sou o assistente de Auto-Edição da Adisea. Seu vídeo bruto já foi transcrito e as legendas automáticas estão prontas. Como gostaria de refinar o vídeo hoje? (ex: "Troque o texto da cena 2", "Aumente as legendas").'
    }
  ]);

  // Referências
  const fileInputRef = useRef<HTMLInputElement>(null);
  const phoneContainerRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const bRollRefs = useRef<(HTMLVideoElement | null)[]>([]);
  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setMounted(true);
    
    // Buscar créditos do usuário logado
    async function loadUserCredits() {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          setUserId(user.id);
          const { data: profile } = await supabase
            .from('profiles')
            .select('credits')
            .eq('id', user.id)
            .single();
          if (profile) {
            setCredits(profile.credits);
          }
        }
      } catch (err) {
        console.error('Erro ao carregar créditos:', err);
      }
    }
    loadUserCredits();
  }, []);

  // Responsividade da largura do mockup do celular
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
  }, [step]);

  // Scroll automático do chat
  useEffect(() => {
    if (chatEndRef.current) {
      chatEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [chatMessages, isConsultantLoading]);

  // Lógica de sincronização do player
  const handleTimeUpdate = () => {
    if (videoRef.current) {
      setCurrentTime(videoRef.current.currentTime);
    }
  };

  const handleLoadedMetadata = () => {
    if (videoRef.current) {
      setVideoDuration(videoRef.current.duration);
    }
  };

  const togglePlay = () => {
    if (videoRef.current) {
      if (isPlaying) {
        videoRef.current.pause();
        // Pausar vídeos de B-roll secundários
        bRollRefs.current.forEach(v => v?.pause());
        setIsPlaying(false);
      } else {
        videoRef.current.play().catch(() => {});
        // Sincronizar e dar play no B-roll se ativo
        const activeIdx = getActiveBRollIndex();
        if (bRollsActive && activeIdx !== -1 && bRollRefs.current[activeIdx]) {
          bRollRefs.current[activeIdx]?.play().catch(() => {});
        }
        setIsPlaying(true);
      }
    }
  };

  const toggleMute = () => {
    if (videoRef.current) {
      videoRef.current.muted = !isMuted;
      setIsMuted(!isMuted);
    }
  };

  // Drag and drop handlers
  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const file = e.dataTransfer.files[0];
      await handleVideoUpload(file);
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      await handleVideoUpload(file);
    }
  };

  // Upload real para o AWS S3 via Presigned URL
  const handleVideoUpload = async (file: File) => {
    // Validar tipo de vídeo e tamanho aproximado
    if (!file.type.startsWith('video/')) {
      alert('Por favor, selecione um arquivo de vídeo válido.');
      return;
    }

    setSelectedFileName(file.name);
    setStep('processing');
    setUploading(true);
    setProcessingStage(0);
    setProcessingLog('Fazendo upload seguro para o storage do Aether...');

    try {
      // 1. Solicitar a geração de uma Presigned URL ao backend Next.js (requisição ultra-leve)
      const presignedRes = await fetch('/api/upload/s3', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          filename: file.name,
          contentType: file.type,
        }),
      });

      if (!presignedRes.ok) {
        throw new Error('Falha ao gerar link de upload pré-assinado.');
      }

      const presignedData = await presignedRes.json();
      if (!presignedData.success || !presignedData.uploadUrl) {
        throw new Error(presignedData.error || 'Erro ao processar chaves de segurança.');
      }

      const { uploadUrl, fileUrl } = presignedData;

      // 2. Fazer o upload do vídeo direto do navegador para o AWS S3
      const uploadRes = await fetch(uploadUrl, {
        method: 'PUT',
        body: file,
        headers: {
          'Content-Type': file.type,
        },
      });

      if (!uploadRes.ok) {
        throw new Error('Falha na transferência direta para a AWS S3.');
      }

      setVideoUrl(fileUrl);
      setUploading(false);
      
      // Iniciar a simulação de transcrição baseada em IA
      triggerAISimulation(file.name);

    } catch (err: any) {
      console.error(err);
      alert('Erro ao realizar upload do vídeo: ' + err.message);
      setStep('upload');
    }
  };

  // Simulação de processamento de IA
  const triggerAISimulation = (fileName: string) => {
    setProcessingStage(1);
    setProcessingLog('Lendo frequência de voz e isolando canais de áudio...');

    setTimeout(() => {
      setProcessingStage(2);
      setProcessingLog('Executando transcrição via Whisper Large v3...');
      
      setTimeout(() => {
        setProcessingStage(3);
        setProcessingLog('Gerando timestamps milissegundo a milissegundo...');
        
        setTimeout(() => {
          setProcessingStage(4);
          setProcessingLog('Cortando pausas e silêncios redundantes...');
          
          setTimeout(() => {
            // Gerar legendas inteligentes padrão baseadas no nome do arquivo ou conteúdo simulado
            const initialSubs: SubtitleItem[] = [
              { id: 'sc-1', start: 0.5, end: 3.8, text: 'Fala pessoal! Subi este vídeo bruto diretamente na plataforma.' },
              { id: 'sc-2', start: 3.8, end: 8.2, text: 'A IA identificou cada palavra, e agora está legendando tudo automático.' },
              { id: 'sc-3', start: 8.2, end: 12.5, text: 'Além disso, posso customizar o design neon das palavras que falo.' },
              { id: 'sc-4', start: 12.5, end: 16.0, text: 'Aperte no botão abaixo para gerar B-Rolls dinâmicos de fundo!' }
            ];
            setSubtitles(initialSubs);
            setStep('editor');
          }, 1500);
        }, 1500);
      }, 1500);
    }, 1500);
  };

  // Customização de texto da legenda
  const handleSubtitleTextChange = (id: string, newText: string) => {
    setSubtitles(prev => prev.map(sub => sub.id === id ? { ...sub, text: newText } : sub));
  };

  // Deletar cena da legenda
  const handleDeleteScene = (id: string) => {
    setSubtitles(prev => prev.filter(sub => sub.id !== id));
  };

  // Adicionar nova cena de legenda vazia
  const handleAddScene = () => {
    const lastSub = subtitles[subtitles.length - 1];
    const newStart = lastSub ? lastSub.end + 0.2 : 0;
    const newEnd = newStart + 3.0;

    const newScene: SubtitleItem = {
      id: `sc-new-${Date.now()}`,
      start: newStart,
      end: newEnd,
      text: 'Nova fala customizada...'
    };
    setSubtitles(prev => [...prev, newScene]);
  };

  // Simular Geração de B-Rolls
  const handleGenerateBRolls = () => {
    if (subtitles.length === 0) return;
    
    setIsGeneratingBRolls(true);
    setBRollStage(1);
    setBRollLog('Analisando contexto semântico das falas transcritas...');

    setTimeout(() => {
      setBRollStage(2);
      setBRollLog('Buscando mídias cinemáticas de suporte (Pexels / Mixkit)...');

      setTimeout(() => {
        setBRollStage(3);
        setBRollLog('Sincronizando takes com a linha de áudio principal...');

        setTimeout(() => {
          // URLs de B-roll dinâmicas premium
          const samples = [
            'https://assets.mixkit.co/videos/preview/mixkit-hand-holding-a-smartphone-with-a-vertical-screen-48766-large.mp4',
            'https://assets.mixkit.co/videos/preview/mixkit-creative-designer-working-on-his-computer-43026-large.mp4',
            'https://assets.mixkit.co/videos/preview/mixkit-hands-typing-fast-on-a-computer-keyboard-40033-large.mp4',
            'https://assets.mixkit.co/videos/preview/mixkit-coding-screen-in-close-up-with-reflected-lights-47864-large.mp4'
          ];
          
          setBRollUrls(samples);
          setBRollsActive(true);
          setIsGeneratingBRolls(false);
          
          // Adiciona feedback no chat
          setChatMessages(prev => [
            ...prev,
            {
              id: `broll-${Date.now()}`,
              sender: 'consultant',
              text: '⚡ Sucesso! Encontrei e posicionei 4 vídeos B-roll cinemáticos para dar suporte visual ao seu Reels. Dê o Play no celular para assistir com a fusão de takes!'
            }
          ]);
        }, 1800);
      }, 1800);
    }, 1800);
  };

  // Encontrar o índice do B-roll ativo de acordo com a reprodução
  const getActiveBRollIndex = () => {
    if (!bRollsActive || bRollUrls.length === 0) return -1;
    const activeSubIndex = subtitles.findIndex(sub => currentTime >= sub.start && currentTime <= sub.end);
    if (activeSubIndex !== -1) {
      return activeSubIndex % bRollUrls.length;
    }
    return -1;
  };

  const activeBRollIdx = getActiveBRollIndex();

  // Enviar comando ao Chat
  const handleSendChat = () => {
    if (!chatInput.trim() || isConsultantLoading) return;
    
    const userMsg = chatInput.trim();
    setChatMessages(prev => [...prev, { id: `user-${Date.now()}`, sender: 'user', text: userMsg }]);
    setChatInput('');
    setIsConsultantLoading(true);

    // Processamento simulado do consultor de vídeo
    setTimeout(() => {
      const lower = userMsg.toLowerCase();
      let responseText = '🤖 Entendido! Fiz o ajuste conforme solicitado. Pode testar no player.';
      
      if (lower.includes('cor') || lower.includes('neon') || lower.includes('amarelo') || lower.includes('azul') || lower.includes('rosa')) {
        if (lower.includes('azul') || lower.includes('cyan')) {
          setNeonColor('#00E5FF');
          responseText = '🤖 Ajustei a cor neon da legenda para Ciano (#00E5FF) para dar mais contraste ao vídeo.';
        } else if (lower.includes('rosa') || lower.includes('pink') || lower.includes('magenta')) {
          setNeonColor('#FF007F');
          responseText = '🤖 Mudei o tema da legenda para Neon Pink (#FF007F). Ficou super moderno!';
        } else if (lower.includes('verde') || lower.includes('emerald')) {
          setNeonColor('#10B981');
          responseText = '🤖 Feito! Ajustei a legenda para Emerald Green (#10B981) conforme pedido.';
        } else {
          setNeonColor('#FFD700');
          responseText = '🤖 Legendas configuradas no padrão Neon Yellow Gold (#FFD700).';
        }
      } else if (lower.includes('tamanho') || lower.includes('grande') || lower.includes('pequeno')) {
        if (lower.includes('grande')) {
          setTextSize('large');
          responseText = '🤖 Aumentei a escala de exibição das legendas para o tamanho Grande.';
        } else if (lower.includes('pequeno')) {
          setTextSize('small');
          responseText = '🤖 Reduzi a escala da legenda para Pequeno para ficar mais discreto.';
        } else {
          setTextSize('medium');
          responseText = '🤖 Reajustei a legenda para o tamanho Médio padrão.';
        }
      } else if (lower.includes('fonte') || lower.includes('font') || lower.includes('impact') || lower.includes('poppins') || lower.includes('inter')) {
        if (lower.includes('impact')) {
          setFontFamily('Impact');
          responseText = '🤖 Mudei a fonte para Impact. Agora as palavras saltam com mais força!';
        } else if (lower.includes('poppins')) {
          setFontFamily('Poppins');
          responseText = '🤖 Fonte alterada para Poppins Bold (estilo Tik Tok moderno).';
        } else if (lower.includes('inter')) {
          setFontFamily('Inter');
          responseText = '🤖 Fonte alterada para Inter, mantendo um design limpo e minimalista.';
        }
      } else if (lower.includes('texto') || lower.includes('cena') || lower.includes('segundo') || lower.includes('troque')) {
        // Simular mudança de texto no editor
        setSubtitles(prev => {
          if (prev.length > 1) {
            const updated = [...prev];
            updated[1] = { ...updated[1], text: 'Esta frase foi re-escrita através do comando do chat de IA!' };
            return updated;
          }
          return prev;
        });
        responseText = '🤖 Encontrei a frase indicada e fiz a substituição do texto na linha do tempo com sucesso!';
      }

      setChatMessages(prev => [
        ...prev,
        { id: `consultant-${Date.now()}`, sender: 'consultant', text: responseText }
      ]);
      setIsConsultantLoading(false);
    }, 1800);
  };

  return (
    <div className="h-[calc(100vh-125px)] flex flex-col gap-4 relative select-none overflow-hidden pb-1">
      
      {/* Estilos dinâmicos de fonte no cabeçalho do documento */}
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Montserrat:wght@900&family=Poppins:wght@800;900&family=Inter:wght@800;900&display=swap');
      `}</style>

      {/* Rota Ativa/Título */}
      <div className="flex items-center justify-between border-b border-[#15233c]/20 pb-4 select-none">
        <div className="flex items-center gap-3">
          <button 
            onClick={() => {
              if (step === 'editor') {
                if (confirm('Deseja realmente voltar? Você perderá o progresso do vídeo atual.')) {
                  setStep('upload');
                  setVideoUrl(null);
                  setSubtitles([]);
                  setBRollsActive(false);
                }
              } else {
                router.push('/dashboard');
              }
            }}
            className="p-2 bg-slate-900/60 border border-[#15233c]/60 text-slate-400 hover:text-white rounded-xl transition-all"
            title="Voltar"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <div>
            <h1 className="text-xl font-bold text-white tracking-tight flex items-center gap-2">
              🎥 Auto-Edição Inteligente
              <span className="h-2 w-2 rounded-full bg-cyan-400 animate-pulse" />
            </h1>
            <p className="text-[11px] text-slate-500">Transforme vídeos brutos em conteúdos magnéticos com legendas, zoom e B-Rolls dinâmicos.</p>
          </div>
        </div>
        <div className="text-xs text-slate-500 font-bold bg-[#070c17]/60 border border-[#15233c]/60 px-3.5 py-1.5 rounded-full select-none">
          Saldo: <span className="text-blue-400">{credits} créditos</span>
        </div>
      </div>

      {/* ESTADO 1: TELA DE UPLOAD (PORTA DE ENTRADA) */}
      {step === 'upload' && (
        <div className="grid grid-cols-12 gap-8 items-stretch flex-1 min-h-0">
          {/* Esquerda: Upload Drag & Drop (Todo o container é a zona de drag and drop) */}
          <div
            onClick={() => fileInputRef.current?.click()}
            onDragEnter={handleDrag}
            onDragLeave={handleDrag}
            onDragOver={handleDrag}
            onDrop={handleDrop}
            className={`col-span-12 lg:col-span-8 flex flex-col justify-center items-center gap-6 bg-[#060a13]/30 border-2 border-dashed rounded-3xl p-10 h-full min-h-0 cursor-pointer transition-all duration-300 relative overflow-hidden group/upload-zone ${
              dragActive
                ? 'border-purple-500 bg-purple-500/5 shadow-[0_0_30px_rgba(168,85,247,0.15)] scale-[1.005]'
                : 'border-[#1e2d4a]/50 hover:border-cyan-500/50 hover:bg-[#060a13]/50 shadow-md shadow-blue-500/2'
            }`}
          >
            {/* Efeito Glow Radial Esfumaçado no fundo */}
            <div 
              className="absolute pointer-events-none z-0 opacity-40 blur-[80px] transition-all duration-500 group-hover/upload-zone:opacity-60"
              style={{
                width: '320px',
                height: '320px',
                background: 'radial-gradient(circle, rgba(139, 92, 246, 0.3) 0%, rgba(59, 130, 246, 0.1) 50%, transparent 100%)',
                left: '50%',
                top: '50%',
                transform: 'translate(-50%, -50%)'
              }}
            />

            <input 
              ref={fileInputRef}
              type="file"
              className="hidden"
              accept="video/*"
              onChange={handleFileChange}
            />

            <div className="z-10 text-center flex flex-col items-center gap-6 max-w-lg">
              {/* Ícone minimalista com background translúcido e glow */}
              <div className="h-16 w-16 rounded-full bg-[#080d19]/80 border border-blue-500/30 flex items-center justify-center text-cyan-400 shadow-xl transition-all duration-300 group-hover/upload-zone:scale-110 group-hover/upload-zone:border-purple-500/50 group-hover/upload-zone:text-purple-400 relative">
                <div className="absolute inset-0 rounded-full bg-cyan-400/10 blur-[8px] group-hover/upload-zone:bg-purple-500/20" />
                <Upload className="h-6 w-6 z-10" />
              </div>

              <div className="flex flex-col gap-3">
                <h2 className="text-2xl lg:text-3xl font-extrabold text-white tracking-tight uppercase">
                  Importe seu Vídeo Bruto
                </h2>
                <p className="text-[11px] text-slate-400 max-w-sm mx-auto leading-normal">
                  Arraste e solte o seu vídeo bruto falando (até 60s) aqui ou clique para selecionar. A IA fará todo o resto de forma automática.
                </p>
              </div>

              {/* Badges explicativos minimalistas em fileira de suporte */}
              <div className="flex gap-4 mt-2">
                <span className="text-[9px] font-bold text-slate-500 bg-[#070c17]/60 border border-slate-900 px-3 py-1 rounded-full uppercase tracking-wider">
                  ⚡ Auto-Legendas
                </span>
                <span className="text-[9px] font-bold text-slate-500 bg-[#070c17]/60 border border-slate-900 px-3 py-1 rounded-full uppercase tracking-wider">
                  🔎 Inteligente Zoom
                </span>
                <span className="text-[9px] font-bold text-slate-500 bg-[#070c17]/60 border border-slate-900 px-3 py-1 rounded-full uppercase tracking-wider">
                  🎥 B-Rolls
                </span>
              </div>
            </div>
          </div>

          {/* Direita: Mockup Informativo e Descrições */}
          <div className="col-span-12 lg:col-span-4 flex flex-col items-center justify-center gap-6">
            
            {/* iPhone Mockup */}
            <div className="w-[280px] aspect-[9/16] rounded-[2.5rem] border-[8px] border-slate-950 bg-[#050b14] overflow-hidden shadow-2xl ring-2 ring-slate-800/85 flex flex-col justify-center items-center p-6 relative">
              {/* Fake Status Bar */}
              <div className="absolute top-2.5 inset-x-5 flex justify-between items-center text-[8px] font-bold text-slate-500/80 z-45 pointer-events-none select-none">
                <span>23:25</span>
                <div className="flex items-center gap-1">
                  <span>📶</span>
                  <span>🔋</span>
                </div>
              </div>

              {/* Dynamic Island / Notch */}
              <div className="absolute top-2 left-1/2 -translate-x-1/2 w-20 h-4 bg-black rounded-full z-45" />

              {/* Player Waiting Screen */}
              <div className="absolute inset-0 flex flex-col items-center justify-center bg-gradient-to-b from-[#0b1424] via-[#050b14] to-[#010408]">
                {/* Abstrato Blur Glow de fundo */}
                <div className="w-32 h-32 rounded-full bg-blue-500/5 blur-3xl absolute" />
                
                {/* Legenda de impacto central */}
                <div className="z-10 px-4 text-center">
                  <h1 
                    className="text-xs font-black tracking-widest uppercase mb-1 drop-shadow-md animate-pulse"
                    style={{
                      fontFamily: 'Montserrat, sans-serif',
                      color: neonColor || '#FFD700',
                      textShadow: '0 0 10px rgba(255,215,0,0.2)'
                    }}
                  >
                    [ AGUARDANDO VÍDEO... ]
                  </h1>
                  <p className="text-[7.5px] font-bold text-slate-600 uppercase tracking-widest mt-1.5">
                    Envie um arquivo para iniciar a edição
                  </p>
                </div>

                {/* Simulated reels side icons in translucent outline for mockup vibe */}
                <div className="absolute right-3.5 bottom-16 flex flex-col items-center gap-4 opacity-20">
                  <div className="h-7 w-7 rounded-full border border-white flex items-center justify-center text-white" />
                  <div className="h-7 w-7 rounded-full border border-white flex items-center justify-center text-white" />
                  <div className="h-7 w-7 rounded-full border border-white flex items-center justify-center text-white" />
                </div>
              </div>

              {/* Bottom Home Indicator Pill */}
              <div className="w-20 h-1 bg-white/20 rounded-full mx-auto mt-auto z-45" />
            </div>

            {/* Cards explicativos abaixo do celular */}
            <div className="w-full max-w-[280px] flex flex-col gap-2.5">
              <div className="bg-[#060a13]/40 border border-blue-500/10 rounded-xl p-3 flex gap-2.5 items-start">
                <span className="text-xs bg-cyan-500/10 text-cyan-400 p-1.5 rounded-lg">💬</span>
                <div>
                  <h4 className="text-[10px] font-bold text-slate-200">Legendas Automáticas</h4>
                  <p className="text-[8px] text-slate-400 mt-0.5 leading-normal">Legenda palavra por palavra com cores neon dinâmicas e efeitos visuais.</p>
                </div>
              </div>

              <div className="bg-[#060a13]/40 border border-blue-500/10 rounded-xl p-3 flex gap-2.5 items-start">
                <span className="text-xs bg-purple-500/10 text-purple-400 p-1.5 rounded-lg">🔎</span>
                <div>
                  <h4 className="text-[10px] font-bold text-slate-200">Zoom Inteligente</h4>
                  <p className="text-[8px] text-slate-400 mt-0.5 leading-normal">Cortes de câmera e enquadramentos dinâmicos nos momentos cruciais do áudio.</p>
                </div>
              </div>

              <div className="bg-[#060a13]/40 border border-blue-500/10 rounded-xl p-3 flex gap-2.5 items-start">
                <span className="text-xs bg-indigo-500/10 text-indigo-400 p-1.5 rounded-lg">⚡</span>
                <div>
                  <h4 className="text-[10px] font-bold text-slate-200">Inserção de B-Rolls</h4>
                  <p className="text-[8px] text-slate-400 mt-0.5 leading-normal">Imagens cinemáticas e vídeos de apoio inseridos sobre suas falas importantes.</p>
                </div>
              </div>
            </div>

          </div>
        </div>
      )}

      {/* ESTADO 2: TELA DE PROCESSAMENTO */}
      {step === 'processing' && (
        <div className="flex flex-col justify-center items-center gap-6 flex-1 min-h-0 select-none bg-[#050914]/20 border border-blue-500/10 rounded-3xl p-10">
          <div className="relative h-16 w-16 flex items-center justify-center">
            <Loader2 className="h-10 w-10 text-cyan-400 animate-spin absolute" />
            <div className="h-6 w-6 rounded-full bg-cyan-500/10 border border-cyan-400/20 flex items-center justify-center text-cyan-400 text-xs font-bold animate-pulse">
              AI
            </div>
          </div>
          
          <div className="text-center flex flex-col gap-2.5 max-w-sm">
            <h3 className="text-sm font-bold text-slate-200">Processando seu Vídeo Bruto...</h3>
            <p className="text-xs text-slate-400 leading-relaxed font-semibold animate-pulse">{processingLog}</p>
          </div>

          {/* Barra de Progresso Simulado */}
          <div className="w-full max-w-xs h-1.5 bg-slate-950 border border-slate-900 rounded-full overflow-hidden">
            <div 
              className="h-full bg-gradient-to-r from-blue-500 via-cyan-400 to-indigo-500 transition-all duration-500 rounded-full"
              style={{ width: `${(processingStage + 1) * 20}%` }}
            />
          </div>
        </div>
      )}

      {/* ESTADO 3: O EDITOR DE AUTO-EDIÇÃO (PÓS-UPLOAD) */}
      {step === 'editor' && (
        <div className="grid grid-cols-12 gap-6 items-stretch flex-1 min-h-0 h-full select-none">
          
          {/* COLUNA ESQUERDA: PAINEL DE CONTROLE, EDITOR DE TEXTO E CHAT */}
          <div className="col-span-12 lg:col-span-8 flex flex-col gap-4 h-full min-h-0">
            
            {/* Abas no Topo (Estilo botões minimalistas/pílulas) */}
            <div className="flex gap-2 shrink-0 select-none pb-1">
              <button
                onClick={() => setActiveTab('roteiro')}
                className={`flex items-center gap-2 px-5 py-2.5 rounded-full text-xs font-bold transition-all duration-300 ${
                  activeTab === 'roteiro'
                    ? 'bg-gradient-to-r from-blue-600 to-indigo-600 border border-indigo-500/30 text-white shadow-md shadow-indigo-600/10'
                    : 'bg-[#060a13] border border-[#1e2d4a]/80 text-slate-400 hover:text-slate-200 hover:border-slate-800'
                }`}
              >
                <span>📝</span> Revisar Roteiro
              </button>
              <button
                onClick={() => setActiveTab('estilos')}
                className={`flex items-center gap-2 px-5 py-2.5 rounded-full text-xs font-bold transition-all duration-300 ${
                  activeTab === 'estilos'
                    ? 'bg-gradient-to-r from-blue-600 to-indigo-600 border border-indigo-500/30 text-white shadow-md shadow-indigo-600/10'
                    : 'bg-[#060a13] border border-[#1e2d4a]/80 text-slate-400 hover:text-slate-200 hover:border-slate-800'
                }`}
              >
                <span>🎨</span> Estilo & Mídias
              </button>
            </div>

            {/* ABA 1: REVISAR ROTEIRO (Bloco de legendas em altura total) */}
            {activeTab === 'roteiro' && (
              <div className="flex-1 min-h-0 flex flex-col gap-3">
                <div className="flex items-center justify-between shrink-0">
                  <span className="text-[10px] text-slate-500 uppercase font-extrabold tracking-wider">Blocos de Legenda / Roteiro</span>
                  <button
                    onClick={handleAddScene}
                    className="px-3 py-1.5 bg-slate-900 border border-slate-800 hover:border-blue-500/40 text-[9px] font-bold text-slate-400 hover:text-white rounded-lg transition-all flex items-center gap-1 active:scale-95"
                  >
                    <Plus className="h-3 w-3" />
                    Nova Cena
                  </button>
                </div>

                <div className="flex-1 min-h-0 overflow-y-auto pr-1 flex flex-col gap-3 scrollbar-thin scrollbar-thumb-slate-900 scrollbar-track-transparent">
                  {subtitles.map((scene, idx) => (
                    <div 
                      key={scene.id} 
                      className="bg-[#060a13] border border-blue-500/30 rounded-xl p-4 flex gap-4 items-start relative hover:border-blue-500/50 transition-all duration-300"
                    >
                      <div className="h-5 w-5 rounded bg-slate-950 border border-slate-900 text-[9px] font-bold text-slate-400 flex items-center justify-center select-none">
                        {idx + 1}
                      </div>

                      <div className="flex-1 flex flex-col gap-2">
                        <textarea
                          value={scene.text}
                          onChange={(e) => handleSubtitleTextChange(scene.id, e.target.value)}
                          className="w-full h-12 bg-transparent text-xs text-slate-200 outline-none resize-none leading-relaxed"
                          placeholder="Edite a fala da cena..."
                        />
                        <div className="flex items-center justify-between text-[9px] text-slate-500 border-t border-slate-900/60 pt-2 font-semibold">
                          <span>⏱️ Duração: {(scene.end - scene.start).toFixed(1)}s</span>
                          <span>Intervalo: {scene.start.toFixed(1)}s - {scene.end.toFixed(1)}s</span>
                        </div>
                      </div>

                      <button
                        onClick={() => handleDeleteScene(scene.id)}
                        className="p-1 rounded hover:bg-red-500/10 text-slate-500 hover:text-red-400 transition-colors"
                        title="Excluir Cena"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* ABA 2: ESTILO & MÍDIAS (Blocos de Customização e B-Rolls) */}
            {activeTab === 'estilos' && (
              <div className="flex-1 min-h-0 flex flex-col gap-4 overflow-y-auto pr-1 scrollbar-thin scrollbar-thumb-slate-900 scrollbar-track-transparent">
                {/* Bloco 1: Seletores de Legenda */}
                <div className="bg-[#060a13] border border-blue-500/40 shadow-[0_0_20px_rgba(59,130,246,0.06)] rounded-2xl p-4 flex flex-col gap-3 shrink-0">
                  <div className="flex items-center gap-2 border-b border-slate-900/60 pb-2.5">
                    <Sliders className="h-4.5 w-4.5 text-cyan-400" />
                    <h3 className="text-xs font-extrabold text-slate-200 uppercase tracking-wider">Ajuste de Design das Legendas</h3>
                  </div>

                  <div className="grid grid-cols-3 gap-6">
                    {/* 1. Cor Neon */}
                    <div className="flex flex-col gap-2">
                      <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wide">Cor de Destaque</span>
                      <div className="flex items-center gap-2">
                        {[
                          { name: 'Gold', val: '#FFD700', bg: 'bg-[#FFD700]' },
                          { name: 'Cyan', val: '#00E5FF', bg: 'bg-[#00E5FF]' },
                          { name: 'Pink', val: '#FF007F', bg: 'bg-[#FF007F]' },
                          { name: 'Emerald', val: '#10B981', bg: 'bg-[#10B981]' },
                          { name: 'Amber', val: '#F59E0B', bg: 'bg-[#F59E0B]' }
                        ].map(c => (
                          <button
                            key={c.val}
                            onClick={() => setNeonColor(c.val)}
                            className={`h-6 w-6 rounded-full ${c.bg} transition-all border ${
                              neonColor === c.val ? 'ring-2 ring-indigo-500 scale-110 border-white' : 'border-slate-800 hover:scale-105'
                            }`}
                            title={c.name}
                          />
                        ))}
                      </div>
                    </div>

                    {/* 2. Tamanho da Legenda */}
                    <div className="flex flex-col gap-2">
                      <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wide">Tamanho</span>
                      <div className="flex p-0.5 rounded-lg bg-slate-950 border border-slate-900">
                        {(['small', 'medium', 'large'] as const).map(size => (
                          <button
                            key={size}
                            onClick={() => setTextSize(size)}
                            className={`flex-1 py-1 text-[9px] font-bold rounded-md transition-all ${
                              textSize === size 
                                ? 'bg-[#161328] border border-[#7c3aed]/40 text-white' 
                                : 'text-slate-400 hover:text-slate-200'
                            }`}
                          >
                            {size === 'small' ? 'Peq' : size === 'medium' ? 'Méd' : 'Grd'}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* 3. Tipo de Fonte */}
                    <div className="flex flex-col gap-2">
                      <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wide">Tipo de Fonte</span>
                      <div className="flex p-0.5 rounded-lg bg-slate-950 border border-slate-900">
                        {['Montserrat', 'Poppins', 'Inter', 'Impact'].map(f => (
                          <button
                            key={f}
                            onClick={() => setFontFamily(f)}
                            className={`flex-1 py-1 text-[9px] font-bold rounded-md transition-all ${
                              fontFamily === f 
                                ? 'bg-[#161328] border border-[#7c3aed]/40 text-white' 
                                : 'text-slate-400 hover:text-slate-200'
                            }`}
                          >
                            {f}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Bloco 2: Gerar B-Rolls Inteligentes */}
                <div className="bg-[#060a13] border border-blue-500/40 shadow-[0_0_20px_rgba(59,130,246,0.06)] rounded-2xl p-4 flex flex-col gap-3 shrink-0">
                  <div className="flex-1">
                    <p className="text-xs text-slate-300 font-semibold leading-normal">
                      {bRollsActive 
                        ? 'Takes B-Roll gerados com IA foram inseridos. Você pode desativar ou regerar a qualquer momento.'
                        : 'Adicione mídias de vídeo cinemáticas sobre as falas mais impactantes do seu vídeo para aumentar a retenção.'
                      }
                    </p>
                  </div>
                  
                  {isGeneratingBRolls ? (
                    <div className="px-5 py-3.5 bg-slate-950 border border-blue-500/30 rounded-xl flex items-center gap-3">
                      <Loader2 className="h-4 w-4 text-cyan-400 animate-spin" />
                      <span className="text-[10px] text-slate-400 font-bold animate-pulse">{bRollLog}</span>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2 mt-2">
                      {bRollsActive && (
                        <button
                          onClick={() => setBRollsActive(false)}
                          className="px-4 py-3 bg-red-500/10 border border-red-500/30 hover:border-red-400 text-xs font-bold text-red-400 rounded-xl active:scale-95 transition-all"
                        >
                          Remover B-Rolls
                        </button>
                      )}
                      <button
                        onClick={handleGenerateBRolls}
                        className="px-4.5 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-xs font-extrabold text-white rounded-xl shadow-lg shadow-indigo-600/10 active:scale-95 transition-all"
                      >
                        {bRollsActive ? '⚡ Regerar B-Rolls com IA' : '⚡ Gerar B-Rolls e Takes com IA'}
                      </button>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Bloco 4: Chat do Consultor base */}
            <div className="flex flex-col rounded-2xl border border-indigo-500/50 shadow-[0_0_20px_rgba(99,102,241,0.12)] bg-[#060a13] p-4 h-[210px] shrink-0 justify-between font-sans">
              {/* Chat mensagens */}
              <div className="flex-1 overflow-y-auto pr-1 flex flex-col gap-3 scrollbar-thin scrollbar-thumb-indigo-500/20 scrollbar-track-transparent">
                {chatMessages.map(msg => (
                  <div
                    key={msg.id}
                    className={`flex flex-col max-w-[80%] ${
                      msg.sender === 'user' ? 'self-end' : 'self-start'
                    }`}
                  >
                    <div
                      className={`px-4 py-2.5 rounded-2xl text-xs leading-relaxed ${
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
                  <div className="self-start flex items-center gap-2 text-[10px] text-indigo-400 font-medium italic animate-pulse py-1">
                    <Loader2 className="h-3 w-3 animate-spin" />
                    <span>🤖 Consultor de Edição está digitando...</span>
                  </div>
                )}
                <div ref={chatEndRef} />
              </div>

              {/* Chat Input */}
              <div className="flex items-center gap-2 border-t border-slate-900/40 pt-3 mt-3 select-none">
                <input 
                  type="text"
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSendChat()}
                  placeholder="Comande a edição com IA (ex: 'mude a cor para ciano')..."
                  className="flex-1 bg-transparent text-slate-200 placeholder-slate-500 text-xs outline-none"
                  disabled={isConsultantLoading}
                />
                <button
                  onClick={handleSendChat}
                  disabled={isConsultantLoading || !chatInput.trim()}
                  className="h-8 w-8 flex items-center justify-center rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 text-white hover:opacity-95 active:scale-95 transition-all shadow-md shadow-indigo-600/10 disabled:opacity-30"
                >
                  <Send className="h-3.5 w-3.5 text-white" />
                </button>
              </div>
            </div>

          </div>

          {/* COLUNA DIREITA: CELULAR SIMULADO COMO PLAYER FIXO DENTRO DE CARD PREMIUM */}
          <div className="col-span-12 lg:col-span-4 flex flex-col h-full min-h-0">
            <div className="flex-1 min-h-0 w-full border border-blue-500/30 bg-[#060a13] shadow-[0_0_25px_rgba(59,130,246,0.06)] rounded-[2rem] p-6 flex flex-col items-center justify-between gap-4">
              <h2 className="text-[10px] uppercase font-extrabold tracking-widest text-slate-400 w-full text-left shrink-0">
                Visualização em Tempo Real
              </h2>

              <div className="flex-1 min-h-0 w-full flex items-center justify-center">
                <div 
                  ref={phoneContainerRef}
                  className="h-full max-h-[530px] aspect-[9/16] bg-[#060a13] border border-blue-500/30 shadow-[0_0_20px_rgba(59,130,246,0.12)] rounded-[2.5rem] border-[8px] border-slate-950 overflow-hidden flex flex-col justify-end relative"
                >
                  {/* Fake Status Bar */}
                  <div className="absolute top-2.5 inset-x-5 flex justify-between items-center text-[8px] font-bold text-white/70 z-45 pointer-events-none select-none">
                    <span>23:25</span>
                    <div className="flex items-center gap-1.5">
                      <span>📶</span>
                      <span>📶</span>
                      <span>🔋</span>
                    </div>
                  </div>

                  {/* Dynamic Island / Notch */}
                  <div className="absolute top-2 left-1/2 -translate-x-1/2 w-20 h-4 bg-black rounded-full z-45 flex items-center justify-center pointer-events-none">
                    <div className="w-1.5 h-1.5 bg-slate-900 rounded-full mr-1"></div>
                    <div className="w-3.5 h-0.5 bg-slate-900 rounded-full mx-1"></div>
                    <div className="w-1.5 h-1.5 bg-blue-900/40 rounded-full ml-1"></div>
                  </div>

                  {/* Bottom Home Indicator Pill */}
                  <div className="absolute bottom-1.5 left-1/2 -translate-x-1/2 w-20 h-1 bg-white/40 rounded-full z-45 pointer-events-none" />

                  {/* Badge de IA no topo */}
                  {videoUrl && (
                    <div className="absolute top-9 left-4 z-35 pointer-events-none select-none">
                      <div className="bg-[#050b14]/75 backdrop-blur-md border border-amber-500/30 px-2.5 py-0.5 rounded-full flex items-center gap-1 shadow-md">
                        <span className="text-amber-400 text-[8px]">✨</span>
                        <span className="text-[7.5px] font-extrabold text-amber-400 tracking-wider uppercase">Exemplo real gerado com IA</span>
                      </div>
                    </div>
                  )}

                  {/* Video Player */}
                  {videoUrl ? (
                    <div className="w-full h-full relative flex flex-col justify-end group/player">
                      {/* B-Roll player overlay under the subtitles if active */}
                      {bRollsActive && bRollUrls.map((url, idx) => {
                        const isActive = idx === activeBRollIdx;
                        return (
                          <video
                            key={`broll-player-${idx}`}
                            ref={(el) => { bRollRefs.current[idx] = el; }}
                            src={url}
                            preload="auto"
                            style={{
                              opacity: isActive ? 1 : 0,
                              pointerEvents: isActive ? 'auto' : 'none',
                              zIndex: isActive ? 20 : 10
                            }}
                            loop
                            playsInline
                            muted={true}
                            className="absolute inset-0 w-full h-full object-cover bg-black"
                          />
                        );
                      })}

                      {/* Main user video element */}
                      <video
                        ref={videoRef}
                        src={videoUrl}
                        onTimeUpdate={handleTimeUpdate}
                        onLoadedMetadata={handleLoadedMetadata}
                        onClick={togglePlay}
                        loop
                        playsInline
                        style={{
                          // If B-roll is active and showing, we push the user video behind the B-roll visually
                          opacity: bRollsActive && activeBRollIdx !== -1 ? 0 : 1,
                          zIndex: 15
                        }}
                        className="absolute inset-0 w-full h-full object-cover cursor-pointer bg-black"
                      />

                      {/* Reels Overlays: Heart, Comment, Share (como no segundo screenshot) */}
                      <div className="absolute right-3 bottom-24 flex flex-col items-center gap-4.5 z-35 pointer-events-auto select-none">
                        <button className="flex flex-col items-center gap-1 group/btn">
                          <div className="h-8.5 w-8.5 rounded-full bg-black/30 backdrop-blur-sm border border-white/5 flex items-center justify-center text-white transition-all hover:scale-105 active:scale-95 shadow-md">
                            <Heart className="h-4 w-4" />
                          </div>
                          <span className="text-[8.5px] font-bold text-white tracking-wider text-shadow">12.8K</span>
                        </button>
                        
                        <button className="flex flex-col items-center gap-1 group/btn">
                          <div className="h-8.5 w-8.5 rounded-full bg-black/30 backdrop-blur-sm border border-white/5 flex items-center justify-center text-white transition-all hover:scale-105 active:scale-95 shadow-md">
                            <MessageCircle className="h-4 w-4" />
                          </div>
                          <span className="text-[8.5px] font-bold text-white tracking-wider text-shadow">352</span>
                        </button>

                        <button className="flex flex-col items-center gap-1 group/btn">
                          <div className="h-8.5 w-8.5 rounded-full bg-black/30 backdrop-blur-sm border border-white/5 flex items-center justify-center text-white transition-all hover:scale-105 active:scale-95 shadow-md">
                            <Share2 className="h-4 w-4" />
                          </div>
                          <span className="text-[8.5px] font-bold text-white tracking-wider text-shadow">2.1K</span>
                        </button>
                      </div>

                      {/* Legenda Estilizada sobreposta */}
                      {(() => {
                        const activeSub = subtitles.find(sub => currentTime >= sub.start && currentTime <= sub.end);
                        if (!activeSub || !activeSub.text.trim()) return null;

                        const words = activeSub.text.trim().split(/\s+/);
                        const totalWords = words.length;
                        const duration = activeSub.end - activeSub.start;
                        const elapsed = currentTime - activeSub.start;

                        const activeWordIdx = totalWords > 1 && duration > 0
                          ? Math.min(Math.floor((elapsed / duration) * totalWords), totalWords - 1)
                          : 0;

                        // Ajustar tamanhos de fonte baseados no phoneWidth e selector
                        const sizeMult = textSize === 'small' ? 0.055 : textSize === 'large' ? 0.090 : 0.075;

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
                              paddingBottom: `${phoneWidth * 0.35}px`,
                              paddingLeft: `${phoneWidth * 0.08}px`,
                              paddingRight: `${phoneWidth * 0.08}px`,
                              pointerEvents: 'none',
                              zIndex: 35
                            }}
                          >
                            <h1
                              style={{
                                fontFamily: `${fontFamily}, sans-serif`,
                                fontSize: `${phoneWidth * sizeMult}px`,
                                fontWeight: 900,
                                textTransform: 'uppercase',
                                textAlign: 'center',
                                lineHeight: 1.25,
                                letterSpacing: '1px',
                                display: 'flex',
                                flexWrap: 'wrap',
                                justifyContent: 'center',
                                rowGap: '4px',
                                textShadow: `
                                  -2px -2px 0 #000,
                                   2px -2px 0 #000,
                                  -2px  2px 0 #000,
                                   2px  2px 0 #000,
                                   0px 4px 10px rgba(0, 0, 0, 0.8)
                                `
                              }}
                            >
                              {words.map((word, index) => {
                                const isWordActive = index === activeWordIdx;
                                return (
                                  <span
                                    key={index}
                                    style={{
                                      color: isWordActive ? neonColor : '#FFFFFF',
                                      marginRight: '6px',
                                      display: 'inline-block',
                                      transform: isWordActive ? 'scale(1.10)' : 'scale(1.0)',
                                      transition: 'transform 0.15s ease-out'
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

                      {/* Controles de Play/Pause na base */}
                      <div className="absolute bottom-4 inset-x-4 flex items-center justify-between z-40 pointer-events-auto">
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

                      {/* Barra de Progresso */}
                      <div className="absolute bottom-0 inset-x-0 h-1 bg-white/15 z-40 select-none">
                        <div 
                          className="h-full bg-gradient-to-r from-cyan-500 to-blue-500" 
                          style={{ width: `${videoDuration ? (currentTime / videoDuration) * 100 : 0}%` }}
                        />
                      </div>

                    </div>
                  ) : (
                    <div className="h-full flex items-center justify-center text-slate-600 text-[10px] font-bold p-6 text-center leading-relaxed">
                      Aguardando envio do vídeo para reproduzir...
                    </div>
                  )}
                </div>
              </div>

              {/* Informações de formato e duração */}
              <div className="text-center shrink-0">
                <p className="text-[11px] text-slate-400 font-bold flex items-center justify-center gap-1.5">
                  <span>📱 Vídeo completo em {videoDuration ? Math.round(videoDuration) : '15'}s</span>
                  <span className="text-slate-600">•</span>
                  <span>Formato Reels 9:16</span>
                </p>
              </div>

              {/* Botão Salvar e Exportar */}
              {videoUrl && (
                <button 
                  onClick={() => {
                    alert('Seu vídeo editado foi enviado para renderização final! Você receberá uma notificação em instantes.');
                    setStep('upload');
                    setVideoUrl(null);
                    setSubtitles([]);
                    setBRollsActive(false);
                  }}
                  className="w-full bg-gradient-to-r from-cyan-500 to-indigo-600 hover:from-cyan-600 hover:to-indigo-700 py-3.5 rounded-xl font-bold text-white transition-all active:scale-[0.99] text-xs shadow-lg shadow-indigo-500/10 flex items-center justify-center gap-1.5 shrink-0"
                >
                  <span>⚡ Renderizar Vídeo HD Final</span>
                  <span className="text-[10px] text-white/70 font-semibold normal-case">(Consome 1 crédito)</span>
                </button>
              )}
            </div>
          </div>

        </div>
      )}

    </div>
  );
}
