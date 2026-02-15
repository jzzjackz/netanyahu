"use client";

import { useEffect, useState, useRef } from "react";
import { createSupabaseBrowserClient } from "../lib/supabaseClient";
import { useAppStore } from "../lib/store";
import type { Message, Channel, Profile } from "../lib/types";
import { format } from "date-fns";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import MessageEmbeds from "./MessageEmbeds";
import PrivateCall from "./PrivateCall";
import UserProfileModal from "./UserProfileModal";
import GifPicker from "./GifPicker";
import { createMentions, createDMMentions } from "../lib/mentions";

export default function ChatArea() {
  const supabase = createSupabaseBrowserClient();
  const { currentChannelId, currentConversationId } = useAppStore();
  const [channel, setChannel] = useState<Channel | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [content, setContent] = useState("");
  const [sending, setSending] = useState(false);
  const [typingUsers, setTypingUsers] = useState<Map<string, string>>(new Map()); // userId -> username
  const [userId, setUserId] = useState<string | null>(null);
  const [replyingTo, setReplyingTo] = useState<Message | null>(null);
  const [uploadingFiles, setUploadingFiles] = useState(false);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [profileModalUserId, setProfileModalUserId] = useState<string | null>(null);
  const [currentUsername, setCurrentUsername] = useState<string>("");
  const [showGifPicker, setShowGifPicker] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      setUserId(user?.id ?? null);
      if (user) {
        const { data: profile } = await supabase
          .from("profiles")
          .select("username")
          .eq("id", user.id)
          .single();
        setCurrentUsername(profile?.username || "");
      }
    });
  }, [supabase.auth]);

  useEffect(() => {
    if (!currentChannelId) {
      setChannel(null);
      setMessages([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const load = async () => {
      const [chRes, msgRes] = await Promise.all([
        supabase.from("channels").select("*").eq("id", currentChannelId).single(),
        supabase.from("messages").select("*").eq("channel_id", currentChannelId).order("created_at", { ascending: true }),
      ]);
      const channelData = chRes.data as Channel | null;
      setChannel(channelData);
      
      // Don't load messages for voice channels
      if (channelData?.type === "voice") {
        setMessages([]);
        setLoading(false);
        return;
      }
      
      const msgList = (msgRes.data as Message[]) ?? [];
      if (msgList.length > 0) {
        const authorIds = [...new Set(msgList.map((m) => m.author_id).filter(Boolean))] as string[];
        const { data: profs } = await supabase.from("profiles").select("*").in("id", authorIds);
        const profileMap = new Map<string, Profile>(((profs ?? []) as Profile[]).map((p) => [p.id, p]));
        
        // Create message map for replies
        const messageMap = new Map(msgList.map((m) => [m.id, m]));
        
        setMessages(msgList.map((m) => ({
          ...m,
          profiles: m.author_id ? profileMap.get(m.author_id) ?? null : null,
          reply_message: m.reply_to ? messageMap.get(m.reply_to) : null,
        })));
      } else {
        setMessages(msgList);
      }
      setLoading(false);
    };
    load();
  }, [currentChannelId, supabase]);

  useEffect(() => {
    if (!currentChannelId) return;
    const channel = supabase.channel(`messages:${currentChannelId}`).on(
      "postgres_changes",
      { event: "INSERT", schema: "public", table: "messages", filter: `channel_id=eq.${currentChannelId}` },
      async (payload) => {
        const newRow = payload.new as Message;
        const authorId = newRow.author_id;
        let profile: Profile | null = null;
        if (authorId) {
          const { data } = await supabase.from("profiles").select("*").eq("id", authorId).maybeSingle();
          profile = data as Profile | null;
        }
        
        // Get reply message if exists
        let replyMessage: Message | null = null;
        if (newRow.reply_to) {
          setMessages((prev) => {
            const existing = prev.find(m => m.id === newRow.reply_to);
            if (existing) {
              replyMessage = existing;
            }
            return [...prev, { ...newRow, profiles: profile, reply_message: replyMessage }];
          });
        } else {
          setMessages((prev) => [...prev, { ...newRow, profiles: profile, reply_message: null }]);
        }
      }
    ).subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [currentChannelId, supabase]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if ((!content.trim() && selectedFiles.length === 0) || !currentChannelId || sending) return;
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    setSending(true);
    
    // Stop typing indicator
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }
    await supabase.channel(`typing:${currentChannelId}`).send({
      type: "broadcast",
      event: "stop_typing",
      payload: { userId: user.id },
    });
    
    // Upload files if any
    const attachments: Array<{ url: string; name: string; type: string }> = [];
    if (selectedFiles.length > 0) {
      setUploadingFiles(true);
      for (const file of selectedFiles) {
        const fileName = `${user.id}/${Date.now()}-${file.name}`;
        const { data, error } = await supabase.storage
          .from("attachments")
          .upload(fileName, file);
        
        if (!error && data) {
          const { data: { publicUrl } } = supabase.storage
            .from("attachments")
            .getPublicUrl(data.path);
          
          attachments.push({
            url: publicUrl,
            name: file.name,
            type: file.type,
          });
        }
      }
      setUploadingFiles(false);
    }
    
    const { data: insertedMessage } = await supabase.from("messages").insert({
      channel_id: currentChannelId,
      author_id: user.id,
      content: content.trim() || "",
      reply_to: replyingTo?.id || null,
      attachments: attachments.length > 0 ? attachments : [],
    }).select().single();
    
    // Create mentions if any
    if (insertedMessage && content.trim()) {
      await createMentions(supabase, insertedMessage.id, currentChannelId, content.trim(), user.id);
    }
    
    setContent("");
    setReplyingTo(null);
    setSelectedFiles([]);
    setSending(false);
  };

  const handleDelete = async (messageId: string) => {
    if (!confirm("Delete this message?")) return;
    await supabase.from("messages").delete().eq("id", messageId);
    setMessages((prev) => prev.filter((m) => m.id !== messageId));
  };

  const handleTyping = async () => {
    if (!currentChannelId || !userId) return;
    
    // Clear existing timeout
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }
    
    // Get username
    const { data: profile } = await supabase.from("profiles").select("username").eq("id", userId).single();
    const username = profile?.username || "Someone";
    
    // Broadcast typing
    await supabase.channel(`typing:${currentChannelId}`).send({
      type: "broadcast",
      event: "typing",
      payload: { userId, username },
    });
    
    // Auto-stop after 3 seconds
    typingTimeoutRef.current = setTimeout(async () => {
      await supabase.channel(`typing:${currentChannelId}`).send({
        type: "broadcast",
        event: "stop_typing",
        payload: { userId },
      });
    }, 3000);
  };

  // Subscribe to typing indicators
  useEffect(() => {
    if (!currentChannelId) return;
    
    const channel = supabase.channel(`typing:${currentChannelId}`)
      .on("broadcast", { event: "typing" }, ({ payload }) => {
        if (payload.userId !== userId) {
          setTypingUsers((prev) => new Map(prev).set(payload.userId, payload.username));
        }
      })
      .on("broadcast", { event: "stop_typing" }, ({ payload }) => {
        setTypingUsers((prev) => {
          const newMap = new Map(prev);
          newMap.delete(payload.userId);
          return newMap;
        });
      })
      .subscribe();
    
    return () => {
      supabase.removeChannel(channel);
      setTypingUsers(new Map());
    };
  }, [currentChannelId, userId, supabase]);

  if (currentConversationId) {
    return <DMArea conversationId={currentConversationId} />;
  }

  if (!currentChannelId) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center bg-[#313338] text-gray-400">
        <p className="text-lg">Select a channel to start chatting</p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex flex-1 flex-col bg-[#313338]">
        <div className="h-12 animate-pulse border-b border-[#1e1f22] bg-[#2b2d31]" />
        <div className="flex-1 overflow-y-auto p-4">
          <div className="h-4 w-1/4 animate-pulse rounded bg-[#404249]" />
          <div className="mt-4 h-4 w-full animate-pulse rounded bg-[#404249]" />
        </div>
      </div>
    );
  }

  // Voice channel view
  if (channel?.type === "voice") {
    return (
      <div className="flex flex-1 flex-col bg-[#313338]">
        <div className="flex h-12 items-center border-b border-[#1e1f22] px-4">
          <span className="text-gray-500">🔊</span>
          <h2 className="ml-1 font-semibold">{channel?.name ?? "Voice Channel"}</h2>
        </div>
        <div className="flex flex-1 flex-col items-center justify-center gap-4 p-4">
          <div className="rounded-full bg-[#404249] p-8">
            <svg className="h-16 w-16 text-gray-400" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M7 4a3 3 0 016 0v4a3 3 0 11-6 0V4zm4 10.93A7.001 7.001 0 0017 8a1 1 0 10-2 0A5 5 0 015 8a1 1 0 00-2 0 7.001 7.001 0 006 6.93V17H6a1 1 0 100 2h8a1 1 0 100-2h-3v-2.07z" clipRule="evenodd" />
            </svg>
          </div>
          <h3 className="text-xl font-semibold">Voice Channel</h3>
          <p className="text-gray-400">Click a voice channel in the sidebar to join</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col bg-[#313338]">
      <div className="flex h-12 items-center border-b border-[#1e1f22] px-4 shadow-sm">
        <span className="text-xl text-gray-400">#</span>
        <h2 className="ml-2 font-semibold text-white">{channel?.name ?? "Channel"}</h2>
      </div>
      <div ref={scrollContainerRef} className="flex-1 overflow-y-auto">{messages.length === 0 && (
          <p className="px-4 pt-4 text-gray-500">No messages yet. Send the first one!</p>
        )}
        {messages.map((m) => {
          const mentionedSelf = m.content.includes(`@${currentUsername}`);
          return (
          <div key={m.id} className={`group flex gap-3 px-4 py-2 hover:bg-[#2e3035] ${mentionedSelf ? 'bg-[#faa81a]/10 border-l-4 border-[#faa81a]' : ''}`}>
            <button
              onClick={() => m.author_id && setProfileModalUserId(m.author_id)}
              className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-[#5865f2] text-sm font-bold hover:opacity-80"
            >
              {m.profiles?.avatar_url ? (
                <img src={m.profiles.avatar_url} alt={m.profiles.username} className="h-full w-full rounded-full object-cover" />
              ) : (
                (m.profiles?.username ?? m.author_id?.slice(0, 2) ?? "?").toString().slice(0, 1).toUpperCase()
              )}
            </button>
            <div className="min-w-0 flex-1">
              <button
                onClick={() => m.author_id && setProfileModalUserId(m.author_id)}
                className="mr-2 font-medium text-white hover:underline"
              >
                {m.profiles?.username ?? "Unknown"}
              </button>
              <span className="text-xs text-gray-500">
                {m.created_at && format(new Date(m.created_at), "MMM d, HH:mm")}
              </span>
              {m.reply_to && m.reply_message && (
                <div className="mb-1 ml-4 border-l-2 border-indigo-500 pl-2 text-xs">
                  <span className="text-gray-400">
                    Replying to <span className="text-indigo-400">{m.reply_message.profiles?.username || "Unknown"}</span>
                  </span>
                  <p className="text-gray-500 line-clamp-1">{m.reply_message.content}</p>
                </div>
              )}
              {(() => {
                // Check if message is just a GIF URL
                const gifMatch = m.content.match(/^(https?:\/\/[^\s]+\.gif|https?:\/\/media\.giphy\.com\/[^\s]+|https?:\/\/[^\s]*giphy[^\s]*|https?:\/\/[^\s]*tenor[^\s]*|https?:\/\/yallah-flax\.vercel\.app\/cdn\/[^\s]+)$/i);
                const isOnlyGif = gifMatch && gifMatch[0] === m.content.trim();
                
                // If it's only a GIF, don't show the text
                if (isOnlyGif) return null;
                
                return (
                  <div className="prose prose-invert max-w-none break-words text-gray-200">
                    <div dangerouslySetInnerHTML={{
                      __html: m.content.replace(/@(\w+)/g, (match, username) => {
                        const isSelf = username === currentUsername;
                        return `<span class="${isSelf ? 'bg-yellow-500/20 text-yellow-300 px-1 rounded font-semibold' : 'bg-indigo-500/20 text-indigo-300 px-1 rounded'}">${match}</span>`;
                      })
                    }} />
                  </div>
                );
              })()}
              {m.attachments && m.attachments.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-2">
                  {m.attachments.map((att, idx) => {
                    const isImage = att.type.startsWith("image/");
                    if (isImage) {
                      return (
                        <a key={idx} href={att.url} target="_blank" rel="noopener noreferrer">
                          <img
                            src={att.url}
                            alt={att.name}
                            className="max-h-80 max-w-md rounded border border-[#404249] object-contain hover:opacity-90"
                          />
                        </a>
                      );
                    }
                    return (
                      <a
                        key={idx}
                        href={att.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-2 rounded bg-[#404249] px-3 py-2 text-sm hover:bg-[#4f5058]"
                      >
                        <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                        </svg>
                        <span className="truncate">{att.name}</span>
                      </a>
                    );
                  })}
                </div>
              )}
              <MessageEmbeds content={m.content} />
              <div className="mt-1 hidden gap-2 group-hover:flex">
                <button
                  onClick={() => setReplyingTo(m)}
                  className="rounded bg-[#404249] px-2 py-1 text-xs hover:bg-[#4f5058]"
                >
                  Reply
                </button>
                {m.author_id === userId && (
                  <button
                    onClick={() => handleDelete(m.id)}
                    className="rounded bg-red-500/20 px-2 py-1 text-xs text-red-400 hover:bg-red-500/30"
                  >
                    Delete
                  </button>
                )}
              </div>
            </div>
          </div>
        );
        })}
        {typingUsers.size > 0 && (
          <div className="flex items-center gap-2 py-2 text-sm text-gray-400">
            <div className="flex gap-1">
              <span className="animate-bounce">●</span>
              <span className="animate-bounce" style={{ animationDelay: "0.1s" }}>●</span>
              <span className="animate-bounce" style={{ animationDelay: "0.2s" }}>●</span>
            </div>
            <span>
              {Array.from(typingUsers.values()).join(", ")} {typingUsers.size === 1 ? "is" : "are"} typing...
            </span>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>
      <form onSubmit={handleSend} className="border-t border-[#1e1f22] p-4">
        {replyingTo && (
          <div className="mb-2 flex items-center gap-2 rounded bg-[#2b2d31] px-3 py-2 text-sm">
            <span className="text-gray-400">Replying to {replyingTo.profiles?.username || "Unknown"}</span>
            <button
              type="button"
              onClick={() => setReplyingTo(null)}
              className="ml-auto text-gray-500 hover:text-gray-300"
            >
              ✕
            </button>
          </div>
        )}
        {selectedFiles.length > 0 && (
          <div className="mb-2 flex flex-wrap gap-2">
            {selectedFiles.map((file, idx) => (
              <div key={idx} className="flex items-center gap-2 rounded bg-[#2b2d31] px-3 py-2 text-sm">
                <span className="truncate max-w-[200px]">{file.name}</span>
                <button
                  type="button"
                  onClick={() => setSelectedFiles(prev => prev.filter((_, i) => i !== idx))}
                  className="text-gray-500 hover:text-gray-300"
                >
                  ✕
                </button>
              </div>
            ))}
          </div>
        )}
        <div className="flex gap-2 rounded-lg bg-[#404249] px-4 py-2">
          <input
            type="file"
            ref={fileInputRef}
            multiple
            onChange={(e) => {
              const files = Array.from(e.target.files || []);
              setSelectedFiles(prev => [...prev, ...files]);
              e.target.value = "";
            }}
            className="hidden"
          />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="text-gray-400 hover:text-gray-200"
            title="Attach files"
          >
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
          </button>
          <button
            type="button"
            onClick={() => setShowGifPicker(true)}
            className="text-gray-400 hover:text-gray-200"
            title="Send GIF"
          >
            <span className="text-lg">GIF</span>
          </button>
          <input
            type="text"
            value={content}
            onChange={(e) => { setContent(e.target.value); handleTyping(); }}
            placeholder={`Message #${channel?.name ?? ""}`}
            className="flex-1 bg-transparent text-sm outline-none placeholder:text-gray-500"
          />
          <button 
            type="submit" 
            disabled={sending || uploadingFiles || (!content.trim() && selectedFiles.length === 0)} 
            className="rounded bg-indigo-500 px-4 py-1.5 text-sm font-medium hover:bg-indigo-600 disabled:opacity-50"
          >
            {uploadingFiles ? "Uploading..." : "Send"}
          </button>
        </div>
      </form>
      {profileModalUserId && (
        <UserProfileModal
          userId={profileModalUserId}
          onClose={() => setProfileModalUserId(null)}
        />
      )}
      {showGifPicker && (
        <GifPicker
          onSelect={async (gifUrl) => {
            setShowGifPicker(false);
            if (!currentChannelId || sending) return;
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return;
            setSending(true);
            await supabase.from("messages").insert({
              channel_id: currentChannelId,
              author_id: user.id,
              content: gifUrl,
            });
            setSending(false);
          }}
          onClose={() => setShowGifPicker(false)}
        />
      )}
    </div>
  );
}

function DMArea({ conversationId }: { conversationId: string }) {
  const supabase = createSupabaseBrowserClient();
  const [messages, setMessages] = useState<(import("../lib/types").DirectMessage)[]>([]);
  const [loading, setLoading] = useState(true);
  const [content, setContent] = useState("");
  const [sending, setSending] = useState(false);
  const [inCall, setInCall] = useState(false);
  const [otherUser, setOtherUser] = useState<Profile | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [uploadingFiles, setUploadingFiles] = useState(false);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [profileModalUserId, setProfileModalUserId] = useState<string | null>(null);
  const [currentUsername, setCurrentUsername] = useState<string>("");
  const [showGifPicker, setShowGifPicker] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const load = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      setUserId(user?.id ?? null);
      
      if (user) {
        const { data: profile } = await supabase
          .from("profiles")
          .select("username")
          .eq("id", user.id)
          .single();
        setCurrentUsername(profile?.username || "");
      }
      
      // Get conversation details to find other user
      const { data: convo } = await supabase
        .from("direct_conversations")
        .select("*")
        .eq("id", conversationId)
        .single();
      
      if (convo && user) {
        const otherUserId = convo.user_a_id === user.id ? convo.user_b_id : convo.user_a_id;
        const { data: profile } = await supabase
          .from("profiles")
          .select("*")
          .eq("id", otherUserId)
          .single();
        setOtherUser(profile as Profile | null);
      }
      
      const { data: rows } = await supabase
        .from("direct_messages")
        .select("*")
        .eq("conversation_id", conversationId)
        .order("created_at", { ascending: true });
      const list = (rows as (import("../lib/types").DirectMessage)[]) ?? [];
      if (list.length > 0) {
        const authorIds = [...new Set(list.map((m) => m.author_id).filter(Boolean))] as string[];
        const { data: profs } = await supabase.from("profiles").select("*").in("id", authorIds);
        const profileMap = new Map<string, Profile>(((profs ?? []) as Profile[]).map((p) => [p.id, p]));
        setMessages(list.map((m) => ({ ...m, profiles: m.author_id ? profileMap.get(m.author_id) ?? null : null })));
      } else {
        setMessages(list);
      }
      setLoading(false);
    };
    load();
  }, [conversationId, supabase]);

  useEffect(() => {
    const ch = supabase.channel(`dm:${conversationId}`).on(
      "postgres_changes",
      { event: "INSERT", schema: "public", table: "direct_messages", filter: `conversation_id=eq.${conversationId}` },
      async (payload) => {
        const newRow = payload.new as import("../lib/types").DirectMessage;
        let profile: Profile | null = null;
        if (newRow.author_id) {
          const { data } = await supabase.from("profiles").select("*").eq("id", newRow.author_id).maybeSingle();
          profile = data as Profile | null;
        }
        setMessages((prev) => [...prev, { ...newRow, profiles: profile }]);
      }
    ).subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [conversationId, supabase]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if ((!content.trim() && selectedFiles.length === 0) || sending) return;
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    setSending(true);
    
    // Upload files if any
    const attachments: Array<{ url: string; name: string; type: string }> = [];
    if (selectedFiles.length > 0) {
      setUploadingFiles(true);
      for (const file of selectedFiles) {
        const fileName = `${user.id}/${Date.now()}-${file.name}`;
        const { data, error } = await supabase.storage
          .from("attachments")
          .upload(fileName, file);
        
        if (!error && data) {
          const { data: { publicUrl } } = supabase.storage
            .from("attachments")
            .getPublicUrl(data.path);
          
          attachments.push({
            url: publicUrl,
            name: file.name,
            type: file.type,
          });
        }
      }
      setUploadingFiles(false);
    }
    
    const { data: insertedMessage } = await supabase.from("direct_messages").insert({
      conversation_id: conversationId,
      author_id: user.id,
      content: content.trim() || "",
      attachments: attachments.length > 0 ? attachments : [],
    }).select().single();
    
    // Create mentions if any
    if (insertedMessage && content.trim()) {
      await createDMMentions(supabase, insertedMessage.id, conversationId, content.trim(), user.id);
    }
    
    setContent("");
    setSelectedFiles([]);
    setSending(false);
  };

  const handleStartCall = async () => {
    if (!userId || !otherUser) return;
    
    // Send incoming call notification
    const channel = supabase.channel(`dm_call:${conversationId}`);
    await channel.send({
      type: "broadcast",
      event: "incoming_call",
      payload: {
        from: userId,
        to: otherUser.id,
        username: (await supabase.from("profiles").select("username").eq("id", userId).single()).data?.username || "Unknown",
      },
    });
    
    setInCall(true);
  };

  if (loading) return <div className="flex flex-1 items-center justify-center bg-[#313338]">Loading...</div>;

  return (
    <>
      {inCall && otherUser && (
        <PrivateCall
          conversationId={conversationId}
          otherUsername={otherUser.username}
          onLeave={() => setInCall(false)}
        />
      )}
      <div className="flex flex-1 flex-col bg-[#313338]">
        <div className="flex h-12 items-center justify-between border-b border-[#1e1f22] px-4">
          <h2 className="font-semibold">{otherUser?.username ?? "Direct Message"}</h2>
          <div className="flex gap-2">
            <button
              onClick={() => setInCall(true)}
              className="rounded p-2 text-gray-400 hover:bg-white/5 hover:text-white"
              title="Start voice call"
            >
              <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 20 20">
                <path d="M2 3a1 1 0 011-1h2.153a1 1 0 01.986.836l.74 4.435a1 1 0 01-.54 1.06l-1.548.773a11.037 11.037 0 006.105 6.105l.774-1.548a1 1 0 011.059-.54l4.435.74a1 1 0 01.836.986V17a1 1 0 01-1 1h-2C7.82 18 2 12.18 2 5V3z" />
              </svg>
            </button>
            <button
              onClick={() => setInCall(true)}
              className="rounded p-2 text-gray-400 hover:bg-white/5 hover:text-white"
              title="Start video call"
            >
              <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 20 20">
                <path d="M2 6a2 2 0 012-2h6a2 2 0 012 2v8a2 2 0 01-2 2H4a2 2 0 01-2-2V6zM14.553 7.106A1 1 0 0014 8v4a1 1 0 00.553.894l2 1A1 1 0 0018 13V7a1 1 0 00-1.447-.894l-2 1z" />
              </svg>
            </button>
          </div>
        </div>
        <div className="flex-1 overflow-y-auto p-4">
          {messages.map((m) => {
            const mentionedSelf = m.content && m.content.includes(`@${currentUsername}`);
            return (
            <div key={m.id} className={`flex gap-3 py-1 ${mentionedSelf ? 'bg-yellow-500/10 border-l-2 border-yellow-500 pl-2' : ''}`}>
              <button
                onClick={() => m.author_id && setProfileModalUserId(m.author_id)}
                className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-[#5865f2] text-sm font-bold hover:opacity-80"
              >
                {m.profiles?.avatar_url ? (
                  <img src={m.profiles.avatar_url} alt={m.profiles.username} className="h-full w-full rounded-full object-cover" />
                ) : (
                  (m.profiles?.username ?? "?").toString().slice(0, 1).toUpperCase()
                )}
              </button>
              <div className="min-w-0 flex-1">
                <button
                  onClick={() => m.author_id && setProfileModalUserId(m.author_id)}
                  className="mr-2 font-medium text-white hover:underline"
                >
                  {m.profiles?.username ?? "Unknown"}
                </button>
                <span className="text-xs text-gray-500">{format(new Date(m.created_at), "MMM d, HH:mm")}</span>
                {(() => {
                  // Check if message is just a GIF URL
                  const gifMatch = m.content?.match(/^(https?:\/\/[^\s]+\.gif|https?:\/\/media\.giphy\.com\/[^\s]+|https?:\/\/[^\s]*giphy[^\s]*|https?:\/\/[^\s]*tenor[^\s]*|https?:\/\/yallah-flax\.vercel\.app\/cdn\/[^\s]+)$/i);
                  const isOnlyGif = m.content && gifMatch && gifMatch[0] === m.content.trim();
                  
                  // If it's only a GIF, don't show the text
                  if (isOnlyGif || !m.content) return null;
                  
                  return (
                    <div dangerouslySetInnerHTML={{
                      __html: m.content.replace(/@(\w+)/g, (match, username) => {
                        const isSelf = username === currentUsername;
                        return `<span class="${isSelf ? 'bg-yellow-500/20 text-yellow-300 px-1 rounded font-semibold' : 'bg-indigo-500/20 text-indigo-300 px-1 rounded'}">${match}</span>`;
                      })
                    }} className="text-gray-200" />
                  );
                })()}
                {m.attachments && m.attachments.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-2">
                    {m.attachments.map((att: { url: string; name: string; type: string }, idx: number) => {
                      const isImage = att.type.startsWith("image/");
                      if (isImage) {
                        return (
                          <a key={idx} href={att.url} target="_blank" rel="noopener noreferrer">
                            <img
                              src={att.url}
                              alt={att.name}
                              className="max-h-80 max-w-md rounded border border-[#404249] object-contain hover:opacity-90"
                            />
                          </a>
                        );
                      }
                      return (
                        <a
                          key={idx}
                          href={att.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-2 rounded bg-[#404249] px-3 py-2 text-sm hover:bg-[#4f5058]"
                        >
                          <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                          </svg>
                          <span className="truncate">{att.name}</span>
                        </a>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          );
          })}
          <div ref={messagesEndRef} />
        </div>
        <form onSubmit={handleSend} className="border-t border-[#1e1f22] p-4">
          {selectedFiles.length > 0 && (
            <div className="mb-2 flex flex-wrap gap-2">
              {selectedFiles.map((file, idx) => (
                <div key={idx} className="flex items-center gap-2 rounded bg-[#2b2d31] px-3 py-2 text-sm">
                  <span className="truncate max-w-[200px]">{file.name}</span>
                  <button
                    type="button"
                    onClick={() => setSelectedFiles(prev => prev.filter((_, i) => i !== idx))}
                    className="text-gray-500 hover:text-gray-300"
                  >
                    ✕
                  </button>
                </div>
              ))}
            </div>
          )}
          <div className="flex gap-2 rounded-lg bg-[#404249] px-4 py-2">
            <input
              type="file"
              ref={fileInputRef}
              multiple
              onChange={(e) => {
                const files = Array.from(e.target.files || []);
                setSelectedFiles(prev => [...prev, ...files]);
                e.target.value = "";
              }}
              className="hidden"
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="text-gray-400 hover:text-gray-200"
              title="Attach files"
            >
              <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
            </button>
            <button
              type="button"
              onClick={() => setShowGifPicker(true)}
              className="text-gray-400 hover:text-gray-200"
              title="Send GIF"
            >
              <span className="text-lg">GIF</span>
            </button>
            <input
              type="text"
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="Message"
              className="flex-1 bg-transparent text-sm outline-none placeholder:text-gray-500"
            />
            <button 
              type="submit" 
              disabled={sending || uploadingFiles || (!content.trim() && selectedFiles.length === 0)} 
              className="rounded bg-indigo-500 px-4 py-1.5 text-sm font-medium hover:bg-indigo-600 disabled:opacity-50"
            >
              {uploadingFiles ? "Uploading..." : "Send"}
            </button>
          </div>
        </form>
      </div>
      {profileModalUserId && (
        <UserProfileModal
          userId={profileModalUserId}
          onClose={() => setProfileModalUserId(null)}
        />
      )}
      {showGifPicker && (
        <GifPicker
          onSelect={async (gifUrl) => {
            setShowGifPicker(false);
            if (sending) return;
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return;
            setSending(true);
            await supabase.from("direct_messages").insert({
              conversation_id: conversationId,
              author_id: user.id,
              content: gifUrl,
            });
            setSending(false);
          }}
          onClose={() => setShowGifPicker(false)}
        />
      )}
    </>
  );
}
