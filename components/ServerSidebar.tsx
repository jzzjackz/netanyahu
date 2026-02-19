"use client";

import { useEffect, useState } from "react";
import { createSupabaseBrowserClient } from "../lib/supabaseClient";
import { useAppStore } from "../lib/store";
import type { Server } from "../lib/types";

export default function ServerSidebar() {
  const supabase = createSupabaseBrowserClient();
  const { currentServerId, setServer } = useAppStore();
  const [servers, setServers] = useState<Server[]>([]);
  const [loading, setLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);
  const [newName, setNewName] = useState("");
  const [creating, setCreating] = useState(false);
  const [contextServer, setContextServer] = useState<Server | null>(null);
  const [contextPos, setContextPos] = useState({ x: 0, y: 0 });
  const [userId, setUserId] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => setUserId(user?.id ?? null));
  }, [supabase.auth]);

  useEffect(() => {
    const fetchServers = async () => {
      if (!userId) return;
      // Get servers where user is a member
      const { data: memberships } = await supabase
        .from("server_members")
        .select("server_id")
        .eq("user_id", userId);
      
      if (!memberships || memberships.length === 0) {
        setServers([]);
        setLoading(false);
        return;
      }
      
      const serverIds = memberships.map(m => m.server_id);
      const { data } = await supabase
        .from("servers")
        .select("*")
        .in("id", serverIds)
        .order("created_at", { ascending: true });
      
      setServers((data as Server[]) ?? []);
      setLoading(false);
    };
    fetchServers();
  }, [supabase, userId]);

  const handleCreateServer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim() || creating) return;
    setCreating(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      setCreating(false);
      return;
    }
    const { data: server, error: serverErr } = await supabase
      .from("servers")
      .insert({ owner_id: user.id, name: newName.trim() })
      .select("*")
      .single();
    if (serverErr || !server) {
      setCreating(false);
      return;
    }
    await supabase.from("server_members").insert({
      server_id: server.id,
      user_id: user.id,
      role: "owner",
    });
    setServers((prev) => [...prev, server as Server]);
    setServer(server.id);
    setNewName("");
    setCreateOpen(false);
    setCreating(false);
  };

  const handleDeleteServer = async (s: Server) => {
    if (!userId || s.owner_id !== userId) return;
    if (!confirm(`Delete server "${s.name}"? This cannot be undone.`)) return;
    await supabase.from("servers").delete().eq("id", s.id);
    setServers((prev) => prev.filter((x) => x.id !== s.id));
    if (currentServerId === s.id) setServer(null);
    setContextServer(null);
  };

  if (loading) {
    return (
      <div className="flex w-[72px] flex-col items-center gap-2 bg-[#1e1f22] py-3">
        <div className="h-12 w-12 animate-pulse rounded-2xl bg-[#313338]" />
      </div>
    );
  }

  return (
    <div className="flex w-[72px] flex-shrink-0 flex-col items-center gap-2 bg-[#1e1f22] py-3 scrollbar-thin overflow-y-auto">
      <button
        type="button"
        onClick={() => setServer(null)}
        className={`group relative flex h-12 w-12 items-center justify-center rounded-[24px] bg-[#313338] transition-all duration-200 hover:rounded-[16px] hover:bg-[#5865f2] ${!currentServerId ? "rounded-[16px] bg-[#5865f2]" : ""}`}
        title="Home"
      >
        <svg className="h-6 w-6 text-white" fill="currentColor" viewBox="0 0 24 24">
          <path d="M20.83 14.6c-.24 0-.45.12-.57.3L16.5 20.6V5.5c0-.28-.22-.5-.5-.5s-.5.22-.5.5v15.1l-3.76-5.7c-.12-.18-.33-.3-.57-.3-.17 0-.34.07-.46.2-.24.26-.22.66.04.89l4.5 6.5c.12.17.31.27.52.27h.06c.21-.02.4-.13.51-.3l4.5-6.5c.26-.23.28-.63.04-.89-.12-.13-.29-.2-.46-.2z"/>
          <path d="M9.76 3.41l-4.5 6.5c-.26.23-.28.63-.04.89.12.13.29.2.46.2.24 0 .45-.12.57-.3L10 4.4v15.1c0 .28.22.5.5.5s.5-.22.5-.5V4.4l3.76 5.7c.12.18.33.3.57.3.17 0 .34-.07.46-.2.24-.26.22-.66-.04-.89l-4.5-6.5c-.12-.17-.31-.27-.52-.27h-.06c-.21.02-.4.13-.51.3z"/>
        </svg>
        {!currentServerId && (
          <div className="absolute left-0 top-1/2 h-10 w-1 -translate-x-2 -translate-y-1/2 rounded-r bg-white" />
        )}
      </button>
      <button
        type="button"
        onClick={() => window.location.href = "/discover"}
        className="group relative flex h-12 w-12 items-center justify-center rounded-[24px] bg-[#313338] transition-all duration-200 hover:rounded-[16px] hover:bg-[#23a559]"
        title="Discover Servers"
      >
        <span className="text-xl">🔍</span>
      </button>
      <div className="my-1 h-[2px] w-8 rounded bg-[#35363c]" />
      {servers.map((s) => (
        <button
          key={s.id}
          type="button"
          onClick={() => setServer(s.id)}
          onContextMenu={(e) => {
            e.preventDefault();
            if (s.owner_id === userId) {
              setContextServer(s);
              setContextPos({ x: e.clientX, y: e.clientY });
            }
          }}
          className={`group relative flex h-12 w-12 items-center justify-center rounded-[24px] bg-[#313338] text-lg font-bold transition-all duration-200 hover:rounded-[16px] hover:bg-[#5865f2] ${currentServerId === s.id ? "rounded-[16px] bg-[#5865f2]" : ""}`}
          title={s.name}
        >
          {s.icon_url ? (
            <img src={s.icon_url} alt="" className="h-full w-full rounded-[24px] object-cover group-hover:rounded-[16px]" />
          ) : (
            (s.name[0] ?? "?").toUpperCase()
          )}
          {currentServerId === s.id && (
            <div className="absolute left-0 top-1/2 h-10 w-1 -translate-x-2 -translate-y-1/2 rounded-r bg-white" />
          )}
        </button>
      ))}
      <button
        type="button"
        onClick={() => setCreateOpen(true)}
        className="flex h-12 w-12 items-center justify-center rounded-[24px] bg-[#313338] text-xl transition-all duration-200 hover:rounded-[16px] hover:bg-[#23a559]"
        title="Add Server"
      >
        +
      </button>
      {contextServer && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setContextServer(null)} aria-hidden />
          <div
            className="fixed z-50 rounded bg-[#313338] py-1 shadow-xl"
            style={{ left: contextPos.x, top: contextPos.y }}
          >
          <button
            type="button"
            onClick={() => { handleDeleteServer(contextServer); setContextServer(null); }}
            className="w-full px-4 py-2 text-left text-sm text-red-400 hover:bg-white/10"
          >
            Delete Server
          </button>
          <button
            type="button"
            onClick={() => setContextServer(null)}
            className="w-full px-4 py-2 text-left text-sm hover:bg-white/10"
          >
            Cancel
          </button>
          </div>
        </>
      )}
      {createOpen && (
        <div className="fixed left-0 top-0 z-50 flex h-full w-full items-center justify-center bg-black/50">
          <div className="w-full max-w-sm rounded-lg bg-[#313338] p-4 shadow-xl">
            <h3 className="mb-3 font-semibold">Create Server</h3>
            <form onSubmit={handleCreateServer}>
              <input
                type="text"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="Server name"
                className="mb-3 w-full rounded bg-[#1e1f22] px-3 py-2 text-sm outline-none ring-1 ring-[#1e1f22] focus:ring-indigo-500"
                autoFocus
              />
              <div className="flex justify-end gap-2">
                <button type="button" onClick={() => setCreateOpen(false)} className="rounded px-3 py-1.5 text-sm hover:bg-white/10">
                  Cancel
                </button>
                <button type="submit" disabled={creating || !newName.trim()} className="rounded bg-indigo-500 px-3 py-1.5 text-sm font-medium hover:bg-indigo-600 disabled:opacity-50">
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
