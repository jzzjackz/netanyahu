"use client";

import { useEffect, useState } from "react";
import { audioManager } from "../lib/audioManager";

interface MessageNotificationProps {
  senderUsername: string;
  message: string;
  onClose: () => void;
  onClick?: () => void;
  playSound?: boolean;
}

export default function MessageNotification({ senderUsername, message, onClose, onClick, playSound = true }: MessageNotificationProps) {
  const [isVisible, setIsVisible] = useState(true);

  useEffect(() => {
    console.log("🔔 Notification mounted for:", senderUsername);
    
    // Play notification sound only if playSound is true
    if (playSound) {
      audioManager.playNotification();
    }

    // Auto-hide after 5 seconds
    const timer = setTimeout(() => {
      setIsVisible(false);
      setTimeout(onClose, 300);
    }, 5000);

    return () => {
      clearTimeout(timer);
    };
  }, [onClose, senderUsername, playSound]);

  if (!isVisible) return null;

  return (
    <div className="fixed right-4 top-4 z-50 animate-in slide-in-from-top-5 fade-in duration-300">
      <div 
        onClick={() => {
          if (onClick) {
            onClick();
            setIsVisible(false);
            setTimeout(onClose, 300);
          }
        }}
        className={`flex w-80 items-start gap-3 rounded-lg bg-[#313338] p-4 shadow-2xl ring-1 ring-white/10 ${onClick ? 'cursor-pointer hover:bg-[#3a3d44]' : ''}`}
      >
        {/* Sender Avatar */}
        <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-[#5865f2] text-sm font-bold">
          {senderUsername.slice(0, 1).toUpperCase()}
        </div>

        {/* Message Content */}
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-white">{senderUsername}</h3>
            <button
              onClick={(e) => {
                e.stopPropagation();
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
  );
}
