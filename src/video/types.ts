export interface SubtitleItem {
  id?: string;
  text: string;
  start: number; // em segundos
  end: number;   // em segundos
  start_time?: number;
  duration?: number;
  word?: string;
  transition?: 'none' | 'fade' | 'wipe';
}

export interface RemotionVideoProps {
  audio_url: string;
  video_urls: string[];
  subtitles: SubtitleItem[];
}
