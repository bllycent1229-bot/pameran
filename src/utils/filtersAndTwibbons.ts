import { FilterId, TwibbonId } from '../types';

export interface FilterPreset {
  id: FilterId;
  name: string;
  description: string;
  cssFilter: string;
  swatchColor: string;
}

export const PHOTO_FILTERS: FilterPreset[] = [
  {
    id: 'original',
    name: 'Asli',
    description: 'Warna natural kamera tanpa ubahan',
    cssFilter: 'none',
    swatchColor: '#E5E5E3',
  },
  {
    id: 'kraton-sepia',
    name: 'Kraton Sepia',
    description: 'Nuansa hangat klasik arsip keraton',
    cssFilter: 'sepia(0.28) contrast(1.06) brightness(0.98) saturate(0.92)',
    swatchColor: '#B89B72',
  },
  {
    id: 'batik-warmth',
    name: 'Batik Sogan',
    description: 'Tone cokelat keemasan & kontras lembut',
    cssFilter: 'sepia(0.18) saturate(1.18) contrast(1.08) brightness(1.01)',
    swatchColor: '#9D7336',
  },
  {
    id: 'monokrom-klasik',
    name: 'Monokrom',
    description: 'Hitam-putih editorial kontras tinggi',
    cssFilter: 'grayscale(1) contrast(1.16) brightness(1.02)',
    swatchColor: '#27272A',
  },
  {
    id: 'gamelan-gold',
    name: 'Gamelan Gold',
    description: 'Sorotan keemasan untuk malam resepsi',
    cssFilter: 'saturate(1.22) contrast(1.05) sepia(0.12) brightness(1.03)',
    swatchColor: '#D4A843',
  },
  {
    id: 'studio-crisp',
    name: 'Studio Jernih',
    description: 'Detail tajam dan kulit bersih modern',
    cssFilter: 'contrast(1.1) brightness(1.04) saturate(1.06)',
    swatchColor: '#94A3B8',
  },
];

export interface TwibbonTheme {
  id: TwibbonId;
  name: string;
  tagline: string;
  primaryColor: string;
  accentColor: string;
  bgPreview: string;
}

export const TWIBBON_THEMES: TwibbonTheme[] = [
  {
    id: 'kawung-kencana',
    name: 'Kawung Kencana',
    tagline: 'Obsidian & Emas Geometris Kawung',
    primaryColor: '#141414',
    accentColor: '#C99A3B',
    bgPreview: '#1B1B1D',
  },
  {
    id: 'parang-kusuma',
    name: 'Parang Kusuma',
    tagline: 'Gading Elegan & Garis Parang Perunggu',
    primaryColor: '#F5F2EB',
    accentColor: '#9B7334',
    bgPreview: '#ECE6DA',
  },
  {
    id: 'gunungan-minimal',
    name: 'Gunungan Minimalis',
    tagline: 'Zamrud Tua & Siluet Gunungan Modern',
    primaryColor: '#13261F',
    accentColor: '#D4AF5A',
    bgPreview: '#172E25',
  },
  {
    id: 'sekar-jagad',
    name: 'Sekar Jagad',
    tagline: 'Indigo Keraton & Ornamen Kuningan',
    primaryColor: '#141D33',
    accentColor: '#D4A84F',
    bgPreview: '#19243E',
  },
  {
    id: 'pendopo-agung',
    name: 'Pendopo Agung',
    tagline: 'Bingkai Galeri Putih & Tipografi Klasik',
    primaryColor: '#FFFFFF',
    accentColor: '#8F6A24',
    bgPreview: '#F8F8F6',
  },
];

export function getFilterCss(filterId: FilterId): string {
  return PHOTO_FILTERS.find((f) => f.id === filterId)?.cssFilter ?? 'none';
}

