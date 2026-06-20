-- Migração: Sincronização automática entre video_drafts e video_jobs
-- Data: 2026-06-20

-- 1. Adicionar coluna video_job_id na tabela video_drafts como FK para video_jobs (se já não existir)
ALTER TABLE public.video_drafts 
ADD COLUMN IF NOT EXISTS video_job_id UUID REFERENCES public.video_jobs(id) ON DELETE CASCADE;

-- 2. Tornar video_job_id único (um rascunho por job) se necessário
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'unique_video_job_id'
    ) THEN
        ALTER TABLE public.video_drafts ADD CONSTRAINT unique_video_job_id UNIQUE (video_job_id);
    END IF;
END $$;

-- 3. Criar função para atualizar o status do job correspondente na tabela video_jobs
CREATE OR REPLACE FUNCTION public.sync_video_job_status_on_draft()
RETURNS TRIGGER AS $$
BEGIN
    -- Determina qual ID usar (se tiver video_job_id, usa ele, senão tenta usar o próprio id do rascunho)
    UPDATE public.video_jobs
    SET status = 'draft'
    WHERE id = COALESCE(NEW.video_job_id, NEW.id);
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4. Criar o trigger de banco de dados para rodar automaticamente após INSERT ou UPDATE
DROP TRIGGER IF EXISTS trigger_sync_video_job_status ON public.video_drafts;
CREATE TRIGGER trigger_sync_video_job_status
AFTER INSERT OR UPDATE ON public.video_drafts
FOR EACH ROW
EXECUTE FUNCTION public.sync_video_job_status_on_draft();
