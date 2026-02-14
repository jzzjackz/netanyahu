"use client";

import { useState, useEffect, useRef } from "react";
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
  
  // Use ref to track current conversation without causing re-subscriptions
  const currentConversationIdRef = useRef(currentConversationId);
  
  useEffect(() => {
    currentConversationIdRef.current = currentConversationId;
  }, [currentConversationId]);

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

  // Global DM notification listener - subscribe to all user's conversations
  useEffect(() => {
    if (!userId) return;

    console.log("🔔 Setting up global DM notification listener for user:", userId);

    let channels: ReturnType<typeof supabase.channel>[] = [];

    // Get all conversations this user is part of
    const setupListeners = async () => {
      const { data: conversations } = await supabase
        .from("direct_conversations")
        .select("id")
        .or(`user_a_id.eq.${userId},user_b_id.eq.${userId}`);

      if (!conversations || conversations.length === 0) {
        console.log("No conversations found for user");
        return;
      }

      console.log(`Found ${conversations.length} conversations, setting up listeners...`);

      // Subscribe to each conversation
      channels = conversations.map((convo) => {
        const channel = supabase
          .channel(`dm_notif:${convo.id}`)
          .on(
            "postgres_changes",
            {
              event: "INSERT",
              schema: "public",
              table: "direct_messages",
              filter: `conversation_id=eq.${convo.id}`,
            },
            async (payload) => {
              console.log("🔥 RAW PAYLOAD RECEIVED:", payload);
              const newMessage = payload.new as DirectMessage;

              console.log("📨 New DM detected:", {
                authorId: newMessage.author_id,
                currentUserId: userId,
                conversationId: newMessage.conversation_id,
                currentConversationId: currentConversationIdRef.current,
                isOwnMessage: newMessage.author_id === userId,
                isCurrentConvo: newMessage.conversation_id === currentConversationIdRef.current,
              });

              // Only show notification if:
              // 1. Message is not from current user
              // 2. User is not currently viewing this conversation
              if (
                newMessage.author_id !== userId &&
                newMessage.conversation_id !== currentConversationIdRef.current
              ) {
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
                  message: messageText,
                });

                // Show browser notification if permission granted
                if (
                  typeof window !== "undefined" &&
                  "Notification" in window &&
                  Notification.permission === "granted"
                ) {
                  console.log("Showing browser notification");
                  const browserNotif = new Notification(
                    `${senderName} sent you a message`,
                    {
                      body: messageText,
                      icon: "/favicon.ico",
                      tag: newMessage.conversation_id,
                      requireInteraction: false,
                    }
                  );

                  setTimeout(() => browserNotif.close(), 5000);

                  browserNotif.onclick = () => {
                    window.focus();
                    browserNotif.close();
                  };
                }
              } else {
                console.log("⏭️ Skipping notification:", {
                  reason:
                    newMessage.author_id === userId
                      ? "own message"
                      : "viewing conversation",
                });
              }
            }
          )
          .subscribe((status) => {
            console.log(`📡 Conversation ${convo.id} subscription status:`, status);
          });

        return channel;
      });
    };

    setupListeners();

    // Cleanup function
    return () => {
      console.log("🔕 Cleaning up DM notification listeners");
      channels.forEach((ch) => supabase.removeChannel(ch));
    };
  }, [userId, supabase]); // Removed currentConversationId from dependencies

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
