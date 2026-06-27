'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';
import { TabType, VideoGenerationState } from '../types/dashboard';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
const supabase = createClient(supabaseUrl, supabaseAnonKey);

interface DashboardContextType {
  credits: number;
  setCredits: React.Dispatch<React.SetStateAction<number>>;
  decrementCredits: (amount: number) => void;
  videoState: VideoGenerationState;
  setVideoState: (state: VideoGenerationState) => void;
  activeTab: TabType;
  setActiveTab: (tab: TabType) => void;
  refreshCredits: () => Promise<void>;
  isUpgradeModalOpen: boolean;
  setIsUpgradeModalOpen: (open: boolean) => void;
}

const DashboardContext = createContext<DashboardContextType | undefined>(undefined);

export function DashboardProvider({ children }: { children: React.ReactNode }) {
  const [credits, setCredits] = useState(0);
  const [videoState, setVideoState] = useState<VideoGenerationState>('idle');
  const [activeTab, setActiveTab] = useState<TabType>('text-to-video');
  const [isUpgradeModalOpen, setIsUpgradeModalOpen] = useState(false);

  const refreshCredits = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const accessToken = session?.access_token;

      const response = await fetch('/api/profile/credits', {
        headers: {
          ...(accessToken ? { 'Authorization': `Bearer ${accessToken}` } : {})
        }
      });
      if (response.ok) {
        const data = await response.json();
        setCredits(data.credits);
      }
    } catch (err) {
      console.error('Erro ao recarregar créditos no context:', err);
    }
  };

  useEffect(() => {
    // Carregar créditos iniciais
    // eslint-disable-next-line react-hooks/set-state-in-effect
    refreshCredits();

    // Ouvir mudanças no estado de autenticação para recarregar créditos
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (session?.user) {
        // Toda vez que o estado do usuário muda, atualiza o cookie também
        document.cookie = `sb-access-token=${session.access_token}; path=/; max-age=${60 * 60 * 24 * 7}; SameSite=Lax; Secure`;
        await refreshCredits();
      } else {
        document.cookie = `sb-access-token=; path=/; expires=Thu, 01 Jan 1970 00:00:00 UTC; SameSite=Lax; Secure`;
        await refreshCredits();
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  const decrementCredits = (amount: number) => {
    setCredits((prev) => Math.max(0, prev - amount));
  };

  return (
    <DashboardContext.Provider
      value={{
        credits,
        setCredits,
        decrementCredits,
        videoState,
        setVideoState,
        activeTab,
        setActiveTab,
        refreshCredits,
        isUpgradeModalOpen,
        setIsUpgradeModalOpen,
      }}
    >
      {children}
    </DashboardContext.Provider>
  );
}

export function useDashboard() {
  const context = useContext(DashboardContext);
  if (!context) {
    throw new Error('useDashboard must be used within a DashboardProvider');
  }
  return context;
}
