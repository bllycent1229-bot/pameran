import React, { useState } from 'react';
import {
  X,
  Download,
  Share2,
  Copy,
  Check,
  Volume2,
  Wand2,
  Frame,
  Loader2,
} from 'lucide-react';
import { AiCaptionOption, EventAlbum, FilterId, PhotoItem } from '../types';
import { PHOTO_FILTERS, getFilterCss, renderCompositeToBlob } from '../utils/filtersAndTwibbons';

interface PhotoLightboxModalProps {
  photo: PhotoItem | null;
  event?: EventAlbum;
  initialFilter: FilterId;
  onClose: () => void;
  onSendToTwibbon: (photo: PhotoItem, filterId: FilterId) => void;
  onCaptionsUpdated: (photoId: string, captions: AiCaptionOption[]) => void;
  onTrackEvent: (payload: {
    action: string;
    photoId?: string;
    eventCode?: string;
    platform?: string;
    filterId?: string;
    detail?: string;
  }) => void;
}

export const PhotoLightboxModal: React.FC<PhotoLightboxModalProps> = ({
  photo,
  event,
  initialFilter,
  onClose,
  onSendToTwibbon,
  onCaptionsUpdated,
  onTrackEvent,
}) => {
  const [selectedFilter, setSelectedFilter] = useState<FilterId>(initialFilter);
  const [selectedCaptionIdx, setSelectedCaptionIdx] = useState(0);
  const [copiedIdx, setCopiedIdx] = useState<number | null>(null);
  const [generatingAi, setGeneratingAi] = useState(false);
  const [ttsLoading, setTtsLoading] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [statusNotice, setStatusNotice] = useState<string | null>(null);

  if (!photo) return null;

  const activeCaptionObj = photo.aiCaptions[selectedCaptionIdx] || photo.aiCaptions[0];
  const fullCaptionText = activeCaptionObj
    ? `${activeCaptionObj.caption}\n\n${activeCaptionObj.hashtags.join(' ')}`
    : photo.title;

  const handleCopyCaption = async (idx: number, text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedIdx(idx);
      setTimeout(() => setCopiedIdx(null), 1800);
    } catch {
      setStatusNotice('Salin manual dari kotak caption.');
    }
  };

  const handleRegenerateCaptions = async () => {
    setGeneratingAi(true);
    setStatusNotice(null);
    try {
      const res = await fetch('/api/gemini/captions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          photoId: photo.id,
          imageUrl: photo.url,
          title: photo.title,
          category: photo.category,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Gagal membuat caption.');
      if (Array.isArray(data.captions) && data.captions.length > 0) {
        onCaptionsUpdated(photo.id, data.captions);
        setSelectedCaptionIdx(0);
        setStatusNotice('3 opsi caption AI baru berhasil disusun berdasarkan visual foto.');
      }
    } catch (err) {
      setStatusNotice(err instanceof Error ? err.message : 'Gagal menghubungi layanan AI.');
    } finally {
      setGeneratingAi(false);
    }
  };

  const handlePlayTts = async (text: string) => {
    setTtsLoading(true);
    setStatusNotice(null);
    try {
      const res = await fetch('/api/gemini/tts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Gagal membuat audio narasi.');
      const audio = new Audio(`data:${data.mimeType || 'audio/wav'};base64,${data.audioBase64}`);
      await audio.play();
    } catch (err) {
      setStatusNotice(err instanceof Error ? err.message : 'Gagal memutar narasi suara.');
    } finally {
      setTtsLoading(false);
    }
  };

  const handleDownloadFiltered = async () => {
    setDownloading(true);
    try {
      const blob = await renderCompositeToBlob({
        imageUrl: photo.url,
        filterId: selectedFilter,
        twibbonId: 'none',
        eventTitle: event?.name || 'Pameran XII IPA 5',
        eventDate: event?.dateLabel || '',
        width: 1200,
        height: photo.aspectRatio === '3:4' ? 1600 : photo.aspectRatio === '16:9' ? 675 : 900,
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${photo.title.toLowerCase().replace(/\s+/g, '-')}-${selectedFilter}.png`;
      a.click();
      URL.revokeObjectURL(url);

      onTrackEvent({
        action: 'download',
        photoId: photo.id,
        eventCode: photo.eventCode,
        filterId: selectedFilter,
        detail: `Unduh foto dengan filter ${selectedFilter}`,
      });
      setStatusNotice('Foto beresolusi tinggi berhasil diunduh.');
    } catch (err) {
      setStatusNotice(err instanceof Error ? err.message : 'Gagal mengunduh foto.');
    } finally {
      setDownloading(false);
    }
  };

  const handleShareSocial = async (platform: 'whatsapp' | 'twitter' | 'facebook' | 'instagram' | 'native') => {
    const shareUrl = `${window.location.origin}/?event=${encodeURIComponent(photo.eventCode)}&photo=${encodeURIComponent(photo.id)}`;
    onTrackEvent({
      action: 'share',
      photoId: photo.id,
      eventCode: photo.eventCode,
      platform,
      detail: `Bagikan ke ${platform.toUpperCase()} dengan caption AI`,
    });

    if (platform === 'native' && navigator.share) {
      try {
        const blob = await renderCompositeToBlob({
          imageUrl: photo.url,
          filterId: selectedFilter,
          twibbonId: 'none',
          eventTitle: event?.name || 'Pameran XII IPA 5',
          eventDate: event?.dateLabel || '',
          width: 1080,
          height: photo.aspectRatio === '3:4' ? 1350 : 810,
        });
        const file = new File([blob], `${photo.id}.png`, { type: 'image/png' });
        if (navigator.canShare?.({ files: [file] })) {
          await navigator.share({ title: photo.title, text: fullCaptionText, files: [file] });
          return;
        }
        await navigator.share({ title: photo.title, text: fullCaptionText, url: shareUrl });
        return;
      } catch {
        // Fallback if cancelled
      }
    }

    if (platform === 'whatsapp') {
      const wa = `https://wa.me/?text=${encodeURIComponent(`${fullCaptionText}\n\nLihat galeri: ${shareUrl}`)}`;
      window.open(wa, '_blank', 'noopener,noreferrer');
    } else if (platform === 'twitter') {
      const tw = `https://twitter.com/intent/tweet?text=${encodeURIComponent(fullCaptionText)}&url=${encodeURIComponent(shareUrl)}`;
      window.open(tw, '_blank', 'noopener,noreferrer');
    } else if (platform === 'facebook') {
      const fb = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(shareUrl)}&quote=${encodeURIComponent(fullCaptionText)}`;
      window.open(fb, '_blank', 'noopener,noreferrer');
    } else if (platform === 'instagram') {
      await handleCopyCaption(selectedCaptionIdx, fullCaptionText);
      await handleDownloadFiltered();
      setStatusNotice('Foto terfilter diunduh & caption AI disalin! Siap ditempel ke Instagram Story atau Feed.');
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-2 sm:p-6"
      role="dialog"
      aria-modal="true"
      aria-label={photo.title}
    >
      <div className="bg-white rounded-2xl w-full max-w-6xl max-h-[94vh] overflow-hidden grid grid-cols-1 lg:grid-cols-12 shadow-2xl">
        {/* Left: High-Res Visual & Live Filter Preview */}
        <div className="lg:col-span-7 bg-[#111111] flex flex-col justify-between p-4 sm:p-6 relative min-h-[340px]">
          <div className="flex items-center justify-between text-xs text-zinc-400 mb-3">
            <div className="flex items-center gap-2">
              <span className="font-mono text-[#D4AF5A]">{photo.eventCode}</span>
              <span aria-hidden="true">·</span>
              <span>{photo.category}</span>
              {photo.exif && (
                <>
                  <span aria-hidden="true">·</span>
                  <span className="hidden sm:inline font-mono text-[11px]">{photo.exif}</span>
                </>
              )}
            </div>
            <button
              type="button"
              onClick={onClose}
              className="lg:hidden p-1.5 text-zinc-300 hover:text-white rounded-md cursor-pointer"
              aria-label="Tutup foto"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="flex-1 flex items-center justify-center overflow-hidden my-auto">
            <img
              src={photo.url}
              alt={photo.title}
              referrerPolicy="no-referrer"
              style={{ filter: getFilterCss(selectedFilter) }}
              className="max-h-[54vh] lg:max-h-[66vh] w-auto object-contain rounded-lg transition-all duration-200"
            />
          </div>

          {/* Filter Strip inside Lightbox */}
          <div className="mt-4 pt-3 border-t border-white/10">
            <div className="flex items-center gap-2 overflow-x-auto pb-1">
              {PHOTO_FILTERS.map((f) => (
                <button
                  key={f.id}
                  type="button"
                  onClick={() => setSelectedFilter(f.id)}
                  className={`px-3 py-1.5 rounded-md text-xs font-medium whitespace-nowrap shrink-0 transition-colors cursor-pointer ${
                    selectedFilter === f.id
                      ? 'bg-[#C99A3B] text-[#141414]'
                      : 'bg-white/10 text-zinc-200 hover:bg-white/20'
                  }`}
                >
                  {f.name}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Right: AI Captions, TTS, Social Sharing & Twibbon Action */}
        <div className="lg:col-span-5 flex flex-col max-h-[94vh] overflow-y-auto bg-white">
          <div className="px-6 py-5 border-b border-zinc-200 flex items-start justify-between gap-4">
            <div>
              <h2 className="font-editorial text-2xl font-bold text-[#141414] leading-tight">
                {photo.title}
              </h2>
              <p className="text-xs text-zinc-500 mt-1">
                Fotografer: {photo.photographer} · <span className="tabular-nums">{photo.downloads}</span> unduhan ·{' '}
                <span className="tabular-nums">{photo.shares}</span> dibagikan
              </p>
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label="Tutup panel"
              className="hidden lg:inline-flex p-2 text-zinc-400 hover:text-[#141414] hover:bg-zinc-100 rounded-lg cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="p-6 space-y-6 flex-1">
            {/* AI Caption Selector */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-semibold text-[#141414]">
                  Opsi Caption Rekomendasi AI
                </h3>
                <button
                  type="button"
                  onClick={handleRegenerateCaptions}
                  disabled={generatingAi}
                  className="inline-flex items-center gap-1.5 text-xs font-medium text-[#9B7334] hover:text-[#141414] transition-colors cursor-pointer disabled:opacity-50"
                >
                  {generatingAi ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Wand2 className="w-3.5 h-3.5" />
                  )}
                  <span>{generatingAi ? 'Menyusun...' : 'Buat Ulang dengan AI'}</span>
                </button>
              </div>

              <div className="space-y-2.5">
                {photo.aiCaptions.map((opt, idx) => {
                  const isSelected = selectedCaptionIdx === idx;
                  const combined = `${opt.caption}\n\n${opt.hashtags.join(' ')}`;
                  return (
                    <div
                      key={`${opt.tone}-${idx}`}
                      onClick={() => setSelectedCaptionIdx(idx)}
                      className={`p-3.5 rounded-xl border transition-colors cursor-pointer ${
                        isSelected
                          ? 'border-[#B48327] bg-[#FAF7F0]'
                          : 'border-zinc-200 hover:border-zinc-300 bg-white'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2 mb-1.5">
                        <span className="text-xs font-semibold text-[#9B7334]">{opt.tone}</span>
                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handlePlayTts(opt.caption);
                            }}
                            disabled={ttsLoading}
                            title="Bacakan caption dengan suara AI"
                            className="p-1.5 rounded-md text-zinc-500 hover:text-[#141414] hover:bg-zinc-100 cursor-pointer"
                          >
                            <Volume2 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleCopyCaption(idx, combined);
                            }}
                            title="Salin caption"
                            className="p-1.5 rounded-md text-zinc-500 hover:text-[#141414] hover:bg-zinc-100 cursor-pointer"
                          >
                            {copiedIdx === idx ? (
                              <Check className="w-3.5 h-3.5 text-emerald-600" />
                            ) : (
                              <Copy className="w-3.5 h-3.5" />
                            )}
                          </button>
                        </div>
                      </div>
                      <p className="text-xs sm:text-sm text-zinc-800 leading-relaxed">{opt.caption}</p>
                      <p className="text-[11px] text-zinc-500 mt-1.5">{opt.hashtags.join(' ')}</p>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Direct Social Media Share */}
            <div className="pt-4 border-t border-zinc-200">
              <h3 className="text-sm font-semibold text-[#141414] mb-3">
                Bagikan Langsung ke Media Sosial
              </h3>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                <button
                  type="button"
                  onClick={() => handleShareSocial('whatsapp')}
                  className="px-3 py-2 text-xs font-medium border border-zinc-200 rounded-lg hover:bg-zinc-50 text-[#141414] cursor-pointer"
                >
                  WhatsApp
                </button>
                <button
                  type="button"
                  onClick={() => handleShareSocial('instagram')}
                  className="px-3 py-2 text-xs font-medium border border-zinc-200 rounded-lg hover:bg-zinc-50 text-[#141414] cursor-pointer"
                >
                  Instagram
                </button>
                <button
                  type="button"
                  onClick={() => handleShareSocial('twitter')}
                  className="px-3 py-2 text-xs font-medium border border-zinc-200 rounded-lg hover:bg-zinc-50 text-[#141414] cursor-pointer"
                >
                  X / Twitter
                </button>
                <button
                  type="button"
                  onClick={() => handleShareSocial('facebook')}
                  className="px-3 py-2 text-xs font-medium border border-zinc-200 rounded-lg hover:bg-zinc-50 text-[#141414] cursor-pointer"
                >
                  Facebook
                </button>
              </div>
            </div>

            {statusNotice && (
              <p className="text-xs text-[#825F2A] bg-[#FAF7F0] border border-[#E5D9BF] rounded-lg px-3 py-2">
                {statusNotice}
              </p>
            )}
          </div>

          {/* Footer Primary Actions */}
          <div className="p-6 border-t border-zinc-200 bg-zinc-50/70 flex flex-col sm:flex-row gap-2.5">
            <button
              type="button"
              onClick={() => {
                onClose();
                onSendToTwibbon(photo, selectedFilter);
              }}
              className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 border border-[#B48327] text-[#825F2A] bg-white hover:bg-[#FAF7F0] text-xs font-semibold rounded-lg transition-colors cursor-pointer"
            >
              <Frame className="w-4 h-4" />
              <span>Pasang Twibbon Jawa</span>
            </button>
            <button
              type="button"
              onClick={handleDownloadFiltered}
              disabled={downloading}
              className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-[#141414] text-white hover:bg-zinc-800 text-xs font-semibold rounded-lg transition-colors cursor-pointer disabled:opacity-50"
            >
              <Download className="w-4 h-4 text-[#D4AF5A]" />
              <span>{downloading ? 'Memproses...' : 'Unduh Foto (HD)'}</span>
            </button>
            {typeof navigator !== 'undefined' && 'share' in navigator && (
              <button
                type="button"
                onClick={() => handleShareSocial('native')}
                title="Bagikan via Perangkat"
                className="inline-flex items-center justify-center p-2.5 border border-zinc-300 bg-white hover:bg-zinc-100 rounded-lg cursor-pointer"
              >
                <Share2 className="w-4 h-4 text-[#141414]" />
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
