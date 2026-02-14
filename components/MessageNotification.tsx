"use client";

import { useEffect, useRef, useState } from "react";

interface MessageNotificationProps {
  senderUsername: string;
  message: string;
  onClose: () => void;
}

export default function MessageNotification({ senderUsername, message, onClose }: MessageNotificationProps) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [isVisible, setIsVisible] = useState(true);

  useEffect(() => {
    // Play notification sound
    if (audioRef.current) {
      audioRef.current.play().catch(e => console.error("Failed to play notification:", e));
    }

    // Auto-hide after 5 seconds
    const timer = setTimeout(() => {
      setIsVisible(false);
      setTimeout(onClose, 300); // Wait for fade out animation
    }, 5000);

    return () => clearTimeout(timer);
  }, [onClose]);

  if (!isVisible) return null;

  return (
    <>
      <audio ref={audioRef} src="/sounds/notification.ogg" />
      
      <div className="fixed right-4 top-4 z-50 animate-in slide-in-from-top-5 fade-in duration-300">
        <div className="flex w-80 items-start gap-3 rounded-lg bg-[#313338] p-4 shadow-2xl ring-1 ring-white/10">
          {/* Sender Avatar */}
          <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-[#5865f2] text-sm font-bold">
            {senderUsername.slice(0, 1).toUpperCase()}
          </div>

          {/* Message Content */}
          <div className="min-w-0 flex-1">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-white">{senderUsername}</h3>
              <button
                onClick={() => {
                  setIsVisible(false);
                  setTimeout(onClose, 300);
                }}
                className="text-gray-400 hover:text-white"
              >
                <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                </svg>
              </button>
            </div>
            <p className="mt-1 text-sm text-gray-300 line-clamp-2">{message}</p>
          </div>
        </div>
      </div>
    </>
  );
}
