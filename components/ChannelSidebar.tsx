"use client";

import { useEffect, useState } from "react";
import { createSupabaseBrowserClient } from "../lib/supabaseClient";
import { useAppStore } from "../lib/store";
import type { Channel, Server, DirectConversation, Profile } from "../lib/types";
import ChannelPermissionsModal from "./ChannelPermissionsModal";

export default function ChannelSidebar() {
  const supabase = createSupabaseBrowserClient();
  const { currentServerId, currentChannelId, currentConversationId, setChannel, setConversation } = useAppStore();
  const [server, setServer] = useState<Server | null>(null);
  const [channels, setChannels] = useState<Channel[]>([]);
  const [conversations, setConversations] = useState<(DirectConversation & { otherUser?: Profile })[]>([]);
  const [userId, setUserId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);
  const [newChannelName, setNewChannelName] = useState("");
  const [creating, setCreating] = useState(false);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteLink, setInviteLink] = useState("");
  const [inviteGenerating, setInviteGenerating] = useState(false);
  const [channelType, setChannelType] = useState<"text" | "voice">("text");
  const [voiceChannelMembers, setVoiceChannelMembers] = useState<Map<string, Array<{ id: string; username: string }>>>(new Map());
  const [channelPermissionsOpen, setChannelPermissionsOpen] = useState(false);
  const [selectedChannel, setSelectedChannel] = useState<Channel | null>(null);
  const [conversationSearch, setConversationSearch] = useState("");

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => setUserId(user?.id ?? null));
  }, [supabase.auth]);

  useEffect(() => {
    if (!currentServerId) {
      setServer(null);
      setChannels([]);
      // Load DM conversations
      if (userId) {
        (async () => {
          setLoading(true);
          const { data: convos } = await supabase
            .from("direct_conversations")
            .select("*")
            .or(`user_a_id.eq.${userId},user_b_id.eq.${userId}`);
          
          if (convos && convos.length > 0) {
            const otherUserIds = convos.map((c: DirectConversation) => 
              c.user_a_id === userId ? c.user_b_id : c.user_a_id
            );
            const { data: profiles } = await supabase
              .from("profiles")
              .select("*")
              .in("id", otherUserIds);
            
            const profileMap = new Map((profiles ?? []).map((p: Profile) => [p.id, p]));
            setConversations(convos.map((c: DirectConversation) => ({
              ...c,
              otherUser: profileMap.get(c.user_a_id === userId ? c.user_b_id : c.user_a_id),
            })));
          } else {
            setConversations([]);
          }
          setLoading(false);
        })();
        
        // Subscribe to new conversations
        const channel = supabase
          .channel(`dm_list:${userId}`)
          .on(
            "postgres_changes",
            {
              event: "INSERT",
              schema: "public",
              table: "direct_conversations",
              filter: `user_a_id=eq.${userId}`,
            },
            async (payload) => {
              const newConvo = payload.new as DirectConversation;
              const { data: profile } = await supabase
                .from("profiles")
                .select("*")
                .eq("id", newConvo.user_b_id)
                .single();
              setConversations((prev) => [...prev, { ...newConvo, otherUser: profile }]);
            }
          )
          .on(
            "postgres_changes",
            {
              event: "INSERT",
              schema: "public",
              table: "direct_conversations",
              filter: `user_b_id=eq.${userId}`,
            },
            async (payload) => {
              const newConvo = payload.new as DirectConversation;
              const { data: profile } = await supabase
                .from("profiles")
                .select("*")
                .eq("id", newConvo.user_a_id)
                .single();
              setConversations((prev) => [...prev, { ...newConvo, otherUser: profile }]);
            }
          )
          .subscribe();
        
        return () => {
          supabase.removeChannel(channel);
        };
      } else {
        setLoading(false);
      }
      return;
    }
    setLoading(true);
    const load = async () => {
      const [sRes, cRes] = await Promise.all([
        supabase.from("servers").select("*").eq("id", currentServerId).single(),
        supabase.from("channels").select("*").eq("server_id", currentServerId).order("position", { ascending: true }),
      ]);
      setServer(sRes.data as Server | null);
      setChannels((cRes.data as Channel[]) ?? []);
      setLoading(false);
    };
    load();
  }, [currentServerId, userId, supabase]);

  // Subscribe to voice channel presence
  useEffect(() => {
    if (!currentServerId || channels.length === 0) return;

    const voiceChannels = channels.filter(c => c.type === "voice");
    if (voiceChannels.length === 0) return;

    const subscriptions = voiceChannels.map(vc => {
      const channel = supabase.channel(`voice_presence:${vc.id}`);
      
      channel
        .on("broadcast", { event: "user_joined" }, ({ payload }) => {
          setVoiceChannelMembers(prev => {
            const newMap = new Map(prev);
            const members = newMap.get(vc.id) || [];
            if (!members.some(m => m.id === payload.id)) {
              newMap.set(vc.id, [...members, { id: payload.id, username: payload.username }]);
            }
            return newMap;
          });
        })
        .on("broadcast", { event: "user_left" }, ({ payload }) => {
          setVoiceChannelMembers(prev => {
            const newMap = new Map(prev);
            const members = newMap.get(vc.id) || [];
            newMap.set(vc.id, members.filter(m => m.id !== payload.id));
            return newMap;
          });
        })
        .subscribe();

      return channel;
    });

    return () => {
      subscriptions.forEach(sub => supabase.removeChannel(sub));
    };
  }, [currentServerId, channels, supabase]);

  const handleGenerateInvite = async () => {
    if (!currentServerId || inviteGenerating) return;
    setInviteGenerating(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const code = Math.random().toString(36).slice(2, 10);
    const { error } = await supabase.from("invite_codes").insert({
      server_id: currentServerId,
      code,
      created_by: user.id,
    });
    setInviteGenerating(false);
    if (error) return;
    const url = `${typeof window !== "undefined" ? window.location.origin : ""}/invite/${code}`;
    setInviteLink(url);
    try {
      await navigator.clipboard.writeText(url);
    } catch {
      // ignore
    }
  };

  const handleCreateChannel = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newChannelName.trim() || !currentServerId || creating) return;
    setCreating(true);
    const maxPos = channels.length ? Math.max(...channels.map((c) => c.position), 0) : 0;
    const { data: ch, error } = await supabase
      .from("channels")
      .insert({ server_id: currentServerId, name: newChannelName.trim(), type: channelType, position: maxPos + 1 })
      .select()
      .single();
    setCreating(false);
    if (error || !ch) return;
    setChannels((prev) => [...prev, ch as Channel]);
    setNewChannelName("");
    setChannelType("text");
    setCreateOpen(false);
    if (channelType === "text") {
      setChannel(ch.id);
    }
  };

  const moveChannel = async (channelId: string, direction: "up" | "down") => {
    const channelIndex = channels.findIndex(c => c.id === channelId);
    if (channelIndex === -1) return;
    
    const channel = channels[channelIndex];
    const sameTypeChannels = channels.filter(c => c.type === channel.type).sort((a, b) => a.position - b.position);
    const indexInType = sameTypeChannels.findIndex(c => c.id === channelId);
    
    if (direction === "up" && indexInType === 0) return;
    if (direction === "down" && indexInType === sameTypeChannels.length - 1) return;
    
    const swapIndex = direction === "up" ? indexInType - 1 : indexInType + 1;
    const swapChannel = sameTypeChannels[swapIndex];
    
    // Swap positions
    const tempPos = channel.position;
    await supabase.from("channels").update({ position: swapChannel.position }).eq("id", channel.id);
    await supabase.from("channels").update({ position: tempPos }).eq("id", swapChannel.id);
    
    // Update local state
    setChannels(prev => prev.map(c => {
      if (c.id === channel.id) return { ...c, position: swapChannel.position };
      if (c.id === swapChannel.id) return { ...c, position: tempPos };
      return c;
    }));
  };

  if (!currentServerId) {
    const filteredConversations = conversations.filter(c => 
      c.otherUser?.username.toLowerCase().includes(conversationSearch.toLowerCase())
    );
    
    return (
      <div className="flex w-60 flex-shrink-0 flex-col bg-[#2b2d31]">
        <div className="flex h-12 items-center border-b border-[#1e1f22] px-4 shadow-sm">
          <input
            type="text"
            placeholder="Find or start a conversation"
            value={conversationSearch}
            onChange={(e) => setConversationSearch(e.target.value)}
            className="w-full rounded bg-[#1e1f22] px-2 py-1 text-sm text-[#dbdee1] placeholder-[#80848e] outline-none focus:outline-none"
          />
        </div>
        {loading ? (
          <div className="p-4">
            <div className="h-4 w-3/4 animate-pulse rounded bg-[#313338]" />
          </div>
        ) : filteredConversations.length > 0 ? (
          <div className="flex-1 overflow-y-auto py-2">
            {filteredConversations.map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => setConversation(c.id)}
                className={`flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-sm ${currentConversationId === c.id ? "bg-[#404249] text-white" : "text-gray-300 hover:bg-white/5 hover:text-gray-100"}`}
              >
                <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-[#5865f2] text-xs font-bold">
                  {(c.otherUser?.username ?? "?").slice(0, 1).toUpperCase()}
                </div>
                <span className="truncate">{c.otherUser?.username ?? "Unknown"}</span>
              </button>
            ))}
          </div>
        ) : conversationSearch ? (
          <div className="flex flex-col items-center justify-center gap-2 p-4 text-gray-400">
            <p className="text-sm">No conversations found</p>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center gap-2 p-4 text-gray-400">
            <p className="text-sm">No conversations yet</p>
            <p className="text-xs">Add friends to start chatting</p>
          </div>
        )}
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex w-60 flex-shrink-0 flex-col bg-[#2b2d31]">
        <div className="h-12 animate-pulse bg-[#313338]" />
        <div className="mt-2 h-4 w-3/4 animate-pulse rounded bg-[#313338]" />
        <div className="mt-2 h-4 w-1/2 animate-pulse rounded bg-[#313338]" />
      </div>
    );
  }

  const textChannels = channels.filter((c) => c.type === "text");
  const voiceChannels = channels.filter((c) => c.type === "voice");

  return (
    <div className="flex w-60 flex-shrink-0 flex-col bg-[#2b2d31]">
      <div className="flex h-12 items-center justify-between border-b border-[#1e1f22] px-4 shadow-sm">
        <h2 className="truncate text-base font-semibold text-white">{server?.name ?? "Server"}</h2>
        <div className="flex items-center gap-1">
          {server?.owner_id === userId && (
            <button
              type="button"
              onClick={() => window.location.href = `/server/${currentServerId}/settings`}
              className="rounded p-1 text-[#b5bac1] transition hover:bg-[#35373c] hover:text-[#dbdee1]"
              title="Server Settings"
            >
              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            </button>
          )}
          <button
            type="button"
            onClick={() => { setInviteOpen(true); setInviteLink(""); }}
            className="rounded p-1 text-[#b5bac1] transition hover:bg-[#35373c] hover:text-[#dbdee1]"
            title="Invite People"
          >
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
            </svg>
          </button>
        </div>
      </div>
      <div className="flex-1 overflow-y-auto py-2">
        {server?.owner_id === userId && (
          <div className="px-2">
            <button
              type="button"
              onClick={() => setCreateOpen(true)}
              className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-sm text-gray-400 transition hover:bg-white/5 hover:text-gray-200"
            >
              <span className="text-lg">+</span> Create Channel
            </button>
          </div>
        )}
        {textChannels.length > 0 && (
          <>
            <div className="mt-4 flex items-center justify-between px-2 py-1 text-xs font-semibold uppercase text-[#949ba4]">
              <span>Text Channels</span>
            </div>
            {textChannels.map((c, idx) => (
              <div
                key={c.id}
                className={`group mx-2 flex w-auto items-center gap-1 rounded px-2 py-1 text-left text-base ${currentChannelId === c.id ? "bg-[#404249] text-white" : "text-[#949ba4] hover:bg-[#35373c] hover:text-[#dbdee1]"}`}
              >
                <button
                  type="button"
                  onClick={() => setChannel(c.id)}
                  className="flex flex-1 items-center gap-2 min-w-0"
                >
                  <svg className="h-5 w-5 flex-shrink-0 text-[#80848e]" fill="currentColor" viewBox="0 0 24 24">
                    <path fillRule="evenodd" clipRule="evenodd" d="M5.88657 21C5.57547 21 5.3399 20.7189 5.39427 20.4126L6.00001 17H2.59511C2.28449 17 2.04905 16.7198 2.10259 16.4138L2.27759 15.4138C2.31946 15.1746 2.52722 15 2.77011 15H6.35001L7.41001 9H4.00511C3.69449 9 3.45905 8.71977 3.51259 8.41381L3.68759 7.41381C3.72946 7.17456 3.93722 7 4.18011 7H7.76001L8.39677 3.41262C8.43914 3.17391 8.64664 3 8.88907 3H9.87344C10.1845 3 10.4201 3.28107 10.3657 3.58738L9.76001 7H15.76L16.3968 3.41262C16.4391 3.17391 16.6466 3 16.8891 3H17.8734C18.1845 3 18.4201 3.28107 18.3657 3.58738L17.76 7H21.1649C21.4755 7 21.711 7.28023 21.6574 7.58619L21.4824 8.58619C21.4406 8.82544 21.2328 9 20.9899 9H17.41L16.35 15H19.7549C20.0655 15 20.301 15.2802 20.2474 15.5862L20.0724 16.5862C20.0306 16.8254 19.8228 17 19.5799 17H16L15.3632 20.5874C15.3209 20.8261 15.1134 21 14.8709 21H13.8866C13.5755 21 13.3399 20.7189 13.3943 20.4126L14 17H8.00001L7.36325 20.5874C7.32088 20.8261 7.11337 21 6.87094 21H5.88657ZM9.41045 9L8.35045 15H14.3504L15.4104 9H9.41045Z"/>
                  </svg>
                  <span className="truncate font-medium">{c.name}</span>
                </button>
                {server?.owner_id === userId && (
                  <div className="hidden group-hover:flex items-center gap-0.5">
                    <button
                      type="button"
                      onClick={() => moveChannel(c.id, "up")}
                      disabled={idx === 0}
                      className="rounded p-0.5 text-gray-400 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed"
                      title="Move Up"
                    >
                      <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                      </svg>
                    </button>
                    <button
                      type="button"
                      onClick={() => moveChannel(c.id, "down")}
                      disabled={idx === textChannels.length - 1}
                      className="rounded p-0.5 text-gray-400 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed"
                      title="Move Down"
                    >
                      <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedChannel(c);
                        setChannelPermissionsOpen(true);
                      }}
                      className="rounded p-0.5 text-gray-400 hover:text-white"
                      title="Channel Permissions"
                    >
                      <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                      </svg>
                    </button>
                  </div>
                )}
              </div>
            ))}
          </>
        )}
        {voiceChannels.length > 0 && (
          <>
            <div className="mt-4 flex items-center justify-between px-2 text-xs font-semibold uppercase text-[#949ba4]">
              <span>Voice Channels</span>
            </div>
            {voiceChannels.map((c, idx) => {
              const members = voiceChannelMembers.get(c.id) || [];
              return (
                <div key={c.id}>
                  <div className="group flex w-full items-center gap-1 rounded px-2 py-1.5 text-left text-sm">
                    <button
                      type="button"
                      onClick={() => setChannel(c.id)}
                      className={`flex flex-1 items-center gap-2 min-w-0 ${currentChannelId === c.id ? "text-white" : "text-gray-300"}`}
                    >
                      <span>🔊</span>
                      <span className="truncate">{c.name}</span>
                    </button>
                    {server?.owner_id === userId && (
                      <div className="hidden group-hover:flex items-center gap-0.5">
                        <button
                          type="button"
                          onClick={() => moveChannel(c.id, "up")}
                          disabled={idx === 0}
                          className="rounded p-0.5 text-gray-400 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed"
                          title="Move Up"
                        >
                          <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                          </svg>
                        </button>
                        <button
                          type="button"
                          onClick={() => moveChannel(c.id, "down")}
                          disabled={idx === voiceChannels.length - 1}
                          className="rounded p-0.5 text-gray-400 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed"
                          title="Move Down"
                        >
                          <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                          </svg>
                        </button>
                      </div>
                    )}
                  </div>
                  {members.length > 0 && (
                    <div className="ml-6 space-y-1 py-1">
                      {members.map(member => (
                        <div key={member.id} className="flex items-center gap-2 px-2 py-1 text-xs text-gray-400">
                          <div className="h-2 w-2 rounded-full bg-green-500" />
                          <span>{member.username}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </>
        )}
      </div>
      {inviteOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="w-full max-w-sm rounded-lg bg-[#313338] p-4 shadow-xl">
            <h3 className="mb-3 font-semibold">Invite People</h3>
            {!inviteLink ? (
              <button
                type="button"
                onClick={handleGenerateInvite}
                disabled={inviteGenerating}
                className="w-full rounded bg-indigo-500 py-2 text-sm font-medium hover:bg-indigo-600 disabled:opacity-50"
              >
                {inviteGenerating ? "Generating..." : "Generate invite link"}
              </button>
            ) : (
              <>
                <p className="mb-2 text-xs text-gray-400">Link copied to clipboard</p>
                <input
                  type="text"
                  readOnly
                  value={inviteLink}
                  className="mb-3 w-full rounded bg-[#1e1f22] px-3 py-2 text-sm outline-none"
                />
                <button
                  type="button"
                  onClick={() => navigator.clipboard.writeText(inviteLink)}
                  className="mb-2 w-full rounded bg-indigo-500 py-2 text-sm font-medium hover:bg-indigo-600"
                >
                  Copy again
                </button>
              </>
            )}
            <button
              type="button"
              onClick={() => setInviteOpen(false)}
              className="mt-2 w-full rounded py-1.5 text-sm hover:bg-white/10"
            >
              Close
            </button>
          </div>
        </div>
      )}
      {createOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="w-full max-w-sm rounded-lg bg-[#313338] p-4 shadow-xl">
            <h3 className="mb-3 font-semibold">Create Channel</h3>
            <form onSubmit={handleCreateChannel}>
              <div className="mb-3 flex gap-2">
                <button
                  type="button"
                  onClick={() => setChannelType("text")}
                  className={`flex-1 rounded px-3 py-2 text-sm ${channelType === "text" ? "bg-indigo-500" : "bg-[#1e1f22] hover:bg-[#2b2d31]"}`}
                >
                  # Text
                </button>
                <button
                  type="button"
                  onClick={() => setChannelType("voice")}
                  className={`flex-1 rounded px-3 py-2 text-sm ${channelType === "voice" ? "bg-indigo-500" : "bg-[#1e1f22] hover:bg-[#2b2d31]"}`}
                >
                  🔊 Voice
                </button>
              </div>
              <input
                type="text"
                value={newChannelName}
                onChange={(e) => setNewChannelName(e.target.value)}
                placeholder="Channel name"
                className="mb-3 w-full rounded bg-[#1e1f22] px-3 py-2 text-sm outline-none ring-1 ring-[#1e1f22] focus:ring-indigo-500"
                autoFocus
              />
              <div className="flex justify-end gap-2">
                <button type="button" onClick={() => { setCreateOpen(false); setChannelType("text"); }} className="rounded px-3 py-1.5 text-sm hover:bg-white/10">
                  Cancel
                </button>
                <button type="submit" disabled={creating || !newChannelName.trim()} className="rounded bg-indigo-500 px-3 py-1.5 text-sm font-medium hover:bg-indigo-600 disabled:opacity-50">
                  Create
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {channelPermissionsOpen && selectedChannel && currentServerId && (
        <ChannelPermissionsModal
          channelId={selectedChannel.id}
          channelName={selectedChannel.name}
          serverId={currentServerId}
          onClose={() => {
            setChannelPermissionsOpen(false);
            setSelectedChannel(null);
          }}
        />
      )}
    </div>
  );
}
