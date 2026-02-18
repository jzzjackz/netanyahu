"use client";

import { useEffect, useState } from "react";
import { createSupabaseBrowserClient } from "../lib/supabaseClient";
import { useAppStore } from "../lib/store";
import type { Channel, Server, DirectConversation, Profile } from "../lib/types";

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

  if (!currentServerId) {
    return (
      <div className="flex w-60 flex-shrink-0 flex-col bg-[#2b2d31]">
        <div className="flex h-12 items-center border-b border-[#1e1f22] px-4 shadow-sm">
          <h2 className="font-semibold">Direct Messages</h2>
        </div>
        {loading ? (
          <div className="p-4">
            <div className="h-4 w-3/4 animate-pulse rounded bg-[#313338]" />
          </div>
        ) : conversations.length > 0 ? (
          <div className="flex-1 overflow-y-auto py-2">
            {conversations.map((c) => (
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
        <h2 className="truncate font-semibold">{server?.name ?? "Server"}</h2>
        <div className="flex items-center gap-1">
          {server?.owner_id === userId && (
            <button
              type="button"
              onClick={() => window.location.href = `/server/${currentServerId}/settings`}
              className="rounded p-1 text-gray-400 transition hover:bg-white/5 hover:text-white"
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
            className="rounded p-1 text-gray-400 transition hover:bg-white/5 hover:text-white"
            title="Invite People"
          >
            <span className="text-sm">🔗</span>
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
            <div className="mt-2 flex items-center gap-1 px-2 text-xs font-semibold uppercase text-gray-500">
              <span>#</span> Text
            </div>
            {textChannels.map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => setChannel(c.id)}
                className={`flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-sm ${currentChannelId === c.id ? "bg-[#404249] text-white" : "text-gray-300 hover:bg-white/5 hover:text-gray-100"}`}
              >
                <span className="text-gray-500">#</span>
                <span className="truncate">{c.name}</span>
              </button>
            ))}
          </>
        )}
        {voiceChannels.length > 0 && (
          <>
            <div className="mt-2 flex items-center gap-1 px-2 text-xs font-semibold uppercase text-gray-500">
              <span>🔊</span> Voice
            </div>
            {voiceChannels.map((c) => {
              const members = voiceChannelMembers.get(c.id) || [];
              return (
                <div key={c.id}>
                  <button
                    type="button"
                    onClick={() => setChannel(c.id)}
                    className={`flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-sm ${currentChannelId === c.id ? "bg-[#404249] text-white" : "text-gray-300 hover:bg-white/5 hover:text-gray-100"}`}
                  >
                    <span>🔊</span>
                    <span className="truncate">{c.name}</span>
                  </button>
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
    </div>
  );
}
