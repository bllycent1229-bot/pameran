import React, { useEffect, useRef, useState } from 'react';
import { X, Send, Volume2, Loader2 } from 'lucide-react';
import { ChatMessage } from '../types';

interface GeminiChatDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  activeEventCode: string;
}

const SUGGESTED_PROMPTS = [
  'Rekomendasikan caption elegan bernuansa Jawa untuk foto kebaya malam ini',
  'Twibbon mana yang paling cocok untuk foto keluarga di Pendopo?',
  'Bagaimana cara mendapatkan semua foto saya dari barcode acara?',
];

export const GeminiChatDrawer: React.FC<GeminiChatDrawerProps> = ({
  isOpen,
  onClose,
  activeEventCode,
}) => {
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 'msg-welcome',
      role: 'model',
      text: 'Sugeng rawuh di XII IPA 5. Saya Pranata, asisten kurasi foto & gaya bahasa acara Pameran XII IPA 5 Adat Jawa. Ada yang bisa saya bantu untuk memilih filter, merangkai caption, atau menentukan bingkai Twibbon Jawa?',
      timestamp: new Date().toISOString(),
    },
  ]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [playingId, setPlayingId] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isOpen]);

  const sendMessage = async (textToSend: string) => {
    const clean = textToSend.trim();
    if (!clean || sending) return;

    const userMsg: ChatMessage = {
      id: `u-${Date.now()}`,
      role: 'user',
      text: clean,
      timestamp: new Date().toISOString(),
    };
    const nextHistory = [...messages, userMsg];
    setMessages(nextHistory);
    setInput('');
    setSending(true);

    try {
      const res = await fetch('/api/gemini/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          activeEventCode,
          messages: nextHistory.map((m) => ({ role: m.role, text: m.text })),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Gagal terhubung ke asisten.');

      setMessages((prev) => [
        ...prev,
        {
          id: `m-${Date.now()}`,
          role: 'model',
          text: data.reply,
          timestamp: new Date().toISOString(),
        },
      ]);
    } catch (err) {
      setMessages((prev) => [
        ...prev,
        {
          id: `err-${Date.now()}`,
          role: 'model',
          text: err instanceof Error ? err.message : 'Terjadi kendala saat memproses permintaan.',
          timestamp: new Date().toISOString(),
        },
      ]);
    } finally {
      setSending(false);
    }
  };

  const speakMessage = async (msg: ChatMessage) => {
    setPlayingId(msg.id);
    try {
      const res = await fetch('/api/gemini/tts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: msg.text }),
      });
      const data = await res.json();
      if (res.ok && data.audioBase64) {
        const audio = new Audio(`data:${data.mimeType || 'audio/wav'};base64,${data.audioBase64}`);
        await audio.play();
      }
    } finally {
      setPlayingId(null);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-[2px] flex justify-end">
      <div className="w-full max-w-md bg-white h-full border-l border-zinc-200 flex flex-col shadow-2xl">
        <div className="px-6 py-4 border-b border-zinc-200 flex items-center justify-between bg-[#FAF8F4]">
          <div>
            <h2 className="font-editorial text-xl font-bold text-[#141414]">
              Pranata — Asisten Acara AI
            </h2>
            <p className="text-xs text-zinc-500">Kurator caption, filter & panduan barcode</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Tutup asisten"
            className="p-2 text-zinc-500 hover:text-[#141414] rounded-lg hover:bg-zinc-200/60 cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Multi-Turn Thread */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {messages.map((msg) => {
            const isUser = msg.role === 'user';
            return (
              <div
                key={msg.id}
                className={`flex flex-col ${isUser ? 'items-end' : 'items-start'}`}
              >
                <div
                  className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm leading-relaxed whitespace-pre-wrap ${
                    isUser
                      ? 'bg-[#141414] text-white rounded-br-sm'
                      : 'bg-[#F5F3EE] text-[#141414] border border-[#E6DFCF] rounded-bl-sm'
                  }`}
                >
                  {msg.text}
                </div>
                {!isUser && (
                  <button
                    type="button"
                    onClick={() => speakMessage(msg)}
                    disabled={playingId === msg.id}
                    className="mt-1 inline-flex items-center gap-1 text-[11px] text-zinc-500 hover:text-[#9B7334] cursor-pointer"
                  >
                    <Volume2 className="w-3 h-3" />
                    <span>{playingId === msg.id ? 'Memutar suara...' : 'Bacakan'}</span>
                  </button>
                )}
              </div>
            );
          })}
          {sending && (
            <div className="flex items-center gap-2 text-xs text-zinc-500">
              <Loader2 className="w-3.5 h-3.5 animate-spin text-[#B48327]" />
              <span>Pranata sedang menyusun jawaban...</span>
            </div>
          )}
          <div ref={bottomRef} />
        </div>

        {/* Quick Prompts */}
        <div className="px-5 py-2.5 border-t border-zinc-100 flex gap-2 overflow-x-auto">
          {SUGGESTED_PROMPTS.map((q) => (
            <button
              key={q}
              type="button"
              onClick={() => sendMessage(q)}
              className="text-[11px] px-2.5 py-1.5 bg-zinc-100 hover:bg-zinc-200 text-zinc-700 rounded-md whitespace-nowrap shrink-0 cursor-pointer"
            >
              {q}
            </button>
          ))}
        </div>

        {/* Chat Input */}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            sendMessage(input);
          }}
          className="p-4 border-t border-zinc-200 flex items-center gap-2"
        >
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Tulis pertanyaan atau minta caption..."
            className="flex-1 px-3.5 py-2.5 text-sm border border-zinc-300 rounded-lg focus:outline-none focus:border-[#B48327]"
          />
          <button
            type="submit"
            disabled={sending || !input.trim()}
            className="p-2.5 bg-[#141414] text-white rounded-lg hover:bg-zinc-800 disabled:opacity-40 cursor-pointer"
            aria-label="Kirim pesan"
          >
            <Send className="w-4 h-4 text-[#D4AF5A]" />
          </button>
        </form>
      </div>
    </div>
  );
};
