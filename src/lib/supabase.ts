import { createClient } from '@supabase/supabase-js';
import { cookies, headers } from 'next/headers';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

// Apenas inicializa o cliente Admin se as variáveis estiverem presentes (evita travar o build do Next.js/Vercel)
export const supabaseAdmin = (supabaseUrl && supabaseServiceKey)
  ? createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    })
  : null as any;

/**
 * Retorna um cliente Supabase associado ao token do usuário atual para respeitar o RLS.
 */
export function getSupabaseUserClient(authToken?: string) {
  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error('As variáveis de ambiente do Supabase (NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY) não estão configuradas.');
  }
  return createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
    global: {
      headers: authToken ? { Authorization: authToken } : undefined,
    },
  });
}

/**
 * Helper para obter automaticamente o cliente Supabase do usuário a partir dos headers ou cookies da requisição atual.
 */
export async function getSupabaseUserClientFromRequest() {
  const headersList = await headers();
  const authHeader = headersList.get('Authorization') || headersList.get('authorization');
  
  if (authHeader) {
    return getSupabaseUserClient(authHeader);
  }
  
  // Tenta extrair a sessão dos cookies do Supabase
  const cookieStore = await cookies();
  
  // O Supabase Auth no Next.js salva o token de acesso em cookies.
  // Procuramos por padrões comuns como 'sb-access-token' ou tokens customizados do Supabase Auth Helpers/SSR.
  const token = 
    cookieStore.get('sb-access-token')?.value || 
    cookieStore.get('supabase-auth-token')?.value; // fallback para outras versões
  
  return getSupabaseUserClient(token ? `Bearer ${token}` : undefined);
}
