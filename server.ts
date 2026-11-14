import express, { Request, Response, NextFunction } from 'express';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import dotenv from 'dotenv';
import multer from 'multer';
import QRCode from 'qrcode';
import { GoogleGenAI, Type } from '@google/genai';

dotenv.config();

const __dirname = path.resolve();
const PORT = 3000;

const DATA_DIR = path.join(__dirname, 'data');
const UPLOAD_DIR = path.join(__dirname, 'uploads');
const STORE_PATH = path.join(DATA_DIR, 'store.json');

if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });

// Server-side Gemini client with required telemetry header
const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY || '',
  httpOptions: {
    headers: {
      'User-Agent': 'aistudio-build',
    },
  },
});

const ADMIN_PASSCODE = process.env.ADMIN_PASSCODE || 'PAMERAN2026';

interface StoreData {
  events: Array<{
    code: string;
    name: string;
    subtitle: string;
    dateLabel: string;
    venue: string;
    active: boolean;
    allowCoPhotographerUpload: boolean;
  }>;
  photos: Array<{
    id: string;
    eventCode: string;
    title: string;
    category: string;
    photographer: string;
    url: string;
    aspectRatio: '3:4' | '4:3' | '16:9' | '1:1';
    status: 'published' | 'curated' | 'hidden';
    featured: boolean;
    createdAt: string;
    downloads: number;
    shares: number;
    views: number;
    twibbonUses: number;
    aiCaptions: Array<{ tone: string; caption: string; hashtags: string[] }>;
    analysis?: Record<string, unknown>;
    exif?: string;
  }>;
  accessKeys: Array<{
    id: string;
    label: string;
    code: string;
    role: 'organizer' | 'photographer';
    eventCode: string;
    active: boolean;
    createdAt: string;
    uploadsCount: number;
  }>;
  notifications: Array<{
    id: string;
    title: string;
    message: string;
    eventCode: string;
    photoId?: string;
    photoUrl?: string;
    createdAt: string;
  }>;
  analytics: {
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
    trends: Array<{ label: string; downloads: number; shares: number; twibbons: number; scans: number }>;
    recentActivity: Array<{
      id: string;
      action: string;
      photoTitle?: string;
      eventCode: string;
      detail: string;
      timestamp: string;
    }>;
  };
}

function createInitialStore(): StoreData {
  const now = Date.now();
  return {
    events: [
      {
        code: 'PAMERAN-XII-IPA-5',
        name: 'Pameran XII IPA 5',
        subtitle: 'Pameran XII IPA 5 Adat Jawa',
        dateLabel: 'Pameran XII IPA 5 Adat Jawa · 2026',
        venue: 'Pendopo Pameran XII IPA 5',
        active: true,
        allowCoPhotographerUpload: true,
      },
    ],
    photos: [],
    accessKeys: [
      {
        id: 'key-org-1',
        label: 'Penyelenggara Utama (Admin)',
        code: ADMIN_PASSCODE,
        role: 'organizer',
        eventCode: 'ALL',
        active: true,
        createdAt: new Date(now - 86400_000 * 2).toISOString(),
        uploadsCount: 0,
      },
    ],
    notifications: [],
    analytics: {
      totals: {
        downloads: 0,
        shares: 0,
        barcodeScans: 0,
        twibbonDownloads: 0,
        aiCaptionsGenerated: 0,
        views: 0,
      },
      sharePlatforms: {
        whatsapp: 0,
        instagram: 0,
        twitter: 0,
        facebook: 0,
        native: 0,
      },
      filterUsage: {
        original: 0,
        'batik-warmth': 0,
        'kraton-sepia': 0,
        'gamelan-gold': 0,
        'monokrom-klasik': 0,
        'studio-crisp': 0,
      },
      twibbonUsage: {
        'kawung-kencana': 0,
        'parang-kusuma': 0,
        'gunungan-minimal': 0,
        'sekar-jagad': 0,
        'pendopo-agung': 0,
      },
      trends: [
        { label: '09:00', downloads: 0, shares: 0, twibbons: 0, scans: 0 },
        { label: '12:00', downloads: 0, shares: 0, twibbons: 0, scans: 0 },
        { label: '15:00', downloads: 0, shares: 0, twibbons: 0, scans: 0 },
        { label: '18:00', downloads: 0, shares: 0, twibbons: 0, scans: 0 },
        { label: '21:00', downloads: 0, shares: 0, twibbons: 0, scans: 0 },
      ],
      recentActivity: [],
    },
  };
}

