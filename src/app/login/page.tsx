'use client';

import React, { useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@supabase/supabase-js';
import { Mail, Lock, Loader2, Sparkles } from 'lucide-react';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
const supabase = createClient(supabaseUrl, supabaseAnonKey);

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectPath = searchParams.get('redirect') || '/dashboard';

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) return;

    setLoading(true);
    setError(null);

    try {
      const { data, error: loginErr } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (loginErr) {
        throw loginErr;
      }

      if (data.session) {
        // Gravar cookie de sessão
        document.cookie = `sb-access-token=${data.session.access_token}; path=/; max-age=${60 * 60 * 24 * 7}; SameSite=Lax; Secure`;
        router.push(redirectPath);
        router.refresh();
      }
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Erro ao efetuar login. Verifique suas credenciais.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#02050c] flex items-center justify-center p-4 relative font-sans text-slate-100 overflow-hidden select-none">
      {/* Background gradients */}
      <div
        className="absolute pointer-events-none z-0 opacity-30 blur-[130px]"
        style={{
          width: '500px',
          height: '500px',
          background: 'radial-gradient(circle, rgba(124,58,237,0.15) 0%, rgba(6,182,212,0.05) 50%, transparent 100%)',
          left: '10%',
          top: '20%',
        }}
      />
      <div
        className="absolute pointer-events-none z-0 opacity-35 blur-[140px]"
        style={{
          width: '600px',
          height: '600px',
          background: 'radial-gradient(circle, rgba(6,182,212,0.15) 0%, rgba(124,58,237,0.05) 50%, transparent 100%)',
          right: '5%',
          bottom: '10%',
        }}
      />

      <div className="w-full max-w-md bg-[#060a13]/80 backdrop-blur-xl border border-[#16223f]/60 rounded-3xl p-8 shadow-[0_0_50px_rgba(6,182,212,0.05)] relative z-10">
        {/* Header */}
        <div className="flex flex-col items-center text-center mb-8">
          <div className="flex items-center gap-2 mb-3">
            <span className="text-xl">✨</span>
            <span className="text-xs font-bold text-indigo-400 bg-indigo-500/10 border border-indigo-500/20 px-3.5 py-1 rounded-full uppercase tracking-widest">
              AETHER NETWORK
            </span>
          </div>
          <h1 className="text-2xl font-black text-white tracking-tight uppercase">
            Bem-vindo de volta
          </h1>
          <p className="text-[11px] text-slate-400 mt-2 max-w-[280px]">
            Faça login para gerenciar seus projetos e acessar sua área de criação.
          </p>
        </div>

        {error && (
          <div className="bg-red-500/10 border border-red-500/25 text-red-400 rounded-xl p-3.5 text-xs font-semibold mb-6 text-center animate-pulse">
            ⚠️ {error}
          </div>
        )}

        <form onSubmit={handleLogin} className="flex flex-col gap-5">
          {/* Email input */}
          <div className="flex flex-col gap-1.5">
            <label className="text-[10px] text-slate-400 font-extrabold uppercase tracking-wide">
              E-mail corporativo ou pessoal
            </label>
            <div className="relative flex items-center">
              <Mail className="absolute left-3.5 h-4.5 w-4.5 text-slate-500" />
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="nome@email.com"
                className="w-full bg-[#03060c]/60 border border-[#16223f]/60 hover:border-cyan-500/40 focus:border-cyan-400 focus:shadow-[0_0_15px_rgba(6,182,212,0.08)] rounded-xl py-3.5 pl-11 pr-4 text-xs text-white placeholder-slate-600 outline-none transition-all"
              />
            </div>
          </div>

          {/* Password input */}
          <div className="flex flex-col gap-1.5">
            <label className="text-[10px] text-slate-400 font-extrabold uppercase tracking-wide">
              Sua senha de segurança
            </label>
            <div className="relative flex items-center">
              <Lock className="absolute left-3.5 h-4.5 w-4.5 text-slate-500" />
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••••••"
                className="w-full bg-[#03060c]/60 border border-[#16223f]/60 hover:border-cyan-500/40 focus:border-cyan-400 focus:shadow-[0_0_15px_rgba(6,182,212,0.08)] rounded-xl py-3.5 pl-11 pr-4 text-xs text-white placeholder-slate-600 outline-none transition-all"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[#2563eb] via-[#6366f1] to-[#a855f7] hover:opacity-95 active:scale-98 py-3.5 text-xs font-bold text-white shadow-lg shadow-indigo-600/15 transition-all select-none mt-2 disabled:opacity-50 cursor-pointer"
          >
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin text-white" />
                <span>Efetuando login...</span>
              </>
            ) : (
              <>
                <Sparkles className="h-4 w-4 text-white fill-current" />
                <span>Acessar Painel de Controle</span>
              </>
            )}
          </button>
        </form>

        <div className="mt-8 text-center border-t border-slate-900 pt-6">
          <p className="text-[11px] text-slate-500 font-semibold">
            Não tem uma conta corporativa?{' '}
            <Link
              href="/cadastro"
              className="text-cyan-400 hover:text-cyan-300 font-extrabold transition-all"
            >
              Criar Conta Gratuita
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-[#02050c] flex items-center justify-center text-slate-400">
        Carregando...
      </div>
    }>
      <LoginForm />
    </Suspense>
  );
}
