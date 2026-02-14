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

  // Request notification permission on mount
  useEffect(() => {
    if (typeof window !== "undefined" && "Notification" in window) {
      if (Notification.permission === "default") {
        Notification.requestPermission().then(permission => {
          console.log("Notification permission:", permission);
        });
      }
    }
  }, []);

  // Global DM notification listener
  useEffect(() => {
    if (!userId) return;

    console.log("🔔 Setting up global DM notification listener for user:", userId);
    console.log("Current conversation ID:", currentConversationId);

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
          console.log("🔥 RAW PAYLOAD RECEIVED:", payload);
          const newMessage = payload.new as DirectMessage;
          
          console.log("📨 New DM detected:", {
            authorId: newMessage.author_id,
            currentUserId: userId,
            conversationId: newMessage.conversation_id,
            currentConversationId,
            isOwnMessage: newMessage.author_id === userId,
            isCurrentConvo: newMessage.conversation_id === currentConversationId
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

            const senderName = (profile as Profile)?.username || "Someone";
            const messageText = newMessage.content || "Sent an attachment";

            console.log("Setting notification state:", { senderName, messageText });

            // Show in-app notification
            setNotification({
              sender: senderName,
              message: messageText
            });

            // Show browser notification if permission granted
            if (typeof window !== "undefined" && "Notification" in window && Notification.permission === "granted") {
              console.log("Showing browser notification");
              const browserNotif = new Notification(`${senderName} sent you a message`, {
                body: messageText,
                icon: "/favicon.ico",
                tag: newMessage.conversation_id,
                requireInteraction: false,
              });

              setTimeout(() => browserNotif.close(), 5000);

              browserNotif.onclick = () => {
                window.focus();
                browserNotif.close();
              };
            }
          } else {
            console.log("⏭️ Skipping notification:", {
              reason: newMessage.author_id === userId ? "own message" : "viewing conversation"
            });
          }
        }
      )
      .subscribe((status) => {
        console.log("📡 Realtime subscription status:", status);
      });

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
      
      {/* Debug: Test notification button */}
      <button
        onClick={() => {
          console.log("🧪 Testing notification manually...");
          setNotification({
            sender: "Test User",
            message: "This is a test notification!"
          });
        }}
        className="fixed bottom-4 right-4 z-50 rounded bg-purple-600 px-4 py-2 text-sm font-medium hover:bg-purple-700"
        title="Test notification"
      >
        Test Notification
      </button>
      
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
