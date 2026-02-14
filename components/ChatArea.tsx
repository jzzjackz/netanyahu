"use client";

import { useEffect, useState, useRef } from "react";
import { createSupabaseBrowserClient } from "../lib/supabaseClient";
import { useAppStore } from "../lib/store";
import type { Message, Channel, Profile } from "../lib/types";
import { format } from "date-fns";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

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
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => setUserId(user?.id ?? null));
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
      setChannel(chRes.data as Channel | null);
      const msgList = (msgRes.data as Message[]) ?? [];
      if (msgList.length > 0) {
        const authorIds = [...new Set(msgList.map((m) => m.author_id).filter(Boolean))] as string[];
        const { data: profs } = await supabase.from("profiles").select("*").in("id", authorIds);
        const profileMap = new Map<string, Profile>(((profs ?? []) as Profile[]).map((p) => [p.id, p]));
        setMessages(msgList.map((m) => ({ ...m, profiles: m.author_id ? profileMap.get(m.author_id) ?? null : null })));
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
        setMessages((prev) => [...prev, { ...newRow, profiles: profile }]);
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
    if (!content.trim() || !currentChannelId || sending) return;
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
    
    await supabase.from("messages").insert({
      channel_id: currentChannelId,
      author_id: user.id,
      content: content.trim(),
    });
    setContent("");
    setSending(false);
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

  return (
    <div className="flex flex-1 flex-col bg-[#313338]">
      <div className="flex h-12 items-center border-b border-[#1e1f22] px-4">
        <span className="text-gray-500">#</span>
        <h2 className="ml-1 font-semibold">{channel?.name ?? "Channel"}</h2>
      </div>
      <div ref={scrollContainerRef} className="flex-1 overflow-y-auto p-4">
        {messages.length === 0 && (
          <p className="text-gray-500">No messages yet. Send the first one!</p>
        )}
        {messages.map((m) => (
          <div key={m.id} className="group flex gap-3 py-1 hover:bg-white/5">
            <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-[#5865f2] text-sm font-bold">
              {(m.profiles?.username ?? m.author_id?.slice(0, 2) ?? "?").toString().slice(0, 1).toUpperCase()}
            </div>
            <div className="min-w-0 flex-1">
              <span className="mr-2 font-medium text-white">
                {m.profiles?.username ?? "Unknown"}
              </span>
              <span className="text-xs text-gray-500">
                {m.created_at && format(new Date(m.created_at), "MMM d, HH:mm")}
              </span>
              <div className="prose prose-invert max-w-none break-words text-gray-200">
                <ReactMarkdown remarkPlugins={[remarkGfm]}>{m.content}</ReactMarkdown>
              </div>
            </div>
          </div>
        ))}
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
        <div className="flex gap-2 rounded-lg bg-[#404249] px-4 py-2">
          <input
            type="text"
            value={content}
            onChange={(e) => { setContent(e.target.value); handleTyping(); }}
            placeholder={`Message #${channel?.name ?? ""}`}
            className="flex-1 bg-transparent text-sm outline-none placeholder:text-gray-500"
          />
          <button type="submit" disabled={sending || !content.trim()} className="rounded bg-indigo-500 px-4 py-1.5 text-sm font-medium hover:bg-indigo-600 disabled:opacity-50">
            Send
          </button>
        </div>
      </form>
    </div>
  );
}

function DMArea({ conversationId }: { conversationId: string }) {
  const supabase = createSupabaseBrowserClient();
  const [messages, setMessages] = useState<(import("../lib/types").DirectMessage)[]>([]);
  const [loading, setLoading] = useState(true);
  const [content, setContent] = useState("");
  const [sending, setSending] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const load = async () => {
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
    if (!content.trim() || sending) return;
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    setSending(true);
    await supabase.from("direct_messages").insert({
      conversation_id: conversationId,
      author_id: user.id,
      content: content.trim(),
    });
    setContent("");
    setSending(false);
  };

  if (loading) return <div className="flex flex-1 items-center justify-center bg-[#313338]">Loading...</div>;

  return (
    <div className="flex flex-1 flex-col bg-[#313338]">
      <div className="flex h-12 items-center border-b border-[#1e1f22] px-4">
        <h2 className="font-semibold">Direct Message</h2>
      </div>
      <div className="flex-1 overflow-y-auto p-4">
        {messages.map((m) => (
          <div key={m.id} className="flex gap-3 py-1">
            <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-[#5865f2] text-sm font-bold">
              {(m.profiles?.username ?? "?").toString().slice(0, 1).toUpperCase()}
            </div>
            <div>
              <span className="mr-2 font-medium text-white">{m.profiles?.username ?? "Unknown"}</span>
              <span className="text-xs text-gray-500">{format(new Date(m.created_at), "MMM d, HH:mm")}</span>
              <p className="text-gray-200">{m.content}</p>
            </div>
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>
      <form onSubmit={handleSend} className="border-t border-[#1e1f22] p-4">
        <div className="flex gap-2 rounded-lg bg-[#404249] px-4 py-2">
          <input
            type="text"
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="Message"
            className="flex-1 bg-transparent text-sm outline-none placeholder:text-gray-500"
          />
          <button type="submit" disabled={sending || !content.trim()} className="rounded bg-indigo-500 px-4 py-1.5 text-sm font-medium hover:bg-indigo-600 disabled:opacity-50">
            Send
          </button>
        </div>
      </form>
    </div>
  );
}
