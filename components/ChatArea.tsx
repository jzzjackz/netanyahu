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
import MessageContent from "./MessageContent";
import FormattingToolbar from "./FormattingToolbar";

export default function ChatArea() {
  const supabase = createSupabaseBrowserClient();
  const { currentChannelId, currentConversationId, setConversation } = useAppStore();
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
  const [editingMessageId, setEditingMessageId] = useState<string | null>(null);
  const [editContent, setEditContent] = useState("");
  const [mentionSuggestions, setMentionSuggestions] = useState<Profile[]>([]);
  const [mentionQuery, setMentionQuery] = useState("");
  const [selectedMentionIndex, setSelectedMentionIndex] = useState(0);
  const [serverMembers, setServerMembers] = useState<Profile[]>([]);
  const [canSendMessages, setCanSendMessages] = useState(true);
  const [showFormattingToolbar, setShowFormattingToolbar] = useState(false);
  const [reactingToMessage, setReactingToMessage] = useState<string | null>(null);
  const [friends, setFriends] = useState<Profile[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

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
        
        // Load friends list
        const { data: accepted } = await supabase
          .from("friend_requests")
          .select("from_user_id, to_user_id")
          .or(`from_user_id.eq.${user.id},to_user_id.eq.${user.id}`)
          .eq("status", "accepted");
        
        const ids = (accepted ?? []).flatMap((r: { from_user_id: string; to_user_id: string }) =>
          r.from_user_id === user.id ? [r.to_user_id] : [r.from_user_id]
        );
        
        if (ids.length > 0) {
          const { data: profs } = await supabase
            .from("profiles")
            .select("id, username, avatar_url, status")
            .in("id", ids);
          setFriends((profs as Profile[]) ?? []);
        }
      }
    });
  }, [supabase.auth]);

  useEffect(() => {
    if (!currentChannelId) {
      setChannel(null);
      setMessages([]);
      setServerMembers([]);
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
      
      // Check if user can send messages in this channel
      if (channelData && userId) {
        const { data: canSend } = await supabase.rpc("can_user_send_in_channel", {
          p_user_id: userId,
          p_channel_id: currentChannelId,
        });
        setCanSendMessages(canSend ?? true);
      }
      
      // Load server members for mention autocomplete
      if (channelData?.server_id) {
        const { data: members } = await supabase
          .from("server_members")
          .select("user_id")
          .eq("server_id", channelData.server_id);
        
        if (members && members.length > 0) {
          const { data: profiles } = await supabase
            .from("profiles")
            .select("id, username, avatar_url")
            .in("id", members.map((m: any) => m.user_id));
          
          setServerMembers((profiles as Profile[]) || []);
        }
      }
      
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

  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const value = e.target.value;
    setContent(value);
    handleTyping();
    
    // Check for @ mention
    const cursorPos = e.target.selectionStart || 0;
    const textBeforeCursor = value.slice(0, cursorPos);
    const match = textBeforeCursor.match(/@(\w*)$/);
    
    if (match) {
      const query = match[1].toLowerCase();
      setMentionQuery(query);
      
      // Filter members by query
      const filtered = serverMembers.filter((m) =>
        m.username.toLowerCase().startsWith(query) && m.id !== userId
      ).slice(0, 10);
      
      setMentionSuggestions(filtered);
      setSelectedMentionIndex(0);
    } else {
      setMentionSuggestions([]);
      setMentionQuery("");
    }
  };

  const handleMentionSelect = (username: string) => {
    const cursorPos = inputRef.current?.selectionStart || 0;
    const textBeforeCursor = content.slice(0, cursorPos);
    const textAfterCursor = content.slice(cursorPos);
    
    // Replace @query with @username
    const newTextBefore = textBeforeCursor.replace(/@\w*$/, `@${username} `);
    const newContent = newTextBefore + textAfterCursor;
    
    setContent(newContent);
    setMentionSuggestions([]);
    setMentionQuery("");
    
    // Focus back on input
    setTimeout(() => {
      if (inputRef.current) {
        inputRef.current.focus();
        inputRef.current.setSelectionRange(newTextBefore.length, newTextBefore.length);
      }
    }, 0);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (mentionSuggestions.length > 0) {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setSelectedMentionIndex((prev) =>
          prev < mentionSuggestions.length - 1 ? prev + 1 : 0
        );
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setSelectedMentionIndex((prev) =>
          prev > 0 ? prev - 1 : mentionSuggestions.length - 1
        );
      } else if (e.key === "Enter" || e.key === "Tab") {
        e.preventDefault();
        handleMentionSelect(mentionSuggestions[selectedMentionIndex].username);
      } else if (e.key === "Escape") {
        setMentionSuggestions([]);
        setMentionQuery("");
      }
    } else if (e.key === "Enter" && !e.shiftKey) {
      // Submit on Enter, allow Shift+Enter for new line
      e.preventDefault();
      const form = e.currentTarget.closest('form');
      if (form) form.requestSubmit();
    }
  };

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

  const handleEdit = (message: Message) => {
    setEditingMessageId(message.id);
    setEditContent(message.content);
  };

  const handleSaveEdit = async (messageId: string) => {
    if (!editContent.trim()) return;
    
    await supabase
      .from("messages")
      .update({ 
        content: editContent.trim(),
        edited_at: new Date().toISOString()
      })
      .eq("id", messageId);
    
    setMessages((prev) =>
      prev.map((m) =>
        m.id === messageId ? { ...m, content: editContent.trim(), edited_at: new Date().toISOString() } : m
      )
    );
    
    setEditingMessageId(null);
    setEditContent("");
  };

  const handleCancelEdit = () => {
    setEditingMessageId(null);
    setEditContent("");
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
    const getStatusColor = (status: string) => {
      switch (status) {
        case "online": return "bg-[#23a55a]";
        case "idle": return "bg-[#f0b232]";
        case "dnd": return "bg-[#f23f43]";
        default: return "bg-[#80848e]";
      }
    };
    
    const openDM = async (friendId: string) => {
      if (!userId) return;
      const [userA, userB] = userId < friendId ? [userId, friendId] : [friendId, userId];
      let { data: conv } = await supabase
        .from("direct_conversations")
        .select("id")
        .eq("user_a_id", userA)
        .eq("user_b_id", userB)
        .maybeSingle();
      if (!conv) {
        const { data: inserted } = await supabase
          .from("direct_conversations")
          .insert({ user_a_id: userA, user_b_id: userB })
          .select("id")
          .single();
        conv = inserted;
      }
      if (conv) setConversation(conv.id);
    };
    
    const filteredFriends = friends.filter(friend => 
      friend.username.toLowerCase().includes(searchQuery.toLowerCase())
    );
    
    return (
      <div className="flex flex-1 flex-col bg-[#313338]">
        {/* Top Navigation Bar */}
        <div className="flex h-12 items-center border-b border-[#1e1f22] px-4 shadow-sm">
          <div className="flex items-center gap-2 text-[#949ba4]">
            <svg className="h-6 w-6" fill="currentColor" viewBox="0 0 24 24">
              <path d="M13 10a4 4 0 1 0 0-8 4 4 0 0 0 0 8Z"/>
              <path d="M3 5v-.75C3 3.56 3.56 3 4.25 3s1.24.56 1.33 1.25C6.12 8.65 9.46 12 13 12h1a8 8 0 0 1 8 8 2 2 0 0 1-2 2 .21.21 0 0 1-.2-.15 7.65 7.65 0 0 0-1.32-2.3c-.15-.2-.42-.06-.39.17l.25 2c.02.15-.1.28-.25.28H9a2 2 0 0 1-2-2v-2.22c0-1.57-.67-3.05-1.53-4.37A15.85 15.85 0 0 1 3 5Z"/>
            </svg>
            <span className="ml-2 text-base font-semibold text-white">Friends</span>
          </div>
        </div>
        
        {/* Friends List */}
        <div className="flex-1 overflow-y-auto p-8">
          <div className="mb-4">
            <input
              type="text"
              placeholder="Search"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full rounded bg-[#1e1f22] px-3 py-2 text-sm text-[#dbdee1] placeholder-[#80848e] outline-none"
            />
          </div>
          
          {filteredFriends.length > 0 ? (
            <>
              <div className="mb-4 text-xs font-semibold uppercase text-[#949ba4]">
                All Friends — {filteredFriends.length}
              </div>
              <div className="space-y-2">
                {filteredFriends.map((friend) => (
                  <div
                    key={friend.id}
                    className="flex items-center gap-3 rounded-lg border-t border-[#3f4147] p-4 hover:bg-[#393c43]"
                  >
                    <button
                      onClick={() => setProfileModalUserId(friend.id)}
                      className="relative flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-[#5865f2] text-sm font-semibold"
                    >
                      {friend.avatar_url ? (
                        <img src={friend.avatar_url} alt={friend.username} className="h-full w-full rounded-full object-cover" />
                      ) : (
                        friend.username.slice(0, 1).toUpperCase()
                      )}
                      <div className={`absolute -bottom-0.5 -right-0.5 h-3.5 w-3.5 rounded-full border-[3px] border-[#313338] ${getStatusColor(friend.status)}`} />
                    </button>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-semibold text-[#dbdee1]">{friend.username}</div>
                      <div className="text-xs text-[#949ba4] capitalize">{friend.status}</div>
                    </div>
                    <button
                      onClick={() => openDM(friend.id)}
                      className="rounded-full bg-[#2b2d31] p-2 hover:bg-[#35373c]"
                      title="Message"
                    >
                      <svg className="h-5 w-5 text-[#b5bac1]" fill="currentColor" viewBox="0 0 20 20">
                        <path d="M2 5a2 2 0 012-2h7a2 2 0 012 2v4a2 2 0 01-2 2H9l-3 3v-3H4a2 2 0 01-2-2V5z"/>
                        <path d="M15 7v2a4 4 0 01-4 4H9.828l-1.766 1.767c.28.149.599.233.938.233h2l3 3v-3h2a2 2 0 002-2V9a2 2 0 00-2-2h-1z"/>
                      </svg>
                    </button>
                  </div>
                ))}
              </div>
            </>
          ) : searchQuery ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <svg className="h-32 w-32 mb-4 text-[#4e5058]" fill="currentColor" viewBox="0 0 24 24">
                <path d="M13 10a4 4 0 1 0 0-8 4 4 0 0 0 0 8Z"/>
                <path d="M3 5v-.75C3 3.56 3.56 3 4.25 3s1.24.56 1.33 1.25C6.12 8.65 9.46 12 13 12h1a8 8 0 0 1 8 8 2 2 0 0 1-2 2 .21.21 0 0 1-.2-.15 7.65 7.65 0 0 0-1.32-2.3c-.15-.2-.42-.06-.39.17l.25 2c.02.15-.1.28-.25.28H9a2 2 0 0 1-2-2v-2.22c0-1.57-.67-3.05-1.53-4.37A15.85 15.85 0 0 1 3 5Z"/>
              </svg>
              <h3 className="text-base font-semibold text-white mb-2">No friends found</h3>
              <p className="text-sm text-[#b5bac1]">Try searching for something else</p>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <svg className="h-32 w-32 mb-4 text-[#4e5058]" fill="currentColor" viewBox="0 0 24 24">
                <path d="M13 10a4 4 0 1 0 0-8 4 4 0 0 0 0 8Z"/>
                <path d="M3 5v-.75C3 3.56 3.56 3 4.25 3s1.24.56 1.33 1.25C6.12 8.65 9.46 12 13 12h1a8 8 0 0 1 8 8 2 2 0 0 1-2 2 .21.21 0 0 1-.2-.15 7.65 7.65 0 0 0-1.32-2.3c-.15-.2-.42-.06-.39.17l.25 2c.02.15-.1.28-.25.28H9a2 2 0 0 1-2-2v-2.22c0-1.57-.67-3.05-1.53-4.37A15.85 15.85 0 0 1 3 5Z"/>
              </svg>
              <h3 className="text-base font-semibold text-white mb-2">No friends yet</h3>
              <p className="text-sm text-[#b5bac1]">Add friends to start chatting</p>
            </div>
          )}
        </div>
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
              {editingMessageId === m.id ? (
                <div className="mt-2">
                  <input
                    type="text"
                    value={editContent}
                    onChange={(e) => setEditContent(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") handleSaveEdit(m.id);
                      if (e.key === "Escape") handleCancelEdit();
                    }}
                    className="w-full rounded bg-[#404249] px-3 py-2 text-sm text-white outline-none"
                    autoFocus
                  />
                  <div className="mt-1 flex gap-2 text-xs text-gray-400">
                    <span>escape to <button onClick={handleCancelEdit} className="text-indigo-400 hover:underline">cancel</button></span>
                    <span>• enter to <button onClick={() => handleSaveEdit(m.id)} className="text-indigo-400 hover:underline">save</button></span>
                  </div>
                </div>
              ) : (
                <>
                  {(() => {
                    // Check if message is just a GIF URL
                    const gifMatch = m.content.match(/^(https?:\/\/[^\s]+\.gif|https?:\/\/media\.giphy\.com\/[^\s]+|https?:\/\/[^\s]*giphy[^\s]*|https?:\/\/[^\s]*tenor[^\s]*|https?:\/\/yallah-flax\.vercel\.app\/cdn\/[^\s]+)$/i);
                    const isOnlyGif = gifMatch && gifMatch[0] === m.content.trim();
                    
                    // If it's only a GIF, don't show the text
                    if (isOnlyGif) return null;
                    
                    return (
                      <>
                        <MessageContent content={m.content} currentUsername={currentUsername} />
                        {m.edited_at && (
                          <span className="ml-1 text-xs text-gray-500">(edited)</span>
                        )}
                      </>
                    );
                  })()}
                </>
              )}
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
              {editingMessageId !== m.id && (
                <div className="mt-1 hidden gap-2 group-hover:flex">
                  <button
                    onClick={() => setReplyingTo(m)}
                    className="rounded bg-[#404249] px-2 py-1 text-xs hover:bg-[#4f5058]"
                  >
                    Reply
                  </button>
                  {m.author_id === userId && (
                    <>
                      <button
                        onClick={() => handleEdit(m)}
                        className="rounded bg-[#404249] px-2 py-1 text-xs hover:bg-[#4f5058]"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => handleDelete(m.id)}
                        className="rounded bg-red-500/20 px-2 py-1 text-xs text-red-400 hover:bg-red-500/30"
                      >
                        Delete
                      </button>
                    </>
                  )}
                </div>
              )}
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
      <form onSubmit={handleSend} className="relative border-t border-[#1e1f22] p-4">
        {!canSendMessages && (
          <div className="mb-2 rounded bg-red-500/20 px-3 py-2 text-sm text-red-300">
            You do not have permission to send messages in this channel.
          </div>
        )}
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
            disabled={!canSendMessages}
            className="text-gray-400 hover:text-gray-200 disabled:opacity-50 disabled:cursor-not-allowed"
            title="Attach files"
          >
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
          </button>
          <button
            type="button"
            onClick={() => setShowGifPicker(true)}
            disabled={!canSendMessages}
            className="text-gray-400 hover:text-gray-200 disabled:opacity-50 disabled:cursor-not-allowed"
            title="Send GIF"
          >
            <span className="text-lg">GIF</span>
          </button>
          <textarea
            ref={inputRef as any}
            value={content}
            onChange={handleInputChange}
            onKeyDown={handleKeyDown}
            placeholder={canSendMessages ? `Message #${channel?.name ?? ""}` : "You cannot send messages in this channel"}
            disabled={!canSendMessages}
            className="flex-1 resize-none bg-transparent text-sm outline-none placeholder:text-gray-500 max-h-32 overflow-y-auto disabled:cursor-not-allowed disabled:text-gray-500"
            rows={1}
            onInput={(e) => {
              const target = e.target as HTMLTextAreaElement;
              target.style.height = 'auto';
              target.style.height = Math.min(target.scrollHeight, 128) + 'px';
            }}
          />
          <button 
            type="submit" 
            disabled={!canSendMessages || sending || uploadingFiles || (!content.trim() && selectedFiles.length === 0)} 
            className="rounded bg-indigo-500 px-4 py-1.5 text-sm font-medium hover:bg-indigo-600 disabled:opacity-50"
          >
            {uploadingFiles ? "Uploading..." : "Send"}
          </button>
        </div>
        {mentionSuggestions.length > 0 && (
          <div className="absolute bottom-full left-0 mb-2 w-64 rounded-lg bg-[#2b2d31] shadow-xl">
            <div className="p-2 text-xs font-semibold uppercase text-gray-400">
              Mention
            </div>
            <div className="max-h-64 overflow-y-auto">
              {mentionSuggestions.map((member, index) => (
                <button
                  key={member.id}
                  type="button"
                  onClick={() => handleMentionSelect(member.username)}
                  className={`flex w-full items-center gap-2 px-2 py-1.5 text-left ${
                    index === selectedMentionIndex ? "bg-[#5865f2]" : "hover:bg-[#404249]"
                  }`}
                >
                  <div className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-[#5865f2] text-xs font-bold">
                    {member.avatar_url ? (
                      <img
                        src={member.avatar_url}
                        alt={member.username}
                        className="h-full w-full rounded-full object-cover"
                      />
                    ) : (
                      member.username.slice(0, 1).toUpperCase()
                    )}
                  </div>
                  <span className="text-sm">{member.username}</span>
                </button>
              ))}
            </div>
          </div>
        )}
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
  const [editingMessageId, setEditingMessageId] = useState<string | null>(null);
  const [editContent, setEditContent] = useState("");
  const [incomingCall, setIncomingCall] = useState<{ from: string; username: string } | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const ringtoneRef = useRef<HTMLAudioElement | null>(null);

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

  // Listen for incoming calls
  useEffect(() => {
    if (!userId) return;

    const callChannel = supabase.channel(`dm_call:${conversationId}`);
    
    callChannel.on("broadcast", { event: "incoming_call" }, ({ payload }) => {
      if (payload.to === userId) {
        setIncomingCall({ from: payload.from, username: payload.username });
        
        // Play ringtone
        if (!ringtoneRef.current) {
          ringtoneRef.current = new Audio("/sounds/ringtone.ogg");
          ringtoneRef.current.loop = true;
        }
        ringtoneRef.current.play().catch(err => console.error("Failed to play ringtone:", err));
      }
    }).subscribe();

    return () => {
      supabase.removeChannel(callChannel);
      if (ringtoneRef.current) {
        ringtoneRef.current.pause();
        ringtoneRef.current = null;
      }
    };
  }, [conversationId, userId, supabase]);

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

  const handleEdit = (message: import("../lib/types").DirectMessage) => {
    setEditingMessageId(message.id);
    setEditContent(message.content || "");
  };

  const handleSaveEdit = async (messageId: string) => {
    if (!editContent.trim()) return;
    
    await supabase
      .from("direct_messages")
      .update({ 
        content: editContent.trim(),
        edited_at: new Date().toISOString()
      })
      .eq("id", messageId);
    
    setMessages((prev) =>
      prev.map((m) =>
        m.id === messageId ? { ...m, content: editContent.trim(), edited_at: new Date().toISOString() } : m
      )
    );
    
    setEditingMessageId(null);
    setEditContent("");
  };

  const handleCancelEdit = () => {
    setEditingMessageId(null);
    setEditContent("");
  };

  const handleStartCall = async () => {
    if (!userId || !otherUser) return;
    
    // Send incoming call notification
    console.log("📞 Starting call to:", otherUser.username, "conversation:", conversationId);
    const channel = supabase.channel(`call_offer:${conversationId}`);
    
    // Subscribe to channel first
    await new Promise((resolve) => {
      channel.subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          console.log("📞 Call channel subscribed");
          resolve(true);
        }
      });
    });
    
    // Now send the call offer
    await channel.send({
      type: "broadcast",
      event: "call_offer",
      payload: {
        from: userId,
        to: otherUser.id,
        username: (await supabase.from("profiles").select("username").eq("id", userId).single()).data?.username || "Unknown",
      },
    });
    console.log("📞 Call offer sent");
    
    setInCall(true);
  };

  const handleAcceptCall = () => {
    if (ringtoneRef.current) {
      ringtoneRef.current.pause();
      ringtoneRef.current = null;
    }
    setIncomingCall(null);
    setInCall(true);
  };

  const handleDeclineCall = () => {
    if (ringtoneRef.current) {
      ringtoneRef.current.pause();
      ringtoneRef.current = null;
    }
    setIncomingCall(null);
  };

  if (loading) return <div className="flex flex-1 items-center justify-center bg-[#313338]">Loading...</div>;

  return (
    <>
      {incomingCall && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80">
          <div className="w-full max-w-md rounded-lg bg-[#2b2d31] p-8 shadow-2xl">
            <div className="mb-6 flex flex-col items-center gap-4">
              <div className="flex h-24 w-24 items-center justify-center rounded-full bg-[#5865f2] text-3xl font-bold">
                {incomingCall.username[0]?.toUpperCase()}
              </div>
              <div className="text-center">
                <h2 className="text-2xl font-bold text-white">{incomingCall.username}</h2>
                <p className="text-sm text-gray-400">Incoming call...</p>
              </div>
            </div>
            <div className="flex gap-4">
              <button
                onClick={handleDeclineCall}
                className="flex flex-1 items-center justify-center gap-2 rounded-full bg-red-500 px-6 py-3 font-medium transition hover:bg-red-600"
              >
                <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M2 3a1 1 0 011-1h2.153a1 1 0 01.986.836l.74 4.435a1 1 0 01-.54 1.06l-1.548.773a11.037 11.037 0 006.105 6.105l.774-1.548a1 1 0 011.059-.54l4.435.74a1 1 0 01.836.986V17a1 1 0 01-1 1h-2C7.82 18 2 12.18 2 5V3z" />
                </svg>
                Decline
              </button>
              <button
                onClick={handleAcceptCall}
                className="flex flex-1 items-center justify-center gap-2 rounded-full bg-green-500 px-6 py-3 font-medium transition hover:bg-green-600"
              >
                <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M2 3a1 1 0 011-1h2.153a1 1 0 01.986.836l.74 4.435a1 1 0 01-.54 1.06l-1.548.773a11.037 11.037 0 006.105 6.105l.774-1.548a1 1 0 011.059-.54l4.435.74a1 1 0 01.836.986V17a1 1 0 01-1 1h-2C7.82 18 2 12.18 2 5V3z" />
                </svg>
                Accept
              </button>
            </div>
          </div>
        </div>
      )}
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
            <div key={m.id} className={`group flex gap-3 py-1 ${mentionedSelf ? 'bg-yellow-500/10 border-l-2 border-yellow-500 pl-2' : ''}`}>
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
                {editingMessageId === m.id ? (
                  <div className="mt-2">
                    <input
                      type="text"
                      value={editContent}
                      onChange={(e) => setEditContent(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") handleSaveEdit(m.id);
                        if (e.key === "Escape") handleCancelEdit();
                      }}
                      className="w-full rounded bg-[#404249] px-3 py-2 text-sm text-white outline-none"
                      autoFocus
                    />
                    <div className="mt-1 flex gap-2 text-xs text-gray-400">
                      <span>escape to <button onClick={handleCancelEdit} className="text-indigo-400 hover:underline">cancel</button></span>
                      <span>• enter to <button onClick={() => handleSaveEdit(m.id)} className="text-indigo-400 hover:underline">save</button></span>
                    </div>
                  </div>
                ) : (
                  <>
                    {(() => {
                      // Check if message is just a GIF URL
                      const gifMatch = m.content?.match(/^(https?:\/\/[^\s]+\.gif|https?:\/\/media\.giphy\.com\/[^\s]+|https?:\/\/[^\s]*giphy[^\s]*|https?:\/\/[^\s]*tenor[^\s]*|https?:\/\/yallah-flax\.vercel\.app\/cdn\/[^\s]+)$/i);
                      const isOnlyGif = m.content && gifMatch && gifMatch[0] === m.content.trim();
                      
                      // If it's only a GIF, don't show the text
                      if (isOnlyGif || !m.content) return null;
                      
                      return (
                        <MessageContent content={m.content} currentUsername={currentUsername} />
                      );
                    })()}
                    {m.edited_at && (
                      <span className="ml-1 text-xs text-gray-500">(edited)</span>
                    )}
                  </>
                )}
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
                <MessageEmbeds content={m.content || ""} />
                {editingMessageId !== m.id && (
                  <div className="mt-1 hidden gap-2 group-hover:flex">
                    {m.author_id === userId && (
                      <>
                        <button
                          onClick={() => handleEdit(m)}
                          className="rounded bg-[#404249] px-2 py-1 text-xs hover:bg-[#4f5058]"
                        >
                          Edit
                        </button>
                        <button
                          onClick={async () => {
                            if (!confirm("Delete this message?")) return;
                            await supabase.from("direct_messages").delete().eq("id", m.id);
                            setMessages((prev) => prev.filter((msg) => msg.id !== m.id));
                          }}
                          className="rounded bg-red-500/20 px-2 py-1 text-xs text-red-400 hover:bg-red-500/30"
                        >
                          Delete
                        </button>
                      </>
                    )}
                  </div>
                )}
              </div>
            </div>
          );
          })}
          <div ref={messagesEndRef} />
        </div>
        <form onSubmit={handleSend} className="relative border-t border-[#1e1f22] p-4">
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
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  const form = e.currentTarget.closest('form');
                  if (form) form.requestSubmit();
                }
              }}
              placeholder="Message"
              className="flex-1 resize-none bg-transparent text-sm outline-none placeholder:text-gray-500 max-h-32 overflow-y-auto"
              rows={1}
              onInput={(e) => {
                const target = e.target as HTMLTextAreaElement;
                target.style.height = 'auto';
                target.style.height = Math.min(target.scrollHeight, 128) + 'px';
              }}
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
