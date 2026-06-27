-- Migração: Fase 2 - Monetização e Regras de Tokens (Asaas)
-- Data: 2026-06-27

-- 1. Alterações na tabela public.profiles
-- Adicionar coluna opcional asaas_customer_id
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS asaas_customer_id TEXT;

-- Alterar valor padrão de créditos para novos usuários para 50
ALTER TABLE public.profiles ALTER COLUMN credits SET DEFAULT 50;

-- 2. Alterações na tabela legada public.users por retrocompatibilidade
ALTER TABLE public.users ALTER COLUMN credits_balance SET DEFAULT 50;

-- 3. Alterações na tabela public.video_jobs
-- Adicionar coluna para controlar se os créditos já foram debitados
ALTER TABLE public.video_jobs ADD COLUMN IF NOT EXISTS credits_charged BOOLEAN DEFAULT FALSE;

-- 4. Atualizar a trigger de criação de perfis/usuários para nascer com 50 créditos
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
    -- Inserir na tabela legada
    INSERT INTO public.users (id, email, credits_balance)
    VALUES (new.id, new.email, 50)
    ON CONFLICT (id) DO UPDATE
    SET email = excluded.email;

    -- Inserir na tabela de profiles
    INSERT INTO public.profiles (id, email, credits)
    VALUES (new.id, new.email, 50)
    ON CONFLICT (id) DO UPDATE
    SET email = excluded.email;
    
    RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 5. Criar a tabela public.payment_logs
CREATE TABLE IF NOT EXISTS public.payment_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
    asaas_billing_id TEXT UNIQUE NOT NULL,
    amount NUMERIC(10, 2) NOT NULL,
    credits_added INTEGER NOT NULL,
    status TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL
);

-- Habilitar RLS na tabela public.payment_logs
ALTER TABLE public.payment_logs ENABLE ROW LEVEL SECURITY;

-- Remover políticas antigas de logs de pagamento se existirem
DROP POLICY IF EXISTS "Usuários podem visualizar seus próprios logs de pagamento" ON public.payment_logs;

-- Criar política para permitir que usuários visualizem seus próprios logs
CREATE POLICY "Usuários podem visualizar seus próprios logs de pagamento"
ON public.payment_logs FOR SELECT
USING (auth.uid() = user_id);

-- 6. Criar função atômica/RPC para incrementar créditos
CREATE OR REPLACE FUNCTION public.increment_profile_credits(
    p_user_id UUID,
    p_amount INTEGER
)
RETURNS VOID AS $$
BEGIN
    UPDATE public.profiles
    SET credits = credits + p_amount
    WHERE id = p_user_id;

    UPDATE public.users
    SET credits_balance = credits_balance + p_amount
    WHERE id = p_user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 7. Criar função atômica/RPC para processamento de pagamentos do Asaas (Blindada/Idempotente)
CREATE OR REPLACE FUNCTION public.process_asaas_payment(
    p_user_id UUID,
    p_billing_id TEXT,
    p_amount NUMERIC,
    p_credits_added INTEGER,
    p_status TEXT
)
RETURNS BOOLEAN AS $$
DECLARE
    v_already_processed BOOLEAN;
BEGIN
    -- Verificar se a cobrança já foi computada anteriormente
    SELECT EXISTS(
        SELECT 1 FROM public.payment_logs WHERE asaas_billing_id = p_billing_id
    ) INTO v_already_processed;

    IF v_already_processed THEN
        RETURN FALSE; -- Retorna falso indicando que já foi processado
    END IF;

    -- Incrementar saldo na tabela de perfis
    UPDATE public.profiles
    SET credits = credits + p_credits_added
    WHERE id = p_user_id;

    -- Incrementar saldo na tabela legada de usuários
    UPDATE public.users
    SET credits_balance = credits_balance + p_credits_added
    WHERE id = p_user_id;

    -- Registrar o log da transação financeira com sucesso
    INSERT INTO public.payment_logs (
        user_id,
        asaas_billing_id,
        amount,
        credits_added,
        status
    ) VALUES (
        p_user_id,
        p_billing_id,
        p_amount,
        p_credits_added,
        p_status
    );

    RETURN TRUE; -- Retorna verdadeiro indicando processamento com sucesso
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 8. Criar a função do trigger para débito automático de 10 créditos no sucesso
CREATE OR REPLACE FUNCTION public.charge_credits_on_ready_video()
RETURNS trigger AS $$
BEGIN
    -- Se o status mudou para 'ready' e os créditos ainda não foram cobrados
    IF NEW.status = 'ready' AND (OLD.status IS DISTINCT FROM 'ready' OR OLD.status IS NULL) AND NOT COALESCE(OLD.credits_charged, FALSE) THEN
        
        -- Atualizar saldo em profiles (o banco travará a transação devido à constraint check_credits se credits < 10)
        UPDATE public.profiles
        SET credits = credits - 10
        WHERE id = NEW.user_id;

        -- Atualizar saldo na tabela legada
        UPDATE public.users
        SET credits_balance = credits_balance - 10
        WHERE id = NEW.user_id;

        -- Marcar os créditos como cobrados
        NEW.credits_charged := TRUE;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 9. Vincular a trigger na tabela video_jobs
DROP TRIGGER IF EXISTS on_video_job_ready ON public.video_jobs;
CREATE TRIGGER on_video_job_ready
    BEFORE UPDATE ON public.video_jobs
    FOR EACH ROW EXECUTE FUNCTION public.charge_credits_on_ready_video();

-- 10. Blindar segurança de escrita no Supabase (Remover UPDATE direto do cliente nas tabelas profiles e users)
DROP POLICY IF EXISTS "Usuários podem atualizar seu próprio perfil" ON public.profiles;
DROP POLICY IF EXISTS "Usuários podem atualizar seu próprio perfil" ON public.users;
