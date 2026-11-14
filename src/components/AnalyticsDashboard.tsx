import React, { useEffect, useState } from 'react';
import { Download, RefreshCw } from 'lucide-react';
import { AnalyticsSummary } from '../types';
import { PHOTO_FILTERS, TWIBBON_THEMES } from '../utils/filtersAndTwibbons';

interface AnalyticsDashboardProps {
  adminToken: string;
  embedded?: boolean;
}

export const AnalyticsDashboard: React.FC<AnalyticsDashboardProps> = ({
  adminToken,
  embedded = false,
}) => {
  const [data, setData] = useState<AnalyticsSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadSummary = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/analytics/summary', {
        headers: { Authorization: `Bearer ${adminToken}` },
      });
      if (!res.ok) {
        throw new Error('Gagal memuat data analitik admin.');
      }
      setData(await res.json());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Gagal memuat data analitik.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadSummary();
  }, [adminToken]);

  const handleExportCsv = () => {
    if (!data) return;
    const rows = [
      ['Judul Foto', 'Kode Acara', 'Kategori', 'Unduhan', 'Dibagikan', 'Penggunaan Twibbon', 'Dilihat'],
      ...data.topPhotos.map((p) => [
        `"${p.title.replace(/"/g, '""')}"`,
        p.eventCode,
        p.category,
        String(p.downloads),
        String(p.shares),
        String(p.twibbonUses),
        String(p.views),
      ]),
    ];
    const csv = rows.map((r) => r.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `xii-ipa-5-analitik-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const wrapperClass = embedded
    ? 'space-y-8'
    : 'max-w-[1360px] mx-auto px-4 sm:px-8 py-8 sm:py-10 space-y-8';

  if (loading && !data) {
    return (
      <div className={wrapperClass}>
        <div className="h-8 w-64 bg-zinc-200 rounded animate-pulse" />
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-24 bg-white border border-zinc-200 rounded-xl animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  if (error && !data) {
    return (
      <div className={wrapperClass}>
        <div className="bg-white border border-zinc-200 rounded-2xl p-6 text-xs text-red-700">
          {error}
        </div>
      </div>
    );
  }

  if (!data) return null;

  const maxTrendVal = Math.max(
    1,
    ...data.trends.map((t) => Math.max(t.downloads, t.shares, t.scans, t.twibbons))
  );

  const shareTotal = Math.max(
    1,
    Object.values(data.sharePlatforms).reduce((a, b) => a + b, 0)
  );
  const twibbonTotal = Math.max(
    1,
    Object.values(data.twibbonUsage).reduce((a, b) => a + b, 0)
  );
  const filterTotal = Math.max(
    1,
    Object.values(data.filterUsage).reduce((a, b) => a + b, 0)
  );

  return (
    <div className={wrapperClass}>
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 border-b border-zinc-200 pb-6">
        <div>
          <p className="text-xs font-mono text-[#9B7334]">LAPORAN INTERAKSI REAL-TIME</p>
          <h1 className="font-editorial text-3xl sm:text-4xl font-bold text-[#141414] mt-1">
            Dashboard Analitik Unduhan & Partisipasi
          </h1>
          <p className="text-sm text-zinc-600 mt-1">
            Pantau jumlah unduhan foto, sebaran berbagi ke media sosial, pemindaian barcode, dan popularitas Twibbon Jawa.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={loadSummary}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 border border-zinc-300 bg-white rounded-lg text-xs font-medium text-zinc-700 hover:text-[#141414] cursor-pointer"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Segarkan</span>
          </button>
          <button
            type="button"
            onClick={handleExportCsv}
            className="inline-flex items-center gap-1.5 px-4 py-2 bg-[#141414] text-white rounded-lg text-xs font-semibold hover:bg-zinc-800 cursor-pointer"
          >
            <Download className="w-3.5 h-3.5 text-[#D4AF5A]" />
            <span>Unduh CSV</span>
          </button>
        </div>
      </div>

      {/* KPI Row */}
      <div className="grid grid-cols-2 lg:grid-cols-6 gap-4">
        <div className="bg-white border border-zinc-200 rounded-xl p-4">
          <p className="text-xs text-zinc-500">Total Unduhan</p>
          <p className="font-mono text-2xl font-semibold text-[#141414] tabular-nums mt-1">
            {data.totals.downloads}
          </p>
        </div>
        <div className="bg-white border border-zinc-200 rounded-xl p-4">
          <p className="text-xs text-zinc-500">Bagikan Medsos</p>
          <p className="font-mono text-2xl font-semibold text-[#141414] tabular-nums mt-1">
            {data.totals.shares}
          </p>
        </div>
        <div className="bg-white border border-zinc-200 rounded-xl p-4">
          <p className="text-xs text-zinc-500">Scan Barcode</p>
          <p className="font-mono text-2xl font-semibold text-[#141414] tabular-nums mt-1">
            {data.totals.barcodeScans}
          </p>
        </div>
        <div className="bg-white border border-zinc-200 rounded-xl p-4">
          <p className="text-xs text-zinc-500">Unduh Twibbon</p>
          <p className="font-mono text-2xl font-semibold text-[#141414] tabular-nums mt-1">
            {data.totals.twibbonDownloads}
          </p>
        </div>
        <div className="bg-white border border-zinc-200 rounded-xl p-4">
          <p className="text-xs text-zinc-500">Caption AI Dibuat</p>
          <p className="font-mono text-2xl font-semibold text-[#141414] tabular-nums mt-1">
            {data.totals.aiCaptionsGenerated}
          </p>
        </div>
        <div className="bg-white border border-zinc-200 rounded-xl p-4">
          <p className="text-xs text-zinc-500">Tayangan Foto</p>
          <p className="font-mono text-2xl font-semibold text-[#141414] tabular-nums mt-1">
            {data.totals.views}
          </p>
        </div>
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Time Series Bar Chart */}
        <div className="lg:col-span-7 bg-white border border-zinc-200 rounded-2xl p-6 space-y-5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-base font-semibold text-[#141414]">
              Tren Unduhan & Interaksi Harian
            </h2>
            <div className="flex items-center gap-4 text-[11px] text-zinc-600">
              <span className="inline-flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-sm bg-[#141414]" /> Unduhan
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-sm bg-[#B48327]" /> Bagikan
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-sm bg-zinc-400" /> Twibbon
              </span>
            </div>
          </div>

          <div className="h-56 flex items-end justify-between gap-4 pt-4 border-b border-zinc-200 pb-2">
            {data.trends.map((pt) => (
              <div key={pt.label} className="flex-1 flex flex-col items-center gap-2 h-full justify-end">
                <div className="w-full flex items-end justify-center gap-1.5 h-44">
                  <div
                    className="w-3.5 sm:w-4 bg-[#141414] rounded-t-sm transition-all"
                    style={{ height: `${Math.max(8, (pt.downloads / maxTrendVal) * 100)}%` }}
                    title={`Unduhan: ${pt.downloads}`}
                  />
                  <div
                    className="w-3.5 sm:w-4 bg-[#B48327] rounded-t-sm transition-all"
                    style={{ height: `${Math.max(8, (pt.shares / maxTrendVal) * 100)}%` }}
                    title={`Bagikan: ${pt.shares}`}
                  />
                  <div
                    className="w-3.5 sm:w-4 bg-zinc-400 rounded-t-sm transition-all"
                    style={{ height: `${Math.max(8, (pt.twibbons / maxTrendVal) * 100)}%` }}
                    title={`Twibbon: ${pt.twibbons}`}
                  />
                </div>
                <span className="font-mono text-[11px] text-zinc-500 tabular-nums">{pt.label}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Share Platform & Twibbon Popularity */}
        <div className="lg:col-span-5 bg-white border border-zinc-200 rounded-2xl p-6 space-y-6">
          <div>
            <h2 className="text-base font-semibold text-[#141414] mb-3">
              Distribusi Media Sosial
            </h2>
            <div className="space-y-2.5">
              {Object.entries(data.sharePlatforms).map(([platform, count]) => (
                <div key={platform} className="space-y-1">
                  <div className="flex justify-between text-xs">
                    <span className="capitalize font-medium text-zinc-700">{platform}</span>
                    <span className="font-mono tabular-nums text-zinc-600">{count}</span>
                  </div>
                  <div className="h-1.5 bg-zinc-100 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-[#141414] rounded-full"
                      style={{ width: `${Math.round((count / shareTotal) * 100)}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="pt-4 border-t border-zinc-100">
            <h2 className="text-base font-semibold text-[#141414] mb-3">
              Twibbon Jawa Terfavorit
            </h2>
            <div className="space-y-2.5">
              {TWIBBON_THEMES.map((t) => {
                const count = data.twibbonUsage[t.id] || 0;
                return (
                  <div key={t.id} className="space-y-1">
                    <div className="flex justify-between text-xs">
                      <span className="font-medium text-zinc-700">{t.name}</span>
                      <span className="font-mono tabular-nums text-zinc-600">{count}</span>
                    </div>
                    <div className="h-1.5 bg-zinc-100 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-[#B48327] rounded-full"
                        style={{ width: `${Math.round((count / twibbonTotal) * 100)}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* Bottom Tables: Top Photos + Filter Usage + Recent Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-7 bg-white border border-zinc-200 rounded-2xl overflow-hidden">
          <div className="px-6 py-4 border-b border-zinc-200 flex items-center justify-between">
            <h2 className="text-base font-semibold text-[#141414]">
              Foto dengan Unduhan & Interaksi Tertinggi
            </h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-[#FAFAF9] text-zinc-500 border-b border-zinc-200">
                <tr>
                  <th className="px-5 py-3">Judul Foto</th>
                  <th className="px-4 py-3 text-right">Unduhan</th>
                  <th className="px-4 py-3 text-right">Bagikan</th>
                  <th className="px-4 py-3 text-right">Twibbon</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100">
                {data.topPhotos.map((p) => (
                  <tr key={p.id}>
                    <td className="px-5 py-3">
                      <p className="font-medium text-[#141414]">{p.title}</p>
                      <p className="text-[11px] text-zinc-500">
                        {p.eventCode} · {p.category}
                      </p>
                    </td>
                    <td className="px-4 py-3 text-right font-mono tabular-nums font-medium">
                      {p.downloads}
                    </td>
                    <td className="px-4 py-3 text-right font-mono tabular-nums">{p.shares}</td>
                    <td className="px-4 py-3 text-right font-mono tabular-nums">{p.twibbonUses}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="lg:col-span-5 space-y-6">
          {/* Filter Popularity */}
          <div className="bg-white border border-zinc-200 rounded-2xl p-6 space-y-3">
            <h2 className="text-base font-semibold text-[#141414]">Popularitas Filter Foto</h2>
            <div className="grid grid-cols-2 gap-3 text-xs">
              {PHOTO_FILTERS.map((f) => {
                const cnt = data.filterUsage[f.id] || 0;
                const pct = Math.round((cnt / filterTotal) * 100);
                return (
                  <div key={f.id} className="border border-zinc-200 rounded-lg p-2.5">
                    <div className="flex items-center justify-between">
                      <span className="font-medium text-zinc-800">{f.name}</span>
                      <span className="font-mono tabular-nums text-zinc-500">{pct}%</span>
                    </div>
                    <p className="font-mono text-sm font-semibold text-[#141414] tabular-nums mt-1">
                      {cnt} kali
                    </p>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Activity Log */}
          <div className="bg-white border border-zinc-200 rounded-2xl p-6 space-y-3">
            <h2 className="text-base font-semibold text-[#141414]">Aktivitas Peserta Terbaru</h2>
            <div className="space-y-2.5 max-h-56 overflow-y-auto pr-1">
              {data.recentActivity.map((act) => (
                <div
                  key={act.id}
                  className="text-xs border-b border-zinc-100 pb-2 last:border-0 last:pb-0"
                >
                  <div className="flex items-center justify-between text-zinc-500">
                    <span className="font-mono text-[11px] text-[#9B7334]">{act.eventCode}</span>
                    <span className="font-mono tabular-nums text-[11px]">
                      {new Date(act.timestamp).toLocaleTimeString('id-ID', {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </span>
                  </div>
                  <p className="text-[#141414] font-medium mt-0.5">{act.detail}</p>
                  {act.photoTitle && <p className="text-zinc-500">{act.photoTitle}</p>}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
