'use client';

import React, { useState, useEffect, useRef } from 'react';
import { createClient } from '@supabase/supabase-js';
import {
  Play,
  Pause,
  Download,
  AlertTriangle,
  Loader2,
  Calendar,
  Video,
  RefreshCw,
  ExternalLink,
  Volume2,
  VolumeX,
  X,
  Sparkles
} from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';


// Interfaces
interface VideoJob {
  id: string;
  user_id: string;
  prompt_input: string;
  status: 'pending' | 'scripting' | 'processing' | 'rendering' | 'completed' | 'ready' | 'failed' | 'draft';
  video_url: string | null;
  created_at: string;
  script_json?: any;
}

// Configuração do Supabase
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
const supabase = createClient(supabaseUrl, supabaseAnonKey);

export default function HistoryPage() {
  const router = useRouter();
  const [videos, setVideos] = useState<VideoJob[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedVideo, setSelectedVideo] = useState<VideoJob | null>(null);

  const [userId, setUserId] = useState<string | null>(null);
  const [isDevMode, setIsDevMode] = useState(false);

  // Estados do Modal de Vídeo
  const [modalPlaying, setModalPlaying] = useState(false);
  const [modalMuted, setModalMuted] = useState(false);
  const modalVideoRef = useRef<HTMLVideoElement>(null);

  // Detectar ambiente de desenvolvimento
  useEffect(() => {
    setIsDevMode(process.env.NODE_ENV === 'development');
  }, []);

  // Buscar usuário e inicializar busca de dados
  useEffect(() => {
    async function initAuthAndFetch() {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          setUserId(user.id);
          fetchVideos(user.id);
        } else {
          // Fallback para desenvolvimento
          if (process.env.NODE_ENV === 'development' || !process.env.NODE_ENV) {
            console.log('🔧 [DEV MODE] Nenhuma sessão ativa. Tentando obter usuário de teste...');
            const { data: testUsers } = await supabase.from('profiles').select('id').limit(1);
            if (testUsers && testUsers.length > 0) {
              const devUid = testUsers[0].id;
              setUserId(devUid);
              fetchVideos(devUid);
            } else {
              // Se não houver usuários cadastrados, busca todos os vídeos na dev
              fetchVideos(null);
            }
          } else {
            setIsLoading(false);
          }
        }
      } catch (err: any) {
        console.error('Erro ao inicializar página de histórico:', err);
        setError('Ocorreu um erro ao carregar a sessão.');
        setIsLoading(false);
      }
    }

    initAuthAndFetch();
  }, []);

  // Função para buscar os vídeos
  async function fetchVideos(uid: string | null) {
    setIsRefreshing(true);
    try {
      let query = supabase.from('video_jobs').select('*');
      
      // Aplicar filtro de segurança (apenas se não estivermos no fallback dev geral)
      if (uid) {
        query = query.eq('user_id', uid);
      }

      // Ordenar por mais recente
      const { data, error: fetchError } = await query.order('created_at', { ascending: false });

      if (fetchError) throw fetchError;

      setVideos(data || []);
      setError(null);
    } catch (err: any) {
      console.error('Erro ao buscar históricos do banco:', err);
      setError('Não foi possível carregar o histórico de vídeos.');
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }

  // Ação de download seguro ( Blob -> Fallback para Tab )
  const handleDownloadVideo = async (e: React.MouseEvent, videoUrl: string, jobId: string) => {
    e.stopPropagation(); // Evita abrir o modal ao clicar no download
    
    // Mostra feedback no console
    console.log(`Iniciando download do vídeo ${jobId} de ${videoUrl}`);

    try {
      const response = await fetch(videoUrl, { mode: 'cors' });
      if (!response.ok) throw new Error('Network response was not ok.');
      
      const blob = await response.blob();
      const blobUrl = window.URL.createObjectURL(blob);
      
      const a = document.createElement('a');
      a.href = blobUrl;
      a.download = `aetherreels-${jobId.slice(0, 8)}.mp4`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(blobUrl);
    } catch (err) {
      console.warn('CORS ou limite de rede impediu download direto por Blob. Usando fallback de aba aberta.', err);
      // Fallback robusto que evita bloqueador de popups e faz o download direto
      window.open(videoUrl, '_blank');
    }
  };

  // Funções do Modal
  const openVideoModal = (video: VideoJob) => {
    setSelectedVideo(video);
    setModalPlaying(true);
  };

  const closeVideoModal = () => {
    setSelectedVideo(null);
    setModalPlaying(false);
  };

  const toggleModalPlay = () => {
    if (modalVideoRef.current) {
      if (modalPlaying) {
        modalVideoRef.current.pause();
      } else {
        modalVideoRef.current.play().catch(() => {});
      }
      setModalPlaying(!modalPlaying);
    }
  };

  const toggleModalMute = () => {
    if (modalVideoRef.current) {
      modalVideoRef.current.muted = !modalMuted;
      setModalMuted(!modalMuted);
    }
  };

  // Formatação de data amigável no lado do cliente
  const DateString = ({ dateString }: { dateString: string }) => {
    const [formatted, setFormatted] = useState('');
    
    useEffect(() => {
      try {
        const date = new Date(dateString);
        const formatOptions: Intl.DateTimeFormatOptions = {
          day: 'numeric',
          month: 'long'
        };
        const text = date.toLocaleDateString('pt-BR', formatOptions);
        // Deixar primeira letra do mês maiúscula
        const capitalized = text.replace(/de (\w)/g, (match, letter) => `de ${letter.toUpperCase()}`);
        setFormatted(`Gerado em ${capitalized}`);
      } catch {
        setFormatted('Data indisponível');
      }
    }, [dateString]);

    return <span>{formatted}</span>;
  };

  return (
    <div className="flex flex-col gap-8">
      {/* Cabeçalho da Página */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-white/5 pb-6">
        <div>
          <h1 className="font-display text-4xl font-extrabold text-white flex items-center gap-2.5">
            Meus Vídeos
            <span className="flex h-2 w-2 rounded-full bg-cyan-400 shadow-[0_0_8px_rgba(34,211,238,0.7)] animate-pulse" />
          </h1>
          <p className="text-slate-400 text-sm mt-1.5">
            Visualize, reproduza e faça o download de todas as suas criações do AetherReels.
          </p>
        </div>

        <div className="flex items-center gap-3">
          {isDevMode && (
            <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-1 bg-amber-500/10 border border-amber-500/20 text-amber-400 rounded">
              Modo Desenvolvedor
            </span>
          )}
          <button
            onClick={() => fetchVideos(userId)}
            disabled={isLoading || isRefreshing}
            className="inline-flex items-center justify-center gap-2 rounded-xl border border-[#1e293b]/40 bg-slate-900/40 hover:bg-slate-900/80 active:scale-95 px-4.5 py-2.5 text-xs font-semibold text-slate-300 transition-all duration-200"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${isRefreshing ? 'animate-spin text-cyan-400' : ''}`} />
            {isRefreshing ? 'Atualizando...' : 'Atualizar'}
          </button>
        </div>
      </div>

      {/* Exibição de Erros */}
      {error && (
        <div className="rounded-xl border border-red-500/20 bg-red-500/5 p-4 text-sm text-red-400 flex items-start gap-3">
          <AlertTriangle className="h-5 w-5 shrink-0 text-red-500" />
          <div>{error}</div>
        </div>
      )}

      {/* Estados Principais (Loading, Vazio, Grid) */}
      {isLoading ? (
        // Grid de Loading (Skeleton Loaders)
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
          {Array.from({ length: 4 }).map((_, i) => (
            <div
              key={i}
              className="relative aspect-[9/16] rounded-2xl border border-[#1e293b]/20 bg-[#0b1329]/10 animate-pulse overflow-hidden p-6 flex flex-col justify-between"
            >
              <div className="w-1/3 h-5 bg-slate-800/60 rounded-lg" />
              <div className="flex flex-col gap-3">
                <div className="w-full h-4 bg-slate-800/60 rounded-md" />
                <div className="w-2/3 h-4 bg-slate-800/60 rounded-md" />
                <div className="w-1/2 h-4 bg-slate-800/60 rounded-md mt-2" />
              </div>
            </div>
          ))}
        </div>
      ) : videos.length === 0 ? (
        // Estado Vazio
        <div className="flex flex-col items-center justify-center text-center py-20 px-4 rounded-3xl border border-[#1e293b]/20 bg-[#0b1329]/10 backdrop-blur-sm max-w-2xl mx-auto w-full">
          <div className="relative flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-600/10 to-cyan-400/10 p-0.5 border border-cyan-500/20 mb-6">
            <Video className="h-8 w-8 text-cyan-400" />
          </div>
          <h3 className="font-display text-xl font-bold text-white">Nenhum vídeo encontrado</h3>
          <p className="text-slate-400 text-sm max-w-sm mt-2 leading-relaxed">
            Você ainda não gerou nenhum vídeo. Vá para o criador e dê asas à sua criatividade!
          </p>
          <Link
            href="/dashboard"
            className="mt-6 inline-flex items-center justify-center rounded-xl bg-gradient-to-r from-blue-600 to-cyan-400 px-6 py-3 text-sm font-semibold text-white shadow-lg shadow-cyan-500/10 hover:shadow-cyan-500/25 active:scale-95 transition-all duration-200"
          >
            Criar Meu Primeiro Vídeo
          </Link>
        </div>
      ) : (
        // Grid de Vídeos
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
          {videos.map((video) => {
            const isCompleted = video.status === 'completed' || video.status === 'ready';
            const isFailed = video.status === 'failed';
            const isDraft = video.status === 'draft';
            const isProcessing = ['pending', 'scripting', 'processing', 'rendering'].includes(video.status);

            return (
              <div
                key={video.id}
                className="group/card relative aspect-[9/16] rounded-2xl overflow-hidden border border-[#1e293b]/40 bg-[#0b1329]/20 shadow-lg flex flex-col justify-between transition-all duration-300 hover:border-cyan-500/30 hover:shadow-[0_0_20px_rgba(6,182,212,0.05)] cursor-pointer"
                onClick={() => {
                  if (isDraft) {
                    router.push(`/dashboard/projetos/${video.id}/edit`);
                  } else if (isCompleted) {
                    openVideoModal(video);
                  }
                }}
              >
                {/* 1. ESTADO CONCLUÍDO (Player com Hover Play) */}
                {isCompleted && video.video_url && (
                  <>
                    <video
                      src={video.video_url}
                      preload="metadata"
                      muted
                      loop
                      playsInline
                      className="absolute inset-0 w-full h-full object-cover transition-transform duration-500 group-hover/card:scale-105 bg-black"
                      onMouseEnter={(e) => e.currentTarget.play().catch(() => {})}
                      onMouseLeave={(e) => {
                        e.currentTarget.pause();
                        e.currentTarget.currentTime = 0;
                      }}
                    />
                    
                    {/* Overlay de gradiente para contraste do texto */}
                    <div className="absolute inset-0 bg-gradient-to-t from-black via-black/40 to-black/10 z-10 pointer-events-none" />

                    {/* Botão centralizado de Play (exibido em hover) */}
                    <div className="absolute inset-0 flex items-center justify-center z-20 opacity-0 group-hover/card:opacity-100 transition-opacity duration-300 pointer-events-none">
                      <div className="h-12 w-12 rounded-full bg-cyan-400/90 text-slate-950 flex items-center justify-center shadow-lg shadow-cyan-500/20 transform scale-90 group-hover/card:scale-100 transition-transform duration-300">
                        <Play className="h-5 w-5 fill-current ml-0.5" />
                      </div>
                    </div>
                  </>
                )}

                {/* 2. ESTADO PROCESSANDO / PENDENTE */}
                {isProcessing && (
                  <div className="absolute inset-0 bg-slate-950/75 z-10 flex flex-col justify-center items-center gap-4 p-6 text-center select-none">
                    {/* Animação com Pulso de Neon */}
                    <div className="relative flex h-14 w-14 items-center justify-center rounded-full bg-cyan-500/10 border border-cyan-500/20">
                      <Loader2 className="h-6 w-6 text-cyan-400 animate-spin" />
                      <span className="absolute inset-0 rounded-full bg-cyan-400/10 animate-ping opacity-75" />
                    </div>
                    
                    <div className="space-y-1">
                      <p className="text-xs font-semibold text-slate-200">
                        {video.status === 'scripting' && 'Gerando Roteiro com IA...'}
                        {video.status === 'rendering' && 'Renderizando na AWS...'}
                        {video.status === 'processing' && 'Processando Mídias...'}
                        {video.status === 'pending' && 'Fila de Processamento...'}
                        {!['scripting', 'rendering', 'processing', 'pending'].includes(video.status) && 'Produzindo vídeo...'}
                      </p>
                      <p className="text-[10px] text-slate-500">
                        Isso pode levar alguns minutos
                      </p>
                    </div>
                  </div>
                )}

                {/* 3. ESTADO COM FALHA */}
                {isFailed && (
                  <div className="absolute inset-0 bg-slate-950/70 z-10 flex flex-col justify-center items-center gap-3.5 p-6 text-center select-none">
                    <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-red-500/10 border border-red-500/20 text-red-500">
                      <AlertTriangle className="h-6 w-6" />
                    </div>
                    <div className="space-y-1">
                      <p className="text-xs font-semibold text-slate-200">Falha na Renderização</p>
                      <p className="text-[10px] text-slate-500 leading-normal max-w-[160px] mx-auto">
                        Seus créditos foram devolvidos à sua conta.
                      </p>
                    </div>
                  </div>
                )}

                {/* 4. ESTADO RASCUNHO */}
                {isDraft && (
                  <>
                    {(() => {
                      const scriptData = typeof video.script_json === 'string' 
                        ? JSON.parse(video.script_json) 
                        : video.script_json;
                      const previewVideoUrl = scriptData?.video_urls?.[0] || scriptData?.b_roll_videos?.[0] || (scriptData?.scenes?.[0]?.video_url);

                      return previewVideoUrl ? (
                        <video
                          src={previewVideoUrl}
                          preload="metadata"
                          muted
                          loop
                          playsInline
                          autoPlay
                          className="absolute inset-0 w-full h-full object-cover opacity-35 bg-black transition-transform duration-500 group-hover/card:scale-105"
                        />
                      ) : null;
                    })()}
                    
                    {/* Overlay de gradiente para contraste e visual do editor */}
                    <div className="absolute inset-0 bg-[#070c19]/70 group-hover/card:bg-[#070c19]/60 transition-colors z-10 flex flex-col justify-center items-center gap-3.5 p-6 text-center select-none backdrop-blur-[1px]">
                      <div className="relative flex h-14 w-14 items-center justify-center rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-400 group-hover/card:bg-amber-500/20 group-hover/card:border-amber-500/40 transition-all duration-300">
                        <Sparkles className="h-6 w-6 text-amber-400 group-hover/card:scale-110 transition-transform duration-300" />
                        <span className="absolute inset-0 rounded-2xl bg-amber-400/5 animate-pulse" />
                      </div>
                      
                      <div className="space-y-1">
                        <p className="text-xs font-semibold text-slate-200 group-hover/card:text-white transition-colors">
                          Editor Inteligente
                        </p>
                        <p className="text-[10px] text-slate-500">
                          Clique para editar o rascunho
                        </p>
                      </div>
                    </div>
                  </>
                )}

                {/* Tags de status no topo do Card */}
                <div className="p-4 z-20 flex justify-between items-start pointer-events-none">
                  {isCompleted ? (
                    <span className="text-[10px] font-bold tracking-wider uppercase px-2.5 py-1 bg-emerald-500/25 border border-emerald-500/30 text-emerald-400 rounded-lg backdrop-blur-sm">
                      Pronto
                    </span>
                  ) : isFailed ? (
                    <span className="text-[10px] font-bold tracking-wider uppercase px-2.5 py-1 bg-red-500/20 border border-red-500/30 text-red-400 rounded-lg backdrop-blur-sm">
                      Erro
                    </span>
                  ) : isDraft ? (
                    <span className="text-[10px] font-bold tracking-wider uppercase px-2.5 py-1 bg-amber-500/25 border border-amber-500/30 text-amber-400 rounded-lg backdrop-blur-sm">
                      Rascunho
                    </span>
                  ) : (
                    <span className="text-[10px] font-bold tracking-wider uppercase px-2.5 py-1 bg-cyan-500/20 border border-cyan-500/30 text-cyan-400 rounded-lg backdrop-blur-sm animate-pulse">
                      Gerando
                    </span>
                  )}
                </div>


                {/* Conteúdo de Texto e Ações (Fundo do Card) */}
                <div className="p-4 z-20 w-full bg-gradient-to-t from-slate-950 via-slate-950/80 to-transparent flex flex-col gap-3.5">
                  {/* Prompt do Vídeo */}
                  <p className="text-xs text-slate-200 leading-relaxed font-medium line-clamp-3 group-hover/card:text-white transition-colors">
                    {video.prompt_input || 'Sem prompt definido'}
                  </p>

                  <div className="flex items-center justify-between border-t border-white/5 pt-3">
                    {/* Data Amigável */}
                    <div className="flex items-center gap-1.5 text-[10px] text-slate-400 font-medium">
                      <Calendar className="h-3 w-3 shrink-0" />
                      <DateString dateString={video.created_at} />
                    </div>

                    {/* Botões de Ação */}
                    {isCompleted && video.video_url && (
                      <button
                        onClick={(e) => handleDownloadVideo(e, video.video_url!, video.id)}
                        className="h-7 w-7 rounded-lg bg-white/5 border border-white/10 hover:bg-cyan-500/10 hover:border-cyan-500/30 text-slate-300 hover:text-cyan-400 flex items-center justify-center transition-all duration-200"
                        title="Baixar MP4"
                      >
                        <Download className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ================= MODAL DE PLAYER DE VÍDEO EXPANDIDO ================= */}
      {selectedVideo && selectedVideo.video_url && (
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-sm p-4 sm:p-6"
          onClick={closeVideoModal}
        >
          <div 
            className="relative w-full max-w-[420px] aspect-[9/16] bg-slate-950 border border-white/10 rounded-3xl overflow-hidden shadow-2xl flex flex-col justify-end"
            onClick={(e) => e.stopPropagation()} // Impede fechar ao clicar no player
          >
            {/* Player de Vídeo Nativo */}
            <video
              ref={modalVideoRef}
              src={selectedVideo.video_url}
              autoPlay
              loop
              playsInline
              onClick={toggleModalPlay}
              className="absolute inset-0 w-full h-full object-cover cursor-pointer bg-black"
            />

            {/* Cabeçalho do Modal */}
            <div className="absolute top-4 inset-x-4 flex justify-between items-center z-30">
              <span className="text-[10px] font-bold tracking-wider uppercase px-2.5 py-1 bg-black/60 border border-white/10 text-white/90 rounded-lg backdrop-blur-md">
                AetherReels Player
              </span>
              <button
                onClick={closeVideoModal}
                className="h-8 w-8 rounded-full bg-black/60 border border-white/10 text-white hover:bg-white/10 flex items-center justify-center transition-all duration-200 backdrop-blur-md"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Controles de Vídeo Flutuantes (exibidos no rodapé do player) */}
            <div className="absolute bottom-20 right-4 flex flex-col gap-3.5 z-30">
              <button
                onClick={toggleModalPlay}
                className="h-10 w-10 rounded-full bg-black/60 border border-white/10 text-white hover:bg-white/10 flex items-center justify-center transition-all duration-200 backdrop-blur-md"
              >
                {modalPlaying ? <Pause className="h-4.5 w-4.5" /> : <Play className="h-4.5 w-4.5 fill-current ml-0.5" />}
              </button>
              <button
                onClick={toggleModalMute}
                className="h-10 w-10 rounded-full bg-black/60 border border-white/10 text-white hover:bg-white/10 flex items-center justify-center transition-all duration-200 backdrop-blur-md"
              >
                {modalMuted ? <VolumeX className="h-4.5 w-4.5" /> : <Volume2 className="h-4.5 w-4.5" />}
              </button>
            </div>

            {/* Rodapé com Detalhes e Ações do Modal */}
            <div className="p-6 w-full bg-gradient-to-t from-black via-black/95 to-transparent z-25 flex flex-col gap-4">
              <div className="space-y-1.5 max-h-[140px] overflow-y-auto pr-1 scrollbar-thin">
                <p className="text-sm font-semibold text-white">Prompt Original</p>
                <p className="text-xs text-slate-300 leading-relaxed font-medium">
                  {selectedVideo.prompt_input}
                </p>
              </div>

              <div className="flex items-center justify-between border-t border-white/10 pt-4 gap-4">
                <div className="flex items-center gap-1.5 text-[11px] text-slate-400 font-semibold">
                  <Calendar className="h-3.5 w-3.5" />
                  <DateString dateString={selectedVideo.created_at} />
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={(e) => handleDownloadVideo(e, selectedVideo.video_url!, selectedVideo.id)}
                    className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-gradient-to-r from-blue-600 to-cyan-400 px-4 py-2.5 text-xs font-bold text-white shadow-md hover:shadow-cyan-500/20 active:scale-95 transition-all duration-200"
                  >
                    <Download className="h-3.5 w-3.5" />
                    Baixar MP4
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
