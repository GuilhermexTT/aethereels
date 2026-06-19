-- Migração: Criação da Tabela de Perfis/Créditos, RLS e RPC de Débito
-- Data: 2026-06-18

-- 1. Criar a tabela public.profiles vinculada ao auth.users
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT UNIQUE NOT NULL,
    credits INTEGER NOT NULL DEFAULT 5,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    CONSTRAINT check_credits CHECK (credits >= 0)
);

-- 2. Ativar o Row Level Security (RLS)
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- 3. Remover políticas antigas se já existirem (evita erros ao re-rodar)
DROP POLICY IF EXISTS "Usuários podem visualizar seu próprio perfil" ON public.profiles;
DROP POLICY IF EXISTS "Usuários podem atualizar seu próprio perfil" ON public.profiles;

-- 4. Criar políticas de acesso restrito
CREATE POLICY "Usuários podem visualizar seu próprio perfil"
ON public.profiles FOR SELECT
USING (auth.uid() = id);

CREATE POLICY "Usuários podem atualizar seu próprio perfil"
ON public.profiles FOR UPDATE
USING (auth.uid() = id)
WITH CHECK (auth.uid() = id);

-- 5. Criar a função RPC atômica para decremento de créditos
-- A função executa em nível do banco de dados (SECURITY DEFINER) para garantir a transação atômica.
CREATE OR REPLACE FUNCTION public.decrement_profile_credits(
    p_user_id UUID,
    p_amount INTEGER DEFAULT 1
)
RETURNS VOID AS $$
BEGIN
    UPDATE public.profiles
    SET credits = credits - p_amount
    WHERE id = p_user_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Perfil do usuário não encontrado.'
            USING ERRCODE = 'P0002';
    END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 6. Semear/Migrar dados da tabela antiga (public.users) para a nova (public.profiles)
-- Mantemos os saldos já existentes, ou atribuímos o valor padrão (5) caso não estivesse definido
INSERT INTO public.profiles (id, email, credits, created_at)
SELECT id, email, COALESCE(credits_balance, 5), created_at
FROM public.users
ON CONFLICT (id) DO NOTHING;
