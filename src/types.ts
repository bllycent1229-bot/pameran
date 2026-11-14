export type ViewTab = 'gallery' | 'twibbon' | 'admin';

export type PhotoStatus = 'published' | 'curated' | 'hidden';

export type FilterId =
  | 'original'
  | 'kraton-sepia'
  | 'batik-warmth'
  | 'monokrom-klasik'
  | 'gamelan-gold'
  | 'studio-crisp';

export type TwibbonId =
  | 'none'
  | 'kawung-kencana'
  | 'parang-kusuma'
  | 'gunungan-minimal'
  | 'sekar-jagad'
  | 'pendopo-agung';

export interface AiCaptionOption {
  tone: string;
  caption: string;
  hashtags: string[];
}

export interface PhotoAnalysis {
  mood: string;
  attireAndElements: string;
  lightingAndComposition: string;
  recommendedFilter: FilterId;
  recommendedTwibbon: TwibbonId;
  summaryCaption: string;
}

export interface PhotoItem {
  id: string;
  eventCode: string;
  title: string;
  category: string;
  photographer: string;
  url: string;
  aspectRatio: '3:4' | '4:3' | '16:9' | '1:1';
  status: PhotoStatus;
  featured: boolean;
  createdAt: string;
  downloads: number;
  shares: number;
  views: number;
  twibbonUses: number;
  aiCaptions: AiCaptionOption[];
  analysis?: PhotoAnalysis;
  exif?: string;
}

export interface EventAlbum {
  code: string;
  name: string;
  subtitle: string;
  dateLabel: string;
  venue: string;
  qrDataUrl?: string;
  active: boolean;
  allowCoPhotographerUpload: boolean;
}

export interface AccessKey {
  id: string;
  label: string;
  code: string;
  role: 'organizer' | 'photographer';
  eventCode: string;
  active: boolean;
  createdAt: string;
  uploadsCount: number;
}

export interface NotificationItem {
  id: string;
  title: string;
  message: string;
  eventCode: string;
  photoId?: string;
  photoUrl?: string;
  createdAt: string;
}

export interface AnalyticsTrendPoint {
  label: string;
  downloads: number;
  shares: number;
  twibbons: number;
  scans: number;
}

export interface AnalyticsActivityRow {
  id: string;
  action: 'download' | 'share' | 'twibbon_download' | 'barcode_scan' | 'ai_caption' | 'ai_analyze' | 'view';
  photoTitle?: string;
  eventCode: string;
  detail: string;
  timestamp: string;
}

export interface AnalyticsSummary {
  totals: {
    downloads: number;
    shares: number;
    barcodeScans: number;
    twibbonDownloads: number;
    aiCaptionsGenerated: number;
    views: number;
  };
  sharePlatforms: Record<string, number>;
  filterUsage: Record<string, number>;
  twibbonUsage: Record<string, number>;
  trends: AnalyticsTrendPoint[];
  topPhotos: PhotoItem[];
  recentActivity: AnalyticsActivityRow[];
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'model';
  text: string;
  timestamp: string;
}
