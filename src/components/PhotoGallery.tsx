import React, { useMemo, useState } from 'react';
import JSZip from 'jszip';
import {
  QrCode,
  Wand2,
  Frame,
  Download,
  Search,
  ImageOff,
  Check,
  CheckSquare,
  FolderArchive,
  Loader2,
  BookOpen,
  ArrowRight,
} from 'lucide-react';
import { EventAlbum, FilterId, PhotoItem } from '../types';
import { PHOTO_FILTERS, getFilterCss, renderCompositeToBlob } from '../utils/filtersAndTwibbons';

interface PhotoGalleryProps {
  photos: PhotoItem[];
  events: EventAlbum[];
  activeEventCode: string;
  selectedFilter: FilterId;
  onSelectFilter: (f: FilterId) => void;
  onSelectPhoto: (photo: PhotoItem) => void;
  onSendToTwibbon: (photo: PhotoItem, filterId: FilterId) => void;
  onOpenScanner: () => void;
  onOpenScanTutorial?: () => void;
  onEnablePush?: () => void;
  onTrackEvent: (payload: {
    action: string;
    photoId?: string;
    eventCode?: string;
    filterId?: string;
    detail?: string;
  }) => void;
}

export const PhotoGallery: React.FC<PhotoGalleryProps> = ({
  photos,
  events,
  activeEventCode,
  selectedFilter,
  onSelectFilter,
  onSelectPhoto,
  onSendToTwibbon,
  onOpenScanner,
  onOpenScanTutorial,
  onEnablePush,
  onTrackEvent,
}) => {
  const [category, setCategory] = useState<string>('Semua');
  const [searchQuery, setSearchQuery] = useState('');
  const [failedImages, setFailedImages] = useState<Record<string, boolean>>({});
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [zipProgress, setZipProgress] = useState<string | null>(null);
  const [zipError, setZipError] = useState<string | null>(null);

  const activeEvent = useMemo(
    () => events.find((e) => e.code === activeEventCode) || events[0],
    [events, activeEventCode]
  );

  const categories = useMemo(() => {
    const set = new Set<string>(['Semua']);
    photos.forEach((p) => set.add(p.category));
    return Array.from(set);
  }, [photos]);

  const filteredPhotos = useMemo(() => {
    return photos.filter((p) => {
      const catMatch = category === 'Semua' || p.category === category;
      const q = searchQuery.trim().toLowerCase();
      const queryMatch =
        !q ||
        p.title.toLowerCase().includes(q) ||
        p.photographer.toLowerCase().includes(q) ||
        p.category.toLowerCase().includes(q);
      return catMatch && queryMatch;
    });
  }, [photos, category, searchQuery]);

  const heroPhoto = useMemo(
    () => photos.find((p) => p.featured) || photos[0],
    [photos]
  );

  const handleQuickDownload = async (e: React.MouseEvent, photo: PhotoItem) => {
    e.stopPropagation();
    setDownloadingId(photo.id);
    try {
      const blob = await renderCompositeToBlob({
        imageUrl: photo.url,
        filterId: selectedFilter,
        twibbonId: 'none',
        eventTitle: activeEvent?.name || 'Pameran XII IPA 5',
        eventDate: activeEvent?.dateLabel || '',
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
        detail: `Unduh cepat dengan filter ${selectedFilter}`,
      });
    } finally {
      setDownloadingId(null);
    }
  };

  const toggleSelectPhoto = (photoId: string) => {
    setSelectedIds((prev) =>
      prev.includes(photoId) ? prev.filter((id) => id !== photoId) : [...prev, photoId]
    );
  };

  const handleSelectAllFiltered = () => {
    const allFilteredIds = filteredPhotos.map((p) => p.id);
    const allSelected =
      allFilteredIds.length > 0 && allFilteredIds.every((id) => selectedIds.includes(id));
    if (allSelected) {
      setSelectedIds((prev) => prev.filter((id) => !allFilteredIds.includes(id)));
    } else {
      setSelectedIds((prev) => Array.from(new Set([...prev, ...allFilteredIds])));
    }
  };

  const handleDownloadZip = async () => {
    const targetPhotos = photos.filter((p) => selectedIds.includes(p.id));
    if (targetPhotos.length === 0) return;

    setZipError(null);
    setZipProgress(`Menyiapkan 0/${targetPhotos.length}...`);

    try {
      const zip = new JSZip();
      for (let i = 0; i < targetPhotos.length; i++) {
        const photo = targetPhotos[i];
        setZipProgress(`Memproses ${i + 1}/${targetPhotos.length}...`);
        const blob = await renderCompositeToBlob({
          imageUrl: photo.url,
          filterId: selectedFilter,
          twibbonId: 'none',
          eventTitle: activeEvent?.name || 'Pameran XII IPA 5',
          eventDate: activeEvent?.dateLabel || '',
          width: 1200,
          height: photo.aspectRatio === '3:4' ? 1600 : photo.aspectRatio === '16:9' ? 675 : 900,
        });
        const safeName =
          photo.title
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, '-')
            .replace(/^-|-$/g, '') || `foto-${i + 1}`;
        const indexPrefix = String(i + 1).padStart(2, '0');
        zip.file(`${indexPrefix}-${safeName}-${selectedFilter}.png`, blob);

        onTrackEvent({
          action: 'download',
          photoId: photo.id,
          eventCode: photo.eventCode,
          filterId: selectedFilter,
          detail: `Unduh massal arsip ZIP (${targetPhotos.length} foto)`,
        });
      }

      setZipProgress('Mengemas arsip ZIP...');
      const zipBlob = await zip.generateAsync({ type: 'blob' });
      const url = URL.createObjectURL(zipBlob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `pameran-xii-ipa-5-${selectedIds.length}-foto.zip`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      setZipError(err instanceof Error ? err.message : 'Gagal membuat arsip ZIP.');
    } finally {
      setZipProgress(null);
    }
  };

  return (
    <div className="max-w-[1360px] mx-auto px-4 sm:px-8 py-8 sm:py-12 space-y-12">
      {/* Hero Editorial Split (7_portfolio_photography) */}
      <section className="space-y-8">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-stretch">
          <div className="lg:col-span-6 flex flex-col justify-between bg-white border border-zinc-200/80 rounded-2xl p-6 sm:p-10">
            <div className="space-y-4">
              <div className="flex flex-wrap items-center gap-2 text-xs text-zinc-500">
                <span className="font-medium text-[#9B7334]">
                  {activeEventCode === 'ALL' ? 'SEMUA ALBUM' : activeEvent?.name || 'Pameran XII IPA 5'}
                </span>
                <span aria-hidden="true">·</span>
                <span>{activeEvent?.dateLabel || 'Arsip Resmi Penyelenggara'}</span>
                <span aria-hidden="true">·</span>
                <span className="tabular-nums">{photos.length} foto terkurasi</span>
              </div>

              <h1 className="font-editorial text-4xl sm:text-5xl font-bold tracking-tight text-[#141414] leading-[1.08] text-balance">
                {activeEventCode === 'ALL'
                  ? 'Pameran XII IPA 5'
                  : activeEvent?.name || 'Pameran XII IPA 5'}
              </h1>

              <p className="text-sm sm:text-base text-zinc-600 leading-relaxed max-w-xl">
                {activeEventCode === 'ALL'
                  ? 'Pameran XII IPA 5 Adat Jawa'
                  : activeEvent?.subtitle || 'Pameran XII IPA 5 Adat Jawa'}
              </p>
            </div>

            <div className="pt-8 mt-8 border-t border-zinc-200/80 flex flex-wrap items-center justify-between gap-4">
              <div className="flex flex-wrap items-center gap-3">
                <button
                  type="button"
                  onClick={onOpenScanner}
                  className="inline-flex items-center gap-2 px-5 py-2.5 bg-[#141414] text-white text-sm font-medium rounded-lg hover:bg-zinc-800 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                >
                  <QrCode className="w-4 h-4 text-[#D4AF5A]" />
                  <span>Pindai Barcode Meja</span>
                </button>
                {onOpenScanTutorial && (
                  <button
                    type="button"
                    onClick={onOpenScanTutorial}
                    className="inline-flex items-center gap-2 px-4 py-2.5 border border-zinc-300 bg-white text-[#141414] text-sm font-medium rounded-lg hover:border-[#B48327] transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                  >
                    <BookOpen className="w-4 h-4 text-[#9B7334]" />
                    <span>Tutorial Scan</span>
                  </button>
                )}
                {heroPhoto && (
                  <button
                    type="button"
                    onClick={() => onSendToTwibbon(heroPhoto, selectedFilter)}
                    className="inline-flex items-center gap-2 px-4 py-2.5 border border-zinc-300 bg-white text-[#141414] text-sm font-medium rounded-lg hover:border-[#B48327] transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                  >
                    <Frame className="w-4 h-4 text-[#9B7334]" />
                    <span>Buat Twibbon</span>
                  </button>
                )}
              </div>

              {activeEvent?.qrDataUrl && (
                <button
                  type="button"
                  onClick={onOpenScanner}
                  title="Klik untuk memperbesar atau mengunduh QR Acara"
                  className="flex items-center gap-2.5 p-1.5 pr-3 border border-zinc-200 rounded-lg bg-[#FAFAF9] hover:border-[#B48327] transition-colors cursor-pointer"
                >
                  <img
                    src={activeEvent.qrDataUrl}
                    alt={`QR ${activeEvent.code}`}
                    className="w-10 h-10 rounded"
                  />
                  <div className="text-left">
                    <p className="text-[11px] font-semibold text-[#141414]">
                      {activeEvent.name}
                    </p>
                    <p className="text-[11px] text-zinc-500">QR Terhubung</p>
                  </div>
                </button>
              )}
            </div>
          </div>

          {/* Hero Visual Column (Matched Height) */}
          <div className="lg:col-span-6 min-h-[280px] lg:min-h-[380px] relative rounded-2xl overflow-hidden bg-[#141414]">
            {heroPhoto && !failedImages[heroPhoto.id] ? (
              <img
                src={heroPhoto.url}
                alt={heroPhoto.title}
                referrerPolicy="no-referrer"
                onError={() => setFailedImages((prev) => ({ ...prev, [heroPhoto.id]: true }))}
                style={{ filter: getFilterCss(selectedFilter) }}
                className="w-full h-full object-cover transition-all duration-300 cursor-pointer"
                onClick={() => onSelectPhoto(heroPhoto)}
              />
            ) : (
              <div className="w-full h-full flex flex-col items-center justify-center text-center p-8 border border-[#B48327]/30 rounded-2xl bg-[radial-gradient(circle_at_top,_rgba(180,131,39,0.16),_#141414_70%)]">
                {activeEvent?.qrDataUrl && (
                  <img
                    src={activeEvent.qrDataUrl}
                    alt={`QR ${activeEvent.code}`}
                    className="w-24 h-24 rounded-lg bg-white p-1.5 mb-4 border border-[#C99A3B]/40"
                  />
                )}
                <p className="text-xs font-medium text-[#D4AF5A] tracking-wider">
                  {activeEvent?.name || 'Pameran XII IPA 5'}
                </p>
                <p className="font-editorial text-2xl font-semibold text-white mt-1">
                  Album Siap Menerima Foto
                </p>
                <p className="text-xs text-zinc-400 mt-1.5 max-w-xs leading-relaxed">
                  Foto yang diunggah dan dikurasi penyelenggara akan langsung tampil di halaman ini secara otomatis.
                </p>
              </div>
            )}
            {heroPhoto && (
              <div className="pointer-events-none absolute inset-x-0 bottom-0 p-6 bg-gradient-to-t from-black/80 via-black/35 to-transparent text-white">
                <p className="text-xs text-[#E5C883]">Sorotan Kurasi · {heroPhoto.category}</p>
                <p className="font-editorial text-2xl font-semibold mt-0.5">{heroPhoto.title}</p>
              </div>
            )}
          </div>
        </div>

        {/* 4-Step Editorial Barcode Scan Tutorial */}
        <div className="bg-white border border-zinc-200/80 rounded-2xl overflow-hidden">
            <div className="px-6 py-4 border-b border-zinc-200/80 flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="font-editorial text-xl sm:text-2xl font-bold text-[#141414]">
                  Panduan Scan Barcode Pameran
                </h2>
                <p className="text-xs text-zinc-500 mt-0.5">
                  Ikuti 4 langkah singkat berikut untuk membuka, mengedit, dan mengunduh foto acara
                </p>
              </div>
              <div className="flex items-center gap-2.5">
                {onOpenScanTutorial && (
                  <button
                    type="button"
                    onClick={onOpenScanTutorial}
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 border border-zinc-300 text-xs font-medium text-[#141414] rounded-lg hover:border-[#B48327] transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                  >
                    <BookOpen className="w-3.5 h-3.5 text-[#9B7334]" />
                    <span>Detail & Tips Scan</span>
                  </button>
                )}
                <button
                  type="button"
                  onClick={onOpenScanner}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-[#141414] text-white text-xs font-medium rounded-lg hover:bg-zinc-800 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                >
                  <span>Mulai Scan</span>
                  <ArrowRight className="w-3.5 h-3.5 text-[#D4AF5A]" />
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 divide-y sm:divide-y-0 sm:divide-x divide-zinc-200/80">
              <div className="p-5 space-y-1.5">
                <p className="font-mono text-xs font-semibold text-[#9B7334] tabular-nums">01.</p>
                <p className="text-sm font-semibold text-[#141414]">Siapkan QR Code Acara</p>
                <p className="text-xs text-zinc-600 leading-relaxed">
                  Gunakan QR di meja pameran atau lihat kartu QR <span className="font-medium text-[#141414]">Pameran XII IPA 5</span>.
                </p>
              </div>

              <div className="p-5 space-y-1.5">
                <p className="font-mono text-xs font-semibold text-[#9B7334] tabular-nums">02.</p>
                <p className="text-sm font-semibold text-[#141414]">Pindai Kamera / Unggah</p>
                <p className="text-xs text-zinc-600 leading-relaxed">
                  Klik <span className="font-medium text-[#141414]">Pindai Barcode Meja</span>, arahkan kamera ke kotak emas, unggah gambar QR, atau ketik kode manual.
                </p>
              </div>

              <div className="p-5 space-y-1.5">
                <p className="font-mono text-xs font-semibold text-[#9B7334] tabular-nums">03.</p>
                <p className="text-sm font-semibold text-[#141414]">Filter, Caption AI & ZIP</p>
                <p className="text-xs text-zinc-600 leading-relaxed">
                  Terapkan filter warna, salin caption AI tiap foto, atau pilih banyak foto untuk diunduh sebagai arsip ZIP.
                </p>
              </div>

              <div className="p-5 space-y-1.5">
                <p className="font-mono text-xs font-semibold text-[#9B7334] tabular-nums">04.</p>
                <p className="text-sm font-semibold text-[#141414]">Bingkai Twibbon Jawa</p>
                <p className="text-xs text-zinc-600 leading-relaxed">
                  Pasang bingkai modern adat Jawa di Studio Twibbon lalu unduh HD atau bagikan ke media sosial.
                </p>
              </div>
            </div>
          </div>
      </section>

      {/* Filter Toolbar: Moment Categories + Live Visual Filter Presets + Search */}
      <section className="space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-zinc-200 pb-4">
          {/* Category Segmented Tabs */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 lg:pb-0">
            {categories.map((cat) => (
              <button
                key={cat}
                type="button"
                onClick={() => setCategory(cat)}
                className={`px-3.5 py-1.5 text-xs font-medium rounded-lg whitespace-nowrap shrink-0 transition-colors cursor-pointer ${
                  category === cat
                    ? 'bg-[#141414] text-white'
                    : 'bg-white border border-zinc-200 text-zinc-600 hover:text-[#141414]'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>

          {/* Search Bar & Multi-Select Toggle */}
          <div className="flex items-center gap-2.5 w-full lg:w-auto">
            <div className="relative flex-1 lg:w-72">
              <Search className="w-4 h-4 text-zinc-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Cari judul foto atau fotografer..."
                className="w-full pl-9 pr-3.5 py-2 text-xs bg-white border border-zinc-200 rounded-lg focus:outline-none focus:border-[#B48327]"
              />
            </div>

            {filteredPhotos.length > 0 && (
              <button
                type="button"
                onClick={() => {
                  setSelectionMode((prev) => {
                    if (prev) setSelectedIds([]);
                    return !prev;
                  });
                  setZipError(null);
                }}
                className={`inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium rounded-lg border whitespace-nowrap shrink-0 transition-colors cursor-pointer ${
                  selectionMode
                    ? 'bg-[#141414] text-white border-[#141414]'
                    : 'bg-white text-[#141414] border-zinc-200 hover:border-[#B48327]'
                }`}
              >
                <CheckSquare className="w-3.5 h-3.5" />
                <span>{selectionMode ? 'Keluar Pilih' : 'Pilih Banyak'}</span>
              </button>
            )}
          </div>
        </div>

        {/* Live Photo Filter Presets Strip */}
        <div className="flex items-center gap-3 overflow-x-auto pb-1">
          <span className="text-xs font-medium text-zinc-500 whitespace-nowrap shrink-0">
            Filter Warna Foto:
          </span>
          {PHOTO_FILTERS.map((preset) => {
            const active = selectedFilter === preset.id;
            return (
              <button
                key={preset.id}
                type="button"
                onClick={() => onSelectFilter(preset.id)}
                title={preset.description}
                className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium border whitespace-nowrap shrink-0 transition-colors cursor-pointer ${
                  active
                    ? 'bg-[#FAF7F0] border-[#B48327] text-[#141414]'
                    : 'bg-white border-zinc-200 text-zinc-600 hover:border-zinc-300'
                }`}
              >
                <span
                  className="w-3 h-3 rounded-full border border-black/15 shrink-0"
                  style={{ backgroundColor: preset.swatchColor }}
                />
                <span>{preset.name}</span>
              </button>
            );
          })}
        </div>
        {/* Batch ZIP Download Bar */}
        {(selectionMode || selectedIds.length > 0) && filteredPhotos.length > 0 && (
          <div className="bg-white border border-[#DFD5BE] rounded-xl px-4 py-3 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3 text-xs">
              <span className="font-semibold text-[#141414] tabular-nums">
                {selectedIds.length} foto dipilih
              </span>
              <span aria-hidden="true" className="text-zinc-300">·</span>
              <button
                type="button"
                onClick={handleSelectAllFiltered}
                className="font-medium text-[#9B7334] hover:text-[#141414] cursor-pointer whitespace-nowrap"
              >
                {filteredPhotos.every((p) => selectedIds.includes(p.id))
                  ? 'Batal Pilih Semua'
                  : `Pilih Semua (${filteredPhotos.length})`}
              </button>
              {selectedIds.length > 0 && (
                <>
                  <span aria-hidden="true" className="text-zinc-300">·</span>
                  <button
                    type="button"
                    onClick={() => setSelectedIds([])}
                    className="text-zinc-500 hover:text-[#141414] cursor-pointer whitespace-nowrap"
                  >
                    Kosongkan
                  </button>
                </>
              )}
            </div>

            <div className="flex items-center gap-2.5">
              {zipError && <span className="text-xs text-red-600">{zipError}</span>}
              <button
                type="button"
                onClick={handleDownloadZip}
                disabled={selectedIds.length === 0 || Boolean(zipProgress)}
                className="inline-flex items-center gap-2 px-4 py-2 bg-[#141414] text-white text-xs font-semibold rounded-lg hover:bg-zinc-800 disabled:opacity-40 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              >
                {zipProgress ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin text-[#D4AF5A]" />
                ) : (
                  <FolderArchive className="w-3.5 h-3.5 text-[#D4AF5A]" />
                )}
                <span>{zipProgress || `Unduh Arsip ZIP (${selectedIds.length})`}</span>
              </button>
            </div>
          </div>
        )}
      </section>

      {/* Media-First Photo Grid */}
      <section>
        {filteredPhotos.length === 0 ? (
          <div className="bg-white border border-zinc-200 rounded-2xl p-10 sm:p-12 text-center space-y-4">
            <p className="font-editorial text-2xl font-semibold text-[#141414]">
              {photos.length === 0
                ? 'Belum Ada Foto yang Dipublikasikan'
                : 'Belum Ada Foto untuk Filter Ini'}
            </p>
            <p className="text-sm text-zinc-500 max-w-md mx-auto leading-relaxed">
              {photos.length === 0
                ? 'Penyelenggara acara belum mengunggah foto ke album barcode ini. Aktifkan notifikasi push agar Anda langsung mendapat kabar saat foto pertama ditambahkan.'
                : 'Coba pilih kategori lain atau pindai barcode acara berbeda.'}
            </p>
            {photos.length === 0 && onEnablePush && (
              <div className="pt-2 flex flex-wrap items-center justify-center gap-3">
                <button
                  type="button"
                  onClick={onEnablePush}
                  className="px-4 py-2 bg-[#141414] text-white text-xs font-semibold rounded-lg hover:bg-zinc-800 cursor-pointer"
                >
                  Aktifkan Notifikasi Foto Baru
                </button>
              </div>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredPhotos.map((photo) => {
              const firstCaption = photo.aiCaptions[0]?.caption;
              const isSelected = selectedIds.includes(photo.id);
              return (
                <article
                  key={photo.id}
                  onClick={() => {
                    if (selectionMode) {
                      toggleSelectPhoto(photo.id);
                    } else {
                      onSelectPhoto(photo);
                    }
                  }}
                  className={`group bg-white rounded-2xl overflow-hidden flex flex-col justify-between transition-all cursor-pointer border ${
                    isSelected
                      ? 'border-[#B48327] ring-2 ring-[#B48327]/35'
                      : 'border-zinc-200/80 hover:border-zinc-300'
                  }`}
                >
                  <div className="relative aspect-[4/3] bg-zinc-100 overflow-hidden">
                    {!failedImages[photo.id] ? (
                      <img
                        src={photo.url}
                        alt={photo.title}
                        referrerPolicy="no-referrer"
                        onError={() =>
                          setFailedImages((prev) => ({ ...prev, [photo.id]: true }))
                        }
                        style={{ filter: getFilterCss(selectedFilter) }}
                        className="w-full h-full object-cover group-hover:scale-[1.02] transition-transform duration-300"
                      />
                    ) : (
                      <div className="w-full h-full flex flex-col items-center justify-center text-zinc-400 p-4">
                        <ImageOff className="w-6 h-6 mb-1.5" />
                        <span className="text-xs text-center">{photo.title}</span>
                      </div>
                    )}
                    <button
                      type="button"
                      aria-label={isSelected ? `Batal pilih ${photo.title}` : `Pilih ${photo.title}`}
                      onClick={(e) => {
                        e.stopPropagation();
                        if (!selectionMode) setSelectionMode(true);
                        toggleSelectPhoto(photo.id);
                      }}
                      className={`absolute top-3 left-3 w-7 h-7 rounded-lg flex items-center justify-center border transition-all cursor-pointer ${
                        isSelected
                          ? 'bg-[#141414] border-[#D4AF5A] text-[#D4AF5A] opacity-100'
                          : selectionMode
                          ? 'bg-white/95 border-zinc-300 text-transparent opacity-100 hover:border-[#B48327]'
                          : 'bg-white/90 border-zinc-300 text-transparent opacity-0 group-hover:opacity-100 hover:border-[#B48327]'
                      }`}
                    >
                      <Check className="w-4 h-4" />
                    </button>
                    <div className="pointer-events-none absolute inset-x-0 bottom-0 h-20 bg-gradient-to-t from-black/55 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                  </div>

                  <div className="p-5 flex-1 flex flex-col justify-between space-y-4">
                    <div>
                      <div className="flex items-center gap-2 text-xs text-zinc-500 mb-1.5">
                        <span>{photo.category}</span>
                        <span aria-hidden="true">·</span>
                        <span>{photo.photographer}</span>
                        <span aria-hidden="true">·</span>
                        <span className="tabular-nums">{photo.downloads} unduhan</span>
                      </div>

                      <h3 className="font-editorial text-xl font-bold text-[#141414] leading-snug">
                        {photo.title}
                      </h3>

                      {firstCaption && (
                        <p className="text-xs text-zinc-600 mt-2 line-clamp-2 leading-relaxed">
                          “{firstCaption}”
                        </p>
                      )}
                    </div>

                    <div className="pt-3 border-t border-zinc-100 flex items-center justify-between gap-2">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onSelectPhoto(photo);
                        }}
                        className="inline-flex items-center gap-1.5 text-xs font-medium text-[#9B7334] hover:text-[#141414] cursor-pointer"
                      >
                        <Wand2 className="w-3.5 h-3.5" />
                        <span>Caption AI & Bagikan</span>
                      </button>

                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            onSendToTwibbon(photo, selectedFilter);
                          }}
                          className="px-2.5 py-1.5 text-xs font-medium text-zinc-700 bg-zinc-100 hover:bg-zinc-200 rounded-md transition-colors cursor-pointer whitespace-nowrap"
                        >
                          Twibbon
                        </button>
                        <button
                          type="button"
                          onClick={(e) => handleQuickDownload(e, photo)}
                          disabled={downloadingId === photo.id}
                          title="Unduh Foto"
                          className="p-1.5 text-zinc-700 bg-zinc-100 hover:bg-[#141414] hover:text-white rounded-md transition-colors cursor-pointer"
                        >
                          <Download className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
};