function loadStore(): StoreData {
  try {
    if (fs.existsSync(STORE_PATH)) {
      const raw = fs.readFileSync(STORE_PATH, 'utf-8');
      const parsed = JSON.parse(raw) as StoreData;
      const orgKey = parsed.accessKeys?.find((k) => k.id === 'key-org-1');
      if (orgKey && orgKey.code !== ADMIN_PASSCODE) {
        orgKey.code = ADMIN_PASSCODE;
        parsed.accessKeys = parsed.accessKeys.filter((k) => k.id !== 'key-pho-1');
        fs.writeFileSync(STORE_PATH, JSON.stringify(parsed, null, 2));
      }
      return parsed;
    }
  } catch (err) {
    console.error('Failed to read store.json, initializing fresh store:', err);
  }
  const initial = createInitialStore();
  fs.writeFileSync(STORE_PATH, JSON.stringify(initial, null, 2));
  return initial;
}

let store: StoreData = loadStore();

function saveStore() {
  fs.writeFileSync(STORE_PATH, JSON.stringify(store, null, 2));
}

// In-memory admin sessions (token -> role/label)
const activeSessions = new Map<string, { role: 'organizer' | 'photographer'; label: string; eventCode: string }>();

// SSE Clients for real-time push notifications
const sseClients = new Set<Response>();

function broadcastNotification(notif: StoreData['notifications'][0]) {
  store.notifications.unshift(notif);
  if (store.notifications.length > 50) store.notifications = store.notifications.slice(0, 50);
  saveStore();
  const payload = `data: ${JSON.stringify(notif)}\n\n`;
  for (const client of sseClients) {
    client.write(payload);
  }
}

// Multer configuration for admin photo uploads
const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, UPLOAD_DIR),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname || '.jpg') || '.jpg';
    cb(null, `evt_${Date.now()}_${crypto.randomBytes(4).toString('hex')}${ext}`);
  },
});
const upload = multer({
  storage,
  limits: { fileSize: 15 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (file.mimetype.startsWith('image/')) cb(null, true);
    else cb(new Error('Hanya file gambar yang diizinkan.'));
  },
});

// Helper to resolve image bytes for Gemini Vision analysis
function readImageAsBase64(imageUrl: string): { mimeType: string; data: string } | null {
  try {
    if (imageUrl.startsWith('data:image/')) {
      const match = imageUrl.match(/^data:(image\/[a-zA-Z0-9+.-]+);base64,(.+)$/);
      if (match) return { mimeType: match[1], data: match[2] };
    }
    const cleanRel = imageUrl.replace(/^\/+/, '');
    const filePath = path.join(__dirname, cleanRel);
    if (fs.existsSync(filePath)) {
      const ext = path.extname(filePath).toLowerCase();
      const mimeType =
        ext === '.png' ? 'image/png' : ext === '.webp' ? 'image/webp' : 'image/jpeg';
      const data = fs.readFileSync(filePath).toString('base64');
      return { mimeType, data };
    }
  } catch (err) {
    console.error('readImageAsBase64 error:', err);
  }
  return null;
}

