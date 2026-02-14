"use client";

import { useEffect, useState } from "react";
import { createSupabaseBrowserClient } from "../lib/supabaseClient";
import { useAppStore } from "../lib/store";
import type { Channel, Server } from "../lib/types";

export default function ChannelSidebar() {
  const supabase = createSupabaseBrowserClient();
  const { currentServerId, currentChannelId, setChannel } = useAppStore();
  const [server, setServer] = useState<Server | null>(null);
  const [channels, setChannels] = useState<Channel[]>([]);
  const [loading, setLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);
  const [newChannelName, setNewChannelName] = useState("");
  const [creating, setCreating] = useState(false);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteLink, setInviteLink] = useState("");
  const [inviteGenerating, setInviteGenerating] = useState(false);

  useEffect(() => {
    if (!currentServerId) {
      setServer(null);
      setChannels([]);
      setLoading(false);
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
  }, [currentServerId, supabase]);

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
      .insert({ server_id: currentServerId, name: newChannelName.trim(), type: "text", position: maxPos + 1 })
      .select()
      .single();
    setCreating(false);
    if (error || !ch) return;
    setChannels((prev) => [...prev, ch as Channel]);
    setNewChannelName("");
    setCreateOpen(false);
    setChannel(ch.id);
  };

  if (!currentServerId) {
    return (
      <div className="flex w-60 flex-shrink-0 flex-col bg-[#2b2d31]">
        <div className="flex flex-col items-center justify-center gap-2 p-4 text-gray-400">
          <p className="text-sm">Select a server or create one</p>
        </div>
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
        <button
          type="button"
          onClick={() => { setInviteOpen(true); setInviteLink(""); }}
          className="rounded p-1 text-gray-400 transition hover:bg-white/5 hover:text-white"
          title="Invite People"
        >
          <span className="text-sm">🔗</span>
        </button>
      </div>
      <div className="flex-1 overflow-y-auto py-2">
        <div className="px-2">
          <button
            type="button"
            onClick={() => setCreateOpen(true)}
            className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-sm text-gray-400 transition hover:bg-white/5 hover:text-gray-200"
          >
            <span className="text-lg">+</span> Create Channel
          </button>
        </div>
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
            {voiceChannels.map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => setChannel(c.id)}
                className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-sm text-gray-300 hover:bg-white/5 hover:text-gray-100"
              >
                <span>🔊</span>
                <span className="truncate">{c.name}</span>
              </button>
            ))}
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
              <input
                type="text"
                value={newChannelName}
                onChange={(e) => setNewChannelName(e.target.value)}
                placeholder="Channel name"
                className="mb-3 w-full rounded bg-[#1e1f22] px-3 py-2 text-sm outline-none ring-1 ring-[#1e1f22] focus:ring-indigo-500"
                autoFocus
              />
              <div className="flex justify-end gap-2">
                <button type="button" onClick={() => setCreateOpen(false)} className="rounded px-3 py-1.5 text-sm hover:bg-white/10">
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
