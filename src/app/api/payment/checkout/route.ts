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
    // 1. Obter plano, método de pagamento e userId do corpo do request
    let body;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: 'JSON inválido' }, { status: 400 });
    }
    
    const { plan, billingType = 'PIX', userId } = body;

    // 2. Autenticar usuário via token de sessão
    const supabaseUser = await getSupabaseUserClientFromRequest();
    const token = await getSupabaseUserTokenFromRequest();

    let user: any = null;
    let authError: any = null;
    if (token) {
      try {
        const { data: { user: supabaseAuthUser }, error } = await supabaseUser.auth.getUser(token);
        user = supabaseAuthUser;
        authError = error;
      } catch (err: any) {
        console.error('[CHECKOUT] Erro ao chamar getUser via token:', err.message);
      }
    }

    // Em desenvolvimento, se o token falhar ou não estiver presente, usamos o userId do body como fallback
    if (!user && (process.env.NODE_ENV === 'development' || !process.env.NODE_ENV)) {
      if (userId) {
        const { data: profile } = await supabaseAdmin
          .from('profiles')
          .select('id, email')
          .eq('id', userId)
          .maybeSingle();
        if (profile) {
          user = profile;
          console.log(`[CHECKOUT] Usando userId do corpo da requisição em desenvolvimento: ${user.email} (${user.id})`);
        }
      }
    }



    if (!user) {
      return NextResponse.json({ error: 'Não autorizado. Identificação do usuário necessária.' }, { status: 401 });
    }

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
            cpfCnpj: '99991111140' // CPF de homologação recomendado pelo Asaas
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
          return NextResponse.json({ error: `Falha ao criar cliente no Asaas Sandbox: ${errorMsg}` }, { status: 500 });
        }
      } catch (err: any) {
        console.error('[ASAAS] Erro na requisição do customer:', err);
        return NextResponse.json({ error: `Erro de conexão com gateway ao criar cliente: ${err.message}` }, { status: 500 });
      }
    }

    // Se continuar nulo (mock ou falha), usamos um mock customer id apenas se for mock real
    if (!asaasCustomerId) {
      if (isMock) {
        asaasCustomerId = 'cus_mock_customer_id';
      } else {
        return NextResponse.json({ error: 'Falha ao identificar ou criar cliente no gateway Asaas.' }, { status: 500 });
      }
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
            metadata: {
              user_id: user.id,
              credits: credits
            },
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
