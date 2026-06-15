export interface SubtitleItem {
  text: string;
  start: number; // em segundos
  end: number;   // em segundos
  start_time?: number;
  duration?: number;
}

export interface RemotionVideoProps {
  audio_url: string;
  video_urls: string[];
  subtitles: SubtitleItem[];
}