function drawKawungMotif(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  radius: number,
  color: string,
  alpha = 0.7
) {
  ctx.save();
  ctx.translate(cx, cy);
  ctx.strokeStyle = color;
  ctx.globalAlpha = alpha;
  ctx.lineWidth = Math.max(1.5, radius * 0.08);
  for (let i = 0; i < 4; i++) {
    ctx.save();
    ctx.rotate((Math.PI / 2) * i + Math.PI / 4);
    ctx.beginPath();
    ctx.ellipse(radius * 0.48, 0, radius * 0.44, radius * 0.24, 0, 0, Math.PI * 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(radius * 0.56, 0, radius * 0.06, 0, Math.PI * 2);
    ctx.fillStyle = color;
    ctx.fill();
    ctx.restore();
  }
  ctx.beginPath();
  ctx.arc(0, 0, radius * 0.14, 0, Math.PI * 2);
  ctx.fillStyle = color;
  ctx.fill();
  ctx.restore();
}

function drawGununganCrest(
  ctx: CanvasRenderingContext2D,
  cx: number,
  topY: number,
  size: number,
  color: string
) {
  ctx.save();
  ctx.translate(cx, topY);
  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  ctx.lineWidth = Math.max(2, size * 0.03);

  // Outer Gunungan silhouette
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.bezierCurveTo(size * 0.36, size * 0.35, size * 0.46, size * 0.68, size * 0.38, size);
  ctx.lineTo(-size * 0.38, size);
  ctx.bezierCurveTo(-size * 0.46, size * 0.68, -size * 0.36, size * 0.35, 0, 0);
  ctx.closePath();
  ctx.stroke();

  // Inner central spire
  ctx.beginPath();
  ctx.moveTo(0, size * 0.14);
  ctx.lineTo(0, size * 0.92);
  ctx.stroke();

  // Symmetrical subtle branches
  for (let i = 1; i <= 3; i++) {
    const y = size * (0.28 + i * 0.18);
    const span = size * (0.09 * i);
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.quadraticCurveTo(span * 0.6, y - size * 0.06, span, y - size * 0.02);
    ctx.moveTo(0, y);
    ctx.quadraticCurveTo(-span * 0.6, y - size * 0.06, -span, y - size * 0.02);
    ctx.stroke();
  }
  ctx.restore();
}

function drawParangBand(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  color: string
) {
  ctx.save();
  ctx.beginPath();
  ctx.rect(x, y, w, h);
  ctx.clip();
  ctx.strokeStyle = color;
  ctx.globalAlpha = 0.32;
  ctx.lineWidth = Math.max(1.5, Math.min(w, h) * 0.06);
  const step = Math.max(16, Math.min(w, h) * 0.55);
  for (let px = x - h; px < x + w + h; px += step) {
    ctx.beginPath();
    ctx.moveTo(px, y + h);
    ctx.bezierCurveTo(px + step * 0.3, y + h * 0.4, px + step * 0.7, y + h * 0.6, px + step, y);
    ctx.stroke();
  }
  ctx.restore();
}

export function drawTwibbonFrame(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  themeId: TwibbonId,
  eventTitle: string,
  eventDate: string
) {
  if (themeId === 'none') return;

  const pad = Math.round(w * 0.045);
  const footerH = Math.round(h * 0.155);

  if (themeId === 'kawung-kencana') {
    // Deep obsidian border frame + bottom plaque
    ctx.save();
    ctx.fillStyle = '#121214';
    // Top, left, right frame bars
    ctx.fillRect(0, 0, w, pad);
    ctx.fillRect(0, 0, pad, h);
    ctx.fillRect(w - pad, 0, pad, h);
    // Bottom plaque with subtle gradient
    const grad = ctx.createLinearGradient(0, h - footerH - pad, 0, h);
    grad.addColorStop(0, 'rgba(18,18,20,0)');
    grad.addColorStop(0.28, 'rgba(18,18,20,0.92)');
    grad.addColorStop(1, '#121214');
    ctx.fillStyle = grad;
    ctx.fillRect(0, h - footerH - pad, w, footerH + pad);

    // Gold hairline borders
    ctx.strokeStyle = '#C99A3B';
    ctx.lineWidth = Math.max(2, w * 0.003);
    ctx.strokeRect(pad, pad, w - pad * 2, h - pad * 2);
    ctx.lineWidth = Math.max(1, w * 0.0015);
    ctx.strokeRect(pad + w * 0.012, pad + w * 0.012, w - (pad + w * 0.012) * 2, h - (pad + w * 0.012) * 2);

    // 4 Corner Kawung medallions
    const r = w * 0.042;
    drawKawungMotif(ctx, pad + r * 0.65, pad + r * 0.65, r, '#C99A3B', 0.85);
    drawKawungMotif(ctx, w - pad - r * 0.65, pad + r * 0.65, r, '#C99A3B', 0.85);
    drawKawungMotif(ctx, pad + r * 0.65, h - pad - r * 0.65, r, '#C99A3B', 0.85);
    drawKawungMotif(ctx, w - pad - r * 0.65, h - pad - r * 0.65, r, '#C99A3B', 0.85);

    // Bottom centered typography
    ctx.fillStyle = '#F6E7C1';
    ctx.textAlign = 'center';
    ctx.font = `600 ${Math.round(w * 0.042)}px "Cormorant Garamond", Georgia, serif`;
    ctx.fillText(eventTitle, w / 2, h - footerH * 0.48);

    ctx.fillStyle = '#C99A3B';
    ctx.font = `500 ${Math.round(w * 0.019)}px "Plus Jakarta Sans", sans-serif`;
    ctx.fillText(eventDate.toUpperCase(), w / 2, h - footerH * 0.24);
    ctx.restore();
  } else if (themeId === 'parang-kusuma') {
    ctx.save();
    // Crisp ivory outer mat
    const mat = Math.round(w * 0.055);
    ctx.fillStyle = '#F5F2EB';
    ctx.fillRect(0, 0, w, mat);
    ctx.fillRect(0, 0, mat, h);
    ctx.fillRect(w - mat, 0, mat, h);
    ctx.fillRect(0, h - footerH, w, footerH);

    // Subtle Parang patterns in top & bottom bands
    drawParangBand(ctx, mat, 0, w - mat * 2, mat, '#9B7334');
    drawParangBand(ctx, mat, h - Math.round(footerH * 0.22), w - mat * 2, Math.round(footerH * 0.22), '#9B7334');

    // Bronze inner border
    ctx.strokeStyle = '#9B7334';
    ctx.lineWidth = Math.max(2, w * 0.0028);
    ctx.strokeRect(mat, mat, w - mat * 2, h - mat - footerH);

    // Typography in bottom ivory plate
    ctx.fillStyle = '#1F1B16';
    ctx.textAlign = 'center';
    ctx.font = `700 ${Math.round(w * 0.043)}px "Cormorant Garamond", Georgia, serif`;
    ctx.fillText(eventTitle, w / 2, h - footerH * 0.56);

    ctx.fillStyle = '#825F2A';
    ctx.font = `500 ${Math.round(w * 0.02)}px "Plus Jakarta Sans", sans-serif`;
    ctx.fillText(eventDate, w / 2, h - footerH * 0.32);
    ctx.restore();
  } else if (themeId === 'gunungan-minimal') {
    ctx.save();
    const borderW = Math.round(w * 0.04);
    ctx.fillStyle = '#13261F';
    ctx.fillRect(0, 0, w, borderW);
    ctx.fillRect(0, 0, borderW, h);
    ctx.fillRect(w - borderW, 0, borderW, h);

    const grad = ctx.createLinearGradient(0, h - footerH - borderW, 0, h);
    grad.addColorStop(0, 'rgba(19, 38, 31, 0)');
    grad.addColorStop(0.35, 'rgba(19, 38, 31, 0.94)');
    grad.addColorStop(1, '#13261F');
    ctx.fillStyle = grad;
    ctx.fillRect(0, h - footerH - borderW, w, footerH + borderW);

    // Gold frame line
    ctx.strokeStyle = '#D4AF5A';
    ctx.lineWidth = Math.max(2, w * 0.0025);
    ctx.strokeRect(borderW, borderW, w - borderW * 2, h - borderW * 2);

    // Top Gunungan Crest
    const crestSize = w * 0.08;
    ctx.fillStyle = '#13261F';
    ctx.beginPath();
    ctx.arc(w / 2, borderW + crestSize * 0.45, crestSize * 0.65, 0, Math.PI * 2);
    ctx.fill();
    drawGununganCrest(ctx, w / 2, borderW + crestSize * 0.02, crestSize * 0.86, '#D4AF5A');

    // Bottom text
    ctx.fillStyle = '#F7F3E8';
    ctx.textAlign = 'center';
    ctx.font = `600 ${Math.round(w * 0.041)}px "Cormorant Garamond", Georgia, serif`;
    ctx.fillText(eventTitle, w / 2, h - footerH * 0.48);

    ctx.fillStyle = '#D4AF5A';
    ctx.font = `500 ${Math.round(w * 0.019)}px "Plus Jakarta Sans", sans-serif`;
    ctx.fillText(eventDate, w / 2, h - footerH * 0.24);
    ctx.restore();
  } else if (themeId === 'sekar-jagad') {
    ctx.save();
    const frameW = Math.round(w * 0.042);
    ctx.fillStyle = '#141D33';
    ctx.fillRect(0, 0, w, frameW);
    ctx.fillRect(0, 0, frameW, h);
    ctx.fillRect(w - frameW, 0, frameW, h);
    ctx.fillRect(0, h - footerH, w, footerH);

    // Brass geometric lattice corners
    ctx.strokeStyle = '#D4A84F';
    ctx.lineWidth = Math.max(2, w * 0.0026);
    ctx.strokeRect(frameW, frameW, w - frameW * 2, h - frameW - footerH);

    // Diamond corner brackets
    const d = w * 0.032;
    const corners: [number, number][] = [
      [frameW, frameW],
      [w - frameW, frameW],
      [frameW, h - frameW - footerH + frameW],
      [w - frameW, h - frameW - footerH + frameW],
    ];
    corners.forEach(([cx, cy]) => {
      drawKawungMotif(ctx, cx, cy, d * 0.9, '#D4A84F', 0.9);
    });

    // Gold divider line inside footer
    ctx.beginPath();
    ctx.moveTo(w * 0.22, h - footerH * 0.72);
    ctx.lineTo(w * 0.78, h - footerH * 0.72);
    ctx.strokeStyle = 'rgba(212, 168, 79, 0.45)';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    ctx.fillStyle = '#FFFFFF';
    ctx.textAlign = 'center';
    ctx.font = `600 ${Math.round(w * 0.042)}px "Cormorant Garamond", Georgia, serif`;
    ctx.fillText(eventTitle, w / 2, h - footerH * 0.42);

    ctx.fillStyle = '#D4A84F';
    ctx.font = `500 ${Math.round(w * 0.019)}px "Plus Jakarta Sans", sans-serif`;
    ctx.fillText(eventDate, w / 2, h - footerH * 0.18);
    ctx.restore();
  } else if (themeId === 'pendopo-agung') {
    ctx.save();
    const matSide = Math.round(w * 0.06);
    const matBottom = Math.round(h * 0.17);
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, w, matSide);
    ctx.fillRect(0, 0, matSide, h);
    ctx.fillRect(w - matSide, 0, matSide, h);
    ctx.fillRect(0, h - matBottom, w, matBottom);

    // Fine charcoal + gold architectural rule
    ctx.strokeStyle = '#141414';
    ctx.lineWidth = Math.max(1.5, w * 0.0018);
    ctx.strokeRect(matSide, matSide, w - matSide * 2, h - matSide - matBottom);

    ctx.strokeStyle = '#B48327';
    ctx.lineWidth = Math.max(1, w * 0.0012);
    ctx.strokeRect(matSide - 6, matSide - 6, w - (matSide - 6) * 2, h - matSide - matBottom + 12);

    // Subtle Left-aligned archival typography
    ctx.fillStyle = '#141414';
    ctx.textAlign = 'left';
    ctx.font = `600 ${Math.round(w * 0.04)}px "Cormorant Garamond", Georgia, serif`;
    ctx.fillText(eventTitle, matSide, h - matBottom * 0.48);

    ctx.fillStyle = '#71717A';
    ctx.textAlign = 'right';
    ctx.font = `500 ${Math.round(w * 0.018)}px "JetBrains Mono", monospace`;
    ctx.fillText(eventDate, w - matSide, h - matBottom * 0.48);

    // Small gold rule below
    ctx.fillStyle = '#B48327';
    ctx.fillRect(matSide, h - matBottom * 0.34, w * 0.12, 2);
    ctx.restore();
  }
}

