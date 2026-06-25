'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { 
  Sparkles, 
  Folder, 
  Video,
  Settings, 
  Crown, 
  Bell, 
  ChevronDown, 
  Calendar, 
  Menu, 
  X 
} from 'lucide-react';
import { DashboardProvider, useDashboard } from '../../context/DashboardContext';

interface SidebarContentProps {
  onClose?: () => void;
}

function SidebarContent({ 
  onClose,
}: SidebarContentProps) {
  const pathname = usePathname();
  const { credits } = useDashboard();

  const navigation = [
    { name: 'Criar', href: '/dashboard', icon: Sparkles },
    { name: 'Auto-Edição', href: '/dashboard/auto-edicao', icon: Video },
    { name: 'Projetos', href: '/history', icon: Folder },
    { name: 'Configurações', href: '#', icon: Settings },
  ];

  return (
    <div className="flex flex-col h-full bg-[#050914] border-r border-[#15233c]/60 p-6 select-none" role="navigation" aria-label="Menu Principal">
      <div className="relative flex items-center justify-center mb-3 w-full">
        <Link href="/dashboard" onClick={onClose} className="flex items-center justify-center group -ml-2">
          <img
            src="/logo.png"
            alt="Adisea Logo"
            className="h-11 w-auto object-contain"
          />
        </Link>
        {onClose && (
          <button 
            onClick={onClose} 
            className="absolute right-0 text-slate-400 hover:text-white p-1 hover:bg-slate-900/60 rounded-lg transition-colors cursor-pointer"
            aria-label="Fechar menu"
          >
            <X className="h-5 w-5" />
          </button>
        )}
      </div>

      {/* Nav Menu */}
      <nav className="flex flex-col gap-1.5" aria-label="Links de navegação">
        {navigation.map((item) => {
          const isActive = pathname === item.href;
          const Icon = item.icon;
          return (
            <Link
              key={item.name}
              href={item.href}
              onClick={onClose}
              className={`flex items-center gap-3 px-4 py-3 text-sm font-semibold rounded-xl transition-all duration-200 ${
                isActive
                  ? 'bg-[#161328] border border-[#7c3aed]/40 text-white shadow-[0_0_15px_rgba(124,58,237,0.08)]'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/40 border border-transparent'
              }`}
            >
              <Icon className={`h-4.5 w-4.5 ${isActive ? 'text-indigo-400' : 'text-slate-400 group-hover:text-slate-200'}`} />
              <span>{item.name}</span>
            </Link>
          );
        })}
      </nav>

      {/* Credit Panel at Bottom */}
      <div className="mt-auto p-4.5 bg-[#070c17]/60 border border-[#16223f]/50 rounded-2xl flex flex-col gap-3">
        <div className="flex flex-col">
          <span className="text-[11px] text-slate-500 uppercase font-bold tracking-wider">Seus créditos</span>
          <div className="flex items-center gap-1.5 mt-1">
            <span className="text-xl font-extrabold text-white">{credits.toLocaleString('pt-BR')}</span>
            <span className="text-blue-400 font-bold">⚡</span>
          </div>
          <span className="text-[10px] text-slate-500 font-medium">de 15.000 usados</span>
        </div>
        
        {/* Progress bar */}
        <div className="w-full h-1.5 bg-slate-950 rounded-full overflow-hidden mt-0.5">
          <div 
            className="h-full bg-gradient-to-r from-blue-500 via-indigo-500 to-purple-500 rounded-full" 
            style={{ width: `${(credits / 15000) * 100}%` }}
          />
        </div>

        <div className="flex items-center gap-1.5 text-[10px] text-slate-500 mt-1 font-semibold">
          <Calendar className="h-3.5 w-3.5 text-slate-500" />
          <span>Renova em 12 dias</span>
        </div>
      </div>
    </div>
  );
}

