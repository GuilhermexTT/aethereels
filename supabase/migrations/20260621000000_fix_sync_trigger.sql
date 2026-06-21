-- Migração: Atualizar o trigger de sincronização para copiar script_json do rascunho para o job
-- Data: 2026-06-21

-- 1. Atualizar a função do trigger para incluir a cópia do script_json
CREATE OR REPLACE FUNCTION public.sync_video_job_status_on_draft()
RETURNS TRIGGER AS $$
BEGIN
    -- Atualiza o status do job correspondente para 'draft'
    -- E copia o payload script_json (contendo audio_url, video_urls, subtitles) para video_jobs
    UPDATE public.video_jobs
    SET status = 'draft',
        script_json = NEW.script_json
    WHERE id = COALESCE(NEW.video_job_id, NEW.id);
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. Recriar o trigger para garantir aplicação limpa
DROP TRIGGER IF EXISTS trigger_sync_video_job_status ON public.video_drafts;
CREATE TRIGGER trigger_sync_video_job_status
AFTER INSERT OR UPDATE ON public.video_drafts
FOR EACH ROW
EXECUTE FUNCTION public.sync_video_job_status_on_draft();
