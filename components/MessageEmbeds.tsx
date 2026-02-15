"use client";

import { useEffect, useState } from "react";
import { createSupabaseBrowserClient } from "../lib/supabaseClient";
import Link from "next/link";

interface MessageEmbedsProps {
  content: string;
}

export default function MessageEmbeds({ content }: MessageEmbedsProps) {
  const supabase = createSupabaseBrowserClient();
  const [inviteData, setInviteData] = useState<any>(null);
  const [linkPreview, setLinkPreview] = useState<any>(null);
  const [gifUrl, setGifUrl] = useState<string | null>(null);

  useEffect(() => {
    // Check for GIF URLs (GIPHY, Tenor, custom API, or any .gif)
    const gifMatch = content.match(/(https?:\/\/[^\s]+\.gif|https?:\/\/media\.giphy\.com\/[^\s]+|https?:\/\/[^\s]*giphy[^\s]*|https?:\/\/[^\s]*tenor[^\s]*|https?:\/\/yallah-flax\.vercel\.app\/cdn\/[^\s]+)/i);
    if (gifMatch) {
      setGifUrl(gifMatch[1]);
      return; // Don't process other embeds if it's a GIF
    }

    // Check for invite links
    const inviteMatch = content.match(/\/invite\/([a-z0-9]+)/i);
    if (inviteMatch) {
      const code = inviteMatch[1];
      supabase
        .from("invite_codes")
        .select("*, servers(*)")
        .eq("code", code)
        .single()
        .then(({ data }) => {
          if (data) setInviteData(data);
        });
    }

    // Check for regular URLs
    const urlMatch = content.match(/(https?:\/\/[^\s]+)/);
    if (urlMatch && !inviteMatch) {
      const url = urlMatch[1];
      // Simple preview - in production you'd use an API like OpenGraph
      setLinkPreview({ url, title: url });
    }
  }, [content, supabase]);

  return (
    <>
      {gifUrl && (
        <div className="mt-2">
          <img
            src={gifUrl}
            alt="GIF"
            className="max-h-80 max-w-md rounded border border-[#404249] object-contain"
            loading="lazy"
          />
        </div>
      )}
      {inviteData && !gifUrl && (
        <Link
          href={`/invite/${inviteData.code}`}
          className="mt-2 block max-w-md rounded-lg border border-[#404249] bg-[#2b2d31] p-4 hover:bg-[#313338]"
        >
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-indigo-500 text-xl font-bold">
              {inviteData.servers?.name?.[0]?.toUpperCase() || "S"}
            </div>
            <div>
              <p className="text-sm text-gray-400">You've been invited to join</p>
              <p className="font-semibold">{inviteData.servers?.name || "a server"}</p>
            </div>
          </div>
        </Link>
      )}
      {linkPreview && !inviteData && !gifUrl && (
        <a
          href={linkPreview.url}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-2 block max-w-md rounded-lg border border-[#404249] bg-[#2b2d31] p-3 hover:bg-[#313338]"
        >
          <div className="flex items-center gap-2">
            <span className="text-xl">🔗</span>
            <p className="truncate text-sm text-indigo-400">{linkPreview.url}</p>
          </div>
        </a>
      )}
    </>
  );
}
