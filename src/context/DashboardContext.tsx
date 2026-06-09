'use client';

import React, { createContext, useContext, useState } from 'react';
import { TabType, VideoGenerationState } from '../types/dashboard';

interface DashboardContextType {
  credits: number;
  decrementCredits: (amount: number) => void;
  videoState: VideoGenerationState;
  setVideoState: (state: VideoGenerationState) => void;
  activeTab: TabType;
  setActiveTab: (tab: TabType) => void;
}

const DashboardContext = createContext<DashboardContextType | undefined>(undefined);

export function DashboardProvider({ children }: { children: React.ReactNode }) {
  const [credits, setCredits] = useState(12450);
  const [videoState, setVideoState] = useState<VideoGenerationState>('idle');
  const [activeTab, setActiveTab] = useState<TabType>('text-to-video');

  const decrementCredits = (amount: number) => {
    setCredits((prev) => Math.max(0, prev - amount));
  };

  return (
    <DashboardContext.Provider
      value={{
        credits,
        decrementCredits,
        videoState,
        setVideoState,
        activeTab,
        setActiveTab,
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
