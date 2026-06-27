import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { paymentId, userId, value, credits } = body;

    // 1. Confirmar pagamento no Asaas Sandbox real se houver API key configurada
    const asaasApiKey = process.env.ASAAS_API_KEY;
    if (asaasApiKey && !asaasApiKey.includes('mock') && paymentId && !paymentId.includes('mock')) {
      try {
        const confirmUrl = `https://sandbox.asaas.com/api/v3/sandbox/payment/${paymentId}/confirm`;
        const asaasConfirmResponse = await fetch(confirmUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'access_token': asaasApiKey
          }
        });
        if (asaasConfirmResponse.ok) {
          console.log(`[SIMULATE WEBHOOK] Cobrança ${paymentId} confirmada com sucesso no painel do Asaas Sandbox.`);
        } else {
          const errMsg = await asaasConfirmResponse.text();
          console.warn(`[SIMULATE WEBHOOK] Asaas Sandbox retornou erro ao confirmar cobrança ${paymentId}: ${errMsg}`);
        }
      } catch (err: any) {
        console.error('[SIMULATE WEBHOOK] Erro ao conectar com o gateway do Asaas para confirmação:', err.message);
      }
    }

    // 2. Disparar o webhook local
    const webhookUrl = `${req.nextUrl.origin}/api/webhooks/asaas`;
    const secret = process.env.ASAAS_WEBHOOK_SECRET || 'mock_asaas_webhook_secret_for_testing';

    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'asaas-access-token': secret
      },
      body: JSON.stringify({
        event: 'PAYMENT_RECEIVED',
        payment: {
          id: paymentId,
          value: value,
          status: 'RECEIVED',
          externalReference: userId,
          metadata: {
            user_id: userId,
            credits: credits
          },
          metaData: {
            user_id: userId,
            credits: credits
          }
        }
      })
    });

    if (!response.ok) {
      const errText = await response.text();
      return NextResponse.json({ error: `Webhook simulado falhou: ${errText}` }, { status: 500 });
    }

    const data = await response.json();
    return NextResponse.json({ success: true, webhookResponse: data });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
