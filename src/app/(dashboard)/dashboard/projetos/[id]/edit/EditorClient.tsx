'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import dynamic from 'next/dynamic';
import { createClient } from '@supabase/supabase-js';

const PlayerWrapper = dynamic(() => import('./PlayerWrapper'), {
  ssr: false,
  loading: () => (
    <div className="w-full h-full flex flex-col justify-center items-center gap-2 select-none">
      <Loader2 className="h-6 w-6 text-blue-500 animate-spin" />
      <span className="text-[10px] text-slate-500 font-bold">Carregando Player...</span>
    </div>
  )
});
import { 
  Play, 
  Pause, 
  Save, 
  Upload, 
  Search, 
  Sparkles, 
  X, 
  ChevronLeft, 
  Loader2, 
  CheckCircle2, 
  Image as ImageIcon, 
  Video as VideoIcon, 
  AlertTriangle, 
  Rocket,
  Volume2,
  VolumeX,
  Plus,
  GripVertical,
  RefreshCw
} from 'lucide-react';
import { SubtitleItem } from '@/video/types';

// Supabase client instance using standard client persistence
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
const supabase = createClient(supabaseUrl, supabaseAnonKey);

interface EditorClientProps {
  id: string;
}

export default function EditorClient({ id }: EditorClientProps) {
  const router = useRouter();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Estados dos Metadados do Rascunho
  const [promptInput, setPromptInput] = useState('');
  const [audioUrl, setAudioUrl] = useState('');
  const [videoUrls, setVideoUrls] = useState<string[]>([]);
  const [subtitles, setSubtitles] = useState<SubtitleItem[]>([]);
  
  // Estados da Aplicação
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isRendering, setIsRendering] = useState(false);
  const [renderProgress, setRenderProgress] = useState(0);
  const [userId, setUserId] = useState<string | null>(null);
  const [credits, setCredits] = useState(0);
  const [draftDbId, setDraftDbId] = useState<string | null>(null);

  // Drag and drop & Voice update states
  const [isCardDraggable, setIsCardDraggable] = useState(false);
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [isUpdatingVoice, setIsUpdatingVoice] = useState(false);
  const [playerKey, setPlayerKey] = useState<number>(0);


  // Painel de Mídias (Canva Interno)
  const [mediaPanelOpen, setMediaPanelOpen] = useState(false);
  const [activeSceneIndex, setActiveSceneIndex] = useState<number | null>(null);
  const [mediaTab, setMediaTab] = useState<'pexels' | 'uploads'>('pexels');
  
  // Pexels Search State
  const [pexelsQuery, setPexelsQuery] = useState('tecnologia');
  const [pexelsResults, setPexelsResults] = useState<any[]>([]);
  const [pexelsLoading, setPexelsLoading] = useState(false);
  
  // Upload State
  const [dragActive, setDragActive] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [userUploads, setUserUploads] = useState<string[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Carrega a sessão do usuário e o rascunho do projeto
  useEffect(() => {
    async function loadData() {
      try {
        setIsLoading(true);
        // 1. Obter usuário autenticado
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          setUserId(user.id);
          
          // Buscar créditos
          const { data: profile } = await supabase
            .from('profiles')
            .select('credits')
            .eq('id', user.id)
            .single();
          if (profile) {
            setCredits(profile.credits);
          }
        }

        // 2. Buscar o rascunho em public.video_drafts (ou video_jobs como fallback)
        let draftData: any = null;
        
        const { data: draft, error: draftErr } = await supabase
          .from('video_drafts')
          .select('*')
          .or(`id.eq.${id},video_job_id.eq.${id}`)
          .maybeSingle();

        if (!draftErr && draft) {
          draftData = draft;
          setDraftDbId(draft.id);
        } else {
          // Fallback para video_jobs
          const { data: job, error: jobErr } = await supabase
            .from('video_jobs')
            .select('*')
            .eq('id', id)
            .single();
          if (!jobErr && job) {
            draftData = job;
          }
        }


        if (draftData) {
          setPromptInput(draftData.prompt_input || 'Rascunho Inteligente');
          
          let scriptJson = draftData.script_json;
          if (typeof scriptJson === 'string') {
            scriptJson = JSON.parse(scriptJson);
          }

          if (scriptJson) {
            setAudioUrl(scriptJson.audio_url || '');
            const parsedVideos = Array.isArray(scriptJson.video_urls) ? scriptJson.video_urls : [];
            const parsedSubs = Array.isArray(scriptJson.subtitles) ? scriptJson.subtitles : [];
            
            // Garante correspondência 1-para-1 de mídias para as cenas
            const normalizedVideos = [...parsedVideos];
            while (normalizedVideos.length < parsedSubs.length) {
              normalizedVideos.push('https://assets.mixkit.co/videos/preview/mixkit-futuristic-subway-station-with-neon-lights-in-vertical-format-48227-large.mp4');
            }
            
            setVideoUrls(normalizedVideos);
            
            let currentStart = 0;
            const mappedSubs = parsedSubs.map((sub: any) => {
              const start = sub.start !== undefined 
                ? parseFloat(sub.start) 
                : (sub.start_time !== undefined ? parseFloat(sub.start_time) : currentStart);
              const end = sub.end !== undefined 
                ? parseFloat(sub.end) 
                : (sub.end_time !== undefined ? parseFloat(sub.end_time) : (start + (parseFloat(sub.duration) || 3)));
              
              const safeStart = isNaN(start) || !isFinite(start) ? currentStart : start;
              const safeEnd = isNaN(end) || !isFinite(end) || end <= safeStart ? safeStart + 3 : end;
              
              currentStart = safeEnd;
              return {
                id: sub.id || Math.random().toString(36).substring(2, 11),
                start: safeStart,
                end: safeEnd,
                text: String(sub.text || sub.word || '')
              };
            });
            setSubtitles(mappedSubs);
          }
        } else {
          alert('Projeto ou rascunho não localizado.');
          router.push('/history');
        }

        // 3. Buscar uploads antigos
        if (user) {
          const { data: uploads } = await supabase
            .from('user_uploads')
            .select('url')
            .eq('user_id', user.id)
            .order('created_at', { ascending: false });
          if (uploads) {
            setUserUploads(uploads.map(u => u.url));
          } else {
            // Fallback para localStorage
            const local = localStorage.getItem(`recent_uploads_${user.id}`);
            if (local) {
              setUserUploads(JSON.parse(local));
            }
          }
        }

      } catch (err) {
        console.error('Erro ao carregar dados do editor:', err);
      } finally {
        setIsLoading(false);
      }
    }

    loadData();
  }, [id, router]);

  // Carrega buscas iniciais do Pexels
  useEffect(() => {
    if (mediaPanelOpen && mediaTab === 'pexels' && pexelsResults.length === 0) {
      searchPexels();
    }
  }, [mediaPanelOpen, mediaTab]);

  // Função para buscar vídeos/imagens do Pexels via nossa rota proxy API
  const searchPexels = async () => {
    setPexelsLoading(true);
    try {
      const res = await fetch(`/api/pexels/search?query=${encodeURIComponent(pexelsQuery)}&type=video`);
      if (!res.ok) throw new Error();
      const data = await res.json();
      setPexelsResults(data.videos || []);
    } catch {
      console.error('Erro ao buscar no Pexels. Usando mocks.');
    } finally {
      setPexelsLoading(false);
    }
  };

  // Tratar alteração do roteiro da cena
  const handleTextChange = (index: number, newText: string) => {
    const updated = [...subtitles];
    updated[index] = { ...updated[index], text: newText };
    setSubtitles(updated);
  };

  // Abre o painel para substituir a mídia de um card
  const handleReplaceMediaClick = (index: number) => {
    setActiveSceneIndex(index);
    setMediaPanelOpen(true);
  };

  // Aplica a mídia selecionada do Canva/Pexels à cena ativa
  const selectMediaForActiveScene = (url: string) => {
    if (activeSceneIndex !== null) {
      const updated = [...videoUrls];
      updated[activeSceneIndex] = url;
      setVideoUrls(updated);
      setMediaPanelOpen(false);
      setActiveSceneIndex(null);
    }
  };

  // Lógica do Drag & Drop de Arquivos
  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      uploadFile(e.dataTransfer.files[0]);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      uploadFile(e.target.files[0]);
    }
  };

  // Fazer o upload do arquivo para o S3 e salvar no banco de dados do Supabase
  const uploadFile = async (file: File) => {
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);

      const res = await fetch('/api/upload/s3', {
        method: 'POST',
        body: formData
      });

      if (!res.ok) throw new Error('Falha no upload do arquivo');
      const data = await res.json();
      const fileUrl = data.url;

      // Salva URL no Supabase user_uploads
      if (userId) {
        try {
          const { error } = await supabase
            .from('user_uploads')
            .insert([{ user_id: userId, url: fileUrl }]);
          if (error) throw error;
        } catch {
          // Fallback para localStorage
          const local = localStorage.getItem(`recent_uploads_${userId}`);
          const list = local ? JSON.parse(local) : [];
          const updatedList = [fileUrl, ...list].slice(0, 15);
          localStorage.setItem(`recent_uploads_${userId}`, JSON.stringify(updatedList));
        }

        // Adiciona à lista local imediatamente
        setUserUploads(prev => [fileUrl, ...prev]);
        
        // Aplica o arquivo na cena correspondente
        selectMediaForActiveScene(fileUrl);
      }

    } catch (err: any) {
      alert('Falha ao enviar arquivo: ' + err.message);
    } finally {
      setUploading(false);
    }
  };

  // Funções de Reordenação (Drag and Drop)
  const handleDragStart = (e: React.DragEvent, index: number) => {
    setDraggedIndex(index);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
  };

  const handleDropScene = (index: number) => {
    if (draggedIndex === null || draggedIndex === index) return;
    
    const reorderedSubs = [...subtitles];
    const [draggedSub] = reorderedSubs.splice(draggedIndex, 1);
    reorderedSubs.splice(index, 0, draggedSub);
    
    const reorderedVideos = [...videoUrls];
    const [draggedVideo] = reorderedVideos.splice(draggedIndex, 1);
    reorderedVideos.splice(index, 0, draggedVideo);
    
    // Recalcular tempos sequencialmente para manter sincronia
    let currentStart = 0;
    const finalSubs = reorderedSubs.map((sub) => {
      const duration = sub.end - sub.start;
      const start = currentStart;
      const end = currentStart + duration;
      currentStart = end;
      return {
        ...sub,
        start,
        end
      };
    });

    setSubtitles(finalSubs);
    setVideoUrls(reorderedVideos);
    setDraggedIndex(null);
    setIsCardDraggable(false);
  };

  // Sincronizar e regenerar a voz de todas as cenas na ElevenLabs
  const handleUpdateVoice = async () => {
    setIsUpdatingVoice(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const accessToken = session?.access_token;

      const res = await fetch('/api/video/update-audio', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(accessToken ? { 'Authorization': `Bearer ${accessToken}` } : {})
        },
        body: JSON.stringify({
          id: draftDbId || id,
          subtitles: subtitles.map(s => ({ id: s.id, text: s.text }))
        })
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || 'Falha ao atualizar a voz.');
      }

      const result = await res.json();
      if (result.success) {
        setAudioUrl(result.audio_url);
        setSubtitles(result.subtitles);
        setPlayerKey(Date.now());
        alert('Voz e tempos de sincronização atualizados com sucesso!');
      }
    } catch (err: any) {
      alert('Erro ao atualizar voz: ' + err.message);
    } finally {
      setIsUpdatingVoice(false);
    }
  };

  // Salvar alterações locais como rascunho no Supabase
  const handleSaveDraft = async () => {
    setIsSaving(true);
    try {
      const updatedScriptJson = {
        audio_url: audioUrl,
        video_urls: videoUrls,
        subtitles: subtitles
      };

      // Tenta atualizar video_drafts
      let { error: draftErr } = await supabase
        .from('video_drafts')
        .update({ script_json: updatedScriptJson })
        .eq('id', draftDbId || id);

      // Fallback para video_jobs
      if (draftErr) {
        const { error: jobErr } = await supabase
          .from('video_jobs')
          .update({ script_json: updatedScriptJson })
          .eq('id', id);
        if (jobErr) throw jobErr;
      }

      alert('Rascunho salvo com sucesso!');
    } catch (err: any) {
      alert('Falha ao salvar rascunho: ' + err.message);
    } finally {
      setIsSaving(false);
    }
  };

  // Disparar Renderização Final na AWS Lambda
  const handleRenderVideo = async () => {
    if (credits <= 0) {
      alert('Você não tem créditos suficientes na sua conta.');
      return;
    }

    setIsRendering(true);
    setRenderProgress(0);

    try {
      // 1. Iniciar renderização via AWS Lambda chamando nossa API Route
      const res = await fetch('/api/video/render', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          compositionId: 'Reels',
          inputProps: {
            audio_url: audioUrl,
            video_urls: videoUrls,
            subtitles: subtitles
          }
        })
      });

      if (!res.ok) throw new Error('O servidor de renderização falhou ao iniciar.');
      const renderData = await res.json();
      
      const { renderId, bucketName } = renderData;

      // 2. Decrementar 1 crédito do usuário via RPC atômica
      if (userId) {
        await supabase.rpc('decrement_profile_credits', { p_user_id: userId, p_amount: 1 });
        setCredits(prev => Math.max(0, prev - 1));
      }

      // 3. Atualizar status na tabela correspondente
      await supabase
        .from('video_drafts')
        .update({ status: 'rendering' })
        .eq('id', draftDbId || id);
      
      await supabase
        .from('video_jobs')
        .update({ status: 'rendering' })
        .eq('id', id);

      // 4. Iniciar consulta (polling) para acompanhar progresso de renderização
      const interval = setInterval(async () => {
        try {
          const progressRes = await fetch(`/api/video/render/progress?renderId=${renderId}&bucketName=${bucketName}`);
          if (!progressRes.ok) return;

          const progressData = await progressRes.json();

          if (progressData.status === 'done') {
            clearInterval(interval);
            setIsRendering(false);
            setRenderProgress(100);

            const finalUrl = progressData.videoUrl;

            // Salvar link finalizado
            await supabase
              .from('video_jobs')
              .update({ status: 'ready', video_url: finalUrl })
              .eq('id', id);

            alert('Vídeo renderizado com sucesso!');
            router.push('/history');

          } else if (progressData.status === 'error') {
            clearInterval(interval);
            setIsRendering(false);
            alert(`A renderização falhou na AWS: ${progressData.error}`);
            
            await supabase
              .from('video_jobs')
              .update({ status: 'failed' })
              .eq('id', id);

          } else if (progressData.status === 'rendering') {
            setRenderProgress(progressData.progress || 0);
          }
        } catch (err) {
          console.error(err);
        }
      }, 3500);

    } catch (err: any) {
      setIsRendering(false);
      alert('Erro ao processar renderização: ' + err.message);
    }
  };

  // Cálculo dinâmico da duração total do vídeo
  const lastSub = subtitles.length > 0 ? subtitles[subtitles.length - 1] : null;
  const totalSec = lastSub && typeof lastSub.end === 'number' && !isNaN(lastSub.end) ? lastSub.end : 15;
  const durationInFrames = Math.max(30, Math.ceil(totalSec * 30));

  if (!mounted || isLoading) {
    return (
      <div className="w-full h-[60vh] flex flex-col justify-center items-center gap-4">
        <Loader2 className="h-9 w-9 text-blue-500 animate-spin" />
        <span className="text-sm text-slate-400 font-semibold">Carregando editor inteligente...</span>
      </div>
    );
  }

  return (
    <div className="flex h-[calc(100vh-100px)] overflow-hidden gap-8 relative select-none">
      {/* Esquerda: Linha do Tempo e Controle de Cenas */}
      <div className="flex-1 overflow-y-auto pr-2 flex flex-col gap-5">
        <div className="flex items-center justify-between border-b border-[#15233c]/20 pb-4">
          <div className="flex items-center gap-3">
            <button 
              onClick={() => router.push('/history')}
              className="p-2 bg-slate-900/60 border border-[#15233c]/60 text-slate-400 hover:text-white rounded-xl transition-all"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <div>
              <h1 className="text-xl font-bold text-white tracking-tight flex items-center gap-2">
                Estúdio de Edição Inteligente
                <span className="h-2 w-2 rounded-full bg-indigo-500 animate-pulse" />
              </h1>
              <p className="text-[11px] text-slate-500 truncate max-w-[400px]">Prompt: {promptInput}</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button 
              onClick={handleUpdateVoice}
              disabled={isUpdatingVoice || subtitles.length === 0}
              className="inline-flex items-center gap-1.5 px-4.5 py-2.5 bg-amber-500/10 border border-amber-500/30 hover:border-amber-400 text-xs font-bold text-amber-400 hover:text-amber-300 rounded-xl transition-all shadow-[0_0_15px_rgba(245,158,11,0.05)] active:scale-95 disabled:opacity-50"
              title="Regera a voz consolidada na ElevenLabs para todas as cenas com os textos atuais"
            >
              {isUpdatingVoice ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
              <span>Atualizar Voz</span>
            </button>

            <button 
              onClick={handleSaveDraft}
              disabled={isSaving}
              className="inline-flex items-center gap-1.5 px-4.5 py-2.5 bg-[#15233c]/35 border border-[#15233c]/80 text-xs font-bold text-slate-200 hover:text-white hover:bg-[#15233c] rounded-xl transition-all active:scale-95 disabled:opacity-50"
            >
              {isSaving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
              <span>Salvar Rascunho</span>
            </button>
          </div>
        </div>

        {/* Lista de cards das cenas (Estilo Notion) */}
        <div className="flex flex-col gap-4">
          {subtitles.map((scene, index) => {
            const mediaUrl = videoUrls[index];
            const isImage = /\.(jpg|jpeg|png|webp|gif)($|\?)/i.test(mediaUrl || '');

            return (
              <React.Fragment key={scene.id || index}>
                <div 
                  draggable={isCardDraggable}
                  onDragStart={(e) => handleDragStart(e, index)}
                  onDragOver={(e) => handleDragOver(e, index)}
                  onDrop={() => handleDropScene(index)}
                  className={`bg-[#060a13] border border-blue-500/80 shadow-[0_0_20px_rgba(59,130,246,0.12)] rounded-2xl p-5 flex gap-5 hover:shadow-[0_0_20px_rgba(59,130,246,0.18)] transition-all duration-300 relative group transition-opacity ${
                    draggedIndex === index ? 'opacity-40 border-dashed border-indigo-500' : ''
                  }`}
                >
                  {/* Indicador Numérico da Cena e Drag Handle */}
                  <div 
                    onMouseEnter={() => setIsCardDraggable(true)}
                    onMouseLeave={() => setIsCardDraggable(false)}
                    className="absolute top-4 left-4 flex items-center gap-1 bg-slate-900/90 border border-slate-800 rounded-xl px-2 py-1 text-[10px] text-slate-400 font-bold cursor-grab active:cursor-grabbing hover:border-indigo-500/50 hover:text-white transition-all select-none"
                    title="Arraste pelo grip para reordenar a cena"
                  >
                    <GripVertical className="h-3 w-3 text-slate-500" />
                    <span>{index + 1}</span>
                  </div>

                  {/* Bloco da Mídia (Esquerda do Card) */}
                  <div className="w-40 aspect-[9/16] rounded-xl overflow-hidden bg-slate-950 relative border border-slate-800 shrink-0 select-none shadow-inner">
                    {mediaUrl ? (
                      isImage ? (
                        <img src={mediaUrl} className="w-full h-full object-cover" alt={`Cena ${index + 1}`} />
                      ) : (
                        <video src={mediaUrl} className="w-full h-full object-cover" muted playsInline loop />
                      )
                    ) : (
                      <div className="w-full h-full flex flex-col justify-center items-center gap-1.5 text-slate-500">
                        <ImageIcon className="h-6 w-6" />
                        <span className="text-[10px] font-semibold">Sem Mídia</span>
                      </div>
                    )}
                    
                    {/* Botão Substituir Mídia em hover */}
                    <div className="absolute inset-0 bg-black/40 backdrop-blur-3xs flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                      <button 
                        onClick={() => handleReplaceMediaClick(index)}
                        className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-[10px] font-bold shadow-md shadow-indigo-600/20 transition-all active:scale-95 flex items-center gap-1"
                      >
                        <Plus className="h-3 w-3" />
                        Mudar Mídia
                      </button>
                    </div>
                  </div>

                  {/* Conteúdo de Roteiro e Timestamps (Direita do Card) */}
                  <div className="flex-1 flex flex-col gap-3 justify-between">
                    <div className="flex flex-col gap-1.5">
                      <span className="text-[10px] text-slate-500 uppercase font-bold tracking-wider">Legenda / Roteiro da Cena</span>
                      <textarea 
                        value={scene.text}
                        onChange={(e) => handleTextChange(index, e.target.value)}
                        className="w-full h-24 bg-slate-950/60 border border-slate-900 focus:border-blue-500/50 rounded-xl p-3 text-xs text-slate-200 placeholder-slate-600 outline-none resize-none leading-relaxed focus:shadow-[0_0_15px_rgba(59,130,246,0.06)]"
                        placeholder="Insira as falas da cena..."
                      />
                    </div>

                    <div className="flex items-center justify-between text-[10px] text-slate-500 font-semibold select-none border-t border-slate-900/60 pt-2.5">
                      <span>⏱️ Duração: {scene && typeof scene.end === 'number' && typeof scene.start === 'number' && !isNaN(scene.end - scene.start) ? (scene.end - scene.start).toFixed(1) : '0.0'}s</span>
                      <span>Intervalo: {scene && typeof scene.start === 'number' && !isNaN(scene.start) ? scene.start.toFixed(1) : '0.0'}s - {scene && typeof scene.end === 'number' && !isNaN(scene.end) ? scene.end.toFixed(1) : '0.0'}s</span>
                    </div>
                  </div>
                </div>
                {index < subtitles.length - 1 && (
                  <div className="flex justify-center my-1 relative py-2 select-none group/trans-container">
                    <div className="absolute inset-0 flex items-center" aria-hidden="true">
                      <div className="w-full border-t border-dashed border-slate-800/60 group-hover/trans-container:border-indigo-500/30 transition-colors"></div>
                    </div>
                    <div className="relative flex justify-center">
                      <button 
                        type="button" 
                        onClick={() => alert(`Escolher transição entre cena ${index + 1} e ${index + 2} (Funcionalidade futura)`)}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-slate-950 border border-slate-800 hover:border-indigo-500/50 hover:bg-slate-900 text-[10px] font-bold text-slate-500 hover:text-indigo-400 shadow-md transition-all active:scale-95 group/trans-btn"
                      >
                        <Plus className="h-3 w-3 text-slate-500 group-hover/trans-btn:text-indigo-400 group-hover/trans-btn:rotate-90 transition-transform duration-300" />
                        <span>Escolher Transição</span>
                      </button>
                    </div>
                  </div>
                )}
              </React.Fragment>
            );
          })}
        </div>
      </div>

      {/* Direita: Player Remotion e Renderização */}
      <div className="w-[300px] sm:w-[320px] shrink-0 flex flex-col gap-5">
        <h2 className="text-xs uppercase font-extrabold tracking-wider text-slate-500">Visualização em Tempo Real</h2>
        
        {/* Componente do Player Remotion */}
        <div className="w-full bg-[#060a13] border border-blue-500/40 shadow-[0_0_20px_rgba(59,130,246,0.08)] rounded-3xl p-3 flex flex-col items-center justify-center aspect-[9/16] relative overflow-hidden select-none">
          <PlayerWrapper
            key={playerKey}
            audioUrl={audioUrl ? `${audioUrl}?t=${playerKey}` : ''}
            videoUrls={videoUrls}
            subtitles={subtitles}
            durationInFrames={durationInFrames}
          />

          {isRendering && (
            <div className="absolute inset-0 bg-black/90 backdrop-blur-sm z-50 flex flex-col justify-center items-center gap-3.5 p-4 text-center select-none">
              <Loader2 className="h-8 w-8 text-cyan-400 animate-spin" />
              <span className="text-xs font-semibold text-slate-200 leading-normal animate-pulse">
                Renderizando Vídeo Final... {renderProgress > 0 ? `(${renderProgress}%)` : ''}
              </span>
              <span className="text-[10px] text-slate-500">
                Isso pode levar até 2 minutos na AWS Lambda.
              </span>
            </div>
          )}
        </div>

        {/* Botão de Disparo Final de Renderização */}
        <div className="flex flex-col gap-2">
          <button 
            onClick={handleRenderVideo}
            disabled={isRendering || subtitles.length === 0}
            className="w-full bg-gradient-to-r from-blue-600 to-[#7c3aed] hover:from-blue-700 hover:to-[#6d28d9] py-4 rounded-2xl font-bold text-white transition-all duration-200 active:scale-[0.99] disabled:opacity-50 disabled:cursor-not-allowed flex flex-col items-center justify-center gap-0.5 shadow-lg shadow-indigo-600/10"
          >
            <span className="text-sm tracking-wide flex items-center gap-1.5">
              <Rocket className="h-4 w-4" />
              Renderizar Vídeo Final HD
            </span>
            <span className="text-[10px] text-white/70 font-semibold normal-case">1 crédito será consumido</span>
          </button>
          <div className="flex items-center justify-center gap-2 select-none text-[10px] text-slate-500 font-bold border-t border-slate-900 pt-3">
            <span>Saldo: {credits} créditos</span>
          </div>
        </div>
      </div>

      {/* Painel Lateral Retrátil de Mídias (Estilo Canva Interno) */}
      {mediaPanelOpen && (
        <div className="fixed inset-0 z-50 flex justify-end">
          {/* Backdrop */}
          <div 
            className="fixed inset-0 bg-black/75 backdrop-blur-sm transition-opacity"
            onClick={() => {
              setMediaPanelOpen(false);
              setActiveSceneIndex(null);
            }}
          />

          {/* Painel */}
          <div className="relative w-[380px] max-w-full h-full bg-[#050914] border-l border-[#15233c] shadow-2xl flex flex-col z-10 animate-slide-in">
            {/* Header */}
            <div className="p-5 border-b border-[#15233c]/60 flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-white">Substituir Mídia</h3>
                <p className="text-[10px] text-slate-500 mt-0.5">Selecione para a Cena {activeSceneIndex !== null ? activeSceneIndex + 1 : ''}</p>
              </div>
              <button 
                onClick={() => {
                  setMediaPanelOpen(false);
                  setActiveSceneIndex(null);
                }}
                className="p-1.5 hover:bg-slate-900 text-slate-400 hover:text-white rounded-lg transition-colors"
              >
                <X className="h-4.5 w-4.5" />
              </button>
            </div>

            {/* Abas */}
            <div className="grid grid-cols-2 border-b border-[#15233c]/30 p-1 bg-slate-950/40 select-none">
              <button 
                onClick={() => setMediaTab('pexels')}
                className={`py-2.5 text-xs font-semibold rounded-lg transition-all ${
                  mediaTab === 'pexels' 
                    ? 'bg-[#161328] border border-[#7c3aed]/40 text-white' 
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                Biblioteca Pexels
              </button>
              <button 
                onClick={() => setMediaTab('uploads')}
                className={`py-2.5 text-xs font-semibold rounded-lg transition-all ${
                  mediaTab === 'uploads' 
                    ? 'bg-[#161328] border border-[#7c3aed]/40 text-white' 
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                Seus Uploads
              </button>
            </div>

            {/* Conteúdo das Abas */}
            <div className="flex-1 overflow-y-auto p-5">
              {mediaTab === 'pexels' && (
                <div className="flex flex-col gap-4">
                  {/* Busca Pexels */}
                  <div className="relative flex items-center bg-slate-950 border border-slate-900 focus-within:border-blue-500/50 rounded-xl px-3 py-2 text-xs">
                    <input 
                      type="text"
                      value={pexelsQuery}
                      onChange={(e) => setPexelsQuery(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && searchPexels()}
                      placeholder="Pesquise no Pexels..."
                      className="bg-transparent text-slate-200 outline-none w-full placeholder-slate-600"
                    />
                    <button 
                      onClick={searchPexels}
                      className="text-slate-500 hover:text-white transition-colors"
                    >
                      <Search className="h-3.5 w-3.5" />
                    </button>
                  </div>

                  {/* Resultados da busca */}
                  {pexelsLoading ? (
                    <div className="h-40 flex flex-col justify-center items-center gap-2">
                      <Loader2 className="h-6 w-6 text-blue-500 animate-spin" />
                      <span className="text-[10px] text-slate-500 font-bold">Procurando mídias...</span>
                    </div>
                  ) : (
                    <div className="grid grid-cols-2 gap-3 pb-4">
                      {pexelsResults.map((item) => (
                        <div 
                          key={item.id}
                          onClick={() => selectMediaForActiveScene(item.url)}
                          className="aspect-[9/16] rounded-lg overflow-hidden bg-slate-950 border border-slate-900/60 relative cursor-pointer group/item hover:border-blue-500/50 transition-all select-none shadow-md"
                        >
                          <img src={item.image} className="w-full h-full object-cover" alt="" />
                          <div className="absolute inset-0 bg-black/30 group-hover/item:bg-black/10 transition-colors flex items-end p-2 select-none">
                            <span className="text-[8px] text-white/80 font-bold truncate max-w-full bg-slate-950/70 px-1.5 py-0.5 rounded border border-white/5">@{item.user.name}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {mediaTab === 'uploads' && (
                <div className="flex flex-col gap-4">
                  {/* Área Drag & Drop de Upload */}
                  <div 
                    onClick={() => fileInputRef.current?.click()}
                    onDragEnter={handleDrag}
                    onDragLeave={handleDrag}
                    onDragOver={handleDrag}
                    onDrop={handleDrop}
                    className={`border border-dashed rounded-xl p-6 flex flex-col items-center justify-center gap-2 cursor-pointer transition-all ${
                      dragActive 
                        ? 'border-blue-500 bg-blue-500/5 shadow-[0_0_15px_rgba(59,130,246,0.1)]' 
                        : 'border-[#15233c] hover:border-blue-500/40 bg-slate-950/20'
                    }`}
                  >
                    <input 
                      ref={fileInputRef}
                      type="file" 
                      className="hidden" 
                      accept="image/*,video/*"
                      onChange={handleFileChange}
                    />
                    {uploading ? (
                      <div className="flex flex-col items-center gap-1.5">
                        <Loader2 className="h-6 w-6 text-blue-500 animate-spin" />
                        <span className="text-[10px] text-slate-400 font-bold">Enviando arquivo...</span>
                      </div>
                    ) : (
                      <>
                        <Upload className="h-5 w-5 text-slate-500" />
                        <div className="text-center select-none">
                          <p className="text-[11px] font-semibold text-slate-300">Carregar imagem/vídeo</p>
                          <p className="text-[9px] text-slate-500 mt-0.5">Arraste ou clique para selecionar</p>
                        </div>
                      </>
                    )}
                  </div>

                  {/* Lista de Arquivos Recentes */}
                  <div className="flex flex-col gap-2.5">
                    <span className="text-[10px] text-slate-500 uppercase font-bold tracking-wider select-none">Arquivos Recentes</span>
                    {userUploads.length === 0 ? (
                      <p className="text-[10px] text-slate-600 leading-normal">Nenhum upload recente localizado.</p>
                    ) : (
                      <div className="grid grid-cols-2 gap-3 pb-4">
                        {userUploads.map((url, i) => {
                          const isImage = /\.(jpg|jpeg|png|webp|gif)($|\?)/i.test(url);
                          return (
                            <div 
                              key={i}
                              onClick={() => selectMediaForActiveScene(url)}
                              className="aspect-[9/16] rounded-lg overflow-hidden bg-slate-950 border border-slate-900/60 relative cursor-pointer hover:border-blue-500/50 transition-all select-none shadow-md group/recent"
                            >
                              {isImage ? (
                                <img src={url} className="w-full h-full object-cover" alt="" />
                              ) : (
                                <video src={url} className="w-full h-full object-cover" muted playsInline />
                              )}
                              <div className="absolute inset-0 bg-black/10 group-hover/recent:bg-black/0 transition-colors" />
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
