import { NextRequest, NextResponse } from 'next/server';
import {
  getSupabaseUserClientFromRequest,
  getSupabaseUserTokenFromRequest,
  supabaseAdmin,
} from '@/lib/supabase';

export async function DELETE(req: NextRequest) {
  const supabaseUser = await getSupabaseUserClientFromRequest();
  const token = await getSupabaseUserTokenFromRequest();

  // Verificar sessão
  let user: any = null;
  try {
    const { data: { user: u } } = await supabaseUser.auth.getUser(token);
    user = u;
  } catch {
    // sem sessão
  }

  if (!user) {
    return NextResponse.json({ error: 'Não autorizado.' }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const jobId = searchParams.get('id');

  if (!jobId) {
    return NextResponse.json({ error: 'ID do job é obrigatório.' }, { status: 400 });
  }

  // Verificar que o job pertence ao usuário antes de deletar
  const { data: job, error: fetchError } = await supabaseUser.from('video_jobs')
    .select('id, user_id, status')
    .eq('id', jobId)
    .single();

  if (fetchError || !job) {
    return NextResponse.json({ error: 'Job não encontrado.' }, { status: 404 });
  }

  if (job.user_id !== user.id) {
    return NextResponse.json({ error: 'Acesso negado.' }, { status: 403 });
  }

  // Não permitir deletar jobs em processamento ativo
  const activeStatuses = ['pending', 'scripting', 'processing', 'rendering'];
  if (activeStatuses.includes(job.status)) {
    return NextResponse.json(
      { error: 'Não é possível excluir um vídeo que ainda está sendo processado.' },
      { status: 409 }
    );
  }

  // Usar o cliente admin para deletar (evita conflitos de RLS em DELETE)
  const clientToDelete = supabaseAdmin || supabaseUser;
  const { error: deleteError } = await clientToDelete
    .from('video_jobs')
    .delete()
    .eq('id', jobId)
    .eq('user_id', user.id);

  if (deleteError) {
    console.error('[DELETE /api/video/delete] Erro ao deletar:', deleteError);
    return NextResponse.json({ error: 'Erro interno ao excluir o projeto.' }, { status: 500 });
  }

  return NextResponse.json({ success: true, deletedId: jobId });
}
