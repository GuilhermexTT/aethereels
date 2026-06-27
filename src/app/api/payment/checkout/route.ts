import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseUserClientFromRequest, supabaseAdmin, getSupabaseUserTokenFromRequest } from '@/lib/supabase';

// Helper para obter a data de amanhã no formato YYYY-MM-DD
function getTomorrowDate() {
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  return tomorrow.toISOString().split('T')[0];
}

export async function POST(req: NextRequest) {
  try {
    // 1. Autenticar usuário
    const supabaseUser = await getSupabaseUserClientFromRequest();
    const token = await getSupabaseUserTokenFromRequest();

    let user: any = null;
    try {
      const { data: { user: supabaseAuthUser } } = await supabaseUser.auth.getUser(token);
      user = supabaseAuthUser;
    } catch (err) {
      console.log('Nenhuma sessão ativa encontrada via cookies/auth headers.');
    }

    if (!user) {
      if (process.env.NODE_ENV === 'development' || !process.env.NODE_ENV) {
        // Obter usuário padrão
        const { data: existingProfiles } = await supabaseAdmin.from('profiles').select('id, email').limit(1);
        if (existingProfiles && existingProfiles.length > 0) {
          user = existingProfiles[0];
        }
      }
    }

    if (!user) {
      return NextResponse.json({ error: 'Não autorizado.' }, { status: 401 });
    }

    // 2. Obter plano e método de pagamento do request body
    let body;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: 'JSON inválido' }, { status: 400 });
    }
    
    const { plan, billingType = 'PIX' } = body;

    // Mapear os planos
    let value = 0;
    let credits = 0;
    let description = '';

    if (plan === 'starter') {
      value = 39.90;
      credits = 350;
      description = 'AetherNetwork - Plano Starter';
    } else if (plan === 'pro') {
      value = 79.90;
      credits = 900;
      description = 'AetherNetwork - Plano Pro';
    } else if (plan === 'recharge') {
      value = 19.90;
      credits = 150;
      description = 'AetherNetwork - Recarga Avulsa 150 créditos';
    } else {
      return NextResponse.json({ error: 'Plano inválido.' }, { status: 400 });
    }

    const asaasApiKey = process.env.ASAAS_API_KEY || 'mock_asaas_api_key';
    const isMock = asaasApiKey.includes('mock');

    // 3. Buscar ou criar o asaas_customer_id no Supabase
    let { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('asaas_customer_id, email')
      .eq('id', user.id)
      .maybeSingle();

    let asaasCustomerId = profile?.asaas_customer_id;

    if (!asaasCustomerId && !isMock) {
      try {
        // Criar cliente no Asaas Sandbox
        const customerRes = await fetch('https://sandbox.asaas.com/api/v3/customers', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'access_token': asaasApiKey
          },
          body: JSON.stringify({
            name: user.email.split('@')[0],
            email: user.email,
            cpfCnpj: '44598765239' // CPF fictício obrigatório
          })
        });

        if (customerRes.ok) {
          const customerData = await customerRes.json();
          asaasCustomerId = customerData.id;

          // Salvar no perfil
          await supabaseAdmin
            .from('profiles')
            .update({ asaas_customer_id: asaasCustomerId })
            .eq('id', user.id);
        } else {
          const errorMsg = await customerRes.text();
          console.error('[ASAAS] Erro ao criar cliente no Asaas:', errorMsg);
        }
      } catch (err) {
        console.error('[ASAAS] Erro na requisição do customer:', err);
      }
    }

    // Se continuar nulo (mock ou falha), usamos um mock customer id
    if (!asaasCustomerId) {
      asaasCustomerId = 'cus_mock_customer_id';
    }

    let paymentId = `pay_${Math.random().toString(36).substring(7)}`;
    let pixCode = '00020126580014br.gov.bcb.pix0136mockpixkey-asaas-sandbox-aethernetwork520400005303986540519.905802BR5925AetherNetwork6009Sao Paulo62070503***6304abcd';
    let pixQrCode = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=='; // Mock QR code
    let invoiceUrl = 'https://sandbox.asaas.com/i/mock';

    if (!isMock) {
      try {
        // Criar cobrança no Asaas Sandbox
        const paymentRes = await fetch('https://sandbox.asaas.com/api/v3/payments', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'access_token': asaasApiKey
          },
          body: JSON.stringify({
            customer: asaasCustomerId,
            billingType: billingType,
            value: value,
            dueDate: getTomorrowDate(),
            externalReference: user.id,
            description: description,
            metaData: {
              user_id: user.id,
              credits: credits
            }
          })
        });

        if (!paymentRes.ok) {
          const errMsg = await paymentRes.text();
          throw new Error(`Asaas retornou erro: ${errMsg}`);
        }

        const paymentData = await paymentRes.json();
        paymentId = paymentData.id;
        invoiceUrl = paymentData.invoiceUrl;

        // Se for Pix, obter o QR Code
        if (billingType === 'PIX') {
          const qrCodeRes = await fetch(`https://sandbox.asaas.com/api/v3/payments/${paymentId}/pixQrCode`, {
            method: 'GET',
            headers: {
              'access_token': asaasApiKey
            }
          });

          if (qrCodeRes.ok) {
            const qrCodeData = await qrCodeRes.json();
            pixCode = qrCodeData.payload;
            pixQrCode = `data:image/png;base64,${qrCodeData.encodedImage}`;
          }
        }
      } catch (err: any) {
        console.error('[ASAAS] Erro ao criar cobrança:', err);
        return NextResponse.json({ error: `Erro no gateway de pagamento: ${err.message}` }, { status: 500 });
      }
    }

    return NextResponse.json({
      success: true,
      paymentId,
      billingType,
      value,
      credits,
      pixCode,
      pixQrCode,
      invoiceUrl,
      userId: user.id
    });

  } catch (error: any) {
    console.error('[CHECKOUT API] Erro:', error);
    return NextResponse.json({ error: 'Erro interno do servidor.' }, { status: 500 });
  }
}
