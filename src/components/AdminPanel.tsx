import React, { useEffect, useState } from 'react';
import {
  Lock,
  UploadCloud,
  Check,
  Eye,
  EyeOff,
  Star,
  Trash2,
  KeyRound,
  Bell,
  LogOut,
  Plus,
  Loader2,
  QrCode,
  BarChart3,
} from 'lucide-react';
import { AccessKey, EventAlbum, PhotoItem } from '../types';
import { AnalyticsDashboard } from './AnalyticsDashboard';

interface AdminPanelProps {
  events: EventAlbum[];
  onRefreshData: () => Promise<void>;
}

export const AdminPanel: React.FC<AdminPanelProps> = ({ events, onRefreshData }) => {
  const [token, setToken] = useState<string | null>(() =>
    localStorage.getItem('xii_ipa5_admin_token')
  );
  const [sessionInfo, setSessionInfo] = useState<{
    role: string;
    label: string;
    eventCode: string;
  } | null>(null);

  const [passcode, setPasscode] = useState('');
  const [authError, setAuthError] = useState<string | null>(null);
  const [authLoading, setAuthLoading] = useState(false);

  const [subTab, setSubTab] = useState<'upload' | 'curate' | 'access' | 'analytics'>('upload');
  const [allPhotos, setAllPhotos] = useState<PhotoItem[]>([]);
  const [accessKeys, setAccessKeys] = useState<AccessKey[]>([]);

  // Upload Form State
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [uploadEventCode, setUploadEventCode] = useState(events[0]?.code || 'PAMERAN-XII-IPA-5');
  const [uploadCategory, setUploadCategory] = useState('Potret Tamu');
  const [uploadTitle, setUploadTitle] = useState('');
  const [autoCaption, setAutoCaption] = useState(true);
  const [autoPublish, setAutoPublish] = useState(true);
  const [sendPush, setSendPush] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [uploadFeedback, setUploadFeedback] = useState<string | null>(null);

  // Access Key & New Event State
  const [newKeyLabel, setNewKeyLabel] = useState('');
  const [newKeyCode, setNewKeyCode] = useState('');
  const [newEventCode, setNewEventCode] = useState('');
  const [newEventName, setNewEventName] = useState('');
  const [pushTitle, setPushTitle] = useState('');
  const [pushMessage, setPushMessage] = useState('');

  const loadAdminResources = async (activeToken: string) => {
    try {
      const [meRes, photosRes, keysRes] = await Promise.all([
        fetch('/api/admin/me', { headers: { Authorization: `Bearer ${activeToken}` } }),
        fetch('/api/photos?includeHidden=true&eventCode=ALL', {
          headers: { Authorization: `Bearer ${activeToken}` },
        }),
        fetch('/api/admin/access-keys', { headers: { Authorization: `Bearer ${activeToken}` } }),
      ]);

      if (!meRes.ok) {
        localStorage.removeItem('xii_ipa5_admin_token');
        setToken(null);
        setSessionInfo(null);
        return;
      }

      const meData = await meRes.json();
      setSessionInfo(meData);
      if (photosRes.ok) setAllPhotos(await photosRes.json());
      if (keysRes.ok) setAccessKeys(await keysRes.json());
    } catch {
      // ignore transient error
    }
  };

  useEffect(() => {
    if (token) {
      loadAdminResources(token);
    }
  }, [token]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthLoading(true);
    setAuthError(null);
    try {
      const res = await fetch('/api/admin/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ passcode }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Kode akses ditolak.');
      localStorage.setItem('xii_ipa5_admin_token', data.token);
      setToken(data.token);
      setPasscode('');
    } catch (err) {
      setAuthError(err instanceof Error ? err.message : 'Gagal masuk.');
    } finally {
      setAuthLoading(false);
    }
  };

  const handleLogout = async () => {
    if (token) {
      await fetch('/api/admin/logout', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
    }
    localStorage.removeItem('xii_ipa5_admin_token');
    setToken(null);
    setSessionInfo(null);
  };

  const handleUploadSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token || selectedFiles.length === 0) return;
    setUploading(true);
    setUploadFeedback(null);
    try {
      const fd = new FormData();
      selectedFiles.forEach((f) => fd.append('photos', f));
      fd.append('eventCode', uploadEventCode);
      fd.append('category', uploadCategory);
      fd.append('title', uploadTitle);
      fd.append('autoCaption', String(autoCaption));
      fd.append('autoPublish', String(autoPublish));
      fd.append('sendPush', String(sendPush));

      const res = await fetch('/api/admin/upload', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: fd,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Gagal mengunggah foto.');
      setSelectedFiles([]);
      setUploadTitle('');
      setUploadFeedback(
        `${data.photos.length} foto berhasil diunggah${sendPush && autoPublish ? ' dan notifikasi push terkirim ke peserta.' : '.'}`
      );
      await loadAdminResources(token);
      await onRefreshData();
    } catch (err) {
      setUploadFeedback(err instanceof Error ? err.message : 'Upload gagal.');
    } finally {
      setUploading(false);
    }
  };

  const handleUpdatePhoto = async (
    id: string,
    patch: Partial<{ status: string; featured: boolean }>
  ) => {
    if (!token) return;
    await fetch(`/api/admin/photos/${id}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(patch),
    });
    await loadAdminResources(token);
    await onRefreshData();
  };

  const handleDeletePhoto = async (id: string) => {
    if (!token) return;
    await fetch(`/api/admin/photos/${id}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` },
    });
    await loadAdminResources(token);
    await onRefreshData();
  };

  const handleCreateAccessKey = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token || !newKeyLabel || !newKeyCode) return;
    const res = await fetch('/api/admin/access-keys', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        label: newKeyLabel,
        code: newKeyCode,
        eventCode: uploadEventCode,
      }),
    });
    if (res.ok) {
      setNewKeyLabel('');
      setNewKeyCode('');
      await loadAdminResources(token);
    }
  };

  const handleToggleKey = async (key: AccessKey) => {
    if (!token) return;
    await fetch(`/api/admin/access-keys/${key.id}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ active: !key.active }),
    });
    await loadAdminResources(token);
  };

  const handleToggleCoPhotographerPolicy = async (evt: EventAlbum) => {
    if (!token) return;
    await fetch(`/api/admin/events/${evt.code}/upload-policy`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ allowCoPhotographerUpload: !evt.allowCoPhotographerUpload }),
    });
    await onRefreshData();
  };

  const handleCreateEvent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token || !newEventCode || !newEventName) return;
    const res = await fetch('/api/events', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ code: newEventCode, name: newEventName }),
    });
    if (res.ok) {
      setNewEventCode('');
      setNewEventName('');
      await onRefreshData();
    }
  };

  const handleSendManualPush = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token || !pushTitle || !pushMessage) return;
    const res = await fetch('/api/admin/notify', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        title: pushTitle,
        message: pushMessage,
        eventCode: uploadEventCode,
      }),
    });
    if (res.ok) {
      setPushTitle('');
      setPushMessage('');
    }
  };

  if (!token || !sessionInfo) {
    return (
      <div className="max-w-lg mx-auto px-4 py-16">
        <div className="bg-white border border-zinc-200 rounded-2xl p-8 space-y-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#FAF7F0] border border-[#E6DFCF] flex items-center justify-center">
              <Lock className="w-5 h-5 text-[#9B7334]" />
            </div>
            <div>
              <h1 className="font-editorial text-2xl font-bold text-[#141414]">
                Panel Admin Penyelenggara
              </h1>
              <p className="text-xs text-zinc-500">
                Hanya penyelenggara & fotografer terotorisasi yang dapat mengunggah atau mengkurasi foto
              </p>
            </div>
          </div>

          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-zinc-700 mb-1.5">
                Kode Akses Penyelenggara / Fotografer
              </label>
              <input
                type="password"
                value={passcode}
                onChange={(e) => setPasscode(e.target.value)}
                placeholder="Masukkan kode akses..."
                className="w-full px-3.5 py-2.5 text-sm font-mono border border-zinc-300 rounded-lg focus:outline-none focus:border-[#B48327]"
              />
            </div>

            {authError && (
              <p className="text-xs text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                {authError}
              </p>
            )}

            <button
              type="submit"
              disabled={authLoading}
              className="w-full py-2.5 bg-[#141414] text-white text-sm font-semibold rounded-lg hover:bg-zinc-800 transition-colors cursor-pointer"
            >
              {authLoading ? 'Memverifikasi...' : 'Masuk ke Panel Kurasi'}
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-[1360px] mx-auto px-4 sm:px-8 py-8 sm:py-10 space-y-8">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-zinc-200 pb-6">
        <div>
          <p className="text-xs font-mono text-[#9B7334]">
            {sessionInfo.role === 'organizer' ? 'PENYELENGGARA UTAMA' : 'FOTOGRAFER TEROTORISASI'} ·{' '}
            {sessionInfo.label}
          </p>
          <h1 className="font-editorial text-3xl sm:text-4xl font-bold text-[#141414] mt-1">
            Kurasi Galeri & Manajemen Akses Upload
          </h1>
        </div>
        <button
          type="button"
          onClick={handleLogout}
          className="inline-flex items-center gap-2 px-4 py-2 border border-zinc-300 bg-white rounded-lg text-xs font-medium text-zinc-700 hover:text-[#141414] cursor-pointer self-start sm:self-auto"
        >
          <LogOut className="w-3.5 h-3.5" />
          <span>Keluar Sesi Admin</span>
        </button>
      </div>

      {/* Sub-Tabs */}
      <div className="flex items-center gap-2 border-b border-zinc-200 pb-3 overflow-x-auto">
        <button
          type="button"
          onClick={() => setSubTab('upload')}
          className={`px-4 py-2 text-xs font-semibold rounded-lg whitespace-nowrap cursor-pointer ${
            subTab === 'upload' ? 'bg-[#141414] text-white' : 'bg-white border border-zinc-200 text-zinc-700'
          }`}
        >
          Unggah Foto & Siarkan
        </button>
        <button
          type="button"
          onClick={() => setSubTab('curate')}
          className={`px-4 py-2 text-xs font-semibold rounded-lg whitespace-nowrap cursor-pointer ${
            subTab === 'curate' ? 'bg-[#141414] text-white' : 'bg-white border border-zinc-200 text-zinc-700'
          }`}
        >
          Kurasi Gambar ({allPhotos.length})
        </button>
        <button
          type="button"
          onClick={() => setSubTab('access')}
          className={`px-4 py-2 text-xs font-semibold rounded-lg whitespace-nowrap shrink-0 cursor-pointer ${
            subTab === 'access' ? 'bg-[#141414] text-white' : 'bg-white border border-zinc-200 text-zinc-700'
          }`}
        >
          Akses Upload, Barcode & Push
        </button>
        <button
          type="button"
          onClick={() => setSubTab('analytics')}
          className={`inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold rounded-lg whitespace-nowrap shrink-0 cursor-pointer ${
            subTab === 'analytics' ? 'bg-[#141414] text-white' : 'bg-white border border-zinc-200 text-zinc-700'
          }`}
        >
          <BarChart3 className="w-3.5 h-3.5" />
          <span>Analitik & Laporan</span>
        </button>
      </div>

      {/* Tab 1: Upload */}
      {subTab === 'upload' && (
        <form
          onSubmit={handleUploadSubmit}
          className="bg-white border border-zinc-200 rounded-2xl p-6 sm:p-8 max-w-3xl space-y-6"
        >
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-zinc-700 mb-1.5">
                Album Barcode Acara
              </label>
              <select
                value={uploadEventCode}
                onChange={(e) => setUploadEventCode(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-zinc-300 rounded-lg focus:outline-none focus:border-[#B48327]"
              >
                {events.map((evt) => (
                  <option key={evt.code} value={evt.code}>
                    {evt.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-zinc-700 mb-1.5">
                Kategori Momen
              </label>
              <select
                value={uploadCategory}
                onChange={(e) => setUploadCategory(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-zinc-300 rounded-lg focus:outline-none focus:border-[#B48327]"
              >
                <option value="Pembukaan">Pembukaan</option>
                <option value="Panggung & Gamelan">Panggung & Gamelan</option>
                <option value="Potret Tamu">Potret Tamu</option>
                <option value="Momen Candid">Momen Candid</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-zinc-700 mb-1.5">
              Judul Foto (Opsional — otomatis dari nama berkas jika kosong)
            </label>
            <input
              type="text"
              value={uploadTitle}
              onChange={(e) => setUploadTitle(e.target.value)}
              placeholder="Contoh: Prosesi Kirab Pendopo"
              className="w-full px-3.5 py-2 text-sm border border-zinc-300 rounded-lg focus:outline-none focus:border-[#B48327]"
            />
          </div>

          <label className="block border-2 border-dashed border-zinc-300 hover:border-[#B48327] rounded-2xl p-8 text-center cursor-pointer transition-colors bg-[#FAFAF9]">
            <UploadCloud className="w-8 h-8 mx-auto text-[#9B7334] mb-2" />
            <p className="text-sm font-medium text-[#141414]">
              {selectedFiles.length > 0
                ? `${selectedFiles.length} foto siap diunggah`
                : 'Klik atau tarik file foto acara ke sini (JPG / PNG)'}
            </p>
            <p className="text-xs text-zinc-500 mt-1">Maksimal 12 file sekaligus · Resolusi penuh</p>
            <input
              type="file"
              accept="image/*"
              multiple
              onChange={(e) => setSelectedFiles(Array.from(e.target.files || []))}
              className="hidden"
            />
          </label>

          <div className="space-y-2.5 text-xs text-zinc-700">
            <label className="flex items-center gap-2.5 cursor-pointer">
              <input
                type="checkbox"
                checked={autoCaption}
                onChange={(e) => setAutoCaption(e.target.checked)}
                className="accent-[#141414]"
              />
              <span>Buat 3 opsi caption media sosial secara otomatis dengan Gemini AI</span>
            </label>
            <label className="flex items-center gap-2.5 cursor-pointer">
              <input
                type="checkbox"
                checked={autoPublish}
                onChange={(e) => setAutoPublish(e.target.checked)}
                className="accent-[#141414]"
              />
              <span>Langsung publikasikan ke galeri peserta (lewati antrean kurasi)</span>
            </label>
            <label className="flex items-center gap-2.5 cursor-pointer">
              <input
                type="checkbox"
                checked={sendPush}
                onChange={(e) => setSendPush(e.target.checked)}
                className="accent-[#141414]"
              />
              <span>Kirim notifikasi push langsung ke semua peserta yang terhubung</span>
            </label>
          </div>

          {uploadFeedback && (
            <p className="text-xs text-[#825F2A] bg-[#FAF7F0] border border-[#E5D9BF] rounded-lg px-3.5 py-2.5">
              {uploadFeedback}
            </p>
          )}

          <button
            type="submit"
            disabled={uploading || selectedFiles.length === 0}
            className="inline-flex items-center gap-2 px-6 py-2.5 bg-[#141414] text-white text-sm font-semibold rounded-lg hover:bg-zinc-800 disabled:opacity-40 cursor-pointer"
          >
            {uploading && <Loader2 className="w-4 h-4 animate-spin" />}
            <span>{uploading ? 'Mengunggah & Memproses...' : 'Unggah ke Galeri Acara'}</span>
          </button>
        </form>
      )}

      {/* Tab 2: Curate Photos */}
      {subTab === 'curate' && (
        <div className="bg-white border border-zinc-200 rounded-2xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-[#FAFAF9] border-b border-zinc-200 text-zinc-500 font-medium">
                <tr>
                  <th className="px-4 py-3">Foto</th>
                  <th className="px-4 py-3">Judul & Acara</th>
                  <th className="px-4 py-3">Status Kurasi</th>
                  <th className="px-4 py-3 text-right">Unduhan / Bagikan</th>
                  <th className="px-4 py-3 text-right">Aksi Kurator</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100">
                {allPhotos.map((p) => (
                  <tr key={p.id} className="hover:bg-zinc-50/70">
                    <td className="px-4 py-3">
                      <img
                        src={p.url}
                        alt={p.title}
                        referrerPolicy="no-referrer"
                        className="w-14 h-11 object-cover rounded-md border border-zinc-200"
                      />
                    </td>
                    <td className="px-4 py-3">
                      <p className="font-semibold text-[#141414]">{p.title}</p>
                      <p className="text-zinc-500 mt-0.5">
                        {p.eventCode} · {p.category} · {p.photographer}
                      </p>
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`font-medium ${
                          p.status === 'published'
                            ? 'text-emerald-700'
                            : p.status === 'curated'
                            ? 'text-amber-700'
                            : 'text-zinc-500'
                        }`}
                      >
                        {p.status === 'published'
                          ? 'Terpublikasi'
                          : p.status === 'curated'
                          ? 'Menunggu Kurasi'
                          : 'Disembunyikan'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right font-mono tabular-nums text-zinc-700">
                      {p.downloads} / {p.shares}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="inline-flex items-center gap-1.5">
                        <button
                          type="button"
                          title={p.status === 'published' ? 'Sembunyikan' : 'Publikasikan'}
                          onClick={() =>
                            handleUpdatePhoto(p.id, {
                              status: p.status === 'published' ? 'hidden' : 'published',
                            })
                          }
                          className="p-1.5 border border-zinc-200 rounded-md hover:bg-zinc-100 cursor-pointer"
                        >
                          {p.status === 'published' ? (
                            <EyeOff className="w-3.5 h-3.5 text-zinc-600" />
                          ) : (
                            <Eye className="w-3.5 h-3.5 text-emerald-700" />
                          )}
                        </button>
                        <button
                          type="button"
                          title="Jadikan Sorotan Utama"
                          onClick={() => handleUpdatePhoto(p.id, { featured: !p.featured })}
                          className={`p-1.5 border rounded-md cursor-pointer ${
                            p.featured
                              ? 'border-[#B48327] bg-[#FAF7F0] text-[#B48327]'
                              : 'border-zinc-200 text-zinc-500 hover:bg-zinc-100'
                          }`}
                        >
                          <Star className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          title="Hapus Foto"
                          onClick={() => handleDeletePhoto(p.id)}
                          className="p-1.5 border border-zinc-200 rounded-md text-red-600 hover:bg-red-50 cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Tab 3: Access Keys, Event Barcodes & Manual Push */}
      {subTab === 'access' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Access Keys Management */}
          <div className="bg-white border border-zinc-200 rounded-2xl p-6 space-y-5">
            <div className="flex items-center gap-2">
              <KeyRound className="w-4 h-4 text-[#9B7334]" />
              <h2 className="text-base font-semibold text-[#141414]">
                Kelola Akses Upload Fotografer
              </h2>
            </div>

            <div className="space-y-2.5">
              {accessKeys.map((k) => (
                <div
                  key={k.id}
                  className="p-3.5 border border-zinc-200 rounded-xl flex items-center justify-between gap-3"
                >
                  <div>
                    <p className="text-sm font-medium text-[#141414]">{k.label}</p>
                    <p className="text-xs font-mono text-zinc-500 mt-0.5">
                      Kode: {k.code} · Acara: {k.eventCode}
                    </p>
                  </div>
                  {k.role === 'photographer' && sessionInfo.role === 'organizer' && (
                    <button
                      type="button"
                      onClick={() => handleToggleKey(k)}
                      className={`px-3 py-1.5 text-xs font-medium rounded-md border cursor-pointer ${
                        k.active
                          ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                          : 'bg-zinc-100 text-zinc-500 border-zinc-200'
                      }`}
                    >
                      {k.active ? 'Aktif' : 'Nonaktif'}
                    </button>
                  )}
                </div>
              ))}
            </div>

            {sessionInfo.role === 'organizer' && (
              <form onSubmit={handleCreateAccessKey} className="pt-4 border-t border-zinc-100 space-y-3">
                <p className="text-xs font-semibold text-zinc-700">Tambah Kunci Fotografer Baru</p>
                <div className="grid grid-cols-2 gap-2.5">
                  <input
                    type="text"
                    value={newKeyLabel}
                    onChange={(e) => setNewKeyLabel(e.target.value)}
                    placeholder="Nama Fotografer"
                    className="px-3 py-2 text-xs border border-zinc-300 rounded-lg"
                  />
                  <input
                    type="text"
                    value={newKeyCode}
                    onChange={(e) => setNewKeyCode(e.target.value)}
                    placeholder="Kode (cth: LENSA-SARI)"
                    className="px-3 py-2 text-xs font-mono uppercase border border-zinc-300 rounded-lg"
                  />
                </div>
                <button
                  type="submit"
                  className="inline-flex items-center gap-1.5 px-4 py-2 bg-[#141414] text-white text-xs font-medium rounded-lg cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Terbitkan Akses</span>
                </button>
              </form>
            )}
          </div>

          {/* Event Barcode Policy + Manual Push Notification */}
          <div className="space-y-6">
            <div className="bg-white border border-zinc-200 rounded-2xl p-6 space-y-4">
              <div className="flex items-center gap-2">
                <QrCode className="w-4 h-4 text-[#9B7334]" />
                <h2 className="text-base font-semibold text-[#141414]">
                  Kebijakan Upload & Barcode Acara
                </h2>
              </div>

              <div className="space-y-2.5">
                {events.map((evt) => (
                  <div
                    key={evt.code}
                    className="p-3 border border-zinc-200 rounded-xl flex items-center justify-between gap-3"
                  >
                    <div>
                      <p className="text-sm font-semibold text-[#141414]">{evt.name}</p>
                      <p className="text-xs text-zinc-500">{evt.subtitle}</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleToggleCoPhotographerPolicy(evt)}
                      className={`px-3 py-1.5 text-xs font-medium rounded-md border cursor-pointer ${
                        evt.allowCoPhotographerUpload
                          ? 'bg-[#FAF7F0] text-[#825F2A] border-[#DFD5BE]'
                          : 'bg-zinc-100 text-zinc-600 border-zinc-200'
                      }`}
                    >
                      {evt.allowCoPhotographerUpload ? 'Upload Tim Terbuka' : 'Terkunci (Admin Only)'}
                    </button>
                  </div>
                ))}
              </div>

              <form onSubmit={handleCreateEvent} className="pt-3 border-t border-zinc-100 flex gap-2">
                <input
                  type="text"
                  value={newEventCode}
                  onChange={(e) => setNewEventCode(e.target.value)}
                  placeholder="Kode (cth: WDG-26)"
                  className="w-32 px-3 py-2 text-xs font-mono uppercase border border-zinc-300 rounded-lg"
                />
                <input
                  type="text"
                  value={newEventName}
                  onChange={(e) => setNewEventName(e.target.value)}
                  placeholder="Nama Acara Baru"
                  className="flex-1 px-3 py-2 text-xs border border-zinc-300 rounded-lg"
                />
                <button
                  type="submit"
                  className="px-3.5 py-2 bg-[#141414] text-white text-xs font-medium rounded-lg cursor-pointer"
                >
                  Buat QR
                </button>
              </form>
            </div>

            <form
              onSubmit={handleSendManualPush}
              className="bg-white border border-zinc-200 rounded-2xl p-6 space-y-3"
            >
              <div className="flex items-center gap-2">
                <Bell className="w-4 h-4 text-[#9B7334]" />
                <h2 className="text-base font-semibold text-[#141414]">
                  Kirim Notifikasi Push ke Peserta
                </h2>
              </div>
              <input
                type="text"
                value={pushTitle}
                onChange={(e) => setPushTitle(e.target.value)}
                placeholder="Judul pemberitahuan (cth: Foto Sesi Resepsi Sudah Tayang!)"
                className="w-full px-3 py-2 text-xs border border-zinc-300 rounded-lg"
              />
              <textarea
                rows={2}
                value={pushMessage}
                onChange={(e) => setPushMessage(e.target.value)}
                placeholder="Isi pesan singkat untuk tamu acara..."
                className="w-full px-3 py-2 text-xs border border-zinc-300 rounded-lg"
              />
              <button
                type="submit"
                className="inline-flex items-center gap-1.5 px-4 py-2 bg-[#141414] text-white text-xs font-medium rounded-lg cursor-pointer"
              >
                <Check className="w-3.5 h-3.5 text-[#D4AF5A]" />
                <span>Siarkan Notifikasi Sekarang</span>
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Tab 4: Admin-Only Analytics Dashboard */}
      {subTab === 'analytics' && <AnalyticsDashboard adminToken={token} embedded />}
    </div>
  );
};
