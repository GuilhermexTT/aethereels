-- Migração de Inicialização: Tabelas e RLS
-- Data: 2026-06-08 (Timezone UTC padrão)

-- 1. Habilitando extensões necessárias
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 2. Tabela: users (espelho de auth.users do Supabase)
CREATE TABLE IF NOT EXISTS public.users (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT UNIQUE NOT NULL,
    credits_balance INTEGER NOT NULL DEFAULT 0,
    stripe_customer_id TEXT UNIQUE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    CONSTRAINT check_credits_balance CHECK (credits_balance >= 0)
);

-- 3. Tabela: instagram_credentials
CREATE TABLE IF NOT EXISTS public.instagram_credentials (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    instagram_business_id TEXT NOT NULL,
    encrypted_access_token TEXT NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- 4. Tabela: video_jobs
CREATE TABLE IF NOT EXISTS public.video_jobs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    status TEXT NOT NULL DEFAULT 'pending',
    prompt_input TEXT NOT NULL,
    script_json JSONB DEFAULT '{}'::jsonb,
    video_url TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    CONSTRAINT check_video_status CHECK (status IN ('pending', 'scripting', 'rendering', 'ready', 'failed'))
);

-- 5. Tabela: scheduled_posts
CREATE TABLE IF NOT EXISTS public.scheduled_posts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    video_job_id UUID NOT NULL REFERENCES public.video_jobs(id) ON DELETE CASCADE,
    caption TEXT NOT NULL,
    scheduled_for TIMESTAMP WITH TIME ZONE NOT NULL,
    post_status TEXT NOT NULL DEFAULT 'scheduled',
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    CONSTRAINT check_post_status CHECK (post_status IN ('scheduled', 'publishing', 'published', 'failed'))
);

-- 6. Tabela: refund_logs (Auditoria de Reembolso)
CREATE TABLE IF NOT EXISTS public.refund_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    video_job_id UUID NOT NULL REFERENCES public.video_jobs(id) ON DELETE CASCADE,
    error_message TEXT,
    credits_refunded INTEGER NOT NULL DEFAULT 1,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- 7. Habilitando RLS (Row Level Security) globalmente
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.instagram_credentials ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.video_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.scheduled_posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.refund_logs ENABLE ROW LEVEL SECURITY;

-- 8. Criação de Políticas de Segurança (RLS)

-- Políticas para: users
CREATE POLICY "Usuários podem visualizar seu próprio perfil" 
ON public.users FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Usuários podem atualizar seu próprio perfil" 
ON public.users FOR UPDATE USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

-- Políticas para: instagram_credentials
CREATE POLICY "Usuários podem gerenciar suas próprias credenciais do Instagram"
ON public.instagram_credentials FOR ALL 
USING (auth.uid() = user_id) 
WITH CHECK (auth.uid() = user_id);

-- Políticas para: video_jobs
CREATE POLICY "Usuários podem interagir apenas com seus próprios jobs"
ON public.video_jobs FOR ALL 
USING (auth.uid() = user_id) 
WITH CHECK (auth.uid() = user_id);

-- Políticas para: scheduled_posts
CREATE POLICY "Usuários podem gerenciar seus posts agendados vinculados aos seus video_jobs"
ON public.scheduled_posts FOR ALL 
USING (
    EXISTS (
        SELECT 1 FROM public.video_jobs 
        WHERE video_jobs.id = scheduled_posts.video_job_id 
        AND video_jobs.user_id = auth.uid()
    )
)
WITH CHECK (
    EXISTS (
        SELECT 1 FROM public.video_jobs 
        WHERE video_jobs.id = scheduled_posts.video_job_id 
        AND video_jobs.user_id = auth.uid()
    )
);

-- Políticas para: refund_logs
CREATE POLICY "Usuários podem visualizar seus próprios logs de reembolso"
ON public.refund_logs FOR SELECT 
USING (auth.uid() = user_id);
