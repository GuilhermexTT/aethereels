-- Migração: Habilitar RLS e adicionar políticas de segurança para video_drafts
-- Data: 2026-06-20

-- 1. Habilitar RLS na tabela public.video_drafts
ALTER TABLE public.video_drafts ENABLE ROW LEVEL SECURITY;

-- 2. Remover políticas antigas se já existirem (evita erros ao re-rodar)
DROP POLICY IF EXISTS "Usuários podem visualizar seus próprios rascunhos" ON public.video_drafts;
DROP POLICY IF EXISTS "Usuários podem criar seus próprios rascunhos" ON public.video_drafts;
DROP POLICY IF EXISTS "Usuários podem atualizar seus próprios rascunhos" ON public.video_drafts;
DROP POLICY IF EXISTS "Usuários podem deletar seus próprios rascunhos" ON public.video_drafts;

-- 3. Criar políticas de acesso restrito baseadas no user_id
CREATE POLICY "Usuários podem visualizar seus próprios rascunhos"
ON public.video_drafts FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Usuários podem criar seus próprios rascunhos"
ON public.video_drafts FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Usuários podem atualizar seus próprios rascunhos"
ON public.video_drafts FOR UPDATE
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Usuários podem deletar seus próprios rascunhos"
ON public.video_drafts FOR DELETE
USING (auth.uid() = user_id);
