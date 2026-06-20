-- Migração: Atualizar a restrição de status dos jobs de vídeo
-- Permite os novos status 'draft' e 'processing' na tabela public.video_jobs
-- Data: 2026-06-20

-- 1. Remover a restrição check_video_status antiga (se existir)
ALTER TABLE public.video_jobs 
DROP CONSTRAINT IF EXISTS check_video_status;

-- 2. Adicionar a nova restrição check_video_status contendo os status corretos
ALTER TABLE public.video_jobs 
ADD CONSTRAINT check_video_status 
CHECK (status IN ('pending', 'scripting', 'processing', 'rendering', 'ready', 'failed', 'draft'));
