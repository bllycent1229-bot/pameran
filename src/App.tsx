import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { X, ArrowRight, Bell } from 'lucide-react';
import {
  AiCaptionOption,
  EventAlbum,
  FilterId,
  NotificationItem,
  PhotoItem,
  ViewTab,
} from './types';
import { Header } from './components/Header';
import { PhotoGallery } from './components/PhotoGallery';
import { TwibbonStudio } from './components/TwibbonStudio';
import { AdminPanel } from './components/AdminPanel';
import { BarcodeScannerModal, ScannerMode } from './components/BarcodeScannerModal';
import { PhotoLightboxModal } from './components/PhotoLightboxModal';
import { GeminiChatDrawer } from './components/GeminiChatDrawer';

export default function App() {
  const [activeTab, setActiveTab] = useState<ViewTab>('gallery');
  const [events, setEvents] = useState<EventAlbum[]>([]);
  const [photos, setPhotos] = useState<PhotoItem[]>([]);
  const [activeEventCode, setActiveEventCode] = useState<string>(() => {
    const params = new URLSearchParams(window.location.search);
    return params.get('event')?.toUpperCase() || 'PAMERAN-XII-IPA-5';
  });
  const [selectedFilter, setSelectedFilter] = useState<FilterId>('original');

  const [lightboxPhoto, setLightboxPhoto] = useState<PhotoItem | null>(null);
  const [twibbonPhoto, setTwibbonPhoto] = useState<PhotoItem | null>(null);
  const [scannerOpen, setScannerOpen] = useState(false);
  const [scannerInitialMode, setScannerInitialMode] = useState<ScannerMode>('cards');
  const [chatOpen, setChatOpen] = useState(false);

  const openScannerModal = (mode: ScannerMode = 'cards') => {
    setScannerInitialMode(mode);
    setScannerOpen(true);
  };

  // Real-time push notifications (SSE + Browser Notification API)
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [notifPanelOpen, setNotifPanelOpen] = useState(false);
  const [liveToast, setLiveToast] = useState<NotificationItem | null>(null);
  const [pushEnabled, setPushEnabled] = useState<boolean>(() => {
    if (typeof window !== 'undefined' && 'Notification' in window) {
      return Notification.permission === 'granted';
    }
    return false;
  });

  const loadData = useCallback(async () => {
    try {
      const [evtRes, photoRes, notifRes] = await Promise.all([
        fetch('/api/events'),
        fetch(`/api/photos?eventCode=${encodeURIComponent(activeEventCode)}`),
        fetch('/api/notifications'),
      ]);
      if (evtRes.ok) {
        const evtData: EventAlbum[] = await evtRes.json();
        setEvents(evtData);
      }
      if (photoRes.ok) {
        const pData: PhotoItem[] = await photoRes.json();
        setPhotos(pData);
        const paramPhoto = new URLSearchParams(window.location.search).get('photo');
        if (paramPhoto) {
          const found = pData.find((p) => p.id === paramPhoto);
          if (found) setLightboxPhoto(found);
        }
      }
      if (notifRes.ok) {
        setNotifications(await notifRes.json());
      }
    } catch (err) {
      console.error('Failed to load XII IPA 5 data:', err);
    }
  }, [activeEventCode]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // SSE Push Notification Subscription
  useEffect(() => {
    const evtSource = new EventSource('/api/notifications/stream');
    evtSource.onmessage = (event) => {
      try {
        const payload = JSON.parse(event.data);
        if (payload?.type === 'connected') return;
        const notif = payload as NotificationItem;
        setNotifications((prev) => [notif, ...prev]);
        setUnreadCount((c) => c + 1);
        setLiveToast(notif);
        loadData();

        if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted') {
          new Notification(notif.title, {
            body: notif.message,
          });
        }

        setTimeout(() => {
          setLiveToast((current) => (current?.id === notif.id ? null : current));
        }, 7500);
      } catch {
        // ignore keepalive
      }
    };
    return () => {
      evtSource.close();
    };
  }, [loadData]);

  const handleEnablePushNotifications = async () => {
    if (typeof window !== 'undefined' && 'Notification' in window) {
      const perm = await Notification.requestPermission();
      setPushEnabled(perm === 'granted');
    } else {
      setPushEnabled(true);
    }
    setNotifPanelOpen(true);
  };

  const trackEvent = useCallback(
    async (payload: {
      action: string;
      photoId?: string;
      eventCode?: string;
      platform?: string;
      filterId?: string;
      twibbonId?: string;
      detail?: string;
    }) => {
      try {
        await fetch('/api/analytics/track', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
      } catch {
        // silent telemetry failure
      }
    },
    []
  );

  const handleScannedEvent = (code: string) => {
    setActiveEventCode(code);
    setActiveTab('gallery');
    const url = new URL(window.location.href);
    url.searchParams.set('event', code);
    window.history.replaceState({}, '', url.toString());
    trackEvent({
      action: 'barcode_scan',
      eventCode: code,
      detail: `Akses galeri acara ${code} via scan barcode`,
    });
  };

  const handleOpenPhoto = (photo: PhotoItem) => {
    setLightboxPhoto(photo);
    trackEvent({
      action: 'view',
      photoId: photo.id,
      eventCode: photo.eventCode,
    });
  };

  const handleSendToTwibbon = (photo: PhotoItem, filterId: FilterId) => {
    setTwibbonPhoto(photo);
    setSelectedFilter(filterId);
    setActiveTab('twibbon');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleCaptionsUpdated = (photoId: string, captions: AiCaptionOption[]) => {
    setPhotos((prev) =>
      prev.map((p) => (p.id === photoId ? { ...p, aiCaptions: captions } : p))
    );
    setLightboxPhoto((prev) =>
      prev && prev.id === photoId ? { ...prev, aiCaptions: captions } : prev
    );
  };

  const activeEvent = useMemo(
    () => events.find((e) => e.code === activeEventCode) || events[0],
    [events, activeEventCode]
  );

  return (
    <div className="min-h-screen flex flex-col bg-[#F8F8F7] text-[#141414]">
      <Header
        activeTab={activeTab}
        onSelectTab={setActiveTab}
        onOpenScanner={() => openScannerModal('cards')}
        events={events}
        activeEventCode={activeEventCode}
        onSelectEventCode={setActiveEventCode}
        unreadNotifications={unreadCount}
        pushEnabled={pushEnabled}
        onToggleNotifications={handleEnablePushNotifications}
        onOpenNotifPanel={() => {
          setNotifPanelOpen((v) => !v);
          setUnreadCount(0);
        }}
        onOpenChat={() => setChatOpen(true)}
      />

      {/* Notification Feed Drawer */}
      {notifPanelOpen && (
        <div className="fixed right-4 sm:right-8 top-32 z-40 w-80 sm:w-96 bg-white border border-zinc-200 rounded-2xl shadow-xl overflow-hidden">
          <div className="px-4 py-3 border-b border-zinc-200 flex items-center justify-between bg-[#FAFAF9]">
            <div className="flex items-center gap-2">
              <Bell className="w-4 h-4 text-[#9B7334]" />
              <span className="text-xs font-semibold text-[#141414]">Notifikasi Foto Baru</span>
            </div>
            <button
              type="button"
              onClick={() => setNotifPanelOpen(false)}
              className="p-1 text-zinc-500 hover:text-[#141414] cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
          <div className="max-h-80 overflow-y-auto divide-y divide-zinc-100">
            {notifications.length === 0 ? (
              <p className="p-4 text-xs text-zinc-500 text-center">Belum ada pemberitahuan.</p>
            ) : (
              notifications.map((n) => (
                <div
                  key={n.id}
                  onClick={() => {
                    setActiveEventCode(n.eventCode);
                    setActiveTab('gallery');
                    setNotifPanelOpen(false);
                    if (n.photoId) {
                      const matched = photos.find((p) => p.id === n.photoId);
                      if (matched) setLightboxPhoto(matched);
                    }
                  }}
                  className="p-3.5 hover:bg-zinc-50 flex items-start gap-3 cursor-pointer"
                >
                  {n.photoUrl && (
                    <img
                      src={n.photoUrl}
                      alt={n.title}
                      className="w-11 h-11 rounded-md object-cover shrink-0 border border-zinc-200"
                    />
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-semibold text-[#141414]">{n.title}</p>
                    <p className="text-xs text-zinc-600 mt-0.5 line-clamp-2">{n.message}</p>
                    <p className="text-[11px] font-mono text-zinc-400 mt-1">
                      {n.eventCode} ·{' '}
                      {new Date(n.createdAt).toLocaleTimeString('id-ID', {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </p>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* Real-time Push Notification Toast */}
      {liveToast && (
        <div className="fixed bottom-5 right-5 z-50 max-w-sm bg-[#141414] text-white border border-zinc-800 rounded-xl p-4 shadow-2xl flex items-start gap-3">
          {liveToast.photoUrl && (
            <img
              src={liveToast.photoUrl}
              alt={liveToast.title}
              className="w-12 h-12 rounded-lg object-cover shrink-0"
            />
          )}
          <div className="flex-1 min-w-0">
            <p className="text-xs font-semibold text-[#D4AF5A]">{liveToast.title}</p>
            <p className="text-xs text-zinc-200 mt-0.5 leading-snug">{liveToast.message}</p>
            <button
              type="button"
              onClick={() => {
                setActiveEventCode(liveToast.eventCode);
                setActiveTab('gallery');
                setLiveToast(null);
              }}
              className="mt-2 inline-flex items-center gap-1 text-[11px] font-medium text-white underline cursor-pointer"
            >
              <span>Lihat Foto Baru</span>
              <ArrowRight className="w-3 h-3" />
            </button>
          </div>
          <button
            type="button"
            onClick={() => setLiveToast(null)}
            className="text-zinc-400 hover:text-white cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Main Content */}
      <main className="flex-1">
        {activeTab === 'gallery' && (
          <PhotoGallery
            photos={photos}
            events={events}
            activeEventCode={activeEventCode}
            selectedFilter={selectedFilter}
            onSelectFilter={setSelectedFilter}
            onSelectPhoto={handleOpenPhoto}
            onSendToTwibbon={handleSendToTwibbon}
            onOpenScanner={() => openScannerModal('cards')}
            onOpenScanTutorial={() => openScannerModal('tutorial')}
            onEnablePush={handleEnablePushNotifications}
            onTrackEvent={trackEvent}
          />
        )}

        {activeTab === 'twibbon' && (
          <TwibbonStudio
            photos={photos}
            activeEvent={activeEvent}
            initialPhoto={twibbonPhoto}
            initialFilter={selectedFilter}
            onTrackEvent={trackEvent}
          />
        )}

        {activeTab === 'admin' && (
          <AdminPanel events={events} onRefreshData={loadData} />
        )}
      </main>

      {/* Quiet Editorial Footer */}
      <footer className="border-t border-zinc-200 bg-white mt-12">
        <div className="max-w-[1360px] mx-auto px-4 sm:px-8 py-6 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-zinc-500">
          <div className="flex items-center gap-2">
            <span className="font-editorial text-base font-bold text-[#141414]">XII IPA 5</span>
            <span aria-hidden="true">·</span>
            <span>Arsip Foto Barcode & Twibbon Jawa Modern</span>
          </div>
          <div className="flex items-center gap-6">
            <button
              type="button"
              onClick={() => openScannerModal('cards')}
              className="hover:text-[#141414] cursor-pointer"
            >
              Scan Barcode
            </button>
            <button
              type="button"
              onClick={() => openScannerModal('tutorial')}
              className="hover:text-[#141414] cursor-pointer"
            >
              Tutorial Scan
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('twibbon')}
              className="hover:text-[#141414] cursor-pointer"
            >
              Studio Twibbon
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('admin')}
              className="hover:text-[#141414] cursor-pointer"
            >
              Akses Penyelenggara
            </button>
          </div>
        </div>
      </footer>

      {/* Modals & Drawers */}
      <BarcodeScannerModal
        isOpen={scannerOpen}
        onClose={() => setScannerOpen(false)}
        events={events}
        onScannedEvent={handleScannedEvent}
        initialMode={scannerInitialMode}
      />

      <PhotoLightboxModal
        photo={lightboxPhoto}
        event={activeEvent}
        initialFilter={selectedFilter}
        onClose={() => setLightboxPhoto(null)}
        onSendToTwibbon={handleSendToTwibbon}
        onCaptionsUpdated={handleCaptionsUpdated}
        onTrackEvent={trackEvent}
      />

      <GeminiChatDrawer
        isOpen={chatOpen}
        onClose={() => setChatOpen(false)}
        activeEventCode={activeEventCode}
      />
    </div>
  );
}
