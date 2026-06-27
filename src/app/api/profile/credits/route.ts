import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseUserClientFromRequest, supabaseAdmin, getSupabaseUserTokenFromRequest } from '@/lib/supabase';

export async function GET(request: NextRequest) {
  try {
    const supabaseUser = await getSupabaseUserClientFromRequest();
    const token = await getSupabaseUserTokenFromRequest();

    let user: any = null;
    try {
      const { data: { user: supabaseAuthUser } } = await supabaseUser.auth.getUser(token);
      user = supabaseAuthUser;
    } catch {
      // Sem sessão
    }

    const { searchParams } = new URL(request.url);
    const queryUserId = searchParams.get('userId');

    // Se não houver usuário logado no navegador e for ambiente de desenvolvimento
    if (!user) {
      if (process.env.NODE_ENV === 'development' || !process.env.NODE_ENV) {
        if (queryUserId) {
          const { data: profile } = await supabaseAdmin
            .from('profiles')
            .select('credits')
            .eq('id', queryUserId)
            .maybeSingle();
          if (profile) {
            console.log(`[CREDITS API] Usando userId da query string em desenvolvimento: ${queryUserId}. Saldo: ${profile.credits}`);
            return NextResponse.json({ credits: profile.credits || 0 });
          }
        }


      }
      return NextResponse.json({ credits: 0 });
    }

    // Buscar perfil do usuário autenticado
    const { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('credits')
      .eq('id', user.id)
      .maybeSingle();

    return NextResponse.json({ credits: profile?.credits || 0 });

  } catch (error: any) {
    console.error('Erro na API de créditos:', error);
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 });
  }
}
