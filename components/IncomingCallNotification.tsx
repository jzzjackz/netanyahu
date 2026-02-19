"use client";

import { useEffect } from "react";
import { audioManager } from "../lib/audioManager";

interface IncomingCallNotificationProps {
  callerUsername: string;
  callerAvatar?: string;
  onAccept: () => void;
  onDecline: () => void;
}

export default function IncomingCallNotification({ 
  callerUsername, 
  callerAvatar,
  onAccept, 
  onDecline 
}: IncomingCallNotificationProps) {
  useEffect(() => {
    console.log("📞 Incoming call from:", callerUsername);
    
    // Play ringtone
    audioManager.playRingtone();

    return () => {
      // Stop ringtone when component unmounts
      audioManager.stopRingtone();
    };
  }, [callerUsername]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70">
      <div className="w-full max-w-sm rounded-lg bg-[#313338] p-8 shadow-2xl">
        {/* Caller Avatar */}
        <div className="mb-6 flex justify-center">
          <div className="relative">
            <div className="h-24 w-24 overflow-hidden rounded-full bg-[#5865f2] ring-4 ring-green-500 animate-pulse">
              {callerAvatar ? (
                <img 
                  src={callerAvatar} 
                  alt={callerUsername} 
                  className="h-full w-full object-cover" 
                />
              ) : (
                <div className="flex h-full w-full items-center justify-center text-3xl font-bold">
                  {callerUsername.slice(0, 1).toUpperCase()}
                </div>
              )}
            </div>
            {/* Pulsing ring animation */}
            <div className="absolute inset-0 rounded-full border-4 border-green-500 animate-ping" />
          </div>
        </div>

        {/* Caller Info */}
        <div className="mb-8 text-center">
          <h2 className="mb-2 text-2xl font-bold text-white">{callerUsername}</h2>
          <p className="text-sm text-gray-400">Incoming call...</p>
        </div>

        {/* Action Buttons */}
        <div className="flex gap-4">
          <button
            onClick={onDecline}
            className="flex-1 rounded-full bg-red-500 py-4 font-semibold text-white transition hover:bg-red-600 active:scale-95"
          >
            <div className="flex items-center justify-center gap-2">
              <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 20 20">
                <path d="M2 3a1 1 0 011-1h2.153a1 1 0 01.986.836l.74 4.435a1 1 0 01-.54 1.06l-1.548.773a11.037 11.037 0 006.105 6.105l.774-1.548a1 1 0 011.059-.54l4.435.74a1 1 0 01.836.986V17a1 1 0 01-1 1h-2C7.82 18 2 12.18 2 5V3z" />
              </svg>
              Decline
            </div>
          </button>
          <button
            onClick={onAccept}
            className="flex-1 rounded-full bg-green-500 py-4 font-semibold text-white transition hover:bg-green-600 active:scale-95"
          >
            <div className="flex items-center justify-center gap-2">
              <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 20 20">
                <path d="M2 3a1 1 0 011-1h2.153a1 1 0 01.986.836l.74 4.435a1 1 0 01-.54 1.06l-1.548.773a11.037 11.037 0 006.105 6.105l.774-1.548a1 1 0 011.059-.54l4.435.74a1 1 0 01.836.986V17a1 1 0 01-1 1h-2C7.82 18 2 12.18 2 5V3z" />
              </svg>
              Accept
            </div>
          </button>
        </div>
      </div>
    </div>
  );
}
