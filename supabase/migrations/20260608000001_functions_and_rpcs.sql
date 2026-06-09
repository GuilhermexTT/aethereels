-- Migração de RPCs: Controle de Créditos e Reembolso
-- Data: 2026-06-08 (Timezone UTC padrão)

-- 1. RPC: debit_video_credit (Valida saldo, debita crédito e cria o video_job)
-- Executa de forma atômica com lock de linha para prevenir Race Conditions.
CREATE OR REPLACE FUNCTION public.debit_video_credit(
    p_user_id UUID,
    p_prompt_input TEXT
)
RETURNS UUID AS $$
DECLARE
    v_job_id UUID;
    v_credits INTEGER;
    v_caller_uid UUID;
BEGIN
    -- Obter o UID do usuário autenticado no contexto do Supabase (se houver)
    v_caller_uid := auth.uid();
    
    -- Se a chamada veio de um usuário autenticado (não-admin/service_role),
    -- garante que ele só pode solicitar geração de vídeo para si mesmo.
    IF v_caller_uid IS NOT NULL AND v_caller_uid <> p_user_id THEN
        RAISE EXCEPTION 'Não autorizado: O ID do usuário solicitante não corresponde ao usuário autenticado.'
            USING ERRCODE = '42501'; -- código de erro de permissão do PostgreSQL (Insufficient Privilege)
    END IF;

    -- Lock de escrita (pessimistic lock) na linha do usuário para evitar Race Conditions
    SELECT credits_balance INTO v_credits
    FROM public.users
    WHERE id = p_user_id
    FOR UPDATE;

    -- Validar se a conta do usuário existe
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Usuário não encontrado.'
            USING ERRCODE = 'P0002'; -- Data Not Found
    END IF;

    -- Validar saldo de créditos
    IF v_credits < 1 THEN
        RAISE EXCEPTION 'Saldo de créditos insuficiente para gerar este vídeo.'
            USING ERRCODE = '22003'; -- Numeric Value Out of Range
    END IF;

    -- Deduzir exatamente 1 crédito do saldo do usuário
    UPDATE public.users
    SET credits_balance = credits_balance - 1
    WHERE id = p_user_id;

    -- Criar o registro na tabela de video_jobs com status 'pending'
    INSERT INTO public.video_jobs (
        user_id,
        status,
        prompt_input,
        script_json
    ) VALUES (
        p_user_id,
        'pending',
        p_prompt_input,
        '{}'::jsonb
    )
    RETURNING id INTO v_job_id;

    -- Retorna o ID do job criado para que a API repasse ao frontend
    RETURN v_job_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. RPC: refund_video_credit (Reembolsa crédito e gera log de auditoria em caso de falhas)
-- Executado de forma transacional pelo callback do webhook (ou contingência n8n).
CREATE OR REPLACE FUNCTION public.refund_video_credit(
    p_user_id UUID,
    p_job_id UUID,
    p_error_txt TEXT
)
RETURNS VOID AS $$
DECLARE
    v_job_exists BOOLEAN;
    v_job_user_id UUID;
    v_job_status TEXT;
BEGIN
    -- Validar a existência do job de vídeo e obter metadados
    SELECT EXISTS(SELECT 1 FROM public.video_jobs WHERE id = p_job_id), user_id, status
    INTO v_job_exists, v_job_user_id, v_job_status
    FROM public.video_jobs
    WHERE id = p_job_id;

    IF NOT v_job_exists THEN
        RAISE EXCEPTION 'Job de vídeo com ID % não encontrado.', p_job_id
            USING ERRCODE = 'P0002';
    END IF;

    -- Garantir que o job pertence ao usuário informado no reembolso
    IF v_job_user_id <> p_user_id THEN
        RAISE EXCEPTION 'O job de vídeo % não pertence ao usuário %.', p_job_id, p_user_id
            USING ERRCODE = '42501';
    END IF;

    -- Impedir duplo reembolso (se o job já está marcado como failed, ou se já foi reembolsado)
    -- Se o status for 'failed', mas ainda assim for disparado, ou se for outro status, atualizamos para failed.
    IF EXISTS (
        SELECT 1 FROM public.refund_logs 
        WHERE video_job_id = p_job_id
    ) THEN
        RAISE EXCEPTION 'Este job de vídeo % já recebeu reembolso anteriormente.', p_job_id
            USING ERRCODE = '23505'; -- Unique Violation
    END IF;

    -- Reestabelece o saldo (+1 crédito) do usuário
    UPDATE public.users
    SET credits_balance = credits_balance + 1
    WHERE id = p_user_id;

    -- Atualiza o status do job de vídeo para 'failed' para integridade visual do frontend
    UPDATE public.video_jobs
    SET status = 'failed'
    WHERE id = p_job_id;

    -- Insere registro de auditoria na tabela de logs de reembolso
    INSERT INTO public.refund_logs (
        user_id,
        video_job_id,
        error_message,
        credits_refunded
    ) VALUES (
        p_user_id,
        p_job_id,
        p_error_txt,
        1
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. Habilita o recurso de "Postgres Changes" (Supabase Realtime) na tabela video_jobs
-- para que o frontend escute nativamente as atualizações de status sem polling.
alter publication supabase_realtime add table public.video_jobs;

