export interface SubtitleItem {
  id?: string;
  text: string;
  start: number; // em segundos
  end: number;   // em segundos
  start_time?: number;
  duration?: number;
  word?: string;
  transition?: 'none' | 'fade' | 'wipe';
  transitionDuration?: number; // em segundos
}

export interface StyleConfig {
  template: 'clean_business' | 'viral_hyper' | 'cyber_aesthetic';
  fontFamily?: string;
  fontSize?: string;
  textColor?: string;
  highlightColor?: string;
  textGlow?: boolean;
  emojiEnabled?: boolean;
  autoZoom?: boolean;
  progressBar?: boolean;
}

export interface RemotionVideoProps {
  audio_url: string;
  video_urls: string[];
  subtitles: SubtitleItem[];
  style_config?: StyleConfig;
}

