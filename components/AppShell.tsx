"use client";

import { useState, useEffect, useRef } from "react";
import ServerSidebar from "./ServerSidebar";
import ChannelSidebar from "./ChannelSidebar";
import ChatArea from "./ChatArea";
import MemberList from "./MemberList";
import FriendsPanel from "./FriendsPanel";
import VoiceCall from "./VoiceCall";
import MessageNotification from "./MessageNotification";
import AnnouncementBanner from "./AnnouncementBanner";
import { useAppStore } from "../lib/store";
import { createSupabaseBrowserClient } from "../lib/supabaseClient";
import type { Channel, DirectMessage, Profile } from "../lib/types";

export default function AppShell() {
  const supabase = createSupabaseBrowserClient();
  const { currentServerId, currentChannelId, currentConversationId } = useAppStore();
  const [voiceChannel, setVoiceChannel] = useState<Channel | null>(null);
  const [voiceChannelKey, setVoiceChannelKey] = useState(0);
  const [notification, setNotification] = useState<{ sender: string; message: string; conversationId: string } | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [showMobileSidebar, setShowMobileSidebar] = useState(false);
  
  // Use ref to track current conversation without causing re-subscriptions
  const currentConversationIdRef = useRef(currentConversationId);
  
  useEffect(() => {
    currentConversationIdRef.current = currentConversationId;
    
    // Auto-dismiss notification if user switches to that conversation
    if (notification && notification.conversationId === currentConversationId) {
      console.log("Auto-dismissing notification - user switched to conversation");
      setNotification(null);
    }
  }, [currentConversationId, notification]);

  // Get current user ID and set status to online
  useEffect(() => {
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      setUserId(user?.id ?? null);
      if (user) {
        // Set status to online when user logs in
        await supabase
          .from("profiles")
          .update({ status: 'online' })
          .eq("id", user.id);
      }
    });
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
    let isMounted = true;

    // Get all conversations this user is part of
    const setupListeners = async () => {
      const { data: conversations } = await supabase
        .from("direct_conversations")
        .select("id")
        .or(`user_a_id.eq.${userId},user_b_id.eq.${userId}`);

      if (!isMounted) return; // Component unmounted during async operation

      if (!conversations || conversations.length === 0) {
        console.log("No conversations found for user");
        return;
      }

      console.log(`Found ${conversations.length} conversations, setting up listeners...`);

      // Subscribe to each conversation
      channels = conversations.map((convo) => {
        const channel = supabase
          .channel(`dm_notif_${convo.id}`) // Changed naming to avoid conflicts
          .on(
            "postgres_changes",
            {
              event: "INSERT",
              schema: "public",
              table: "direct_messages",
              filter: `conversation_id=eq.${convo.id}`,
            },
            async (payload) => {
              if (!isMounted) return; // Don't process if unmounted
              
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
                  conversationId: newMessage.conversation_id,
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
            if (isMounted) {
              console.log(`📡 Conversation ${convo.id} subscription status:`, status);
            }
          });

        return channel;
      });
    };

    setupListeners();

    // Cleanup function
    return () => {
      console.log("🔕 Cleaning up DM notification listeners");
      isMounted = false;
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

  // Close mobile sidebar when channel/conversation changes
  useEffect(() => {
    setShowMobileSidebar(false);
  }, [currentChannelId, currentConversationId]);

  return (
    <div className="flex h-full w-full">
      <AnnouncementBanner />
      {notification && (
        <MessageNotification
          senderUsername={notification.sender}
          message={notification.message}
          onClose={() => setNotification(null)}
        />
      )}
      
      {/* Mobile Menu Button */}
      <button
        onClick={() => setShowMobileSidebar(!showMobileSidebar)}
        className="fixed left-4 top-4 z-50 rounded-lg bg-[#5865f2] p-2 md:hidden"
        aria-label="Toggle menu"
      >
        <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
        </svg>
      </button>
      
      {/* Mobile Overlay */}
      {showMobileSidebar && (
        <div
          className="fixed inset-0 z-30 bg-black/50 md:hidden"
          onClick={() => setShowMobileSidebar(false)}
        />
      )}
      
      {/* Sidebars Container */}
      <div className={`
        fixed inset-y-0 left-0 z-40 flex
        transition-transform duration-300
        ${showMobileSidebar ? 'translate-x-0' : '-translate-x-full'}
        md:relative md:translate-x-0 md:z-0
      `}>
        <ServerSidebar />
        <ChannelSidebar />
      </div>
      
      <ChatArea />
      
      {/* Desktop: Member List / Friends Panel */}
      <div className="hidden lg:block">
        {currentServerId ? <MemberList /> : <FriendsPanel />}
      </div>
      
      {/* Mobile: Friends Panel as overlay when not in a server */}
      {!currentServerId && (
        <div className="lg:hidden">
          <button
            onClick={() => setShowMobileSidebar(true)}
            className="fixed right-4 top-4 z-50 rounded-lg bg-[#5865f2] p-2"
            aria-label="Friends"
          >
            <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
            </svg>
          </button>
          {showMobileSidebar && (
            <div className="fixed inset-y-0 right-0 z-40 w-60 bg-[#2b2d31]">
              <FriendsPanel />
            </div>
          )}
        </div>
      )}
      
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