function TopHeader({ onMenuOpen }: { onMenuOpen: () => void }) {
  const { credits } = useDashboard();

  return (
    <header className="sticky top-0 z-40 w-full bg-[#02050c]/80 backdrop-blur-md px-6 py-4 flex items-center justify-between border-b border-[#15233c]/20">
      {/* Hamburger menu for mobile only */}
      <button 
        onClick={onMenuOpen}
        className="md:hidden text-slate-300 hover:text-white p-2 hover:bg-slate-900/60 rounded-xl transition-all"
        aria-label="Abrir menu lateral"
      >
        <Menu className="h-5 w-5" />
      </button>

      {/* Right actions */}
      <div className="flex items-center gap-4 ml-auto">
        {/* Credits Badge (hidden on extra small screens) */}
        <div className="hidden sm:flex items-center gap-1.5 rounded-full border border-[#15233c]/60 bg-[#070c17]/60 px-4 py-2 text-xs font-semibold text-slate-300 select-none">
          <span className="text-blue-400">⚡</span>
          <span>Créditos</span>
          <span className="text-blue-400 font-bold ml-1">{credits.toLocaleString('pt-BR')}</span>
        </div>

        {/* Upgrade Button */}
        <button className="flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-[#6366f1] to-[#a855f7] hover:opacity-95 px-4 py-2 text-xs font-bold text-white shadow-lg shadow-purple-500/20 active:scale-95 transition-all">
          <Crown className="h-3.5 w-3.5 fill-current text-white" />
          Upgrade
        </button>

        {/* Bell Notifications */}
        <button className="relative rounded-xl p-2 bg-[#070c17]/60 border border-[#15233c]/60 text-slate-400 hover:bg-[#0c1426] hover:text-white transition-all">
          <span className="absolute top-1.5 right-1.5 h-1.5 w-1.5 rounded-full bg-[#a855f7] ring-2 ring-[#02050c]"></span>
          <Bell className="h-4.5 w-4.5" />
        </button>

        {/* Profile Avatar */}
        <div className="flex items-center gap-2 pl-2 border-l border-slate-800 cursor-pointer group">
          <div className="h-8 w-8 rounded-full overflow-hidden border border-slate-700 group-hover:border-blue-400/50 transition-colors">
            <img
              src="https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=100&q=80"
              alt="Perfil do Usuário"
              className="h-full w-full object-cover"
            />
          </div>
          <ChevronDown className="h-3.5 w-3.5 text-slate-500 group-hover:text-slate-300 transition-colors" />
        </div>
      </div>
    </header>
  );
}

export default function DashboardClientLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  useEffect(() => {
    // Reverter/limpar preferências de acessibilidade anteriores
    document.documentElement.style.removeProperty('--text-scale');
    document.documentElement.classList.remove('reduced-motion');
  }, []);

  return (
    <DashboardProvider>
      <div className="min-h-screen bg-[#02050c] flex font-sans text-slate-100 overflow-hidden">
        {/* Desktop Sidebar (hidden on mobile) */}
        <aside className="hidden md:block w-64 shrink-0 h-screen sticky top-0" role="complementary">
          <SidebarContent />
        </aside>

        {/* Mobile Sidebar (Drawer overlay) */}
        {isSidebarOpen && (
          <div className="fixed inset-0 z-50 flex md:hidden" role="dialog" aria-modal="true" aria-label="Menu lateral">
            {/* Backdrop overlay */}
            <div 
              className="fixed inset-0 bg-black/60 backdrop-blur-sm transition-opacity"
              onClick={() => setIsSidebarOpen(false)}
              aria-hidden="true"
            />
            {/* Drawer */}
            <div className="relative w-64 max-w-xs h-full flex flex-col z-10">
              <SidebarContent onClose={() => setIsSidebarOpen(false)} />
            </div>
          </div>
        )}

        {/* Main Content Area */}
        <div className="flex-1 flex flex-col min-w-0 h-screen overflow-hidden">
          <TopHeader onMenuOpen={() => setIsSidebarOpen(true)} />
          <main className="flex-1 overflow-y-auto px-6 py-6 md:px-8 md:py-8" role="main" id="main-content">
            {children}
          </main>
        </div>
      </div>
    </DashboardProvider>
  );
}