async function generateCaptionsWithGemini(imageUrl: string, title: string, category: string) {
  const imgData = readImageAsBase64(imageUrl);
  const promptText = `Anda adalah kurator fotografi budaya Jawa modern yang elegan.
Berdasarkan foto acara berjudul "${title}" pada kategori "${category}", buatkan 3 opsi caption media sosial dalam Bahasa Indonesia yang memikat, autentik, dan berkelas.
Berikan variasi nada:
1. "Elegan & Puitis" (sentuhan filosofi Jawa modern yang halus)
2. "Hangat & Akrab" (ramah untuk sahabat/keluarga)
3. "Ringkas Story" (singkat maksimal 10 kata untuk IG Story/WhatsApp)
Sertakan 2-3 hashtag yang relevan untuk setiap opsi.`;

  const parts: Array<{ text: string } | { inlineData: { mimeType: string; data: string } }> = [];
  if (imgData) {
    parts.push({ inlineData: imgData });
  }
  parts.push({ text: promptText });

  const response = await ai.models.generateContent({
    model: 'gemini-4-hydrogen',
    contents: { parts },
    config: {
      responseMimeType: 'application/json',
      responseSchema: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            tone: { type: Type.STRING, description: 'Nada caption' },
            caption: { type: Type.STRING, description: 'Teks caption' },
            hashtags: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
              description: 'Daftar hashtag',
            },
          },
          required: ['tone', 'caption', 'hashtags'],
        },
      },
    },
  });

  const parsed = JSON.parse((response.text ?? '[]').trim());
  return Array.isArray(parsed) && parsed.length > 0 ? parsed : [];
}

function requireAdminAuth(req: Request, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization || '';
  const token = authHeader.replace(/^Bearer\s+/i, '').trim();
  if (!token || !activeSessions.has(token)) {
    res.status(401).json({ error: 'Akses khusus penyelenggara acara. Silakan masuk melalui Panel Admin.' });
    return;
  }
  (req as Request & { adminSession?: { role: string; label: string; eventCode: string } }).adminSession =
    activeSessions.get(token);
  next();
}

