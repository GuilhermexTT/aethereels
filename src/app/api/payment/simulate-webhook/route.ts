import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { paymentId, userId, value, credits } = body;

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
