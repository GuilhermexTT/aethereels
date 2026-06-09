export type TabType = 'text-to-video' | 'blog-link' | 'trend-audio';

export type VideoGenerationState = 'idle' | 'loading' | 'ready';

export type LanguageType = 'pt' | 'en' | 'es';
export type ToneType = 'envolvente' | 'profissional' | 'humorado' | 'inspirador';
export type DurationType = '30s' | '60s' | '90s';

export interface DropdownOption<T> {
  value: T;
  label: string;
}

export interface CreationFormData {
  tab: TabType;
  prompt: string;
  blogLink: string;
  trendAudio: string;
  language: LanguageType;
  tone: ToneType;
  duration: DurationType;
}

export interface VideoItem {
  id: string;
  title: string;
  status: 'completed' | 'processing' | 'failed';
  createdAt: string;
  duration: string;
  thumbnailUrl?: string;
  videoUrl?: string;
}

export interface UserCredits {
  available: number;
  total: number;
}

export interface UserProfile {
  name: string;
  email: string;
  avatarUrl: string;
  credits: UserCredits;
}
