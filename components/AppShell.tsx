"use client";

import { useState, useEffect } from "react";
import ServerSidebar from "./ServerSidebar";
import ChannelSidebar from "./ChannelSidebar";
import ChatArea from "./ChatArea";
import MemberList from "./MemberList";
import FriendsPanel from "./FriendsPanel";
import VoiceCall from "./VoiceCall";
import MessageNotification from "./MessageNotification";
import { useAppStore } from "../lib/store";
import { createSupabaseBrowserClient } from "../lib/supabaseClient";
import type { Channel, DirectMessage, Profile } from "../lib/types";

export default function AppShell() {
  const supabase = createSupabaseBrowserClient();
  const { currentServerId, currentChannelId, currentConversationId } = useAppStore();
  const [voiceChannel, setVoiceChannel] = useState<Channel | null>(null);
  const [voiceChannelKey, setVoiceChannelKey] = useState(0);
  const [notification, setNotification] = useState<{ sender: string; message: string } | null>(null);
  const [userId, setUserId] = useState<string | null>(null);

  // Get current user ID
  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => setUserId(user?.id ?? null));
  }, [supabase.auth]);

  // Global DM notification listener
  useEffect(() => {
    if (!userId) return;

    console.log("🔔 Setting up global DM notification listener for user:", userId);

    const channel = supabase
      .channel("global_dm_notifications")
      .on(
        "postgres_changes",
        { 
          event: "INSERT", 
          schema: "public", 
          table: "direct_messages"
        },
        async (payload) => {
          const newMessage = payload.new as DirectMessage;
          
          console.log("📨 New DM detected:", {
            authorId: newMessage.author_id,
            currentUserId: userId,
            conversationId: newMessage.conversation_id,
            currentConversationId
          });

          // Only show notification if:
          // 1. Message is not from current user
          // 2. User is not currently viewing this conversation
          if (newMessage.author_id !== userId && newMessage.conversation_id !== currentConversationId) {
            console.log("✅ Showing notification for DM");
            
            // Get sender profile
            const { data: profile } = await supabase
              .from("profiles")
              .select("*")
              .eq("id", newMessage.author_id)
              .single();

            setNotification({
              sender: (profile as Profile)?.username || "Someone",
              message: newMessage.content || "Sent an attachment"
            });
          } else {
            console.log("⏭️ Skipping notification (own message or viewing conversation)");
          }
        }
      )
      .subscribe();

    return () => {
      console.log("🔕 Cleaning up global DM notification listener");
      supabase.removeChannel(channel);
    };
  }, [userId, currentConversationId, supabase]);

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
        setVoiceChannelKey(prev => prev + 1); // Force remount
      } else {
        setVoiceChannel(null);
      }
    };
    
    loadChannel();
  }, [currentChannelId, supabase]);


  return (
    <div className="flex h-full w-full">
      {notification && (
        <MessageNotification
          senderUsername={notification.sender}
          message={notification.message}
          onClose={() => setNotification(null)}
        />
      )}
      <ServerSidebar />
      <ChannelSidebar />
      <ChatArea />
      {currentServerId ? <MemberList /> : <FriendsPanel />}
      {voiceChannel && (
        <VoiceCall
          key={voiceChannelKey}
          channelId={voiceChannel.id}
          channelName={voiceChannel.name}
          onLeave={() => {
            setVoiceChannel(null);
            setVoiceChannelKey(prev => prev + 1);
          }}
        />
      )}
    </div>
  );
}
