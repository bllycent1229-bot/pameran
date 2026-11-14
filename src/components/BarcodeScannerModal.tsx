import React, { useEffect, useRef, useState } from 'react';
import jsQR from 'jsqr';
import {
  Camera,
  Upload,
  X,
  CheckCircle2,
  Download,
  Search,
  BookOpen,
  ArrowRight,
  Smartphone,
  Image as ImageIcon,
  Keyboard,
} from 'lucide-react';
import { EventAlbum } from '../types';

export type ScannerMode = 'cards' | 'camera' | 'manual' | 'tutorial';

interface BarcodeScannerModalProps {
  isOpen: boolean;
  onClose: () => void;
  events: EventAlbum[];
  onScannedEvent: (code: string) => void;
  initialMode?: ScannerMode;
}

export const BarcodeScannerModal: React.FC<BarcodeScannerModalProps> = ({
  isOpen,
  onClose,
  events,
  onScannedEvent,
  initialMode = 'cards',
}) => {
  const [mode, setMode] = useState<ScannerMode>(initialMode);
  const [manualCode, setManualCode] = useState('');
  const [scanMessage, setScanMessage] = useState<string | null>(null);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    if (isOpen) {
      setMode(initialMode);
      setScanMessage(null);
    }
  }, [isOpen, initialMode]);

  const stopCamera = () => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    rafRef.current = null;
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
  };

  useEffect(() => {
    if (!isOpen || mode !== 'camera') {
      stopCamera();
      return;
    }

    let cancelled = false;
    setCameraError(null);
    setScanMessage('Arahkan kamera ke barcode atau QR Code meja acara...');

    navigator.mediaDevices
      ?.getUserMedia({ video: { facingMode: 'environment' } })
      .then((stream) => {
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.play().catch(() => {});
        }

        const tick = () => {
          if (cancelled || !videoRef.current || !canvasRef.current) return;
          const video = videoRef.current;
          if (video.readyState === video.HAVE_ENOUGH_DATA) {
            const canvas = canvasRef.current;
            canvas.width = video.videoWidth;
            canvas.height = video.videoHeight;
            const ctx = canvas.getContext('2d');
            if (ctx) {
              ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
              const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
              const code = jsQR(imgData.data, imgData.width, imgData.height);
              if (code?.data) {
                handleDecodedValue(code.data);
                return;
              }
            }
          }
          rafRef.current = requestAnimationFrame(tick);
        };
        rafRef.current = requestAnimationFrame(tick);
      })
      .catch(() => {
        if (!cancelled) {
          setCameraError(
            'Kamera tidak tersedia atau izin ditolak. Anda dapat mengunggah gambar barcode atau memilih kartu QR acara di tab sebelah.'
          );
        }
      });

    return () => {
      cancelled = true;
      stopCamera();
    };
  }, [isOpen, mode]);

  const handleDecodedValue = (raw: string) => {
    let extracted = raw.trim();
    try {
      const url = new URL(raw);
      const param = url.searchParams.get('event');
      if (param) extracted = param;
    } catch {
      // raw string code
    }
    const clean = extracted.toUpperCase();
    const matched = events.find(
      (e) => e.code.toUpperCase() === clean || e.name.toUpperCase() === clean
    );
    if (matched) {
      stopCamera();
      onScannedEvent(matched.code);
      onClose();
    } else {
      setScanMessage(`Kode "${clean}" terbaca, namun belum terdaftar di daftar acara.`);
    }
  };

  const handleImageUploadQr = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;
        ctx.drawImage(img, 0, 0);
        const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const decoded = jsQR(imgData.data, imgData.width, imgData.height);
        if (decoded?.data) {
          handleDecodedValue(decoded.data);
        } else {
          setScanMessage('Barcode / QR tidak terdeteksi pada gambar tersebut.');
        }
      };
      img.src = String(reader.result);
    };
    reader.readAsDataURL(file);
  };

  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualCode.trim()) return;
    handleDecodedValue(manualCode);
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Pemindai Barcode Acara"
    >
      <div className="bg-white border border-zinc-200 rounded-2xl w-full max-w-2xl overflow-hidden shadow-2xl">
        <div className="px-6 py-4 border-b border-zinc-200 flex items-center justify-between">
          <div>
            <h2 className="font-editorial text-2xl font-bold text-[#141414]">
              Akses Foto via Scan Barcode
            </h2>
            <p className="text-xs text-zinc-500 mt-0.5">
              Pindai QR meja undangan atau ikuti panduan untuk membuka seluruh foto Pameran XII IPA 5
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Tutup pemindai"
            className="p-2 rounded-lg text-zinc-500 hover:text-[#141414] hover:bg-zinc-100 cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Mode Selector Tabs */}
        <div className="px-6 pt-4 flex items-center gap-2 border-b border-zinc-100 pb-3 overflow-x-auto">
          <button
            type="button"
            onClick={() => setMode('cards')}
            className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
              mode === 'cards' ? 'bg-[#141414] text-white' : 'text-zinc-600 hover:bg-zinc-100'
            }`}
          >
            Kartu QR Acara
          </button>
          <button
            type="button"
            onClick={() => setMode('camera')}
            className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer inline-flex items-center gap-1.5 ${
              mode === 'camera' ? 'bg-[#141414] text-white' : 'text-zinc-600 hover:bg-zinc-100'
            }`}
          >
            <Camera className="w-3.5 h-3.5" />
            <span>Kamera / Unggah QR</span>
          </button>
          <button
            type="button"
            onClick={() => setMode('manual')}
            className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer inline-flex items-center gap-1.5 ${
              mode === 'manual' ? 'bg-[#141414] text-white' : 'text-zinc-600 hover:bg-zinc-100'
            }`}
          >
            <Search className="w-3.5 h-3.5" />
            <span>Input Kode Manual</span>
          </button>
          <button
            type="button"
            onClick={() => setMode('tutorial')}
            className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer inline-flex items-center gap-1.5 ${
              mode === 'tutorial' ? 'bg-[#141414] text-white' : 'text-zinc-600 hover:bg-zinc-100'
            }`}
          >
            <BookOpen className="w-3.5 h-3.5" />
            <span>Tutorial Scan</span>
          </button>
        </div>

        <div className="p-6 max-h-[72vh] overflow-y-auto">
          {mode === 'cards' && (
            <div className={`grid gap-4 ${events.length === 1 ? 'grid-cols-1 max-w-md mx-auto' : 'grid-cols-1 sm:grid-cols-2'}`}>
              {events.map((evt) => (
                <div
                  key={evt.code}
                  className="border border-zinc-200 rounded-xl p-4 flex flex-col justify-between bg-[#FAFAF9]"
                >
                  <div>
                    <div className="flex items-start justify-between gap-3 mb-3">
                      <div>
                        <h3 className="font-editorial text-lg font-bold text-[#141414] leading-snug">
                          {evt.name}
                        </h3>
                        <p className="text-xs text-zinc-500 mt-0.5">{evt.subtitle}</p>
                      </div>
                      {evt.qrDataUrl && (
                        <img
                          src={evt.qrDataUrl}
                          alt={`QR Code ${evt.name}`}
                          className="w-20 h-20 rounded-md border border-zinc-200 bg-white p-1 shrink-0"
                        />
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 pt-3 border-t border-zinc-200/80">
                    <button
                      type="button"
                      onClick={() => {
                        onScannedEvent(evt.code);
                        onClose();
                      }}
                      className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 bg-[#141414] text-white text-xs font-medium rounded-lg hover:bg-zinc-800 transition-colors cursor-pointer"
                    >
                      <CheckCircle2 className="w-3.5 h-3.5 text-[#D4AF5A]" />
                      <span>Simulasi Scan & Buka</span>
                    </button>
                    {evt.qrDataUrl && (
                      <a
                        href={evt.qrDataUrl}
                        download={`Barcode-${evt.code}.png`}
                        title="Unduh QR Code"
                        className="p-2 border border-zinc-300 rounded-lg text-zinc-700 hover:bg-white transition-colors"
                      >
                        <Download className="w-4 h-4" />
                      </a>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}

          {mode === 'camera' && (
            <div className="space-y-4">
              <div className="relative rounded-xl overflow-hidden bg-zinc-900 aspect-video flex items-center justify-center">
                {cameraError ? (
                  <p className="text-xs text-zinc-300 text-center px-6 max-w-md leading-relaxed">
                    {cameraError}
                  </p>
                ) : (
                  <video ref={videoRef} className="w-full h-full object-cover" playsInline muted />
                )}
                <canvas ref={canvasRef} className="hidden" />
                <div className="pointer-events-none absolute inset-0 border-[28px] border-black/35 flex items-center justify-center">
                  <div className="w-44 h-44 border-2 border-[#D4AF5A] rounded-xl" />
                </div>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
                <p className="text-xs text-zinc-600">{scanMessage}</p>
                <label className="inline-flex items-center gap-2 px-3 py-2 text-xs font-medium bg-zinc-100 hover:bg-zinc-200 text-[#141414] rounded-lg cursor-pointer transition-colors">
                  <Upload className="w-3.5 h-3.5" />
                  <span>Unggah Gambar QR</span>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleImageUploadQr}
                    className="hidden"
                  />
                </label>
              </div>
            </div>
          )}

          {mode === 'manual' && (
            <form onSubmit={handleManualSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-zinc-700 mb-1.5">
                  Kode Barcode Acara
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={manualCode}
                    onChange={(e) => setManualCode(e.target.value)}
                    placeholder="Contoh: Pameran XII IPA 5"
                    className="flex-1 px-3.5 py-2.5 text-sm font-mono uppercase border border-zinc-300 rounded-lg focus:outline-none focus:border-[#B48327]"
                  />
                  <button
                    type="submit"
                    className="px-5 py-2.5 bg-[#141414] text-white text-sm font-medium rounded-lg hover:bg-zinc-800 whitespace-nowrap shrink-0 cursor-pointer"
                  >
                    Buka Album
                  </button>
                </div>
                <p className="text-[11px] text-zinc-500 mt-2">
                  Masukkan <span className="font-mono text-[#141414]">PAMERAN-XII-IPA-5</span> atau{' '}
                  <span className="font-medium text-[#141414]">Pameran XII IPA 5</span>.
                </p>
              </div>
              {scanMessage && <p className="text-xs text-amber-700">{scanMessage}</p>}
            </form>
          )}

          {mode === 'tutorial' && (
            <div className="space-y-6">
              {/* 4 Editorial Steps */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="font-editorial text-xl font-bold text-[#141414]">
                    4 Langkah Membuka Foto via Scan Barcode
                  </h3>
                  <span className="text-xs text-zinc-500 tabular-nums">1–2 menit</span>
                </div>

                <div className="divide-y divide-zinc-200/80 border border-zinc-200 rounded-xl bg-[#FAFAF9]">
                  <div className="p-4 flex items-start gap-3.5">
                    <span className="font-mono text-xs font-semibold text-[#9B7334] pt-0.5 tabular-nums shrink-0">
                      01.
                    </span>
                    <div className="space-y-1">
                      <p className="text-sm font-semibold text-[#141414]">
                        Temukan Kartu Barcode / QR Code Pameran
                      </p>
                      <p className="text-xs text-zinc-600 leading-relaxed">
                        Siapkan QR Code <span className="font-medium text-[#141414]">Pameran XII IPA 5</span> yang tercetak di meja undangan, stand pameran, atau simpan gambarnya dari tab <span className="font-medium text-[#141414]">Kartu QR Acara</span>.
                      </p>
                    </div>
                  </div>

                  <div className="p-4 flex items-start gap-3.5">
                    <span className="font-mono text-xs font-semibold text-[#9B7334] pt-0.5 tabular-nums shrink-0">
                      02.
                    </span>
                    <div className="space-y-2 w-full">
                      <p className="text-sm font-semibold text-[#141414]">
                        Pilih Salah Satu dari 3 Cara Pemindaian
                      </p>
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 pt-1">
                        <button
                          type="button"
                          onClick={() => setMode('camera')}
                          className="text-left p-3 rounded-lg bg-white border border-zinc-200 hover:border-[#B48327] transition-colors cursor-pointer"
                        >
                          <div className="flex items-center gap-1.5 text-xs font-semibold text-[#141414]">
                            <Smartphone className="w-3.5 h-3.5 text-[#9B7334]" />
                            <span>Kamera Langsung</span>
                          </div>
                          <p className="text-[11px] text-zinc-500 mt-1 leading-relaxed">
                            Izinkan kamera, lalu arahkan kotak bidik emas ke QR hingga terbaca otomatis.
                          </p>
                        </button>

                        <button
                          type="button"
                          onClick={() => setMode('camera')}
                          className="text-left p-3 rounded-lg bg-white border border-zinc-200 hover:border-[#B48327] transition-colors cursor-pointer"
                        >
                          <div className="flex items-center gap-1.5 text-xs font-semibold text-[#141414]">
                            <ImageIcon className="w-3.5 h-3.5 text-[#9B7334]" />
                            <span>Unggah Gambar QR</span>
                          </div>
                          <p className="text-[11px] text-zinc-500 mt-1 leading-relaxed">
                            Pilih foto atau screenshot barcode dari galeri HP/laptop Anda.
                          </p>
                        </button>

                        <button
                          type="button"
                          onClick={() => setMode('manual')}
                          className="text-left p-3 rounded-lg bg-white border border-zinc-200 hover:border-[#B48327] transition-colors cursor-pointer"
                        >
                          <div className="flex items-center gap-1.5 text-xs font-semibold text-[#141414]">
                            <Keyboard className="w-3.5 h-3.5 text-[#9B7334]" />
                            <span>Input Kode Manual</span>
                          </div>
                          <p className="text-[11px] text-zinc-500 mt-1 leading-relaxed">
                            Ketik kode <span className="font-mono text-[#141414]">PAMERAN-XII-IPA-5</span> jika QR buram.
                          </p>
                        </button>
                      </div>
                    </div>
                  </div>

                  <div className="p-4 flex items-start gap-3.5">
                    <span className="font-mono text-xs font-semibold text-[#9B7334] pt-0.5 tabular-nums shrink-0">
                      03.
                    </span>
                    <div className="space-y-1">
                      <p className="text-sm font-semibold text-[#141414]">
                        Olah Foto dengan Filter, Caption AI & Unduh ZIP
                      </p>
                      <p className="text-xs text-zinc-600 leading-relaxed">
                        Setelah album terbuka, coba filter warna (<span className="font-medium text-[#141414]">Kraton Sepia</span>, <span className="font-medium text-[#141414]">Batik Sogan</span>, <span className="font-medium text-[#141414]">Gamelan Gold</span>), salin caption rekomendasi AI, atau klik <span className="font-medium text-[#141414]">Pilih Banyak</span> untuk mengunduh banyak foto sekaligus dalam file ZIP.
                      </p>
                    </div>
                  </div>

                  <div className="p-4 flex items-start gap-3.5">
                    <span className="font-mono text-xs font-semibold text-[#9B7334] pt-0.5 tabular-nums shrink-0">
                      04.
                    </span>
                    <div className="space-y-1">
                      <p className="text-sm font-semibold text-[#141414]">
                        Hias dengan Twibbon Adat Jawa & Bagikan
                      </p>
                      <p className="text-xs text-zinc-600 leading-relaxed">
                        Tekan tombol <span className="font-medium text-[#141414]">Twibbon</span> pada foto pilihan Anda untuk menambahkan bingkai Jawa modern, lalu unduh resolusi tinggi atau bagikan langsung ke media sosial.
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Tips & Troubleshooting */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                <div className="p-4 rounded-xl border border-zinc-200 bg-white space-y-2">
                  <p className="font-semibold text-[#141414]">Tips Agar Scan Cepat Terbaca</p>
                  <ul className="space-y-1.5 text-zinc-600 leading-relaxed">
                    <li>· Jaga jarak kamera sekitar 15–25 cm dari kertas QR.</li>
                    <li>· Pastikan pencahayaan cukup dan tidak ada pantulan cahaya keras.</li>
                    <li>· Posisikan seluruh sisi QR berada tepat di dalam kotak bidik emas.</li>
                  </ul>
                </div>

                <div className="p-4 rounded-xl border border-zinc-200 bg-white space-y-2">
                  <p className="font-semibold text-[#141414]">Kendala Umum & Solusi</p>
                  <ul className="space-y-1.5 text-zinc-600 leading-relaxed">
                    <li>· <span className="font-medium text-[#141414]">Kamera ditolak:</span> Gunakan tombol Unggah Gambar QR atau Kartu QR Acara.</li>
                    <li>· <span className="font-medium text-[#141414]">Foto masih kosong:</span> Penyelenggara sedang memproses unggahan; aktifkan notifikasi push agar langsung diberi tahu.</li>
                  </ul>
                </div>
              </div>

              {/* Direct Action Footer */}
              <div className="pt-2 border-t border-zinc-200 flex flex-wrap items-center justify-between gap-3">
                <button
                  type="button"
                  onClick={() => setMode('cards')}
                  className="px-4 py-2 border border-zinc-300 text-[#141414] text-xs font-medium rounded-lg hover:border-[#B48327] transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                >
                  Lihat Kartu QR Acara
                </button>
                <button
                  type="button"
                  onClick={() => setMode('camera')}
                  className="inline-flex items-center gap-2 px-4 py-2 bg-[#141414] text-white text-xs font-semibold rounded-lg hover:bg-zinc-800 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                >
                  <Camera className="w-3.5 h-3.5 text-[#D4AF5A]" />
                  <span>Coba Scan Kamera Sekarang</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
