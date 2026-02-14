"use client";

import { useState, useEffect } from "react";
import ServerSidebar from "./ServerSidebar";
import ChannelSidebar from "./ChannelSidebar";
import ChatArea from "./ChatArea";
import MemberList from "./MemberList";
import FriendsPanel from "./FriendsPanel";
import VoiceCall from "./VoiceCall";
import { useAppStore } from "../lib/store";
import { createSupabaseBrowserClient } from "../lib/supabaseClient";
import type { Channel } from "../lib/types";

export default function AppShell() {
  const supabase = createSupabaseBrowserClient();
  const { currentServerId, currentChannelId } = useAppStore();
  const [voiceChannel, setVoiceChannel] = useState<Channel | null>(null);

  useEffect(() => {
    if (!currentChannelId) {
      setVoiceChannel(null);
      return;
    }
    
    const loadChannel = async () => {
      const { data } = await supabase
        .from("channels")
        .select("*")
        .eq("id", currentChannelId)
        .single();
      
      if (data && (data as Channel).type === "voice") {
        setVoiceChannel(data as Channel);
      } else {
        setVoiceChannel(null);
      }
    };
    
    loadChannel();
  }, [currentChannelId, supabase]);

  return (
    <div className="flex h-full w-full">
      <ServerSidebar />
      <ChannelSidebar />
      <ChatArea />
      {currentServerId ? <MemberList /> : <FriendsPanel />}
      {voiceChannel && (
        <VoiceCall
          channelId={voiceChannel.id}
          channelName={voiceChannel.name}
          onLeave={() => setVoiceChannel(null)}
        />
      )}
    </div>
  );
}
