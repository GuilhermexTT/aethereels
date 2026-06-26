-- Migração: Fase 1 - Persistência de Projetos, Créditos e Triggers de Usuário
-- Data: 2026-06-26

-- 1. Alterar o valor padrão de créditos para novos usuários na tabela profiles para 10
ALTER TABLE public.profiles ALTER COLUMN credits SET DEFAULT 10;

-- 2. Criar a tabela public.projects
CREATE TABLE IF NOT EXISTS public.projects (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
    name TEXT NOT NULL,
    video_s3_key TEXT,
    transcript_data JSONB DEFAULT '[]'::jsonb,
    styles JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL
);

-- 3. Habilitar RLS na tabela public.projects
ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;

-- 4. Criar políticas de segurança RLS para a tabela public.projects
DROP POLICY IF EXISTS "Usuários podem visualizar seus próprios projetos" ON public.projects;
CREATE POLICY "Usuários podem visualizar seus próprios projetos"
ON public.projects FOR SELECT
USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Usuários podem criar seus próprios projetos" ON public.projects;
CREATE POLICY "Usuários podem criar seus próprios projetos"
ON public.projects FOR INSERT
WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Usuários podem atualizar seus próprios projetos" ON public.projects;
CREATE POLICY "Usuários podem atualizar seus próprios projetos"
ON public.projects FOR UPDATE
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Usuários podem excluir seus próprios projetos" ON public.projects;
CREATE POLICY "Usuários podem excluir seus próprios projetos"
ON public.projects FOR DELETE
USING (auth.uid() = user_id);

-- 5. Criar trigger automática para criação de perfis
-- Esta função cria o perfil com 10 créditos a partir do e-mail do auth.users
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
    INSERT INTO public.profiles (id, email, credits)
    VALUES (new.id, new.email, 10)
    ON CONFLICT (id) DO UPDATE
    SET email = excluded.email;
    RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
