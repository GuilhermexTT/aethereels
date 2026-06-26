'use client';

import React, { useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@supabase/supabase-js';
import { Mail, Lock, Loader2, Sparkles } from 'lucide-react';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
const supabase = createClient(supabaseUrl, supabaseAnonKey);

function RegisterForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectPath = searchParams.get('redirect') || '/dashboard';

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password || !confirmPassword) return;

    if (password !== confirmPassword) {
      setError('As senhas digitadas não coincidem.');
      return;
    }

    if (password.length < 6) {
      setError('A senha deve ter no mínimo 6 caracteres.');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const { data, error: signupErr } = await supabase.auth.signUp({
        email,
        password,
      });

      if (signupErr) {
        throw signupErr;
      }

      if (data.user) {
        // Se autologin foi ativado (padrão do Supabase se confirmação de e-mail estiver desativada na dashboard)
        if (data.session) {
          document.cookie = `sb-access-token=${data.session.access_token}; path=/; max-age=${60 * 60 * 24 * 7}; SameSite=Lax; Secure`;
          router.push(redirectPath);
          router.refresh();
        } else {
          setSuccess(true);
        }
      }
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Erro ao efetuar o cadastro. Tente novamente.');
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
            <span className="text-xl">⚡</span>
            <span className="text-xs font-bold text-indigo-400 bg-indigo-500/10 border border-indigo-500/20 px-3.5 py-1 rounded-full uppercase tracking-widest">
              Fase 1: Cadastro
            </span>
          </div>
          <h1 className="text-2xl font-black text-white tracking-tight uppercase">
            Criar sua Conta
          </h1>
          <p className="text-[11px] text-slate-400 mt-2 max-w-[280px]">
            Crie sua conta gratuita e resgate seus <span className="text-cyan-400 font-bold">10 créditos bônus</span> de boas-vindas.
          </p>
        </div>

        {error && (
          <div className="bg-red-500/10 border border-red-500/25 text-red-400 rounded-xl p-3.5 text-xs font-semibold mb-6 text-center animate-pulse">
            ⚠️ {error}
          </div>
        )}

        {success ? (
          <div className="bg-emerald-500/10 border border-emerald-500/25 text-slate-200 rounded-2xl p-6 text-center flex flex-col items-center gap-4">
            <div className="h-10 w-10 rounded-full bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
              ✓
            </div>
            <h3 className="text-sm font-bold text-white uppercase tracking-wider">Conta Criada!</h3>
            <p className="text-xs text-slate-400 leading-relaxed font-semibold">
              Um e-mail de confirmação foi enviado para o seu endereço. Confirme seu e-mail para ativar sua conta e receber seus 10 créditos.
            </p>
            <Link
              href="/login"
              className="mt-2 w-full text-center rounded-xl bg-slate-900 border border-slate-800 hover:border-slate-700 py-3 text-xs font-bold text-white transition-all"
            >
              Ir para o Login
            </Link>
          </div>
        ) : (
          <form onSubmit={handleRegister} className="flex flex-col gap-4.5">
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
                  placeholder="Mínimo 6 caracteres"
                  className="w-full bg-[#03060c]/60 border border-[#16223f]/60 hover:border-cyan-500/40 focus:border-cyan-400 focus:shadow-[0_0_15px_rgba(6,182,212,0.08)] rounded-xl py-3.5 pl-11 pr-4 text-xs text-white placeholder-slate-600 outline-none transition-all"
                />
              </div>
            </div>

            {/* Confirm Password input */}
            <div className="flex flex-col gap-1.5">
              <label className="text-[10px] text-slate-400 font-extrabold uppercase tracking-wide">
                Confirme sua senha
              </label>
              <div className="relative flex items-center">
                <Lock className="absolute left-3.5 h-4.5 w-4.5 text-slate-500" />
                <input
                  type="password"
                  required
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Repita sua senha"
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
                  <span>Cadastrando sua conta...</span>
                </>
              ) : (
                <>
                  <Sparkles className="h-4 w-4 text-white fill-current" />
                  <span>Cadastrar e Resgatar Bônus</span>
                </>
              )}
            </button>
          </form>
        )}

        <div className="mt-8 text-center border-t border-slate-900 pt-6">
          <p className="text-[11px] text-slate-500 font-semibold">
            Já possui uma conta?{' '}
            <Link
              href="/login"
              className="text-cyan-400 hover:text-cyan-300 font-extrabold transition-all"
            >
              Fazer Login
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}

export default function RegisterPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-[#02050c] flex items-center justify-center text-slate-400">
        Carregando...
      </div>
    }>
      <RegisterForm />
    </Suspense>
  );
}
