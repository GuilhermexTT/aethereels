import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

export async function POST(req: NextRequest) {
  try {
    // 1. Validação estrita do token secreto do webhook
    const asaasToken = req.headers.get('asaas-access-token');
    const secretToken = process.env.ASAAS_WEBHOOK_SECRET;

    if (!secretToken || !asaasToken || asaasToken !== secretToken) {
      console.warn('[ASAAS WEBHOOK] Tentativa de acesso não autorizada (token inválido ou ausente).');
      return NextResponse.json({ error: 'Não autorizado.' }, { status: 401 });
    }

    // 2. Parse do body JSON
    let payload: any;
    try {
      payload = await req.json();
    } catch (err) {
      return NextResponse.json({ error: 'Payload JSON inválido.' }, { status: 400 });
    }

    console.log(`📥 [Asaas Webhook] Evento recebido: ${payload.event}`);

    // 3. Processar apenas o evento PAYMENT_RECEIVED
    if (payload.event === 'PAYMENT_RECEIVED') {
      const payment = payload.payment;
      if (!payment) {
        return NextResponse.json({ error: 'Dados do pagamento ausentes no payload.' }, { status: 400 });
      }

      const asaasBillingId = payment.id;
      const amount = Number(payment.value);
      const status = payment.status;

      // Obter metadata de forma insensível a maiúsculas/minúsculas (Asaas API = metadata, simulador antigo = metaData)
      const metadata = payment.metadata || payment.metaData;

      // Obter user_id de externalReference ou metadata
      const userId = payment.externalReference || metadata?.user_id || metadata?.userId;

      if (!userId) {
        console.error('[ASAAS WEBHOOK] ID do usuário (externalReference/metadata.user_id) não encontrado.');
        return NextResponse.json({ error: 'ID do usuário não fornecido.' }, { status: 400 });
      }

      // Obter quantidade de créditos do metadata ou determinar pelo valor pago (fallback)
      let creditsAdded = Number(metadata?.credits);
      if (!creditsAdded || isNaN(creditsAdded)) {
        if (amount >= 39.0 && amount <= 40.0) {
          creditsAdded = 350; // Plano Starter
        } else if (amount >= 79.0 && amount <= 80.0) {
          creditsAdded = 900; // Plano Pro
        } else if (amount >= 19.0 && amount <= 20.0) {
          creditsAdded = 150; // Recarga Avulsa
        } else {
          creditsAdded = 0;
        }
      }

      if (creditsAdded <= 0) {
        console.warn(`[ASAAS WEBHOOK] Quantidade de créditos a serem adicionados é inválida ou zero para o valor: ${amount}.`);
        return NextResponse.json({ message: 'Nenhum crédito associado a este valor.' }, { status: 200 });
      }

      console.log(`[ASAAS WEBHOOK] Processando pagamento ${asaasBillingId} de R$ ${amount} para o usuário ${userId}. Adicionando ${creditsAdded} créditos.`);

      // 4. Invocar a RPC atômica/idempotente process_asaas_payment
      const { data: success, error: rpcError } = await supabaseAdmin.rpc('process_asaas_payment', {
        p_user_id: userId,
        p_billing_id: asaasBillingId,
        p_amount: amount,
        p_credits_added: creditsAdded,
        p_status: status
      });

      if (rpcError) {
        console.error('[ASAAS WEBHOOK] Erro ao executar process_asaas_payment RPC:', rpcError);
        return NextResponse.json({ error: 'Erro interno ao processar e salvar o pagamento.' }, { status: 500 });
      }

      if (success) {
        console.log(`[ASAAS WEBHOOK] Pagamento ${asaasBillingId} processado com sucesso. ${creditsAdded} créditos injetados.`);
        return NextResponse.json({ message: 'Créditos adicionados com sucesso.' }, { status: 200 });
      } else {
        console.log(`[ASAAS WEBHOOK] Pagamento ${asaasBillingId} já havia sido processado anteriormente (ignorado por segurança).`);
        return NextResponse.json({ message: 'Pagamento já processado anteriormente (ignorado).' }, { status: 200 });
      }
    }

    // Outros eventos recebidos
    return NextResponse.json({ message: `Evento ${payload.event} recebido e ignorado.` }, { status: 200 });

  } catch (error: any) {
    console.error('[ASAAS WEBHOOK] Erro inesperado:', error);
    return NextResponse.json({ error: 'Erro interno do servidor.' }, { status: 500 });
  }
}
