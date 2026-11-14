import React, { useEffect, useRef, useState } from 'react';
import {
  Download,
  Upload,
  Wand2,
  Share2,
  Volume2,
  Loader2,
  RotateCcw,
} from 'lucide-react';
import {
  EventAlbum,
  FilterId,
  PhotoAnalysis,
  PhotoItem,
  TwibbonId,
} from '../types';
import {
  PHOTO_FILTERS,
  TWIBBON_THEMES,
  drawTwibbonFrame,
  getFilterCss,
  renderCompositeToBlob,
} from '../utils/filtersAndTwibbons';

interface TwibbonStudioProps {
  photos: PhotoItem[];
  activeEvent?: EventAlbum;
  initialPhoto: PhotoItem | null;
  initialFilter: FilterId;
  onTrackEvent: (payload: {
    action: string;
    photoId?: string;
    eventCode?: string;
    twibbonId?: string;
    filterId?: string;
    platform?: string;
    detail?: string;
  }) => void;
}

export const TwibbonStudio: React.FC<TwibbonStudioProps> = ({
  photos,
  activeEvent,
  initialPhoto,
  initialFilter,
  onTrackEvent,
}) => {
  const [selectedPhotoId, setSelectedPhotoId] = useState<string>(
    initialPhoto?.id || photos[0]?.id || ''
  );
  const [customImageUrl, setCustomImageUrl] = useState<string | null>(null);
  const [selectedFilter, setSelectedFilter] = useState<FilterId>(initialFilter || 'batik-warmth');
  const [selectedTwibbon, setSelectedTwibbon] = useState<TwibbonId>('kawung-kencana');
  const [eventTitle, setEventTitle] = useState(activeEvent?.name || 'Pameran XII IPA 5');
  const [eventDate, setEventDate] = useState(
    activeEvent?.subtitle || 'Pameran XII IPA 5 Adat Jawa'
  );

  const [zoom, setZoom] = useState(1);
  const [offsetX, setOffsetX] = useState(0);
  const [offsetY, setOffsetY] = useState(0);

  const [analyzing, setAnalyzing] = useState(false);
  const [analysis, setAnalysis] = useState<PhotoAnalysis | null>(null);
  const [analysisError, setAnalysisError] = useState<string | null>(null);
  const [downloading, setDownloading] = useState(false);
  const [ttsBusy, setTtsBusy] = useState(false);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    if (initialPhoto) {
      setSelectedPhotoId(initialPhoto.id);
      setCustomImageUrl(null);
    }
  }, [initialPhoto]);

  useEffect(() => {
    if (activeEvent) {
      setEventTitle(activeEvent.name);
      setEventDate(activeEvent.subtitle || activeEvent.dateLabel);
    }
  }, [activeEvent]);

  const activePhotoObj = photos.find((p) => p.id === selectedPhotoId) || photos[0];
  const currentImageUrl = customImageUrl || activePhotoObj?.url || '';

  // Render live interactive Canvas preview (works even before gallery photos exist)
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const w = 720;
    const h = 900;

    if (!currentImageUrl) {
      canvas.width = w;
      canvas.height = h;
      ctx.fillStyle = '#1C1C1E';
      ctx.fillRect(0, 0, w, h);

      ctx.fillStyle = 'rgba(255,255,255,0.65)';
      ctx.textAlign = 'center';
      ctx.font = '600 22px "Plus Jakarta Sans", sans-serif';
      ctx.fillText('Pratinjau Bingkai Twibbon Jawa', w / 2, h * 0.44);
      ctx.fillStyle = 'rgba(255,255,255,0.42)';
      ctx.font = '400 16px "Plus Jakarta Sans", sans-serif';
      ctx.fillText('Unggah foto pribadi atau tunggu foto dari penyelenggara', w / 2, h * 0.49);

      drawTwibbonFrame(ctx, w, h, selectedTwibbon, eventTitle, eventDate);
      return;
    }

    let cancelled = false;
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      if (cancelled) return;
      canvas.width = w;
      canvas.height = h;
      ctx.fillStyle = '#141414';
      ctx.fillRect(0, 0, w, h);

      const baseScale = Math.max(w / img.width, h / img.height);
      const drawW = img.width * baseScale * zoom;
      const drawH = img.height * baseScale * zoom;
      const drawX = (w - drawW) / 2 + offsetX * (w * 0.25);
      const drawY = (h - drawH) / 2 + offsetY * (h * 0.25);

      ctx.save();
      ctx.filter = getFilterCss(selectedFilter);
      ctx.drawImage(img, drawX, drawY, drawW, drawH);
      ctx.restore();

      drawTwibbonFrame(ctx, w, h, selectedTwibbon, eventTitle, eventDate);
    };
    img.src = currentImageUrl;
    return () => {
      cancelled = true;
    };
  }, [currentImageUrl, selectedFilter, selectedTwibbon, eventTitle, eventDate, zoom, offsetX, offsetY]);

  const handleUploadOwnPhoto = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      setCustomImageUrl(String(reader.result));
      setAnalysis(null);
      setZoom(1);
      setOffsetX(0);
      setOffsetY(0);
    };
    reader.readAsDataURL(file);
  };

  const handleAnalyzeWithGemini = async () => {
    if (!currentImageUrl) return;
    setAnalyzing(true);
    setAnalysisError(null);
    try {
      const res = await fetch('/api/gemini/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(
          customImageUrl ? { imageDataUrl: customImageUrl } : { photoUrl: currentImageUrl }
        ),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Gagal menganalisis foto.');
      const a: PhotoAnalysis = data.analysis;
      setAnalysis(a);

      // Automatically apply AI recommendations if valid
      if (PHOTO_FILTERS.some((f) => f.id === a.recommendedFilter)) {
        setSelectedFilter(a.recommendedFilter);
      }
      if (TWIBBON_THEMES.some((t) => t.id === a.recommendedTwibbon)) {
        setSelectedTwibbon(a.recommendedTwibbon);
      }
    } catch (err) {
      setAnalysisError(err instanceof Error ? err.message : 'Gagal menganalisis foto.');
    } finally {
      setAnalyzing(false);
    }
  };

  const handleSpeakCaption = async (text: string) => {
    setTtsBusy(true);
    try {
      const res = await fetch('/api/gemini/tts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text }),
      });
      const data = await res.json();
      if (res.ok && data.audioBase64) {
        const audio = new Audio(`data:${data.mimeType || 'audio/wav'};base64,${data.audioBase64}`);
        await audio.play();
      }
    } finally {
      setTtsBusy(false);
    }
  };

  const handleDownloadTwibbon = async () => {
    if (!currentImageUrl) return;
    setDownloading(true);
    try {
      const blob = await renderCompositeToBlob({
        imageUrl: currentImageUrl,
        filterId: selectedFilter,
        twibbonId: selectedTwibbon,
        eventTitle,
        eventDate,
        zoom,
        offsetX,
        offsetY,
        width: 1080,
        height: 1350,
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `twibbon-${selectedTwibbon}-${Date.now()}.png`;
      a.click();
      URL.revokeObjectURL(url);

      onTrackEvent({
        action: 'twibbon_download',
        photoId: customImageUrl ? undefined : activePhotoObj?.id,
        eventCode: activeEvent?.code || 'PAMERAN-XII-IPA-5',
        twibbonId: selectedTwibbon,
        filterId: selectedFilter,
        detail: `Unduh Twibbon ${selectedTwibbon} + filter ${selectedFilter}`,
      });
    } finally {
      setDownloading(false);
    }
  };

  const handleShareTwibbon = async () => {
    if (!currentImageUrl) return;
    const blob = await renderCompositeToBlob({
      imageUrl: currentImageUrl,
      filterId: selectedFilter,
      twibbonId: selectedTwibbon,
      eventTitle,
      eventDate,
      zoom,
      offsetX,
      offsetY,
      width: 1080,
      height: 1350,
    });
    onTrackEvent({
      action: 'share',
      photoId: customImageUrl ? undefined : activePhotoObj?.id,
      eventCode: activeEvent?.code || 'PAMERAN-XII-IPA-5',
      platform: 'native',
      detail: `Bagikan Twibbon ${selectedTwibbon} ke media sosial`,
    });

    if (navigator.share) {
      const file = new File([blob], `xii-ipa-5-${selectedTwibbon}.png`, { type: 'image/png' });
      try {
        if (navigator.canShare?.({ files: [file] })) {
          await navigator.share({
            title: eventTitle,
            text: analysis?.summaryCaption || `${eventTitle} — XII IPA 5`,
            files: [file],
          });
          return;
        }
      } catch {
        // fallback below
      }
    }
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `xii-ipa-5-${selectedTwibbon}.png`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="max-w-[1360px] mx-auto px-4 sm:px-8 py-8 sm:py-10 space-y-8">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 border-b border-zinc-200 pb-6">
        <div>
          <p className="text-xs font-mono text-[#9B7334]">JAWA · MODERN · ELEGAN</p>
          <h1 className="font-editorial text-3xl sm:text-4xl font-bold text-[#141414] mt-1">
            Studio Twibbon Otomatis & Analisis AI
          </h1>
          <p className="text-sm text-zinc-600 mt-1 max-w-2xl">
            Pilih foto dari galeri acara atau unggah potret pribadi Anda, terapkan bingkai Twibbon Jawa kontemporer, dan biarkan AI merekomendasikan filter serta caption terbaik.
          </p>
        </div>

        <label className="inline-flex items-center gap-2 px-4 py-2.5 bg-white border border-zinc-300 hover:border-[#B48327] text-xs font-semibold text-[#141414] rounded-lg cursor-pointer whitespace-nowrap shrink-0 transition-colors">
          <Upload className="w-4 h-4 text-[#9B7334]" />
          <span>Unggah Foto Sendiri</span>
          <input type="file" accept="image/*" onChange={handleUploadOwnPhoto} className="hidden" />
        </label>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Left: Live High-Res Twibbon Canvas Preview */}
        <div className="lg:col-span-5 space-y-4">
          <div className="bg-white border border-zinc-200 rounded-2xl p-4 sm:p-5">
            <div className="aspect-[4/5] w-full rounded-xl overflow-hidden bg-zinc-900 flex items-center justify-center">
              <canvas ref={canvasRef} className="w-full h-full object-contain" />
            </div>

            {/* Pan & Zoom Controls */}
            <div className="mt-4 pt-4 border-t border-zinc-100 space-y-3">
              <div className="flex items-center justify-between text-xs">
                <span className="font-medium text-zinc-700">Sesuaikan Posisi Foto</span>
                <button
                  type="button"
                  onClick={() => {
                    setZoom(1);
                    setOffsetX(0);
                    setOffsetY(0);
                  }}
                  className="inline-flex items-center gap-1 text-zinc-500 hover:text-[#141414] cursor-pointer"
                >
                  <RotateCcw className="w-3 h-3" />
                  <span>Reset</span>
                </button>
              </div>
              <div className="grid grid-cols-3 gap-3 text-[11px] text-zinc-600">
                <label className="space-y-1">
                  <span>Perbesar ({zoom.toFixed(2)}x)</span>
                  <input
                    type="range"
                    min="0.8"
                    max="2"
                    step="0.05"
                    value={zoom}
                    onChange={(e) => setZoom(parseFloat(e.target.value))}
                    className="w-full accent-[#B48327]"
                  />
                </label>
                <label className="space-y-1">
                  <span>Geser Horizontal</span>
                  <input
                    type="range"
                    min="-1"
                    max="1"
                    step="0.05"
                    value={offsetX}
                    onChange={(e) => setOffsetX(parseFloat(e.target.value))}
                    className="w-full accent-[#B48327]"
                  />
                </label>
                <label className="space-y-1">
                  <span>Geser Vertikal</span>
                  <input
                    type="range"
                    min="-1"
                    max="1"
                    step="0.05"
                    value={offsetY}
                    onChange={(e) => setOffsetY(parseFloat(e.target.value))}
                    className="w-full accent-[#B48327]"
                  />
                </label>
              </div>
            </div>
          </div>

          <div className="flex gap-3">
            <button
              type="button"
              onClick={handleDownloadTwibbon}
              disabled={downloading || !currentImageUrl}
              className="flex-1 inline-flex items-center justify-center gap-2 px-5 py-3 bg-[#141414] text-white text-sm font-semibold rounded-xl hover:bg-zinc-800 transition-colors cursor-pointer disabled:opacity-50"
            >
              <Download className="w-4 h-4 text-[#D4AF5A]" />
              <span>{downloading ? 'Merender PNG...' : 'Unduh Twibbon HD'}</span>
            </button>
            <button
              type="button"
              onClick={handleShareTwibbon}
              disabled={!currentImageUrl}
              className="inline-flex items-center justify-center gap-2 px-4 py-3 border border-zinc-300 bg-white hover:border-[#B48327] text-sm font-semibold text-[#141414] rounded-xl cursor-pointer"
            >
              <Share2 className="w-4 h-4" />
              <span>Bagikan</span>
            </button>
          </div>
        </div>

        {/* Right: Twibbon Themes, Photo Picker, Filters & AI Photo Analyzer */}
        <div className="lg:col-span-7 space-y-6">
          {/* 1. AI Image Understanding Card */}
          <div className="bg-white border border-zinc-200 rounded-2xl p-6 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-base font-semibold text-[#141414]">
                  Analisis Foto & Rekomendasi Twibbon AI
                </h2>
                <p className="text-xs text-zinc-500 mt-0.5">
                  Deteksi nuansa busana Jawa, pencahayaan, dan pasangkan bingkai otomatis
                </p>
              </div>
              <button
                type="button"
                onClick={handleAnalyzeWithGemini}
                disabled={analyzing || !currentImageUrl}
                className="inline-flex items-center gap-2 px-4 py-2 bg-[#FAF7F0] border border-[#DFD5BE] hover:border-[#B48327] text-[#141414] text-xs font-semibold rounded-lg cursor-pointer disabled:opacity-50"
              >
                {analyzing ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin text-[#B48327]" />
                ) : (
                  <Wand2 className="w-3.5 h-3.5 text-[#9B7334]" />
                )}
                <span>{analyzing ? 'Menganalisis...' : 'Analisis Foto dengan AI'}</span>
              </button>
            </div>

            {analysisError && (
              <p className="text-xs text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                {analysisError}
              </p>
            )}

            {analysis && (
              <div className="bg-[#FAF8F4] border border-[#E6DFCF] rounded-xl p-4 space-y-3 text-xs">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <p className="font-semibold text-[#9B7334]">Suasana & Mood</p>
                    <p className="text-zinc-700 mt-0.5 leading-relaxed">{analysis.mood}</p>
                  </div>
                  <div>
                    <p className="font-semibold text-[#9B7334]">Busana & Elemen Visual</p>
                    <p className="text-zinc-700 mt-0.5 leading-relaxed">
                      {analysis.attireAndElements}
                    </p>
                  </div>
                </div>
                <div className="pt-2 border-t border-[#E6DFCF] flex flex-wrap items-center justify-between gap-2">
                  <p className="text-zinc-800 italic">“{analysis.summaryCaption}”</p>
                  <button
                    type="button"
                    onClick={() => handleSpeakCaption(analysis.summaryCaption)}
                    disabled={ttsBusy}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-white border border-zinc-200 rounded-md text-[11px] font-medium text-zinc-700 hover:text-[#141414] cursor-pointer"
                  >
                    <Volume2 className="w-3 h-3 text-[#9B7334]" />
                    <span>{ttsBusy ? 'Memutar...' : 'Bacakan'}</span>
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* 2. Javanese Modern Twibbon Selector */}
          <div className="bg-white border border-zinc-200 rounded-2xl p-6 space-y-4">
            <h2 className="text-base font-semibold text-[#141414]">
              Pilih Tema Twibbon Jawa Modern (5 Desain)
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {TWIBBON_THEMES.map((theme) => {
                const active = selectedTwibbon === theme.id;
                return (
                  <button
                    key={theme.id}
                    type="button"
                    onClick={() => setSelectedTwibbon(theme.id)}
                    className={`p-3.5 rounded-xl border text-left flex items-center gap-3.5 transition-colors cursor-pointer ${
                      active
                        ? 'border-[#B48327] bg-[#FAF7F0]'
                        : 'border-zinc-200 hover:border-zinc-300 bg-white'
                    }`}
                  >
                    <div
                      className="w-11 h-11 rounded-lg border-2 shrink-0 flex items-center justify-center font-editorial font-bold text-sm"
                      style={{
                        backgroundColor: theme.bgPreview,
                        borderColor: theme.accentColor,
                        color: theme.accentColor,
                      }}
                    >
                      KL
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-[#141414] truncate">{theme.name}</p>
                      <p className="text-xs text-zinc-500 truncate">{theme.tagline}</p>
                    </div>
                  </button>
                );
              })}
            </div>

            {/* Editable Title & Date on Twibbon */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
              <div>
                <label className="block text-xs font-medium text-zinc-600 mb-1">
                  Judul pada Bingkai
                </label>
                <input
                  type="text"
                  value={eventTitle}
                  onChange={(e) => setEventTitle(e.target.value)}
                  maxLength={44}
                  className="w-full px-3 py-2 text-xs border border-zinc-300 rounded-lg focus:outline-none focus:border-[#B48327]"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-zinc-600 mb-1">
                  Subjudul / Tanggal Acara
                </label>
                <input
                  type="text"
                  value={eventDate}
                  onChange={(e) => setEventDate(e.target.value)}
                  maxLength={48}
                  className="w-full px-3 py-2 text-xs border border-zinc-300 rounded-lg focus:outline-none focus:border-[#B48327]"
                />
              </div>
            </div>
          </div>

          {/* 3. Filter & Source Photo Picker */}
          <div className="bg-white border border-zinc-200 rounded-2xl p-6 space-y-5">
            <div>
              <h2 className="text-sm font-semibold text-[#141414] mb-3">Filter Warna</h2>
              <div className="flex flex-wrap gap-2">
                {PHOTO_FILTERS.map((f) => (
                  <button
                    key={f.id}
                    type="button"
                    onClick={() => setSelectedFilter(f.id)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium border cursor-pointer ${
                      selectedFilter === f.id
                        ? 'bg-[#141414] text-white border-[#141414]'
                        : 'bg-white text-zinc-700 border-zinc-200 hover:border-zinc-300'
                    }`}
                  >
                    {f.name}
                  </button>
                ))}
              </div>
            </div>

            <div className="pt-4 border-t border-zinc-100">
              <h2 className="text-sm font-semibold text-[#141414] mb-3">
                Atau Pilih Foto dari Galeri Acara
              </h2>
              {photos.length === 0 ? (
                <p className="text-xs text-zinc-500">
                  Galeri acara masih kosong. Unggah foto pribadi Anda lewat tombol di atas atau tambahkan foto melalui Panel Admin.
                </p>
              ) : (
                <div className="grid grid-cols-4 sm:grid-cols-5 gap-2.5">
                  {photos.map((p) => {
                    const isSel = !customImageUrl && selectedPhotoId === p.id;
                    return (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => {
                          setCustomImageUrl(null);
                          setSelectedPhotoId(p.id);
                          setAnalysis(null);
                        }}
                        className={`aspect-square rounded-lg overflow-hidden border-2 transition-all cursor-pointer ${
                          isSel ? 'border-[#B48327] ring-2 ring-[#B48327]/30' : 'border-transparent'
                        }`}
                      >
                        <img
                          src={p.url}
                          alt={p.title}
                          referrerPolicy="no-referrer"
                          className="w-full h-full object-cover"
                        />
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
