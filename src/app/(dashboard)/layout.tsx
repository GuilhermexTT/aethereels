'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Bell, ChevronDown } from 'lucide-react';
import { DashboardProvider, useDashboard } from '../../context/DashboardContext';

function Header() {
  const pathname = usePathname();
  const { credits } = useDashboard();

  const formatCredits = (num: number) => {
    return num.toLocaleString('pt-BR');
  };

  const navigation = [
    { name: 'Criar', href: '/dashboard' },
    { name: 'Histórico', href: '/history' },
    { name: 'Integrações', href: '/integrations' },
    { name: 'Configurações', href: '/settings' },
  ];

  return (
    <header className="sticky top-0 z-50 w-full border-b border-white/5 bg-[#030712]/80 backdrop-blur-md">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex h-16 items-center justify-between gap-4">
          
          {/* Logo ReelsFlow (Alinhado à Esquerda) */}
          <div className="flex items-center gap-2">
            <Link href="/dashboard" className="flex items-center gap-2 group">
              <div className="relative flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-blue-600 to-cyan-400 p-0.5 shadow-md shadow-cyan-500/10 group-hover:shadow-cyan-500/20 transition-all duration-300">
                <div className="flex h-full w-full items-center justify-center rounded-[10px] bg-[#030712] transition-colors group-hover:bg-[#030712]/45">
                  <svg
                    className="h-5 w-5 text-cyan-400 fill-none stroke-current"
                    viewBox="0 0 24 24"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M12 2a10 10 0 1 0 10 10" />
                    <path d="M12 6a6 6 0 1 0 6 6" />
                    <path d="M12 10a2 2 0 1 0 2 2" />
                  </svg>
                </div>
              </div>
              <span className="font-display text-xl font-bold tracking-tight text-white bg-gradient-to-r from-white via-slate-100 to-slate-300 bg-clip-text">
                Reels<span className="text-cyan-400">Flow</span>
              </span>
            </Link>
          </div>

          {/* Menu Central */}
          <nav className="hidden md:flex items-center gap-8">
            {navigation.map((item) => {
              const isActive = pathname === item.href || (item.href === '/dashboard' && pathname === '/dashboard');
              return (
                <Link
                  key={item.name}
                  href={item.href}
                  className={`text-sm font-medium transition-all duration-200 hover:text-white ${
                    isActive
                      ? 'text-cyan-400 font-semibold drop-shadow-[0_0_10px_rgba(0,229,255,0.4)]'
                      : 'text-slate-400/80 hover:text-slate-200'
                  }`}
                >
                  {item.name}
                </Link>
              );
            })}
          </nav>

          {/* Ações Direitas */}
          <div className="flex items-center gap-4">
            
            {/* Indicador de Créditos */}
            <div className="flex items-center gap-2 rounded-full border border-[#1e293b]/50 bg-slate-900/40 px-3.5 py-1.5 text-xs font-semibold text-slate-300 shadow-inner">
              <div className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-cyan-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-cyan-505 bg-cyan-400"></span>
              </div>
              <span>Créditos</span>
              <span className="text-cyan-400 font-bold ml-1">{formatCredits(credits)}</span>
            </div>

            {/* Botão Upgrade */}
            <button className="hidden sm:inline-flex items-center justify-center rounded-lg border border-blue-500/30 bg-blue-500/10 px-4 py-1.5 text-xs font-semibold text-blue-400 hover:bg-blue-500/20 hover:border-blue-500/50 hover:text-white active:scale-95 transition-all duration-200">
              Upgrade
            </button>

            {/* Notificações */}
            <button className="relative rounded-lg p-2 text-slate-400 hover:bg-white/5 hover:text-white transition-all duration-200">
              <span className="absolute top-2 right-2 h-1.5 w-1.5 rounded-full bg-cyan-400 ring-2 ring-[#030712]"></span>
              <Bell className="h-5 w-5" />
            </button>

            {/* Avatar do Perfil */}
            <div className="flex items-center gap-1.5 pl-2 border-l border-white/5 cursor-pointer group">
              <div className="h-8 w-8 rounded-full overflow-hidden border border-white/10 group-hover:border-cyan-400/50 transition-colors duration-200">
                <img
                  src="https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=100&q=80"
                  alt="Perfil do Usuário"
                  className="h-full w-full object-cover"
                />
              </div>
              <ChevronDown className="h-3 w-3 text-slate-500 group-hover:text-slate-300 transition-colors" />
            </div>

          </div>

        </div>
      </div>
    </header>
  );
}

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <DashboardProvider>
      <div className="min-h-screen bg-[#030712] flex flex-col font-sans">
        <Header />
        <main className="flex-1 w-full mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8 md:py-10">
          {children}
        </main>
      </div>
    </DashboardProvider>
  );
}