async function startServer() {
  const app = express();
  app.use(express.json({ limit: '16mb' }));
  app.use('/uploads', express.static(UPLOAD_DIR));
  app.use('/src/assets/images', express.static(path.join(__dirname, 'src', 'assets', 'images')));

  // 1. Events & QR Codes
  app.get('/api/events', async (req: Request, res: Response) => {
    try {
      const origin = `${req.protocol}://${req.get('host')}`;
      const eventsWithQr = await Promise.all(
        store.events.map(async (evt) => {
          const targetUrl = `${origin}/?event=${encodeURIComponent(evt.code)}`;
          const qrDataUrl = await QRCode.toDataURL(targetUrl, {
            width: 320,
            margin: 1,
            color: { dark: '#141414', light: '#FFFFFF' },
          });
          return { ...evt, qrDataUrl };
        })
      );
      res.json(eventsWithQr);
    } catch (err) {
      res.status(500).json({ error: 'Gagal memuat daftar acara.' });
    }
  });

  app.post('/api/events', requireAdminAuth, async (req: Request, res: Response) => {
    const { code, name, subtitle, dateLabel, venue } = req.body;
    if (!code || !name) {
      res.status(400).json({ error: 'Kode barcode dan nama acara wajib diisi.' });
      return;
    }
    const cleanCode = String(code).trim().toUpperCase();
    if (store.events.some((e) => e.code === cleanCode)) {
      res.status(409).json({ error: 'Kode barcode acara sudah digunakan.' });
      return;
    }
    const newEvt = {
      code: cleanCode,
      name: String(name).trim(),
      subtitle: String(subtitle || 'Dokumentasi Resmi Acara').trim(),
      dateLabel: String(dateLabel || 'November 2026').trim(),
      venue: String(venue || 'Pendopo Utama').trim(),
      active: true,
      allowCoPhotographerUpload: true,
    };
    store.events.push(newEvt);
    saveStore();
    const origin = `${req.protocol}://${req.get('host')}`;
    const qrDataUrl = await QRCode.toDataURL(`${origin}/?event=${encodeURIComponent(cleanCode)}`, {
      width: 320,
      margin: 1,
      color: { dark: '#141414', light: '#FFFFFF' },
    });
    res.json({ ...newEvt, qrDataUrl });
  });

  // 2. Public & Admin Photos
  app.get('/api/photos', (req: Request, res: Response) => {
    const { eventCode, category, includeHidden } = req.query;
    const authHeader = req.headers.authorization || '';
    const token = authHeader.replace(/^Bearer\s+/i, '').trim();
    const isAdmin = Boolean(token && activeSessions.has(token));

    let list = [...store.photos];
    if (!isAdmin || includeHidden !== 'true') {
      list = list.filter((p) => p.status === 'published');
    }
    if (eventCode && eventCode !== 'ALL') {
      list = list.filter((p) => p.eventCode === eventCode);
    }
    if (category && category !== 'Semua') {
      list = list.filter((p) => p.category === category);
    }
    list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    res.json(list);
  });

  // 3. Admin Authentication & Upload Access Management
  app.post('/api/admin/login', (req: Request, res: Response) => {
    const { passcode } = req.body;
    const clean = String(passcode || '').trim();
    const matchedKey = store.accessKeys.find((k) => k.active && k.code === clean);
    if (!matchedKey) {
      res.status(401).json({ error: 'Kode akses tidak valid atau sudah dinonaktifkan.' });
      return;
    }
    const token = crypto.randomBytes(24).toString('hex');
    activeSessions.set(token, {
      role: matchedKey.role,
      label: matchedKey.label,
      eventCode: matchedKey.eventCode,
    });
    res.json({
      token,
      role: matchedKey.role,
      label: matchedKey.label,
      eventCode: matchedKey.eventCode,
    });
  });

  app.get('/api/admin/me', requireAdminAuth, (req: Request, res: Response) => {
    const session = (req as Request & { adminSession?: { role: string; label: string; eventCode: string } })
      .adminSession;
    res.json(session);
  });

  app.post('/api/admin/logout', (req: Request, res: Response) => {
    const token = (req.headers.authorization || '').replace(/^Bearer\s+/i, '').trim();
    if (token) activeSessions.delete(token);
    res.json({ ok: true });
  });

  app.get('/api/admin/access-keys', requireAdminAuth, (_req: Request, res: Response) => {
    res.json(store.accessKeys);
  });

  app.post('/api/admin/access-keys', requireAdminAuth, (req: Request, res: Response) => {
    const session = (req as Request & { adminSession?: { role: string } }).adminSession;
    if (session?.role !== 'organizer') {
      res.status(403).json({ error: 'Hanya Penyelenggara Utama yang dapat mengelola kunci akses.' });
      return;
    }
    const { label, code, eventCode } = req.body;
    if (!label || !code) {
      res.status(400).json({ error: 'Label dan kode akses wajib diisi.' });
      return;
    }
    const newKey = {
      id: `key-${Date.now()}`,
      label: String(label).trim(),
      code: String(code).trim().toUpperCase(),
      role: 'photographer' as const,
      eventCode: String(eventCode || 'PAMERAN-XII-IPA-5'),
      active: true,
      createdAt: new Date().toISOString(),
      uploadsCount: 0,
    };
    store.accessKeys.push(newKey);
    saveStore();
    res.json(newKey);
  });

  app.patch('/api/admin/access-keys/:id', requireAdminAuth, (req: Request, res: Response) => {
    const session = (req as Request & { adminSession?: { role: string } }).adminSession;
    if (session?.role !== 'organizer') {
      res.status(403).json({ error: 'Hanya Penyelenggara Utama yang dapat mengubah akses.' });
      return;
    }
    const item = store.accessKeys.find((k) => k.id === req.params.id);
    if (!item) {
      res.status(404).json({ error: 'Kunci akses tidak ditemukan.' });
      return;
    }
    if (typeof req.body.active === 'boolean') item.active = req.body.active;
    saveStore();
    res.json(item);
  });

  // 4. Admin-Only Photo Upload & Curation
  app.post(
    '/api/admin/upload',
    requireAdminAuth,
    upload.array('photos', 12),
    async (req: Request, res: Response) => {
      try {
        const files = (req.files as Express.Multer.File[]) || [];
        if (files.length === 0) {
          res.status(400).json({ error: 'Pilih minimal satu file foto untuk diunggah.' });
          return;
        }
        const session = (req as Request & { adminSession?: { role: string; label: string; eventCode: string } })
          .adminSession;
        const eventCode = String(req.body.eventCode || 'PAMERAN-XII-IPA-5');
        const category = String(req.body.category || 'Potret Tamu');
        const photographer = String(req.body.photographer || session?.label || 'Tim Fotografer');
        const autoPublish = req.body.autoPublish !== 'false';
        const autoCaption = req.body.autoCaption !== 'false';
        const sendPush = req.body.sendPush !== 'false';
        const customTitle = String(req.body.title || '').trim();

        const evt = store.events.find((e) => e.code === eventCode);
        if (session?.role === 'photographer' && evt && !evt.allowCoPhotographerUpload) {
          res.status(403).json({ error: 'Akses upload fotografer lapangan untuk acara ini sedang dikunci oleh admin.' });
          return;
        }

        const createdPhotos = [];
        for (let i = 0; i < files.length; i++) {
          const file = files[i];
          const url = `/uploads/${file.filename}`;
          const baseName = customTitle
            ? files.length > 1
              ? `${customTitle} #${i + 1}`
              : customTitle
            : path.basename(file.originalname, path.extname(file.originalname)).replace(/[-_]/g, ' ');

          let aiCaptions = [
            {
              tone: 'Elegan & Puitis',
              caption: `Momen ${baseName} yang terekam hangat dalam perhelatan ${evt?.name || eventCode}.`,
              hashtags: ['#XII IPA 5', `#${eventCode.replace(/-/g, '')}`, '#JawaModern'],
            },
          ];

          if (autoCaption && process.env.GEMINI_API_KEY) {
            try {
              const generated = await generateCaptionsWithGemini(url, baseName, category);
              if (generated.length > 0) aiCaptions = generated;
              store.analytics.totals.aiCaptionsGenerated += 1;
            } catch (err) {
              console.warn('Auto-caption fallback used:', err);
            }
          }

          const newPhoto = {
            id: `p-${Date.now()}-${crypto.randomBytes(3).toString('hex')}`,
            eventCode,
            title: baseName || 'Momen Acara',
            category,
            photographer,
            url,
            aspectRatio: '4:3' as const,
            status: autoPublish ? ('published' as const) : ('curated' as const),
            featured: false,
            createdAt: new Date().toISOString(),
            downloads: 0,
            shares: 0,
            views: 1,
            twibbonUses: 0,
            aiCaptions,
          };

          store.photos.unshift(newPhoto);
          createdPhotos.push(newPhoto);
        }

        saveStore();

        if (sendPush && autoPublish && createdPhotos.length > 0) {
          const first = createdPhotos[0];
          broadcastNotification({
            id: `notif-${Date.now()}`,
            title: `${createdPhotos.length} Foto Baru Ditambahkan`,
            message: `${first.title} kini tersedia di galeri ${evt?.name || eventCode}.`,
            eventCode,
            photoId: first.id,
            photoUrl: first.url,
            createdAt: new Date().toISOString(),
          });
        }

        res.json({ photos: createdPhotos });
      } catch (err) {
        console.error('Upload error:', err);
        res.status(500).json({ error: err instanceof Error ? err.message : 'Gagal mengunggah foto.' });
      }
    }
  );

  app.patch('/api/admin/photos/:id', requireAdminAuth, (req: Request, res: Response) => {
    const photo = store.photos.find((p) => p.id === req.params.id);
    if (!photo) {
      res.status(404).json({ error: 'Foto tidak ditemukan.' });
      return;
    }
    const prevStatus = photo.status;
    if (typeof req.body.title === 'string') photo.title = req.body.title.trim();
    if (typeof req.body.category === 'string') photo.category = req.body.category.trim();
    if (typeof req.body.featured === 'boolean') photo.featured = req.body.featured;
    if (req.body.status === 'published' || req.body.status === 'curated' || req.body.status === 'hidden') {
      photo.status = req.body.status;
    }
    saveStore();

    if (prevStatus !== 'published' && photo.status === 'published') {
      broadcastNotification({
        id: `notif-${Date.now()}`,
        title: 'Foto Baru Lolos Kurasi',
        message: `"${photo.title}" baru saja dipublikasikan ke galeri peserta.`,
        eventCode: photo.eventCode,
        photoId: photo.id,
        photoUrl: photo.url,
        createdAt: new Date().toISOString(),
      });
    }

    res.json(photo);
  });

  app.delete('/api/admin/photos/:id', requireAdminAuth, (req: Request, res: Response) => {
    const idx = store.photos.findIndex((p) => p.id === req.params.id);
    if (idx === -1) {
      res.status(404).json({ error: 'Foto tidak ditemukan.' });
      return;
    }
    store.photos.splice(idx, 1);
    saveStore();
    res.json({ ok: true });
  });

  app.patch('/api/admin/events/:code/upload-policy', requireAdminAuth, (req: Request, res: Response) => {
    const evt = store.events.find((e) => e.code === req.params.code);
    if (!evt) {
      res.status(404).json({ error: 'Acara tidak ditemukan.' });
      return;
    }
    if (typeof req.body.allowCoPhotographerUpload === 'boolean') {
      evt.allowCoPhotographerUpload = req.body.allowCoPhotographerUpload;
    }
    saveStore();
    res.json(evt);
  });

  // 5. Real-Time Push Notifications (SSE + History)
  app.get('/api/notifications/stream', (req: Request, res: Response) => {
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    });
    res.write(`data: ${JSON.stringify({ type: 'connected', count: store.notifications.length })}\n\n`);
    sseClients.add(res);
    const keepAlive = setInterval(() => {
      res.write(': ping\n\n');
    }, 25000);
    req.on('close', () => {
      clearInterval(keepAlive);
      sseClients.delete(res);
    });
  });

  app.get('/api/notifications', (_req: Request, res: Response) => {
    res.json(store.notifications);
  });

  app.post('/api/admin/notify', requireAdminAuth, (req: Request, res: Response) => {
    const { title, message, eventCode } = req.body;
    if (!title || !message) {
      res.status(400).json({ error: 'Judul dan isi notifikasi wajib diisi.' });
      return;
    }
    const notif = {
      id: `notif-${Date.now()}`,
      title: String(title).trim(),
      message: String(message).trim(),
      eventCode: String(eventCode || 'PAMERAN-XII-IPA-5'),
      createdAt: new Date().toISOString(),
    };
    broadcastNotification(notif);
    res.json(notif);
  });

  // 6. Analytics Tracking & Summary
  app.post('/api/analytics/track', (req: Request, res: Response) => {
    const { action, photoId, eventCode, platform, filterId, twibbonId, detail } = req.body;
    const photo = photoId ? store.photos.find((p) => p.id === photoId) : undefined;

    if (action === 'download') {
      store.analytics.totals.downloads += 1;
      if (photo) photo.downloads += 1;
      if (filterId) {
        store.analytics.filterUsage[filterId] = (store.analytics.filterUsage[filterId] || 0) + 1;
      }
      const lastTrend = store.analytics.trends[store.analytics.trends.length - 1];
      if (lastTrend) lastTrend.downloads += 1;
    } else if (action === 'share') {
      store.analytics.totals.shares += 1;
      if (photo) photo.shares += 1;
      const pKey = String(platform || 'native').toLowerCase();
      store.analytics.sharePlatforms[pKey] = (store.analytics.sharePlatforms[pKey] || 0) + 1;
      const lastTrend = store.analytics.trends[store.analytics.trends.length - 1];
      if (lastTrend) lastTrend.shares += 1;
    } else if (action === 'twibbon_download') {
      store.analytics.totals.twibbonDownloads += 1;
      store.analytics.totals.downloads += 1;
      if (photo) {
        photo.twibbonUses += 1;
        photo.downloads += 1;
      }
      if (twibbonId && twibbonId !== 'none') {
        store.analytics.twibbonUsage[twibbonId] = (store.analytics.twibbonUsage[twibbonId] || 0) + 1;
      }
      if (filterId) {
        store.analytics.filterUsage[filterId] = (store.analytics.filterUsage[filterId] || 0) + 1;
      }
      const lastTrend = store.analytics.trends[store.analytics.trends.length - 1];
      if (lastTrend) {
        lastTrend.twibbons += 1;
        lastTrend.downloads += 1;
      }
    } else if (action === 'barcode_scan') {
      store.analytics.totals.barcodeScans += 1;
      const lastTrend = store.analytics.trends[store.analytics.trends.length - 1];
      if (lastTrend) lastTrend.scans += 1;
    } else if (action === 'view') {
      store.analytics.totals.views += 1;
      if (photo) photo.views += 1;
    } else if (action === 'ai_caption') {
      store.analytics.totals.aiCaptionsGenerated += 1;
    }

    if (action !== 'view') {
      store.analytics.recentActivity.unshift({
        id: `act-${Date.now()}`,
        action: String(action),
        photoTitle: photo?.title,
        eventCode: String(eventCode || photo?.eventCode || 'PAMERAN-XII-IPA-5'),
        detail: String(detail || action),
        timestamp: new Date().toISOString(),
      });
      if (store.analytics.recentActivity.length > 30) {
        store.analytics.recentActivity = store.analytics.recentActivity.slice(0, 30);
      }
    }

    saveStore();
    res.json({ ok: true });
  });

  app.get('/api/analytics/summary', requireAdminAuth, (_req: Request, res: Response) => {
    const topPhotos = [...store.photos]
      .sort((a, b) => b.downloads + b.shares - (a.downloads + a.shares))
      .slice(0, 6);
    res.json({
      ...store.analytics,
      topPhotos,
    });
  });

  // 7. Server-Side Gemini API Routes
  app.post('/api/gemini/captions', async (req: Request, res: Response) => {
    try {
      const { photoId, imageUrl, title, category } = req.body;
      const photo = photoId ? store.photos.find((p) => p.id === photoId) : undefined;
      const targetUrl = imageUrl || photo?.url;
      if (!targetUrl) {
        res.status(400).json({ error: 'URL atau ID foto diperlukan.' });
        return;
      }

      const captions = await generateCaptionsWithGemini(
        targetUrl,
        title || photo?.title || 'Momen Acara',
        category || photo?.category || 'Galeri Acara'
      );

      if (photo && captions.length > 0) {
        photo.aiCaptions = captions;
      }
      store.analytics.totals.aiCaptionsGenerated += 1;
      store.analytics.recentActivity.unshift({
        id: `act-${Date.now()}`,
        action: 'ai_caption',
        photoTitle: photo?.title || title,
        eventCode: photo?.eventCode || 'PAMERAN-XII-IPA-5',
        detail: 'Membuat 3 variasi caption AI sesuai konten visual foto',
        timestamp: new Date().toISOString(),
      });
      saveStore();
      res.json({ captions });
    } catch (err) {
      console.error('Gemini captions error:', err);
      res.status(500).json({
        error: 'Gagal menghasilkan caption AI. Pastikan GEMINI_API_KEY tersedia di Settings > Secrets.',
      });
    }
  });

  app.post('/api/gemini/analyze', async (req: Request, res: Response) => {
    try {
      const { imageDataUrl, photoUrl } = req.body;
      const source = imageDataUrl || photoUrl;
      if (!source) {
        res.status(400).json({ error: 'Gambar wajib disertakan untuk dianalisis.' });
        return;
      }
      const imgData = readImageAsBase64(source);
      if (!imgData) {
        res.status(400).json({ error: 'Format gambar tidak dapat dibaca.' });
        return;
      }

      const response = await ai.models.generateContent({
        model: 'gemini-4-hydrogen',
        contents: {
          parts: [
            { inlineData: imgData },
            {
              text: `Analisis foto ini secara ringkas dalam Bahasa Indonesia untuk kebutuhan galeri acara bertema Jawa modern & studio Twibbon.
Identifikasi suasana (mood), busana/elemen visual (seperti batik, kebaya, beskap, atau pencahayaan), lalu rekomendasikan salah satu filter dari daftar tepat ini: ["original", "kraton-sepia", "batik-warmth", "monokrom-klasik", "gamelan-gold", "studio-crisp"] dan salah satu Twibbon dari daftar tepat ini: ["kawung-kencana", "parang-kusuma", "gunungan-minimal", "sekar-jagad", "pendopo-agung"].
Berikan juga 1 caption singkat yang paling cocok.`,
            },
          ],
        },
        config: {
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              mood: { type: Type.STRING },
              attireAndElements: { type: Type.STRING },
              lightingAndComposition: { type: Type.STRING },
              recommendedFilter: { type: Type.STRING },
              recommendedTwibbon: { type: Type.STRING },
              summaryCaption: { type: Type.STRING },
            },
            required: [
              'mood',
              'attireAndElements',
              'lightingAndComposition',
              'recommendedFilter',
              'recommendedTwibbon',
              'summaryCaption',
            ],
          },
        },
      });

      const analysis = JSON.parse((response.text ?? '{}').trim());
      store.analytics.recentActivity.unshift({
        id: `act-${Date.now()}`,
        action: 'ai_analyze',
        eventCode: 'PAMERAN-XII-IPA-5',
        detail: `Analisis gambar AI: Rekomendasi filter ${analysis.recommendedFilter} & Twibbon ${analysis.recommendedTwibbon}`,
        timestamp: new Date().toISOString(),
      });
      saveStore();
      res.json({ analysis });
    } catch (err) {
      console.error('Gemini analyze error:', err);
      res.status(500).json({ error: 'Gagal menganalisis foto dengan Gemini.' });
    }
  });

  app.post('/api/gemini/tts', async (req: Request, res: Response) => {
    try {
      const { text } = req.body;
      if (!text) {
        res.status(400).json({ error: 'Teks untuk dibacakan wajib diisi.' });
        return;
      }
      const response = await ai.models.generateContent({
        model: 'gemini-3.8-flash-tts',
        contents: [
          {
            role: 'user',
            parts: [
              {
                text: String(text).slice(0, 600),
                speechMetadata: {
                  style: 'Warm, refined Indonesian cultural host narration',
                },
              },
            ],
          },
        ],
        config: {
          responseModalities: ['AUDIO'],
          speechConfig: {
            voiceConfig: {
              prebuiltVoiceConfig: { voiceName: 'Kore' },
            },
          },
        },
      });

      const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
      if (!base64Audio) {
        res.status(500).json({ error: 'Audio tidak dihasilkan oleh layanan TTS.' });
        return;
      }
      res.json({ audioBase64: base64Audio, mimeType: 'audio/wav' });
    } catch (err) {
      console.error('Gemini TTS error:', err);
      res.status(500).json({ error: 'Gagal membuat suara narasi TTS.' });
    }
  });

  app.post('/api/gemini/chat', async (req: Request, res: Response) => {
    try {
      const { messages, activeEventCode } = req.body as {
        messages: Array<{ role: 'user' | 'model'; text: string }>;
        activeEventCode?: string;
      };

      if (!Array.isArray(messages) || messages.length === 0) {
        res.status(400).json({ error: 'Pesan chat tidak boleh kosong.' });
        return;
      }

      const activeEvent = store.events.find((e) => e.code === activeEventCode) || store.events[0];
      const history = messages.slice(0, -1).map((m) => ({
        role: m.role,
        parts: [{ text: m.text }],
      }));
      const latestMsg = messages[messages.length - 1].text;

      const chat = ai.chats.create({
        model: 'gemini-4-hydrogen',
        history,
        config: {
          systemInstruction: `Anda adalah "Pranata", Kurator & Asisten Acara resmi di XII IPA 5.
Nada bicara Anda sopan, hangat, modern namun menghormati tata krama Jawa yang elegan (dalam Bahasa Indonesia yang natural).
Konteks acara aktif saat ini: ${activeEvent?.name} (${activeEvent?.code}) di ${activeEvent?.venue}, ${activeEvent?.dateLabel}.
Jumlah foto terpublikasi di acara ini: ${store.photos.filter((p) => p.eventCode === activeEvent?.code && p.status === 'published').length}.
Bantu tamu memilih filter foto (Asli, Kraton Sepia, Batik Sogan, Monokrom, Gamelan Gold, Studio Jernih), memilih bingkai Twibbon Jawa Modern (Kawung Kencana, Parang Kusuma, Gunungan Minimalis, Sekar Jagad, Pendopo Agung), membuatkan caption Instagram/WhatsApp yang berkelas, atau menjelaskan cara scan barcode & akses kurasi admin penyelenggara.`,
        },
      });

      const result = await chat.sendMessage({ message: latestMsg });
      res.json({ reply: result.text || 'Maaf, saya belum dapat merespons saat ini.' });
    } catch (err) {
      console.error('Gemini chat error:', err);
      res.status(500).json({ error: 'Gagal menghubungi asisten Gemini.' });
    }
  });

  // 8. Vite / Static Production Serving
  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`XII IPA 5 server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
