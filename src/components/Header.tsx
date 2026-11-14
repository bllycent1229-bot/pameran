import React from 'react';
import { QrCode, Bell, MessageSquare } from 'lucide-react';
import { EventAlbum, ViewTab } from '../types';

interface HeaderProps {
  activeTab: ViewTab;
  onSelectTab: (tab: ViewTab) => void;
  onOpenScanner: () => void;
  events: EventAlbum[];
  activeEventCode: string;
  onSelectEventCode: (code: string) => void;
  unreadNotifications: number;
  pushEnabled: boolean;
  onToggleNotifications: () => void;
  onOpenNotifPanel: () => void;
  onOpenChat: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  activeTab,
  onSelectTab,
  onOpenScanner,
  events,
  activeEventCode,
  onSelectEventCode,
  unreadNotifications,
  pushEnabled,
  onToggleNotifications,
  onOpenNotifPanel,
  onOpenChat,
}) => {
  const navItems: Array<{ id: ViewTab; label: string }> = [
    { id: 'gallery', label: 'Galeri Foto' },
    { id: 'twibbon', label: 'Studio Twibbon' },
    { id: 'admin', label: 'Panel Admin' },
  ];

  return (
    <div className="sticky top-0 z-40 bg-[#F8F8F7]/95 backdrop-blur-md border-b border-zinc-200/80">
      {/* Strict 3-Zone Top Bar Contract */}
      <header className="max-w-[1360px] mx-auto px-4 sm:px-8 h-16 flex items-center justify-between gap-8">
        {/* Zone 1: Single-line brand wordmark */}
        <button
          type="button"
          onClick={() => onSelectTab('gallery')}
          className="font-editorial text-2xl font-bold tracking-tight text-[#141414] whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#B48327] rounded-sm"
        >
          XII IPA 5
        </button>

        {/* Zone 2: 4 concise single-line navigation links */}
        <nav className="hidden md:flex items-center gap-7 text-sm font-medium text-zinc-600">
          {navItems.map((item) => {
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => onSelectTab(item.id)}
                className={`py-1.5 transition-colors whitespace-nowrap shrink-0 cursor-pointer border-b-2 ${
                  isActive
                    ? 'text-[#141414] border-[#B48327] font-semibold'
                    : 'text-zinc-600 border-transparent hover:text-[#141414] hover:border-zinc-300'
                }`}
              >
                {item.label}
              </button>
            );
          })}
        </nav>

        {/* Zone 3: 1 primary action */}
        <div className="flex items-center shrink-0">
          <button
            type="button"
            onClick={onOpenScanner}
            className="inline-flex items-center gap-2 px-4 py-2 bg-[#141414] text-white text-xs sm:text-sm font-medium rounded-lg hover:bg-zinc-800 transition-colors whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#B48327]"
          >
            <QrCode className="w-4 h-4 text-[#D4AF5A]" />
            <span>Scan Barcode</span>
          </button>
        </div>
      </header>

      {/* Mobile Navigation Row */}
      <div className="md:hidden border-t border-zinc-200/70 px-4 py-2 flex items-center justify-between gap-2 overflow-x-auto">
        {navItems.map((item) => {
          const isActive = activeTab === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => onSelectTab(item.id)}
              className={`px-3 py-1.5 text-xs font-medium rounded-md whitespace-nowrap shrink-0 cursor-pointer ${
                isActive ? 'bg-[#141414] text-white' : 'text-zinc-600 hover:bg-zinc-200/60'
              }`}
            >
              {item.label}
            </button>
          );
        })}
      </div>

      {/* Workspace Sub-Bar for Event Barcode Switcher, Push Notifications & Gemini Assistant */}
      <div className="border-t border-zinc-200/70 bg-white/75">
        <div className="max-w-[1360px] mx-auto px-4 sm:px-8 py-2 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-xs text-zinc-600 min-w-0">
            <span className="font-medium text-zinc-500 whitespace-nowrap">Acara Aktif:</span>
            {events.length <= 1 ? (
              <span className="font-semibold text-[#141414] truncate">
                {events[0]?.name || 'Pameran XII IPA 5'}
              </span>
            ) : (
              <select
                aria-label="Pilih Acara"
                value={activeEventCode}
                onChange={(e) => onSelectEventCode(e.target.value)}
                className="bg-transparent text-xs font-medium text-[#141414] border border-zinc-300 rounded-md px-2.5 py-1 focus:outline-none focus:border-[#B48327] cursor-pointer"
              >
                {events.map((evt) => (
                  <option key={evt.code} value={evt.code}>
                    {evt.name}
                  </option>
                ))}
              </select>
            )}
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={pushEnabled ? onOpenNotifPanel : onToggleNotifications}
              className="inline-flex items-center gap-2 px-3 py-1.5 text-xs font-medium text-zinc-700 bg-white border border-zinc-200 rounded-md hover:border-zinc-300 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              <Bell className={`w-3.5 h-3.5 ${pushEnabled ? 'text-[#B48327]' : 'text-zinc-500'}`} />
              <span>
                {pushEnabled
                  ? `Notifikasi Aktif (${unreadNotifications})`
                  : 'Aktifkan Notifikasi Push'}
              </span>
            </button>

            <button
              type="button"
              onClick={onOpenChat}
              className="inline-flex items-center gap-2 px-3 py-1.5 text-xs font-medium text-[#141414] bg-[#F3EFE6] border border-[#DFD5BE] rounded-md hover:bg-[#EAE3D3] transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              <MessageSquare className="w-3.5 h-3.5 text-[#9B7334]" />
              <span>Tanya Asisten AI</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
