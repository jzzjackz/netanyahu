"use client";

import { useEffect, useState } from "react";
import { createSupabaseBrowserClient } from "../lib/supabaseClient";

interface Announcement {
  id: string;
  title: string;
  message: string;
  created_at: string;
}

export default function AnnouncementBanner() {
  const supabase = createSupabaseBrowserClient();
  const [announcement, setAnnouncement] = useState<Announcement | null>(null);
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());

  useEffect(() => {
    // Load latest announcement
    const loadLatest = async () => {
      const { data } = await supabase
        .from("announcements")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(1)
        .single();

      if (data && !dismissed.has(data.id)) {
        setAnnouncement(data as Announcement);
      }
    };

    loadLatest();

    // Subscribe to new announcements
    const channel = supabase
      .channel("announcements")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "announcements" },
        (payload) => {
          const newAnnouncement = payload.new as Announcement;
          if (!dismissed.has(newAnnouncement.id)) {
            setAnnouncement(newAnnouncement);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [supabase, dismissed]);

  const handleDismiss = () => {
    if (announcement) {
      setDismissed((prev) => new Set(prev).add(announcement.id));
      setAnnouncement(null);
    }
  };

  if (!announcement) return null;

  return (
    <div className="fixed top-0 left-0 right-0 z-50 bg-[#5865f2] px-4 py-3 shadow-lg">
      <div className="mx-auto flex max-w-7xl items-start justify-between gap-4">
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <svg className="h-5 w-5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
              <path d="M10 2a6 6 0 00-6 6v3.586l-.707.707A1 1 0 004 14h12a1 1 0 00.707-1.707L16 11.586V8a6 6 0 00-6-6zM10 18a3 3 0 01-3-3h6a3 3 0 01-3 3z" />
            </svg>
            <h3 className="font-bold text-white">{announcement.title}</h3>
          </div>
          <p className="mt-1 text-sm text-white/90">{announcement.message}</p>
        </div>
        <button
          onClick={handleDismiss}
          className="flex-shrink-0 rounded p-1 text-white/80 hover:bg-white/10 hover:text-white"
          title="Dismiss"
        >
          <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>
    </div>
  );
}