export interface ExportCompositeOptions {
  imageUrl: string;
  filterId: FilterId;
  twibbonId: TwibbonId;
  eventTitle: string;
  eventDate: string;
  zoom?: number;
  offsetX?: number;
  offsetY?: number;
  width?: number;
  height?: number;
}

export async function renderCompositeToBlob(opts: ExportCompositeOptions): Promise<Blob> {
  const targetW = opts.width ?? 1080;
  const targetH = opts.height ?? 1350;
  const zoom = opts.zoom ?? 1;
  const offsetX = opts.offsetX ?? 0;
  const offsetY = opts.offsetY ?? 0;

  const img = await new Promise<HTMLImageElement>((resolve, reject) => {
    const el = new Image();
    el.crossOrigin = 'anonymous';
    el.onload = () => resolve(el);
    el.onerror = () => reject(new Error('Gagal memuat gambar untuk diproses.'));
    el.src = opts.imageUrl;
  });

  const canvas = document.createElement('canvas');
  canvas.width = targetW;
  canvas.height = targetH;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas 2D tidak tersedia.');

  ctx.fillStyle = '#141414';
  ctx.fillRect(0, 0, targetW, targetH);

  // Compute cover scale
  const baseScale = Math.max(targetW / img.width, targetH / img.height);
  const drawW = img.width * baseScale * zoom;
  const drawH = img.height * baseScale * zoom;
  const drawX = (targetW - drawW) / 2 + offsetX * (targetW * 0.25);
  const drawY = (targetH - drawH) / 2 + offsetY * (targetH * 0.25);

  ctx.save();
  ctx.filter = getFilterCss(opts.filterId);
  ctx.drawImage(img, drawX, drawY, drawW, drawH);
  ctx.restore();

  drawTwibbonFrame(ctx, targetW, targetH, opts.twibbonId, opts.eventTitle, opts.eventDate);

  return await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) resolve(blob);
        else reject(new Error('Gagal mengekspor gambar.'));
      },
      'image/png',
      0.95
    );
  });
}
